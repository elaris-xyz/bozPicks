/**
 * Momentum model: base pressure leans toward whoever holds the ball / carries
 * the threat, event spikes point at the attacking side, and a red card swings
 * momentum to the opponent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePressure, eventImpulse, stepMomentum, relaxMomentum } from './momentum';
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

test('stepMomentum spikes on a goal and tags the side', () => {
  const e = { type: 'GOAL', matchMinute: 22, team: 'Brazil' } as BozEvent;
  const { m, goal } = stepMomentum(0, e, 'Brazil');
  assert.ok(m > 3 && m <= 10);         // a home goal drives momentum well up
  assert.equal(goal, 'home');
  assert.equal(stepMomentum(0, { type: 'GOAL', matchMinute: 9, team: 'Argentina' } as BozEvent, 'Brazil').goal, 'away');
});

test('momentum decays back toward the baseline between events (crosses zero)', () => {
  // a big away spike, then relax with neutral possession → returns toward 0
  let m = stepMomentum(0, { type: 'GOAL', matchMinute: 5, team: 'Argentina' } as BozEvent, 'Brazil').m;
  assert.ok(m < -3);
  for (let i = 0; i < 30; i++) m = relaxMomentum(m, stats({ possession: 50 }));
  assert.ok(Math.abs(m) < 1);          // settled back near the centre line
});
