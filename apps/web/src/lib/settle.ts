import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import type { PropMarket, SettlementReceipt } from '@bozpicks/shared';
import { resolveMarket, payoutFor, TXLINE_STAT_KEYS, type FinalStats } from '@/lib/markets';
import { moveVault } from '@/lib/vault';

/**
 * Verifiable-resolution receipt (server-only — uses node crypto). For real
 * fixtures the keeper fetches the TxLINE Merkle proof and lands an on-chain
 * validate_stat tx; here we derive an internally-consistent SHA-256 Merkle-
 * style root/proof over the resolved stat so the mechanism is demonstrable.
 */
export function buildReceipt(m: PropMarket, fixtureId: string, statValue: number, recordId: string, validateTx?: string): SettlementReceipt {
  const h = (s: string) => createHash('sha256').update(s).digest('hex');
  const leaf = h(`${fixtureId}:${m.statKey}:${statValue}:${recordId}`);
  const sibling = h(`${fixtureId}:sibling:${m.kind}`);
  const root = h(leaf < sibling ? leaf + sibling : sibling + leaf);
  return {
    statKey: m.statKey,
    statValue,
    txlineStatKeys: TXLINE_STAT_KEYS[m.kind] ?? [],
    fixtureId,
    txlineRecordId: recordId,
    merkleRoot: root,
    merkleProof: [sibling],
    validateTx: validateTx ?? `sim-${h(root).slice(0, 32)}`,
    verifiedAt: new Date().toISOString(),
    source: validateTx ? 'TXLINE_ONCHAIN' : 'SIMULATED',
  };
}

/**
 * Settle one prop market from the match's final TxLINE stats:
 *  1. resolve the winning outcome deterministically
 *  2. build the verifiable-resolution receipt (Merkle proof + validate tx)
 *  3. pay winners pro-rata (parimutuel), mark losers
 *  4. persist the settled market
 * Shared by the settle API route and the demo's auto-settlement.
 */
export async function settleMarketRow(m: PropMarket, final: FinalStats): Promise<PropMarket> {
  const { winningOutcome, statValue } = resolveMarket(m, final);

  // a real TxLINE record id anchors the proof; use the latest event for the match
  let recordId = `${m.matchId}-final`;
  try {
    const { rows } = await db.query(
      `SELECT id FROM boz_events WHERE match_id=$1 ORDER BY match_minute DESC, created_at DESC LIMIT 1`,
      [m.matchId]
    );
    if (rows[0]?.id) recordId = String(rows[0].id);
  } catch { /* keep fallback */ }

  const receipt = buildReceipt(m, m.matchId, statValue, recordId);
  const settlementTx = receipt.validateTx;

  // 1) SETTLE THE MARKET FIRST. This is the one write that must always land —
  // doing it before payouts/credits means a slow or failing vault credit can
  // never leave a market stuck "open" (the bug that stranded BTTS + First Goal
  // at 4/6). Everything after is best-effort and non-blocking.
  await db.query(
    `UPDATE boz_markets SET status='SETTLED', winning_outcome=$1, settled_at=NOW(),
       settlement_tx=$2, receipt=$3 WHERE id=$4`,
    [winningOutcome, settlementTx, JSON.stringify(receipt), m.id]
  );

  const settled: PropMarket = { ...m, status: 'SETTLED', winningOutcome, settlementTx, receipt, settledAt: receipt.verifiedAt };

  // 2) publish for the live UI — fire-and-forget so a stalled Redis (e.g. over
  // quota) can't block or hang settlement. The client also reconciles via poll.
  void redis.publish('boz:markets', JSON.stringify(settled)).catch(() => {});

  // 3) grade predictions + credit winners' vaults — best-effort, isolated so one
  // bad credit can't abort the rest or the settle itself.
  const winningPool = m.pools[winningOutcome] ?? 0;
  try {
    const { rows: preds } = await db.query(
      `SELECT id, outcome, amount_usdc, wallet_address FROM boz_predictions WHERE market_id=$1 AND status='ACTIVE'`,
      [m.id]
    );
    for (const p of preds) {
      const won = p.outcome === winningOutcome;
      const payout = won ? payoutFor(Number(p.amount_usdc), winningPool, m.totalPool, m.feeBps) : 0;
      // Idempotent + race-safe: only THIS pass may grade the prediction, and
      // only the pass that actually flips ACTIVE→WON credits the vault. If a
      // second settle pass (demo + sweep + auto-heal can overlap) reaches here,
      // the row is no longer ACTIVE, rowCount is 0, and we skip the credit — no
      // more triple-paid winnings inflating the balance.
      const upd = await db.query(
        `UPDATE boz_predictions SET status=$1, payout_amount=$2 WHERE id=$3 AND status='ACTIVE'`,
        [won ? 'WON' : 'LOST', payout, p.id]
      ).catch(() => ({ rowCount: 0 }));
      if (!upd || upd.rowCount === 0) continue; // already graded by another pass
      if (won && payout > 0) {
        await moveVault({
          wallet: p.wallet_address, delta: payout, kind: 'WIN',
          ref: m.label, requireExisting: true,
        }).catch(() => { /* best-effort credit */ });
      }
    }
  } catch { /* best-effort payouts */ }
  return settled;
}
