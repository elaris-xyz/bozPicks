import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

/**
 * Server-side bozVault ledger. The vault is a custodial devnet game balance:
 * deposits/withdrawals are anchored by a real Solana tx the user signs once,
 * while stakes and winnings move the balance instantly (no per-action signing).
 * All amounts are USDC micro-units. Every movement is atomic (row lock inside a
 * transaction) and written to boz_vault_ledger.
 */

export type LedgerKind = 'DEPOSIT' | 'STAKE' | 'WIN' | 'REFUND' | 'WITHDRAW';

export interface VaultState {
  balance: number;    // micro
  deposited: number;  // micro
  won: number;        // micro
}
export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amount: number;       // signed micro
  balanceAfter: number; // micro
  ref: string | null;
  txSig: string | null;
  at: string;
}

export async function getVault(wallet: string): Promise<VaultState> {
  const { rows } = await db.query(
    `SELECT balance_micro, deposited_micro, won_micro FROM boz_vault WHERE wallet_address=$1`,
    [wallet]
  );
  if (rows.length === 0) return { balance: 0, deposited: 0, won: 0 };
  return {
    balance: Number(rows[0].balance_micro),
    deposited: Number(rows[0].deposited_micro),
    won: Number(rows[0].won_micro),
  };
}

export async function getLedger(wallet: string, limit = 40): Promise<LedgerEntry[]> {
  const { rows } = await db.query(
    `SELECT id, kind, amount_micro, balance_after, ref, tx_sig, created_at
     FROM boz_vault_ledger WHERE wallet_address=$1 ORDER BY created_at DESC LIMIT $2`,
    [wallet, limit]
  );
  return rows.map(r => ({
    id: r.id, kind: r.kind as LedgerKind,
    amount: Number(r.amount_micro), balanceAfter: Number(r.balance_after),
    ref: r.ref, txSig: r.tx_sig, at: new Date(r.created_at).toISOString(),
  }));
}

export class InsufficientFunds extends Error {
  constructor(public balance: number) { super('insufficient funds'); }
}

/**
 * Apply a signed delta atomically. Positive credits, negative debits. A debit
 * that would overdraw throws InsufficientFunds (nothing is written). Deposits
 * bump lifetime `deposited`; wins bump lifetime `won`. Returns the new balance.
 */
export async function moveVault(opts: {
  wallet: string;
  delta: number;         // signed micro
  kind: LedgerKind;
  ref?: string;
  txSig?: string;
  requireExisting?: boolean; // WIN/REFUND: only touch wallets that actually have a vault (skip bots)
}): Promise<number> {
  const { wallet, delta, kind, ref, txSig, requireExisting } = opts;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT balance_micro FROM boz_vault WHERE wallet_address=$1 FOR UPDATE`,
      [wallet]
    );
    if (cur.rows.length === 0 && requireExisting) {
      await client.query('ROLLBACK');
      return 0; // e.g. a bot won — no player vault to credit
    }
    const before = cur.rows.length ? Number(cur.rows[0].balance_micro) : 0;
    const after = before + delta;
    if (after < 0) { await client.query('ROLLBACK'); throw new InsufficientFunds(before); }

    const depBump = kind === 'DEPOSIT' ? delta : 0;
    const wonBump = kind === 'WIN' ? delta : 0;
    await client.query(
      `INSERT INTO boz_vault (wallet_address, balance_micro, deposited_micro, won_micro, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (wallet_address) DO UPDATE SET
         balance_micro   = $2,
         deposited_micro = boz_vault.deposited_micro + $3,
         won_micro       = boz_vault.won_micro + $4,
         updated_at = NOW()`,
      [wallet, after, depBump, wonBump]
    );
    await client.query(
      `INSERT INTO boz_vault_ledger (id, wallet_address, kind, amount_micro, balance_after, ref, tx_sig)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), wallet, kind, delta, after, ref ?? null, txSig ?? null]
    );
    await client.query('COMMIT');
    return after;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
