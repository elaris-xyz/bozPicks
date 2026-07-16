/**
 * One-off backfill: re-ingest a FINISHED fixture's full event history with the
 * current normalizer + lineup resolver, so stored events get real player names
 * (goalscorer/card/sub). Past fixtures were ingested before player-name
 * resolution existed, leaving their timelines nameless. This fetches the TxLINE
 * scores snapshot, builds the PlayerId→name map from the lineup records, and
 * REPLACES the fixture's boz_events + boz_replay_events with a clean, complete,
 * named set (in Seq order, with synthetic playback delays for replay).
 *
 * Usage:  pnpm --dir apps/ingest tsx src/backfill.ts <fixtureId> [<fixtureId> …]
 */
import { Pool } from 'pg';
import { txlineRest, buildPlayerMap } from '@bozpicks/txline-client';
import type { TxScores } from '@bozpicks/txline-client';
import { scoresEventToBozEvent } from './normalizer';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function backfillFixture(fixtureId: string): Promise<void> {
  console.log(`\n[backfill] ${fixtureId} …`);

  // team names for event attribution — try the fixtures feed first, then fall
  // back to our own boz_matches (a past fixture won't be in the current
  // fixtures snapshot, but we ingested its name when it was live)
  let names: { home: string; away: string } | undefined;
  try {
    const fixtures = await txlineRest.fixtures();
    const f = fixtures.find(x => String(x.FixtureId) === fixtureId);
    if (f) names = {
      home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
      away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
    };
  } catch { /* fall through to the DB */ }
  if (!names) {
    const { rows } = await db.query<{ home_team: string; away_team: string }>(
      `SELECT home_team, away_team FROM boz_matches WHERE id=$1`, [fixtureId]);
    if (rows[0]) names = { home: rows[0].home_team, away: rows[0].away_team };
  }

  // full history (or snapshot fallback) — snapshot carries the lineup records
  let records: TxScores[] = [];
  try { records = await txlineRest.scoresHistorical(Number(fixtureId)); } catch { /* fall back */ }
  if (!Array.isArray(records) || records.length === 0) {
    records = await txlineRest.scoresSnapshot(Number(fixtureId));
  }
  if (!Array.isArray(records) || records.length === 0) {
    console.warn(`[backfill] ${fixtureId}: no records`); return;
  }

  const players = buildPlayerMap(records);
  console.log(`[backfill] ${fixtureId}: ${records.length} records · ${players.size} player ids mapped`);

  // normalize in Seq order so the timeline + score progression are monotonic
  const sorted = [...records].sort((a, b) =>
    ((a as unknown as { Seq?: number }).Seq ?? 0) - ((b as unknown as { Seq?: number }).Seq ?? 0));

  const events = sorted
    .map(r => scoresEventToBozEvent(r, names, players))
    .filter((e): e is NonNullable<typeof e> => !!e);

  let named = 0;
  for (const e of events) if (e.player && !e.player.startsWith('Player #') && !e.player.includes('?')) named++;
  console.log(`[backfill] ${fixtureId}: ${events.length} events · ${named} with resolved player names`);

  // replace the fixture's stored events with the clean named set
  await db.query('BEGIN');
  try {
    await db.query(`DELETE FROM boz_events        WHERE match_id=$1`, [fixtureId]);
    await db.query(`DELETE FROM boz_replay_events WHERE match_id=$1`, [fixtureId]);
    const span = 90_000; // synthetic playback span for replay timing
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const delayMs = Math.round((Math.min(95, e.matchMinute) / 95) * span) + i; // +i keeps ties ordered
      await db.query(
        `INSERT INTO boz_events (id, match_id, type, match_minute, timestamp, payload)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, match_minute=EXCLUDED.match_minute`,
        [e.id, fixtureId, e.type, e.matchMinute, e.timestamp, JSON.stringify(e)]
      );
      await db.query(
        `INSERT INTO boz_replay_events (id, match_id, recorded_at, delay_ms, payload)
         VALUES ($1,$2,NOW(),$3,$4) ON CONFLICT (id) DO UPDATE SET delay_ms=EXCLUDED.delay_ms, payload=EXCLUDED.payload`,
        [e.id, fixtureId, delayMs, JSON.stringify(e)]
      );
    }
    await db.query('COMMIT');
    console.log(`[backfill] ${fixtureId}: DONE ✓`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(`[backfill] ${fixtureId}: FAILED —`, (err as Error).message);
  }
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) { console.error('usage: tsx src/backfill.ts <fixtureId> …'); process.exit(1); }
  for (const id of ids) await backfillFixture(id);
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
