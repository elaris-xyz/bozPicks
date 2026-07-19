import { NextRequest, NextResponse } from 'next/server';
import { moveVault, InsufficientFunds } from '@/lib/vault';
import { displayToUsdc } from '@bozpicks/shared';
import { isTreasurySignerConfigured, sendFromTreasury, microUsdcToLamports } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/withdraw  { wallet, amountUsdc, txSig }
 * Debits the game balance and returns it to the wallet. 402 if the balance
 * can't cover it.
 *
 * When the treasury signer is configured (real-vault mode) the debit is
 * followed by a REAL treasury → wallet transfer, and the on-chain signature is
 * recorded. The debit happens first (atomic, overdraw-safe); if the transfer
 * fails to confirm the debit is reversed so no balance is lost with no payout.
 * Without a treasury signer it keeps the memo-anchored devnet flow.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string; amountUsdc?: number; txSig?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  const { wallet, amountUsdc, txSig } = body;
  if (!wallet || !amountUsdc || amountUsdc <= 0) {
    return NextResponse.json({ error: 'wallet, amountUsdc required' }, { status: 400 });
  }
  const micro = displayToUsdc(amountUsdc);
  try {
    // Debit first — atomic + overdraw-safe (throws InsufficientFunds).
    let balance = await moveVault({
      wallet, delta: -micro, kind: 'WITHDRAW', ref: 'Cash out to wallet', txSig,
    });

    if (isTreasurySignerConfigured()) {
      try {
        const sig = await sendFromTreasury(wallet, microUsdcToLamports(micro));
        return NextResponse.json({ ok: true, balance, txSig: sig });
      } catch (transferErr) {
        // Transfer didn't confirm — reverse the debit so the player keeps their
        // balance. A positive-delta WITHDRAW restores both balance and the
        // lifetime withdrawn counter (which uses -delta), exactly undoing it.
        balance = await moveVault({
          wallet, delta: micro, kind: 'WITHDRAW', ref: 'Cash-out reversed (transfer failed)',
        }).catch(() => balance);
        return NextResponse.json(
          { error: `withdraw transfer failed: ${(transferErr as Error).message}`, balance },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ ok: true, balance });
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      return NextResponse.json({ error: 'insufficient', balance: e.balance }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
