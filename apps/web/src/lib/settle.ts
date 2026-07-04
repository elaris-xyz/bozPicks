import { db } from '@/lib/db';
import type { PropMarket } from '@bozpicks/shared';
import { resolveMarket, payoutFor, buildReceipt, type FinalStats } from '@/lib/markets';

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

  // pay winners
  const winningPool = m.pools[winningOutcome] ?? 0;
  try {
    const { rows: preds } = await db.query(
      `SELECT id, outcome, amount_usdc FROM boz_predictions WHERE market_id=$1 AND status='ACTIVE'`,
      [m.id]
    );
    for (const p of preds) {
      const won = p.outcome === winningOutcome;
      const payout = won ? payoutFor(Number(p.amount_usdc), winningPool, m.totalPool, m.feeBps) : 0;
      await db.query(
        `UPDATE boz_predictions SET status=$1, payout_amount=$2 WHERE id=$3`,
        [won ? 'WON' : 'LOST', payout, p.id]
      );
    }
  } catch { /* best-effort payouts */ }

  await db.query(
    `UPDATE boz_markets SET status='SETTLED', winning_outcome=$1, settled_at=NOW(),
       settlement_tx=$2, receipt=$3 WHERE id=$4`,
    [winningOutcome, settlementTx, JSON.stringify(receipt), m.id]
  );

  return { ...m, status: 'SETTLED', winningOutcome, settlementTx, receipt, settledAt: receipt.verifiedAt };
}
