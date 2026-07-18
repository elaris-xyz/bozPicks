import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roi, maxDrawdown, initAgent, type AgentState, type SettledBet } from '@bozpicks/shared';

const bet = (stake: number, pnl: number, won: boolean): SettledBet => ({
  outcome: 'HOME', oddsTaken: 2, stake, won, pnl, clvPct: 0,
});

function agentWith(settled: SettledBet[]): AgentState {
  const realizedPnl = settled.reduce((s, b) => s + b.pnl, 0);
  return { ...initAgent('MOMENTUM'), settled, realizedPnl };
}

test('roi is realized P&L over total staked', () => {
  const a = agentWith([bet(10, 10, true), bet(10, -10, false), bet(10, 12, true)]);
  // pnl = 12, staked = 30 → 40%
  assert.ok(Math.abs(roi(a) - 40) < 1e-9);
});

test('roi is 0 with no settled bets (no divide-by-zero)', () => {
  assert.equal(roi(initAgent('CONTRARIAN')), 0);
});

test('maxDrawdown finds the largest peak-to-trough drop and is <= 0', () => {
  // peak 10 → trough 3 = -7 drop, then recovers
  assert.equal(maxDrawdown([0, 4, 10, 6, 3, 8, 12]), -7);
});

test('maxDrawdown is 0 for a monotonically rising curve', () => {
  assert.equal(maxDrawdown([0, 1, 2, 3, 5]), 0);
});

test('maxDrawdown handles empty + single point', () => {
  assert.equal(maxDrawdown([]), 0);
  assert.equal(maxDrawdown([5]), 0);
});
