import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rowToMarket, type FinalStats } from '@/lib/markets';
import { settleMarketRow } from '@/lib/settle';

export const dynamic = 'force-dynamic';

/**
 * Settle-sweep — a safety net that settles any market left OPEN after its match
 * finished. Final stats are rebuilt straight from the DB (match score + events),
 * so it works even when Redis (which normally caches the replay's final stats)
 * is unavailable. Idempotent: already-settled markets are skipped. Called as a
 * belt-and-braces step and reachable if a demo's inline settle ever misses one.
 */

async function finalStatsFromDb(matchId: string): Promise<FinalStats | null> {
  const { rows: mrows } = await db.query(
    `SELECT home_team, away_team, home_score, away_score FROM boz_matches WHERE id=$1`,
    [matchId]
  );
  if (!mrows[0]) return null;
  const home = mrows[0].home_team as string;
  const homeScore = Number(mrows[0].home_score ?? 0);
  const awayScore = Number(mrows[0].away_score ?? 0);

  const { rows: evs } = await db.query(
    `SELECT type, match_minute, payload FROM boz_events WHERE match_id=$1
     ORDER BY (payload->>'seq')::bigint ASC NULLS LAST, match_minute ASC, created_at ASC`,
    [matchId]
  );
  // COUNTING events undercounts real matches whenever the ingest has gaps (a
  // corners market must not settle at 1 when TxLINE's cumulative total says 8).
  // Every record carries cumulative totals in payload.stats — take the max
  // ever seen and never settle below it. First scorer likewise comes from the
  // first RUNNING-SCORE increment, which survives a missed/misclassified goal
  // record (e.g. penalty_outcome).
  let cCorners = 0, cCards = 0, nCorners = 0, nCards = 0;
  let firstScorer: 'HOME' | 'AWAY' | 'NONE' = 'NONE';
  let prevH = 0, prevA = 0;
  for (const e of evs) {
    if (e.type === 'CORNER') nCorners++;
    else if (e.type === 'YELLOW_CARD' || e.type === 'RED_CARD') nCards++;
    const st = e.payload?.stats as { cornersHome?: number; cornersAway?: number; yellowHome?: number; yellowAway?: number; redHome?: number; redAway?: number } | undefined;
    if (st) {
      cCorners = Math.max(cCorners, (st.cornersHome ?? 0) + (st.cornersAway ?? 0));
      cCards = Math.max(cCards, (st.yellowHome ?? 0) + (st.yellowAway ?? 0) + (st.redHome ?? 0) + (st.redAway ?? 0));
    }
    const sc = e.payload?.score as { home?: number; away?: number } | undefined;
    if (sc) {
      const h = sc.home ?? 0, a = sc.away ?? 0;
      if (firstScorer === 'NONE' && (h > prevH || a > prevA)) {
        firstScorer = h > prevH ? 'HOME' : 'AWAY';
      }
      prevH = Math.max(prevH, h); prevA = Math.max(prevA, a);
    }
  }
  const totalCorners = Math.max(cCorners, nCorners);
  const totalCards = Math.max(cCards, nCards);
  return {
    homeScore, awayScore,
    totalGoals: homeScore + awayScore,
    totalCorners, totalCards,
    btts: homeScore > 0 && awayScore > 0,
    firstScorer,
  };
}

export async function POST() {
  try {
    const { rows: open } = await db.query(
      `SELECT * FROM boz_markets WHERE status='OPEN' AND match_id IN
         (SELECT id FROM boz_matches WHERE status='FINISHED')`
    );
    // fall back to any open market whose match simply has a score recorded
    const { rows: openAny } = open.length ? { rows: open } : await db.query(
      `SELECT * FROM boz_markets WHERE status='OPEN'`
    );

    const byMatch = new Map<string, FinalStats | null>();
    let settled = 0;
    const results: Record<string, string> = {};
    for (const row of openAny) {
      const m = rowToMarket(row);
      if (!byMatch.has(m.matchId)) byMatch.set(m.matchId, await finalStatsFromDb(m.matchId));
      const final = byMatch.get(m.matchId);
      if (!final) { results[m.kind] = 'no-final'; continue; }
      try {
        await settleMarketRow(m, final);
        settled++;
        results[m.kind] = 'settled';
      } catch (e) {
        results[m.kind] = `error: ${(e as Error).message}`;
      }
    }
    return NextResponse.json({ ok: true, settled, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
