import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await db.query(`
    SELECT
      wallet_address,
      COUNT(*)                                          AS total,
      COUNT(*) FILTER (WHERE status = 'WON')           AS wins,
      COUNT(*) FILTER (WHERE status = 'LOST')          AS losses,
      COUNT(*) FILTER (WHERE status = 'ACTIVE')        AS active,
      COALESCE(SUM(amount_usdc), 0)                   AS total_staked,
      COALESCE(SUM(payout_amount) FILTER (WHERE status = 'WON'), 0) AS total_payout,
      COALESCE(SUM(payout_amount) FILTER (WHERE status = 'WON'), 0)
        - COALESCE(SUM(amount_usdc) FILTER (WHERE status IN ('WON','LOST')), 0) AS net_usdc,
      MIN(placed_at)                                  AS first_prediction,
      MAX(placed_at)                                  AS last_prediction
    FROM boz_predictions
    GROUP BY wallet_address
    ORDER BY wins DESC, net_usdc DESC
    LIMIT 50
  `);

  return NextResponse.json(rows.map((r, i) => ({
    rank: i + 1,
    wallet: r.wallet_address,
    total: Number(r.total),
    wins: Number(r.wins),
    losses: Number(r.losses),
    active: Number(r.active),
    winRate: Number(r.total) > 0 ? Math.round((Number(r.wins) / Number(r.total)) * 100) : 0,
    totalStaked: Number(r.total_staked) / 1_000_000,
    totalPayout: Number(r.total_payout) / 1_000_000,
    netUsdc: Number(r.net_usdc) / 1_000_000,
    since: r.first_prediction,
  })));
}
