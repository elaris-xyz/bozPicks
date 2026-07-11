import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reconcileVault } from '@/lib/vault';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/reconcile  { wallet? }
 * Heals a vault's balance from the source of truth (see reconcileVault). With a
 * wallet, reconciles just that one; without, reconciles every vault (one-off
 * cleanup after the duplicate-WIN bug). Safe to call repeatedly — idempotent.
 */
export async function POST(req: NextRequest) {
  let wallet: string | undefined;
  try { wallet = (await req.json())?.wallet; } catch { /* none → all */ }
  try {
    if (wallet) {
      const balance = await reconcileVault(wallet);
      return NextResponse.json({ ok: true, balance });
    }
    const { rows } = await db.query(`SELECT wallet_address FROM boz_vault`);
    const results: Record<string, number> = {};
    for (const r of rows) results[r.wallet_address] = await reconcileVault(r.wallet_address);
    return NextResponse.json({ ok: true, reconciled: rows.length, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
