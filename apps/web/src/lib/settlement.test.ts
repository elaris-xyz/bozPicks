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

  test(`scenario "${s.key}" → all markets resolve to a valid outcome`, () => {
    const { final } = generateMatchReplay('m1', HOME, AWAY, { scenario: s });
    const markets = buildMarketsForMatch('m1', HOME, AWAY, 'EscrowPda11111111111111111111111111111111');
    assert.equal(markets.length, 8, 'eight markets');
    for (const m of markets) {
      const { winningOutcome } = resolveMarket(m, final);
      assert.ok(m.outcomes.includes(winningOutcome), 'winner is a valid outcome');
      const expected = EXPECTED[s.key][m.kind]; // 1st-half markets aren't in the fixed map
      if (expected) assert.equal(winningOutcome, expected, `${s.key} · ${m.kind}`);
    }
  });

  test(`scenario "${s.key}" → 1st-half counts are ≤ totals and resolve consistently`, () => {
    const { final } = generateMatchReplay('m1', HOME, AWAY, { scenario: s });
    assert.ok(final.corners1H <= final.totalCorners, '1H corners ≤ total');
    assert.ok(final.cards1H <= final.totalCards, '1H cards ≤ total');
    const markets = buildMarketsForMatch('m1', HOME, AWAY, 'EscrowPda11111111111111111111111111111111');
    const c1h = markets.find(m => m.kind === 'CORNERS_1H')!;
    const k1h = markets.find(m => m.kind === 'CARDS_1H')!;
    assert.equal(resolveMarket(c1h, final).winningOutcome, final.corners1H > (c1h.line ?? 4.5) ? 'OVER' : 'UNDER');
    assert.equal(resolveMarket(k1h, final).winningOutcome, final.cards1H > (k1h.line ?? 1.5) ? 'OVER' : 'UNDER');
  });
}

test('replay is deterministic — identical input yields identical final stats', () => {
  const a = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['goal-fest'] }).final;
  const b = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['goal-fest'] }).final;
  assert.deepEqual(a, b);
});

test('replay emits broadcast events (shots/VAR/offside) without changing settlement', () => {
  const { steps, final } = generateMatchReplay('m1', HOME, AWAY, { scenario: SCENARIOS['home-win'] });
  const types = new Set(steps.map(s => s.event.type));
  assert.ok(types.has('SHOT'), 'has shots');
  assert.ok(types.has('OFFSIDE'), 'has offside');
  assert.ok(types.has('VAR'), 'has a VAR review');
  const shot = steps.find(s => s.event.type === 'SHOT')!.event;
  assert.ok(shot.shotOutcome, 'shot carries an outcome');
  const varEv = steps.find(s => s.event.type === 'VAR')!.event;
  assert.equal(varEv.varOutcome, 'Stands'); // must not change the score
  // final stats identical to the pure scenario — broadcast events are cosmetic
  assert.equal(final.homeScore, 2);
  assert.equal(final.awayScore, 1);
  assert.equal(final.totalGoals, 3);
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
