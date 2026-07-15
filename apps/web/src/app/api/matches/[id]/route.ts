import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';
import type { BozEvent, MatchState, OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try Redis first (live state)
  const [redisState, eventsResult, dbMatch, latestOddsRaw] = await Promise.all([
    redis.hgetall(`boz:match:${id}:state`),
    db.query<{ payload: BozEvent }>(
      // TxLINE Seq is the authoritative order (demo events carry one too);
      // match_minute alone mis-sorts records whose Clock is absent (e.g. the
      // game_finalised row lands at 0' and used to open the timeline)
      `SELECT payload FROM boz_events WHERE match_id = $1
       ORDER BY (payload->>'seq')::bigint ASC NULLS LAST, match_minute ASC, created_at ASC`,
      [id]
    ),
    db.query(
      `SELECT id, home_team, away_team, home_score, away_score,
              status, current_minute, kickoff_time
       FROM boz_matches WHERE id = $1`,
      [id]
    ),
    redis.lindex(`boz:match:${id}:odds`, 0),
  ]);

  const currentOdds: OddsSnapshot | undefined = latestOddsRaw
    ? (JSON.parse(latestOddsRaw) as OddsSnapshot)
    : undefined;

  const events = eventsResult.rows.map(r => r.payload);

  // Build state from Redis or Postgres fallback
  let state: MatchState | null = null;

  const dbFinished = dbMatch.rows[0]?.status === 'FINISHED';
  if (Object.keys(redisState).length > 0 && !dbFinished) {
    // Redis holds the LIVE fields (score/status/minute); team names + kickoff
    // are authoritative in Postgres (the publisher's state hash never stored
    // them, which left real-match headers nameless + flagless).
    const db0 = dbMatch.rows[0];
    state = {
      id,
      homeTeam: redisState.homeTeam || db0?.home_team || '',
      awayTeam: redisState.awayTeam || db0?.away_team || '',
      homeScore: Number(redisState.homeScore ?? db0?.home_score ?? 0),
      awayScore: Number(redisState.awayScore ?? db0?.away_score ?? 0),
      status: (redisState.status as MatchState['status']) ?? db0?.status ?? 'SCHEDULED',
      currentMinute: Number(redisState.currentMinute ?? db0?.current_minute ?? 0),
      kickoffTime: redisState.kickoffTime || db0?.kickoff_time || '',
      lastUpdated: new Date().toISOString(),
    };
  } else if (dbMatch.rows[0]) {
    const r = dbMatch.rows[0];
    state = {
      id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score ?? 0,
      awayScore: r.away_score ?? 0,
      status: r.status,
      currentMinute: r.current_minute ?? 0,
      kickoffTime: r.kickoff_time,
      lastUpdated: new Date().toISOString(),
    };
  }

  return NextResponse.json({ id, state, events, currentOdds });
}
