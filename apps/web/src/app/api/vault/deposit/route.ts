import { NextRequest, NextResponse } from 'next/server';
import { moveVault } from '@/lib/vault';
import { displayToUsdc } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/deposit  { wallet, amountUsdc, txSig }
 * Credits the game balance after the client has signed the on-chain deposit tx.
 * txSig is the devnet signature that anchors the deposit (shown in the ledger).
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string; amountUsdc?: number; txSig?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  const { wallet, amountUsdc, txSig } = body;
  if (!wallet || !amountUsdc || amountUsdc <= 0) {
    return NextResponse.json({ error: 'wallet, amountUsdc required' }, { status: 400 });
  }
  if (amountUsdc > 100_000) return NextResponse.json({ error: 'amount too large' }, { status: 400 });
  try {
    const balance = await moveVault({
      wallet, delta: displayToUsdc(amountUsdc), kind: 'DEPOSIT', ref: 'Wallet deposit', txSig,
    });
    return NextResponse.json({ ok: true, balance });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
