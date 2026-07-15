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
 * Wipe a vault back to zero — clears the ledger and resets the balance. Devnet
 * game money only; used to start a clean recording (deposit → stake → win →
 * cash out) where every number obviously lines up. Also clears the wallet's
 * ACTIVE predictions so no stale stakes linger.
 */
export async function resetVault(wallet: string): Promise<void> {
  await db.query(`DELETE FROM boz_vault_ledger WHERE wallet_address=$1`, [wallet]).catch(() => {});
  await db.query(`DELETE FROM boz_predictions WHERE wallet_address=$1 AND status='ACTIVE'`, [wallet]).catch(() => {});
  await db.query(
    `UPDATE boz_vault SET balance_micro=0, deposited_micro=0, won_micro=0, updated_at=NOW() WHERE wallet_address=$1`,
    [wallet]
  ).catch(() => {});
}

/**
 * Recompute a vault from the LEDGER — the durable source of truth. (boz_predictions
 * can't be trusted for this: demo matches get purged, taking their prediction
 * rows with them, but the vault ledger persists.) Every movement is a signed
 * amount, so the true balance is simply their sum — once the duplicate WIN rows
 * from the earlier non-idempotent settle are removed. Idempotent + safe to
 * re-run. Returns the corrected balance.
 */
export async function reconcileVault(wallet: string): Promise<number> {
  // 1) drop duplicate WIN credits — the bug wrote several identical rows (same
  // market ref, same amount, seconds apart). Keep the earliest of each cluster.
  await db.query(
    `DELETE FROM boz_vault_ledger a USING boz_vault_ledger b
     WHERE a.wallet_address=$1 AND a.kind='WIN' AND b.kind='WIN'
       AND a.wallet_address=b.wallet_address AND a.ref IS NOT DISTINCT FROM b.ref
       AND a.amount_micro=b.amount_micro
       AND a.created_at > b.created_at - interval '2 minutes'
       AND a.created_at < b.created_at + interval '2 minutes'
       AND a.ctid > b.ctid`,
    [wallet]
  ).catch(() => {});

  // 2) balance = sum of every remaining signed movement
  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(amount_micro), 0)                                AS balance,
       COALESCE(SUM(amount_micro) FILTER (WHERE kind='DEPOSIT'), 0)  AS deposited,
       COALESCE(SUM(amount_micro) FILTER (WHERE kind='WIN'), 0)      AS won
     FROM boz_vault_ledger WHERE wallet_address=$1`,
    [wallet]
  );
  const balance = Number(rows[0].balance);
  const deposited = Number(rows[0].deposited);
  const won = Number(rows[0].won);

  await db.query(
    `UPDATE boz_vault SET balance_micro=$2, deposited_micro=$3, won_micro=$4, updated_at=NOW()
     WHERE wallet_address=$1`,
    [wallet, balance, deposited, won]
  ).catch(() => {});
  return balance;
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
    // never wait forever on a contended row lock — settlement calls this in a
    // loop and must not hang if a row is momentarily locked
    await client.query(`SET LOCAL lock_timeout = '5s'`);
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
