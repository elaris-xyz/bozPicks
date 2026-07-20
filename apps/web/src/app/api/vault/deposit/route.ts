import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moveVault } from '@/lib/vault';
import { displayToUsdc } from '@bozpicks/shared';
import { isRealVaultEnabled, verifyDepositTx, microUsdcToLamports } from '@/lib/solana';

export const dynamic = 'force-dynamic';
// verifying the deposit tx is an on-chain read that can be slow on devnet RPCs
export const maxDuration = 30;

/**
 * POST /api/vault/deposit  { wallet, amountUsdc, txSig }
 * Credits the game balance against the on-chain deposit the client signed.
 *
 * When a treasury is configured (real-vault mode) the deposit is VERIFIED on
 * devnet before crediting: the signature must exist, have moved at least the
 * pegged lamports from `wallet` to the treasury, and never have been credited
 * before (replay protection). Without a treasury it keeps the memo-anchored
 * devnet flow — the signature is recorded but no value moved.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string; amountUsdc?: number; txSig?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  const { wallet, amountUsdc, txSig } = body;
  if (!wallet || !amountUsdc || amountUsdc <= 0) {
    return NextResponse.json({ error: 'wallet, amountUsdc required' }, { status: 400 });
  }
  if (amountUsdc > 100_000) return NextResponse.json({ error: 'amount too large' }, { status: 400 });
  const micro = displayToUsdc(amountUsdc);
  try {
    if (isRealVaultEnabled()) {
      if (!txSig) return NextResponse.json({ error: 'txSig required' }, { status: 400 });
      // replay protection: a deposit signature can only ever be credited once
      const dup = await db.query(`SELECT 1 FROM boz_vault_ledger WHERE tx_sig=$1 LIMIT 1`, [txSig]);
      if (dup.rows.length) return NextResponse.json({ error: 'deposit already credited' }, { status: 409 });
      const v = await verifyDepositTx(txSig, wallet, microUsdcToLamports(micro));
      if (!v.ok) return NextResponse.json({ error: `deposit not verified: ${v.reason}` }, { status: 402 });
    }
    const balance = await moveVault({
      wallet, delta: micro, kind: 'DEPOSIT', ref: 'Wallet deposit', txSig,
    });
    return NextResponse.json({ ok: true, balance });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
