import { NextRequest, NextResponse } from 'next/server';
import { moveVault, InsufficientFunds } from '@/lib/vault';
import { displayToUsdc } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/withdraw  { wallet, amountUsdc, txSig }
 * Debits the game balance and returns it to the wallet (anchored by txSig).
 * 402 if the balance can't cover it.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string; amountUsdc?: number; txSig?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  const { wallet, amountUsdc, txSig } = body;
  if (!wallet || !amountUsdc || amountUsdc <= 0) {
    return NextResponse.json({ error: 'wallet, amountUsdc required' }, { status: 400 });
  }
  try {
    const balance = await moveVault({
      wallet, delta: -displayToUsdc(amountUsdc), kind: 'WITHDRAW', ref: 'Cash out to wallet', txSig,
    });
    return NextResponse.json({ ok: true, balance });
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      return NextResponse.json({ error: 'insufficient', balance: e.balance }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
