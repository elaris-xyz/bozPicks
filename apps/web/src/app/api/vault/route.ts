import { NextRequest, NextResponse } from 'next/server';
import { getVault, getLedger } from '@/lib/vault';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Sum of the wallet's currently ACTIVE (unresolved) predictions — the part of
 * "staked" that's neither lost nor back in the balance yet, just waiting on a
 * result. Without this, a player watching their balance drop after placing
 * several stakes reads it as a loss that already happened, when it's really
 * money still in flight (see VaultModal's "in open bets" chip).
 */
async function activeStake(wallet: string): Promise<{ micro: number; count: number }> {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount_usdc),0) AS micro, COUNT(*) AS n
     FROM boz_predictions WHERE wallet_address=$1 AND status='ACTIVE'`,
    [wallet]
  ).catch(() => ({ rows: [{ micro: 0, n: 0 }] }));
  return { micro: Number(rows[0]?.micro ?? 0), count: Number(rows[0]?.n ?? 0) };
}

/** GET /api/vault?wallet=X → current game balance + recent ledger. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  try {
    const [state, ledger, active] = await Promise.all([getVault(wallet), getLedger(wallet), activeStake(wallet)]);
    return NextResponse.json({ ...state, ledger, activeStake: active.micro, activeCount: active.count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
