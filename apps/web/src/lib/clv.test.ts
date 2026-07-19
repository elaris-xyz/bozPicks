/**
 * Closing-Line-Value backtesting tests. Locks the CLV math and the aggregate
 * report an agent's edge is judged on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  impliedProb, clvPct, beatClose, edgeVsClose, devigTwoWay, backtestClv,
} from './clv';

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('impliedProb inverts decimal odds', () => {
  approx(impliedProb(2), 0.5);
  approx(impliedProb(4), 0.25);
});

test('clvPct is positive when the entry price beats the close', () => {
  approx(clvPct(2.1, 2.0), 0.05);
  approx(clvPct(1.9, 2.0), -0.05);
  approx(clvPct(2.0, 2.0), 0);
});

test('beatClose compares entry vs closing odds', () => {
  assert.equal(beatClose(2.1, 2.0), true);
  assert.equal(beatClose(1.9, 2.0), false);
  assert.equal(beatClose(2.0, 2.0), false);
});

test('edgeVsClose is EV per unit stake against the closing price', () => {
  approx(edgeVsClose(2.1, 2.0), 0.05); // 0.5 * 2.1 - 1
  approx(edgeVsClose(1.9, 2.0), -0.05);
});

test('devigTwoWay removes the margin symmetrically', () => {
  const [a, b] = devigTwoWay(1.9, 1.9);
  approx(a, 2.0);
  approx(b, 2.0);
  // asymmetric market stays ordered: the favorite keeps shorter fair odds
  const [fav, dog] = devigTwoWay(1.5, 2.5);
  assert.ok(fav < dog);
});

test('backtestClv aggregates a mixed book stake-weighted', () => {
  const r = backtestClv([
    { entryOdds: 2.1, closingOdds: 2.0, stake: 100, won: true },
    { entryOdds: 1.9, closingOdds: 2.0, stake: 100, won: false },
  ]);
  assert.equal(r.bets, 2);
  assert.equal(r.skipped, 0);
  assert.equal(r.totalStake, 200);
  assert.equal(r.beatCloseCount, 1);
  approx(r.beatCloseRate, 0.5);
  approx(r.avgClvPct, 0);       // +5% and -5% at equal stake
  approx(r.expectedRoi, 0);
  // realized: win 100*(1.1)=110, loss -100 → +10 on 200 staked = 5%
  approx(r.realizedRoi as number, 0.05);
});

test('backtestClv leaves realizedRoi null when a bet is unsettled', () => {
  const r = backtestClv([
    { entryOdds: 2.1, closingOdds: 2.0, stake: 100, won: true },
    { entryOdds: 1.9, closingOdds: 2.0, stake: 100 }, // no result yet
  ]);
  assert.equal(r.realizedRoi, null);
});

test('backtestClv skips invalid odds and stakes', () => {
  const r = backtestClv([
    { entryOdds: 2.0, closingOdds: 2.0, stake: 100 },
    { entryOdds: 1.0, closingOdds: 2.0, stake: 100 },  // odds <= 1
    { entryOdds: 2.0, closingOdds: NaN, stake: 100 },  // NaN
    { entryOdds: 2.0, closingOdds: 2.0, stake: 0 },    // no stake
  ]);
  assert.equal(r.bets, 1);
  assert.equal(r.skipped, 3);
  assert.equal(r.totalStake, 100);
});

test('backtestClv is empty-safe', () => {
  const r = backtestClv([]);
  assert.equal(r.bets, 0);
  assert.equal(r.beatCloseRate, 0);
  assert.equal(r.avgClvPct, 0);
  assert.equal(r.realizedRoi, null);
});
