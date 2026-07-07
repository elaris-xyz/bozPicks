/**
 * Hi-Lo reading tests: prove the game always has a real, bidirectional value to
 * play on — from TxLINE possession when present, else a danger/corner pressure
 * proxy — and that it never leaks a monotonic (always-up) counter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MatchStats } from '@bozpicks/shared';
import { hiloReading, clampReading, isPossession } from './hilo';

const base: MatchStats = {
  cornersHome: 0, cornersAway: 0, yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0,
};

test('uses raw possession when TxLINE provides it', () => {
  assert.equal(hiloReading({ ...base, possession: 62 }), 62);
  assert.equal(isPossession({ ...base, possession: 62 }), true);
});

test('returns null before there is anything to read', () => {
  assert.equal(hiloReading(undefined), null);
  assert.equal(hiloReading(base), null); // no possession, no danger, no corners
  assert.equal(isPossession(base), false);
});

test('falls back to a danger-driven pressure reading that swings both ways', () => {
  const homePress = hiloReading({ ...base, danger: { home: 'HIGH_DANGER', away: 'SAFE' } });
  const awayPress = hiloReading({ ...base, danger: { home: 'SAFE', away: 'HIGH_DANGER' } });
  assert.ok(homePress! > 50, `home pressure ${homePress} > 50`);
  assert.ok(awayPress! < 50, `away pressure ${awayPress} < 50`);
  // symmetric around 50
  assert.equal(homePress! - 50, 50 - awayPress!);
});

test('corner share nudges the reading when danger is level', () => {
  const level = hiloReading({ ...base, danger: { home: 'ATTACK', away: 'ATTACK' }, cornersHome: 8, cornersAway: 2 });
  assert.ok(level! > 50, `more home corners → ${level} > 50`);
});

test('readings are always clamped to the 25–75 band', () => {
  const extreme = hiloReading({ ...base, possession: 200 });
  assert.equal(extreme, 75);
  assert.equal(clampReading(-30), 25);
  assert.equal(clampReading(999), 75);
  // even a maxed-out pressure proxy stays in band
  const maxed = hiloReading({ ...base, danger: { home: 'HIGH_DANGER', away: 'SAFE' }, cornersHome: 20, cornersAway: 0 });
  assert.ok(maxed! <= 75 && maxed! >= 25);
});
