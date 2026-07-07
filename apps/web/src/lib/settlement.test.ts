/**
 * Deterministic settlement tests. A judge can run `pnpm --filter=web test` and
 * confirm that every Command-Bridge scenario resolves ALL six prop markets to
 * the correct outcome, and that the parimutuel payout math conserves the pool.
 *
 * No mocks, no network: the exact same pure functions the demo + keeper use
 * (generateMatchReplay → resolveMarket → payoutFor) are exercised end-to-end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketsForMatch, resolveMarket, payoutFor, poolOdds, impliedFromPool } from './markets';
import { generateMatchReplay } from './replay';
import { SCENARIO_LIST, SCENARIOS } from './scenarios';

const HOME = 'Brazil';
const AWAY = 'Argentina';

/** The outcome each of the 6 markets must resolve to, per scenario key. */
const EXPECTED: Record<string, Record<string, string>> = {
  'home-win':     { MATCH_WINNER: 'HOME', TOTAL_GOALS: 'OVER',  TOTAL_CORNERS: 'UNDER', TOTAL_CARDS: 'UNDER', BTTS: 'YES', FIRST_SCORER: 'AWAY' },
  'away-win':     { MATCH_WINNER: 'AWAY', TOTAL_GOALS: 'UNDER', TOTAL_CORNERS: 'UNDER', TOTAL_CARDS: 'UNDER', BTTS: 'NO',  FIRST_SCORER: 'AWAY' },
  'draw':         { MATCH_WINNER: 'DRAW', TOTAL_GOALS: 'UNDER', TOTAL_CORNERS: 'UNDER', TOTAL_CARDS: 'UNDER', BTTS: 'YES', FIRST_SCORER: 'HOME' },
  'goal-fest':    { MATCH_WINNER: 'DRAW', TOTAL_GOALS: 'OVER',  TOTAL_CORNERS: 'OVER',  TOTAL_CARDS: 'UNDER', BTTS: 'YES', FIRST_SCORER: 'HOME' },
  'high-corners': { MATCH_WINNER: 'HOME', TOTAL_GOALS: 'UNDER', TOTAL_CORNERS: 'OVER',  TOTAL_CARDS: 'OVER',  BTTS: 'NO',  FIRST_SCORER: 'HOME' },
  'clean-sheet':  { MATCH_WINNER: 'HOME', TOTAL_GOALS: 'UNDER', TOTAL_CORNERS: 'OVER',  TOTAL_CARDS: 'UNDER', BTTS: 'NO',  FIRST_SCORER: 'HOME' },
};

for (const s of SCENARIO_LIST) {
  test(`scenario "${s.key}" → replay produces the declared final stats`, () => {
    const { final } = generateMatchReplay('m1', HOME, AWAY, { scenario: s });
    assert.equal(final.homeScore, s.homeGoals, 'home score');
    assert.equal(final.awayScore, s.awayGoals, 'away score');
    assert.equal(final.totalGoals, s.homeGoals + s.awayGoals, 'total goals');
    assert.equal(final.totalCorners, s.cornersHome + s.cornersAway, 'total corners');
    assert.equal(final.totalCards, s.yellowHome + s.yellowAway + s.redAway, 'total cards');
    assert.equal(final.btts, s.homeGoals > 0 && s.awayGoals > 0, 'btts');
    assert.equal(final.firstScorer, s.firstScorer, 'first scorer');
  });

  test(`scenario "${s.key}" → all 6 markets resolve to the expected outcome`, () => {
    const { final } = generateMatchReplay('m1', HOME, AWAY, { scenario: s });
    const markets = buildMarketsForMatch('m1', HOME, AWAY, 'EscrowPda11111111111111111111111111111111');
    assert.equal(markets.length, 6, 'six markets');
    for (const m of markets) {
      const { winningOutcome } = resolveMarket(m, final);
      assert.equal(winningOutcome, EXPECTED[s.key][m.kind], `${s.key} · ${m.kind}`);
      assert.ok(m.outcomes.includes(winningOutcome), 'winner is a valid outcome');
    }
  });
}

test('replay is deterministic — identical input yields identical final stats', () => {
  const a = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['goal-fest'] }).final;
  const b = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['goal-fest'] }).final;
  assert.deepEqual(a, b);
});

test('replay events are chronologically ordered and bracketed by START/END', () => {
  const { steps } = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['home-win'] });
  assert.equal(steps[0].event.type, 'MATCH_START');
  assert.equal(steps[steps.length - 1].event.type, 'MATCH_END');
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i].event.matchMinute >= steps[i - 1].event.matchMinute, `ordered at ${i}`);
    assert.ok(steps[i].delayMs >= steps[i - 1].delayMs, `delays monotonic at ${i}`);
  }
});

test('payoutFor: winners split the whole pool minus fee, pro-rata', () => {
  // pool: HOME 10u wins, AWAY 20u loses → total 30u, fee 2%
  const total = 30, fee = 200, winPool = 10;
  const payout = payoutFor(5, winPool, total, fee);
  // 5/10 of (30 * 0.98) = 0.5 * 29.4 = 14.7 → floor 14
  assert.equal(payout, 14);
});

test('payoutFor: sum of winner payouts never exceeds the pool (no minting)', () => {
  const total = 100, fee = 200, winPool = 40; // three winners staking 10/10/20
  const stakes = [10, 10, 20];
  const paid = stakes.reduce((s, st) => s + payoutFor(st, winPool, total, fee), 0);
  assert.ok(paid <= total, `paid ${paid} <= ${total}`);
  assert.ok(paid >= total * 0.97, 'and pays out ~all of it after fee'); // rounding-tolerant
});

test('payoutFor: sole backer of the winning side is refunded their stake', () => {
  assert.equal(payoutFor(5, 0, 5, 200), 5);
});

test('poolOdds + impliedFromPool are consistent with the pool split', () => {
  const [m] = buildMarketsForMatch('m1', HOME, AWAY, 'pda');
  const staked = { ...m, pools: { HOME: 30, DRAW: 10, AWAY: 10 }, totalPool: 50 };
  assert.equal(impliedFromPool(staked, 'HOME'), 0.6);
  // odds = (total * 0.98) / outcomePool = 49 / 30
  assert.ok(Math.abs(poolOdds(staked, 'HOME') - 49 / 30) < 1e-9);
  // empty pool → uniform implied prob
  assert.equal(impliedFromPool(m, 'HOME'), 1 / 3);
});
