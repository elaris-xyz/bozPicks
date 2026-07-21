import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import type { MatchState, OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  // ── Self-heal zombie demos ──────────────────────────────────────────────────
  // A demo updates itself every second while it plays, so one sitting LIVE with
  // no update for minutes can only mean its run died (a deploy, a serverless
  // kill, a lost connection). Left alone it stays LIVE forever: the pitch clock
  // freezes at whatever minute it reached and the Command Bridge refuses to
  // start anything new, because the app correctly believes a match is on air.
  // This is the poll every client already makes, so the fix lands within ~10s
  // without anyone touching the database.
  await db.query(
    `UPDATE boz_matches SET status='FINISHED', last_updated=NOW()
     WHERE id LIKE 'demo-%' AND status IN ('LIVE','HALFTIME')
       AND last_updated < NOW() - INTERVAL '3 minutes'`
  ).catch(() => {});

  const { rows } = await db.query(
    // Homepage order: LIVE first, then most-recently-played, then soonest
    // upcoming. (Was `kickoff_time ASC` — which surfaced the OLDEST fixtures
    // first, so finished games from days ago sat above what's on now.)
    `SELECT id, home_team, away_team, home_score, away_score,
            status, current_minute, kickoff_time, last_updated, competition
     FROM boz_matches
     ORDER BY
       (status IN ('LIVE','HALFTIME')) DESC,
       CASE WHEN status='FINISHED' THEN kickoff_time END DESC NULLS LAST,
       CASE WHEN status NOT IN ('LIVE','HALFTIME','FINISHED') THEN kickoff_time END ASC NULLS LAST`
  );

  // odds are an optional Redis cache — never let their failure empty the list
  const oddsRaw: (string | null)[] = await Promise.all(
    rows.map(r => redis.lindex(`boz:match:${r.id}:odds`, 0).catch(() => null))
  ).catch(() => rows.map(() => null));

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
