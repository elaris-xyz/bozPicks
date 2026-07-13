import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import type { MatchState, OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await db.query(
    `SELECT id, home_team, away_team, home_score, away_score,
            status, current_minute, kickoff_time, last_updated, competition
     FROM boz_matches ORDER BY kickoff_time ASC`
  );

  const oddsRaw = await Promise.all(
    rows.map(r => redis.lindex(`boz:match:${r.id}:odds`, 0))
  );

  const matches: MatchState[] = rows.map((r, i) => ({
    id: r.id,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeScore: r.home_score ?? 0,
    awayScore: r.away_score ?? 0,
    status: r.status,
    currentMinute: r.current_minute ?? 0,
    kickoffTime: r.kickoff_time,
    lastUpdated: r.last_updated ?? new Date().toISOString(),
    competition: r.competition ?? undefined,
    currentOdds: oddsRaw[i] ? (JSON.parse(oddsRaw[i]!) as OddsSnapshot) : undefined,
  }));

  return NextResponse.json(matches);
}
