import Redis from 'ioredis';
import { Pool } from 'pg';
import type { BozEvent } from '@bozpicks/shared';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const db    = new Pool({ connectionString: process.env.DATABASE_URL });

const STATUS_EVENTS = new Set(['MATCH_START', 'MATCH_END', 'HALFTIME', 'GOAL', 'SCORE_UPDATE']);

function resolveStatus(event: BozEvent): string {
  if (event.type === 'MATCH_END')   return 'FINISHED';
  if (event.type === 'HALFTIME')    return 'HALFTIME';
  if (event.type === 'MATCH_START') return 'LIVE';
  return 'LIVE';
}

export async function publish(event: BozEvent): Promise<void> {
  const payload = JSON.stringify(event);

  // ── Redis: last event per match ─────────────────────────────────────────────
  await redis.set(`boz:match:${event.matchId}:lastEvent`, payload, 'EX', 7200);

  // ── Redis: odds history for agent ───────────────────────────────────────────
  if (event.type === 'ODDS_UPDATE' && event.odds) {
    const oddsKey = `boz:match:${event.matchId}:odds`;
    await redis.lpush(oddsKey, JSON.stringify(event.odds));
    await redis.ltrim(oddsKey, 0, 199);
    await redis.expire(oddsKey, 7200);
  }

  // ── Redis: live score hash ──────────────────────────────────────────────────
  if (event.score || STATUS_EVENTS.has(event.type)) {
    const status = resolveStatus(event);
    const fields: Record<string, string | number> = {
      currentMinute: event.matchMinute,
      status,
      lastUpdated: event.timestamp,
    };
    if (event.score) {
      fields.homeScore = event.score.home;
      fields.awayScore = event.score.away;
    }
    await redis.hset(`boz:match:${event.matchId}:state`, fields);
  }

  // ── Redis: live stats snapshot (corners, cards, possession, danger) ─────────
  if (event.stats) {
    await redis.set(`boz:match:${event.matchId}:stats`, JSON.stringify(event.stats), 'EX', 7200);
  }

  // ── Postgres: keep boz_matches in sync ─────────────────────────────────────
  if (event.score) {
    const status = resolveStatus(event);
    await db.query(
      `UPDATE boz_matches
       SET home_score=$1, away_score=$2, current_minute=$3, status=$4, stats=COALESCE($5,stats), last_updated=NOW()
       WHERE id=$6`,
      [event.score.home, event.score.away, event.matchMinute, status,
       event.stats ? JSON.stringify(event.stats) : null, event.matchId]
    ).catch(e => console.error('[publisher] DB score update:', e.message));
  } else if (STATUS_EVENTS.has(event.type) && event.type !== 'GOAL' && event.type !== 'SCORE_UPDATE') {
    const status = resolveStatus(event);
    await db.query(
      `UPDATE boz_matches
       SET status=$1, current_minute=$2, last_updated=NOW()
       WHERE id=$3`,
      [status, event.matchMinute, event.matchId]
    ).catch(e => console.error('[publisher] DB status update:', e.message));
  }

  // ── Redis: global history for SSE catch-up ──────────────────────────────────
  const histKey = 'boz:global:history';
  await redis.lpush(histKey, payload);
  await redis.ltrim(histKey, 0, 49);
  await redis.expire(histKey, 7200);

  // ── Track last sequence number for TxLINE proof lookups ───────────────────
  if (event.seq) {
    await redis.set(`boz:match:${event.matchId}:lastSeq`, String(event.seq), 'EX', 86400);
  }

  // ── pub/sub ─────────────────────────────────────────────────────────────────
  await redis.publish(`boz:events:${event.matchId}`, payload);
  await redis.publish('boz:global', payload);
}

export { redis };
