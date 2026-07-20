/**
 * statDeltaEvents — the timeline's corner/card pips are derived from increments
 * of the cumulative Stats map, not from TxLINE's sparse discrete action records.
 * These lock that the derived events match the totals, land on the right side,
 * and never double-fire or go negative.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TxScores } from '@bozpicks/txline-client';
import { statDeltaEvents, type SideCounts } from './normalizer';

const NAMES = { home: 'Spain', away: 'Argentina' };

// Build a PascalCase TxLINE score record. Stats keys: 1/2 goals, 3/4 yellow,
// 5/6 red, 7/8 corners (participant 1/2).
function rec(o: {
  seq?: number; clockMin?: number; action?: string; p1Home?: boolean; playerId?: number;
  g1?: number; g2?: number; y1?: number; y2?: number; r1?: number; r2?: number; c1?: number; c2?: number;
}): TxScores {
  return {
    FixtureId: 999,
    Participant1IsHome: o.p1Home ?? true,
    Action: o.action ?? 'update',
    Clock: { Seconds: (o.clockMin ?? 0) * 60 },
    Stats: {
      '1': o.g1 ?? 0, '2': o.g2 ?? 0, '3': o.y1 ?? 0, '4': o.y2 ?? 0,
      '5': o.r1 ?? 0, '6': o.r2 ?? 0, '7': o.c1 ?? 0, '8': o.c2 ?? 0,
    },
    Data: o.playerId ? { PlayerId: o.playerId } : undefined,
    Ts: 1_700_000_000 + (o.seq ?? 0),
    Seq: o.seq ?? 0,
  } as unknown as TxScores;
}

test('baseline (no prev) seeds counts and emits nothing', () => {
  const { events, counts } = statDeltaEvents(undefined, rec({ c1: 3, c2: 1 }), NAMES);
  assert.equal(events.length, 0);
  assert.deepEqual(counts, { cH: 3, cA: 1, yH: 0, yA: 0, rH: 0, rA: 0 });
});

test('a single corner increment emits one CORNER for the right side + minute', () => {
  const prev: SideCounts = { cH: 6, cA: 2, yH: 0, yA: 0, rH: 0, rA: 0 };
  const { events } = statDeltaEvents(prev, rec({ clockMin: 30, c1: 7, c2: 2 }), NAMES);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'CORNER');
  assert.equal(events[0].team, 'Spain');
  assert.equal(events[0].matchMinute, 30);
});

test('a jump of several corners emits that many events (fills ingest gaps)', () => {
  const prev: SideCounts = { cH: 5, cA: 0, yH: 0, yA: 0, rH: 0, rA: 0 };
  const { events } = statDeltaEvents(prev, rec({ c1: 8, c2: 0 }), NAMES);
  assert.equal(events.filter(e => e.type === 'CORNER').length, 3);
});

test('a yellow on the card action carries the booked player', () => {
  const players = new Map([[42, { name: 'Messi', number: '10' }]]);
  const prev: SideCounts = { cH: 0, cA: 0, yH: 0, yA: 0, rH: 0, rA: 0 };
  // participant 2 (away) booked
  const { events } = statDeltaEvents(prev, rec({ action: 'yellow_card', playerId: 42, y2: 1 }), NAMES, players);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'YELLOW_CARD');
  assert.equal(events[0].team, 'Argentina');
  assert.equal(events[0].player, 'Messi · #10');
});

test('a stat catch-up on a non-card record has no player name', () => {
  const prev: SideCounts = { cH: 0, cA: 0, yH: 0, yA: 0, rH: 0, rA: 0 };
  const { events } = statDeltaEvents(prev, rec({ action: 'update', y1: 1 }), NAMES);
  assert.equal(events[0].type, 'YELLOW_CARD');
  assert.equal(events[0].player, undefined);
});

test('no change emits nothing', () => {
  const prev: SideCounts = { cH: 4, cA: 4, yH: 1, yA: 1, rH: 0, rA: 0 };
  const { events } = statDeltaEvents(prev, rec({ c1: 4, c2: 4, y1: 1, y2: 1 }), NAMES);
  assert.equal(events.length, 0);
});

test('a decrement (VAR rescind) never emits a negative/phantom event', () => {
  const prev: SideCounts = { cH: 0, cA: 0, yH: 0, yA: 1, rH: 0, rA: 0 };
  const { events, counts } = statDeltaEvents(prev, rec({ y2: 0 }), NAMES); // rescinded
  assert.equal(events.length, 0);
  assert.equal(counts.yA, 0);
});

test('participant2-is-home flips the side attribution', () => {
  const prev: SideCounts = { cH: 0, cA: 0, yH: 0, yA: 0, rH: 0, rA: 0 };
  // p1Home=false → participant1 corners (c1) belong to AWAY
  const { events } = statDeltaEvents(prev, rec({ p1Home: false, c1: 1, c2: 0 }), NAMES);
  assert.equal(events[0].team, 'Argentina');
});

test('folding the whole match yields events matching the final totals', () => {
  // simulate a stream: corners 0→9 home / 0→4 away, yellows 0→4 away, 1 red away
  const records = [
    rec({ seq: 1, clockMin: 0, c1: 0, c2: 0 }),                 // baseline
    rec({ seq: 2, clockMin: 12, c1: 3, c2: 1 }),
    rec({ seq: 3, clockMin: 40, c1: 5, c2: 2, y2: 2 }),
    rec({ seq: 4, clockMin: 70, c1: 8, c2: 3, y2: 3 }),
    rec({ seq: 5, clockMin: 88, c1: 9, c2: 4, y2: 4, r2: 1 }),
  ];
  let counts: SideCounts | undefined;
  const all = [];
  for (const r of records) { const res = statDeltaEvents(counts, r, NAMES); counts = res.counts; all.push(...res.events); }
  assert.equal(all.filter(e => e.type === 'CORNER').length, 13); // 9 + 4
  assert.equal(all.filter(e => e.type === 'YELLOW_CARD').length, 4);
  assert.equal(all.filter(e => e.type === 'RED_CARD').length, 1);
  // final counts reflect the totals
  assert.deepEqual(counts, { cH: 9, cA: 4, yH: 0, yA: 4, rH: 0, rA: 1 });
});
