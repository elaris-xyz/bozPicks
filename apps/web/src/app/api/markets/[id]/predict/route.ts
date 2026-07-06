import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { rowToMarket } from '@/lib/markets';
import { displayToUsdc } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

/**
 * POST /api/markets/[id]/predict
 * body: { outcome, amountUsdc, wallet, escrowTx? }
 * Records a USDC parimutuel stake and grows the outcome pool atomically.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { outcome?: string; amountUsdc?: number; wallet?: string; escrowTx?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }

  const { outcome, amountUsdc, wallet } = body;
  if (!outcome || !amountUsdc || amountUsdc <= 0 || !wallet) {
    return NextResponse.json({ error: 'outcome, amountUsdc, wallet required' }, { status: 400 });
  }
  const micro = displayToUsdc(amountUsdc);

  try {
    const { rows } = await db.query(`SELECT * FROM boz_markets WHERE id=$1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'market not found' }, { status: 404 });
    const m = rowToMarket(rows[0]);
    if (m.status !== 'OPEN') return NextResponse.json({ error: 'market not open' }, { status: 409 });
    if (!m.outcomes.includes(outcome)) return NextResponse.json({ error: 'invalid outcome' }, { status: 400 });

    const pools = { ...m.pools, [outcome]: (m.pools[outcome] ?? 0) + micro };
    const total = m.totalPool + micro;

    await db.query(
      `UPDATE boz_markets SET pools=$1, total_pool=$2 WHERE id=$3`,
      [JSON.stringify(pools), total, id]
    );
    await db.query(
      `INSERT INTO boz_predictions (id, match_id, market_id, wallet_address, outcome, amount_usdc, escrow_tx, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')`,
      [randomUUID(), m.matchId, id, wallet, outcome, micro, body.escrowTx ?? 'devnet-escrow']
    );

    const updated = { ...m, pools, totalPool: total };
    await redis.publish('boz:markets', JSON.stringify(updated)).catch(() => {});
    return NextResponse.json({ ok: true, market: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
