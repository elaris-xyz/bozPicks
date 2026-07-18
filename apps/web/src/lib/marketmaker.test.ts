import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initMM, mmStep, mmPnl, mmExposure, mmSpreadPct, DEFAULT_MM,
  type OddsSnapshot,
} from '@bozpicks/shared';

// build an in-play OddsSnapshot from implied probabilities (must sum ~1)
function odds(h: number, d: number, a: number, tMs = 0): OddsSnapshot {
  return {
    timestamp: new Date(1_700_000_000_000 + tMs).toISOString(),
    homeWin: 1 / h, draw: 1 / d, awayWin: 1 / a,
    impliedProb: { home: h, draw: d, away: a },
    inRunning: true,
  };
}

test('initMM starts flat with no quotes and zero P&L', () => {
  const s = initMM();
  assert.equal(s.inventory.HOME, 0);
  assert.equal(s.inventory.DRAW, 0);
  assert.equal(s.inventory.AWAY, 0);
  assert.equal(s.fills, 0);
  assert.equal(s.quotes, null);
  assert.equal(mmPnl(s, odds(0.4, 0.3, 0.3)), 0);
});

test('first tick quotes a two-sided market with bid < fair < ask, no fills', () => {
  const s = mmStep(initMM(), odds(0.45, 0.30, 0.25));
  assert.ok(s.quotes);
  for (const q of s.quotes!) {
    assert.ok(q.bid < q.fair, `${q.outcome} bid < fair`);
    assert.ok(q.ask > q.fair, `${q.outcome} ask > fair`);
    assert.ok(q.bid >= 0.01 && q.ask <= 0.99, 'quotes clamped to valid prob');
  }
  assert.equal(s.fills, 0);
  assert.equal(mmPnl(s, odds(0.45, 0.30, 0.25)), 0);
});

test('half-spread widens with realised volatility', () => {
  // stable market → spread near the floor
  let calm = initMM();
  for (let i = 0; i < 6; i++) calm = mmStep(calm, odds(0.40, 0.30, 0.30, i * 1000));

  // choppy market → spread wider
  let choppy = initMM();
  const seq: [number, number, number][] = [
    [0.40, 0.30, 0.30], [0.52, 0.24, 0.24], [0.36, 0.32, 0.32], [0.55, 0.22, 0.23], [0.38, 0.31, 0.31], [0.50, 0.25, 0.25],
  ];
  seq.forEach((p, i) => { choppy = mmStep(choppy, odds(p[0], p[1], p[2], i * 1000)); });

  assert.ok(choppy.halfSpread > calm.halfSpread, 'volatile book quotes a wider spread');
  assert.ok(mmSpreadPct(choppy) > mmSpreadPct(calm));
});

test('a taker lifting the offer as fair rises leaves the maker short + banks edge', () => {
  let s = mmStep(initMM(), odds(0.40, 0.30, 0.30, 0));
  const askHome = s.quotes!.find(q => q.outcome === 'HOME')!.ask;
  // HOME fair jumps clean through our ask
  s = mmStep(s, odds(askHome + 0.05, (1 - (askHome + 0.05)) / 2, (1 - (askHome + 0.05)) / 2, 1000));
  assert.ok(s.inventory.HOME < 0, 'sold into the rise → short HOME');
  assert.ok(s.fills >= 1, 'at least one fill booked');
  assert.ok(s.edgeCaptured > 0, 'captured the half-spread on the fill');
  assert.ok(s.volume >= DEFAULT_MM.size);
});

test('inventory skews quotes to mean-revert exposure toward flat', () => {
  // drive repeated BUY fills on DRAW by walking its fair down through our bid
  let s = mmStep(initMM(), odds(0.30, 0.40, 0.30, 0));
  for (let i = 1; i <= 4; i++) {
    const bidDraw = s.quotes!.find(q => q.outcome === 'DRAW')!.bid;
    const d = Math.max(0.05, bidDraw - 0.04);
    s = mmStep(s, odds((1 - d) / 2, d, (1 - d) / 2, i * 1000));
  }
  assert.ok(s.inventory.DRAW > 0, 'accumulated a long DRAW book');
  const q = s.quotes!.find(x => x.outcome === 'DRAW')!;
  // long inventory shifts BOTH quotes down: ask sits below the un-skewed fair+halfSpread
  assert.ok(q.ask < q.fair + s.halfSpread, 'long book skews the offer down to sell off');
  assert.ok(mmExposure(s) >= s.inventory.DRAW);
});

test('P&L is mark-to-market: cash + inventory valued at current fair', () => {
  let s = mmStep(initMM(), odds(0.40, 0.30, 0.30, 0));
  s = mmStep(s, odds(0.52, 0.24, 0.24, 1000)); // some fills happen
  const mark = odds(0.50, 0.25, 0.25, 2000);
  let expected = s.cash;
  for (const o of ['HOME', 'DRAW', 'AWAY'] as const) expected += s.inventory[o] * mark.impliedProb[o === 'HOME' ? 'home' : o === 'DRAW' ? 'draw' : 'away'];
  assert.ok(Math.abs(mmPnl(s, mark) - expected) < 1e-9);
});

test('deterministic: identical tick sequences produce identical state', () => {
  const run = () => {
    let s = initMM();
    const seq: [number, number, number][] = [[0.4, 0.3, 0.3], [0.5, 0.25, 0.25], [0.35, 0.33, 0.32], [0.6, 0.2, 0.2]];
    seq.forEach((p, i) => { s = mmStep(s, odds(p[0], p[1], p[2], i * 1000)); });
    return s;
  };
  assert.deepEqual(run(), run());
});
