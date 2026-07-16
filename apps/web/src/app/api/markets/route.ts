import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { buildMarketsForMatch, rowToMarket, type FinalStats } from '@/lib/markets';
import { settleMarketRow, finalStatsFromDb } from '@/lib/settle';

export const dynamic = 'force-dynamic';

/**
 * Which ONE match the board shows when the caller doesn't ask for a specific
 * one — mirrors LiveMatchContext's "one live match" rule so this page never
 * disagrees with the rest of the app. Prefer whichever match is currently
 * LIVE/HALFTIME; otherwise fall back to the most recently created market's
 * match (so a just-finished match still shows its settled board).
 *
 * This single resolve is also what fixes the "12 cards" bug: the old GET
 * queried `boz_markets ORDER BY created_at DESC LIMIT 60` with no match
 * filter at all, so a finished real fixture's 6 markets and a fresh demo
 * run's 6 markets rendered on the SAME board, merged pool totals and all.
 */
async function resolveTargetMatchId(requested: string | null): Promise<string | null> {
  if (requested) return requested;
  // ORDER BY kickoff_time ASC — same ordering /api/matches uses, and
  // LiveMatchContext picks the FIRST live match from that list. Matching it
  // exactly means Markets can never disagree with Hi-Lo/Pundit/the header
  // about which match is "the" live one on a rare double-header day.
  const { rows: live } = await db.query(
    `SELECT id FROM boz_matches WHERE status IN ('LIVE','HALFTIME') ORDER BY kickoff_time ASC LIMIT 1`
  );
  if (live[0]?.id) return String(live[0].id);
  const { rows: recent } = await db.query(
    `SELECT match_id FROM boz_markets ORDER BY created_at DESC LIMIT 1`
  );
  return recent[0]?.match_id ? String(recent[0].match_id) : null;
}

/**
 * Auto-create the six prop markets for a REAL fixture that is currently in
 * play and doesn't have a board yet. Demo matches build their markets inside
 * /api/demo; real matches used to have no creation path at all, so /markets
 * sat empty during a live World Cup game. Lazy-ensure on read keeps it
 * serverless-friendly (no worker needed): the first person to open /markets
 * while a match is live creates the board. Seeded with the same small
 * starting liquidity as the demo so the parimutuel odds read sensibly before
 * the first human stake.
 */
async function ensureLiveMarkets(matchId: string | null): Promise<void> {
  if (!matchId) return;
  const { rows: live } = await db.query(
    `SELECT id, home_team, away_team FROM boz_matches m
     WHERE id=$1 AND status IN ('LIVE','HALFTIME') AND id NOT LIKE 'demo-%'
       AND NOT EXISTS (SELECT 1 FROM boz_markets k WHERE k.match_id=m.id)`,
    [matchId]
  );
  const m = live[0];
  if (!m) return;

  const markets = buildMarketsForMatch(
    String(m.id), m.home_team, m.away_team, `escrow-${String(m.id).slice(-8)}`
  );
  for (const mk of markets) {
    const seeded = Object.fromEntries(mk.outcomes.map((o, i) => [o, (i === 0 ? 8 : 5) * 1_000_000]));
    mk.pools = seeded as Record<string, number>;
    mk.totalPool = Object.values(seeded).reduce((a, b) => a + b, 0);
    await db.query(
      `INSERT INTO boz_markets (id, match_id, kind, label, stat_key, line, outcomes, pools, total_pool, fee_bps, status, escrow_pda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPEN',$11) ON CONFLICT (id) DO NOTHING`,
      [mk.id, mk.matchId, mk.kind, mk.label, mk.statKey, mk.line ?? null,
       JSON.stringify(mk.outcomes), JSON.stringify(mk.pools), mk.totalPool, mk.feeBps, mk.escrowPda]
    ).catch(() => {});
    // announce over SSE so an already-open panel renders the board live
    void redis.publish('boz:markets', JSON.stringify(mk)).catch(() => {});
  }
}

/**
 * Settle any OPEN market in this result set whose match has FINISHED. Real
 * fixtures have no inline settle (the demo settles its own markets at
 * full-time) — this closes the loop the moment anyone reads the board.
 */
async function settleFinished(rows: Record<string, unknown>[]): Promise<boolean> {
  const open = rows.filter(r => r.status === 'OPEN');
  if (open.length === 0) return false;
  const matchIds = [...new Set(open.map(r => String(r.match_id)))];
  const { rows: fin } = await db.query(
    `SELECT id FROM boz_matches WHERE id = ANY($1) AND status='FINISHED'`, [matchIds]
  ).catch(() => ({ rows: [] as { id: string }[] }));
  if (fin.length === 0) return false;

  const finished = new Set(fin.map(r => String(r.id)));
  const finals = new Map<string, FinalStats | null>();
  let settledAny = false;
  for (const row of open) {
    const mid = String(row.match_id);
    if (!finished.has(mid)) continue;
    if (!finals.has(mid)) finals.set(mid, await finalStatsFromDb(mid));
    const final = finals.get(mid);
    if (!final) continue;
    try {
      await settleMarketRow(rowToMarket(row), final);
      settledAny = true;
    } catch (e) {
      console.error(`[markets] settle failed for ${row.id}:`, (e as Error).message);
    }
  }
  return settledAny;
}

/**
 * GET /api/markets?matchId=… → prop markets for ONE match (pools +
 * settlement). Without matchId, resolves to the one live/most-recent match —
 * NEVER a mix of markets from different matches.
 */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('matchId');
  try {
    const matchId = await resolveTargetMatchId(requested);
    await ensureLiveMarkets(matchId).catch(() => {});
    if (!matchId) return NextResponse.json([]);

    const query = () => db.query(`SELECT * FROM boz_markets WHERE match_id=$1 ORDER BY created_at ASC`, [matchId]);
    let { rows } = await query();
    if (await settleFinished(rows)) ({ rows } = await query()); // re-read post-settle
    return NextResponse.json(rows.map(rowToMarket));
  } catch {
    return NextResponse.json([]);
  }
}
