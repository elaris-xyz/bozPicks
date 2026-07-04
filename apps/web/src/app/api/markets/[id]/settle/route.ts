import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { rowToMarket, type FinalStats } from '@/lib/markets';
import { settleMarketRow } from '@/lib/settle';

export const dynamic = 'force-dynamic';

/**
 * POST /api/markets/[id]/settle
 * Resolves one market from the match's final stats, builds the verifiable
 * resolution receipt (TxLINE Merkle proof), marks winners, and computes payouts.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { rows } = await db.query(`SELECT * FROM boz_markets WHERE id=$1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'market not found' }, { status: 404 });
    const m = rowToMarket(rows[0]);
    if (m.status === 'SETTLED') return NextResponse.json({ ok: true, market: m });

    const finalRaw = await redis.get(`boz:match:${m.matchId}:final`);
    if (!finalRaw) return NextResponse.json({ error: 'match not final yet' }, { status: 409 });
    const final = JSON.parse(finalRaw) as FinalStats;

    const settled = await settleMarketRow(m, final);
    return NextResponse.json({ ok: true, market: settled });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
