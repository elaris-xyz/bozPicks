/**
 * Momentum model: base pressure leans toward whoever holds the ball / carries
 * the threat, event spikes point at the attacking side, and a red card swings
 * momentum to the opponent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePressure, eventImpulse, addImpulse, tickMomentum } from './momentum';
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

test('addImpulse raises the target on a goal and tags the side', () => {
  const home = addImpulse(0, { type: 'GOAL', matchMinute: 22, team: 'Brazil' } as BozEvent, 'Brazil');
  assert.ok(home.target > 3 && home.target <= 10);
  assert.equal(home.goal, 'home');
  assert.equal(addImpulse(0, { type: 'GOAL', matchMinute: 9, team: 'Argentina' } as BozEvent, 'Brazil').goal, 'away');
});

test('displayed value eases toward the target (smooth rise), then decays to baseline', () => {
  let s = { target: addImpulse(0, { type: 'GOAL', matchMinute: 5, team: 'Argentina' } as BozEvent, 'Brazil').target, m: 0 };
  // eases in — the very first tick is only partway to the target (rounded rise)
  const first = tickMomentum(s, stats({ possession: 50 }));
  assert.ok(first.m < 0 && first.m > s.target);   // moved toward, not all the way
  s = first;
  for (let i = 0; i < 40; i++) s = tickMomentum(s, stats({ possession: 50 }));
  assert.ok(Math.abs(s.m) < 1);                    // settles back near the centre line
});
