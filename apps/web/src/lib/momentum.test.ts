/**
 * Momentum model: base pressure leans toward whoever holds the ball / carries
 * the threat, event spikes point at the attacking side, and a red card swings
 * momentum to the opponent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePressure, eventImpulse, foldMomentum } from './momentum';
import type { BozEvent, MatchStats } from '@bozpicks/shared';

const stats = (o: Partial<MatchStats>): MatchStats => ({
  possession: 50, cornersHome: 0, cornersAway: 0, yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0, ...o,
}) as MatchStats;

test('basePressure leans home when home holds possession + threat', () => {
  assert.ok(basePressure(stats({ possession: 68 })) > 0);
  assert.ok(basePressure(stats({ possession: 32 })) < 0);
  assert.ok(basePressure(stats({ possession: 50, danger: { home: 'HIGH_DANGER', away: 'SAFE' } })) > 2);
});

test('event impulse points at the attacking side', () => {
  const goal = { type: 'GOAL', matchMinute: 10 } as BozEvent;
  assert.ok(eventImpulse(goal, true) > 5);   // home goal → strong up
  assert.ok(eventImpulse(goal, false) < -5); // away goal → strong down
  // red card weakens the carded team → opponent gains
  const red = { type: 'RED_CARD', matchMinute: 55 } as BozEvent;
  assert.ok(eventImpulse(red, true) < 0);    // home carded → momentum to away
  assert.ok(eventImpulse(red, false) > 0);
});

test('foldMomentum updates the baseline from stats and clamps', () => {
  const e = { type: 'GOAL', matchMinute: 22, team: 'Brazil', stats: stats({ possession: 60 }) } as BozEvent;
  const { base, point } = foldMomentum(0, e, 'Brazil');
  assert.ok(base > 0);                 // possession 60 → home baseline up
  assert.equal(point.goal, 'home');
  assert.ok(point.v > 0 && point.v <= 10);
});
