import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rowToMarket, type FinalStats } from '@/lib/markets';
import { settleMarketRow, finalStatsFromDb } from '@/lib/settle';

export const dynamic = 'force-dynamic';

/**
 * Settle-sweep — a safety net that settles any market left OPEN after its match
 * finished. Final stats are rebuilt straight from the DB (match score + events),
 * so it works even when Redis (which normally caches the replay's final stats)
 * is unavailable. Idempotent: already-settled markets are skipped.
 *
 * ONLY markets whose match is FINISHED are swept — the old "any open market"
 * fallback could settle a REAL fixture's markets mid-game.
 */
export async function POST() {
  try {
    const { rows: open } = await db.query(
      `SELECT * FROM boz_markets WHERE status='OPEN' AND match_id IN
         (SELECT id FROM boz_matches WHERE status='FINISHED')`
    );

    const byMatch = new Map<string, FinalStats | null>();
    let settled = 0;
    const results: Record<string, string> = {};
    for (const row of open) {
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
