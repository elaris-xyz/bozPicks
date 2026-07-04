import { connectOddsStream, connectScoresStream, txlineRest } from '@bozpicks/txline-client';
import type { TxOddsPayload, TxScores, TxFixture } from '@bozpicks/txline-client';
import { oddsEventToBozEvent, scoresEventToBozEvent } from './normalizer';
import { publish, redis } from './publisher';
import { record, db } from './recorder';

console.log('[boz-ingest] starting...');

// ─── Load fixtures and start streams ────────────────────────────────────────

async function start() {
  // Get World Cup fixtures
  const fixtures = await txlineRest.fixtures();
  console.log(`[boz-ingest] ${fixtures.length} fixtures loaded`);

  // Publish match list to Redis + Postgres
  for (const f of fixtures) {
    const homeTeam = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const awayTeam = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    const kickoffTime = new Date(f.StartTime).toISOString();

    // Redis
    await redis.hset(`boz:fixture:${f.FixtureId}`, {
      id: String(f.FixtureId), homeTeam, awayTeam,
      homeScore: 0, awayScore: 0, status: 'SCHEDULED',
      currentMinute: 0, kickoffTime,
    });

    // Postgres boz_matches
    await db.query(
      `INSERT INTO boz_matches (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time)
       VALUES ($1,$2,$3,0,0,'SCHEDULED',0,$4)
       ON CONFLICT (id) DO UPDATE SET home_team=$2, away_team=$3, kickoff_time=$4`,
      [String(f.FixtureId), homeTeam, awayTeam, kickoffTime]
    );

    // Auto-create prediction pool
    await db.query(
      `INSERT INTO boz_pools (match_id, status, pool_home, pool_draw, pool_away, total_pool, fee_bps)
       VALUES ($1,'OPEN',0,0,0,0,200)
       ON CONFLICT (match_id) DO NOTHING`,
      [String(f.FixtureId)]
    );
  }
  await redis.set('boz:fixtures', JSON.stringify(fixtures), 'EX', 3600);
  console.log(`[boz-ingest] ${fixtures.length} fixtures synced to DB`);

  // ── Scores SSE (global — all fixtures) ──────────────────────────────────
  const stopScores = connectScoresStream(undefined, {
    onMessage: async (scores: TxScores) => {
      const event = scoresEventToBozEvent(scores);
      if (!event) return;
      await Promise.all([publish(event), record(event)]);
      if (process.env.LOG_EVENTS === 'true') {
        console.log(`[SCORE] ${event.type} match=${event.matchId} min=${event.matchMinute}`);
      }
    },
    onHeartbeat: () => { /* silent */ },
    onError: (err) => console.error('[boz-ingest] scores SSE error:', err),
    onReconnect: (n) => console.warn(`[boz-ingest] scores reconnecting... attempt ${n}`),
  });

  // ── Odds SSE (global — all fixtures) ────────────────────────────────────
  const stopOdds = connectOddsStream(undefined, {
    onMessage: async (odds: TxOddsPayload) => {
      const event = oddsEventToBozEvent(odds);
      if (!event) return;
      await Promise.all([publish(event), record(event)]);
      if (process.env.LOG_EVENTS === 'true') {
        console.log(`[ODDS] match=${event.matchId}`);
      }
    },
    onHeartbeat: () => { /* silent */ },
    onError: (err) => console.error('[boz-ingest] odds SSE error:', err),
    onReconnect: (n) => console.warn(`[boz-ingest] odds reconnecting... attempt ${n}`),
  });

  console.log('[boz-ingest] connected to TxLINE scores + odds streams');

  process.on('SIGTERM', () => { stopScores(); stopOdds(); process.exit(0); });
  process.on('SIGINT',  () => { stopScores(); stopOdds(); process.exit(0); });
}

start().catch((err) => {
  console.error('[boz-ingest] startup error:', err.message);
  process.exit(1);
});
