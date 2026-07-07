/**
 * TxLINE Stats-key legend tests. Locks in the team-confirmed mapping (base keys
 * 1-8 + period prefixes) so our validate_stat settlement proves the RIGHT stat
 * — e.g. the old 1002 constant was H1 participant-2 goals, not the final total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statKey, decodeStatKey, FINAL_GOAL_STAT_KEYS, FINAL_ACTION } from '@bozpicks/txline-client';

test('base keys map to goals/cards/corners for both participants', () => {
  assert.equal(statKey('GOALS', 1), 1);
  assert.equal(statKey('GOALS', 2), 2);
  assert.equal(statKey('YELLOW', 1), 3);
  assert.equal(statKey('YELLOW', 2), 4);
  assert.equal(statKey('RED', 1), 5);
  assert.equal(statKey('RED', 2), 6);
  assert.equal(statKey('CORNERS', 1), 7);
  assert.equal(statKey('CORNERS', 2), 8);
});

test('period prefixes compose correctly — 7008 = P2 corners in ETTotal', () => {
  assert.equal(statKey('CORNERS', 2, 'ETTOTAL'), 7008);
  assert.equal(statKey('GOALS', 2, 'H1'), 1002); // the old (wrong-for-final) value
  assert.equal(statKey('GOALS', 1, 'H2'), 3001);
});

test('decodeStatKey is the inverse of statKey', () => {
  assert.deepEqual(decodeStatKey(7008), { period: 'ETTOTAL', base: 'CORNERS', participant: 2 });
  assert.deepEqual(decodeStatKey(1002), { period: 'H1', base: 'GOALS', participant: 2 });
  assert.deepEqual(decodeStatKey(1), { period: 'TOTAL', base: 'GOALS', participant: 1 });
  assert.equal(decodeStatKey(9999), null); // unknown prefix
});

test('final-result constants follow TxLINE settlement guidance', () => {
  assert.deepEqual(FINAL_GOAL_STAT_KEYS, [1, 2]); // total goals, both participants
  assert.equal(FINAL_ACTION, 'game_finalised');
});
