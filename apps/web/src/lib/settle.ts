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
    // payout_amount IS NULL = "no settle pass has graded-and-paid this row
    // yet". Selecting on that (not just ACTIVE) heals rows another writer
    // flipped without paying — the keeper's legacy 1X2 grader used to blanket
    // WON/LOST every prediction of the match, which made this loop skip the
    // vault credit entirely (the "won total never moves" bug).
    const { rows: preds } = await db.query(
      `SELECT id, outcome, amount_usdc, wallet_address FROM boz_predictions
       WHERE market_id=$1 AND (status='ACTIVE' OR payout_amount IS NULL)`,
      [m.id]
    );
    for (const p of preds) {
      const won = p.outcome === winningOutcome;
      const payout = won ? payoutFor(Number(p.amount_usdc), winningPool, m.totalPool, m.feeBps) : 0;
      // Idempotent + race-safe: this UPDATE always sets payout_amount, and only
      // rows whose payout_amount is still NULL can match — so even when settle
      // passes overlap (demo + sweep + auto-heal), each row is paid at most
      // once; the losing pass sees rowCount 0 and skips the credit.
      const upd = await db.query(
        `UPDATE boz_predictions SET status=$1, payout_amount=$2
         WHERE id=$3 AND (status='ACTIVE' OR payout_amount IS NULL)`,
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

/**
 * Rebuild a match's final stats straight from the DB (score + event history) —
 * works even when Redis (which normally caches a replay's final stats) is
 * unavailable. Used by the settle-sweep and by /api/markets to settle a real
 * fixture's markets once the match is FINISHED.
 */
export async function finalStatsFromDb(matchId: string): Promise<FinalStats | null> {
  const { rows: mrows } = await db.query(
    `SELECT home_team, away_team, home_score, away_score FROM boz_matches WHERE id=$1`,
    [matchId]
  );
  if (!mrows[0]) return null;
  const homeScore = Number(mrows[0].home_score ?? 0);
  const awayScore = Number(mrows[0].away_score ?? 0);

  const { rows: evs } = await db.query(
    `SELECT type, match_minute, payload FROM boz_events WHERE match_id=$1
     ORDER BY (payload->>'seq')::bigint ASC NULLS LAST, match_minute ASC, created_at ASC`,
    [matchId]
  );
  // COUNTING events undercounts real matches whenever the ingest has gaps (a
  // corners market must not settle at 1 when TxLINE's cumulative total says 8).
  // Every record carries cumulative totals in payload.stats — take the max
  // ever seen and never settle below it. First scorer likewise comes from the
  // first RUNNING-SCORE increment, which survives a missed/misclassified goal
  // record (e.g. penalty_outcome).
  let cCorners = 0, cCards = 0, nCorners = 0, nCards = 0;
  let firstScorer: 'HOME' | 'AWAY' | 'NONE' = 'NONE';
  let prevH = 0, prevA = 0;
  for (const e of evs) {
    if (e.type === 'CORNER') nCorners++;
    else if (e.type === 'YELLOW_CARD' || e.type === 'RED_CARD') nCards++;
    const st = e.payload?.stats as { cornersHome?: number; cornersAway?: number; yellowHome?: number; yellowAway?: number; redHome?: number; redAway?: number } | undefined;
    if (st) {
      cCorners = Math.max(cCorners, (st.cornersHome ?? 0) + (st.cornersAway ?? 0));
      cCards = Math.max(cCards, (st.yellowHome ?? 0) + (st.yellowAway ?? 0) + (st.redHome ?? 0) + (st.redAway ?? 0));
    }
    const sc = e.payload?.score as { home?: number; away?: number } | undefined;
    if (sc) {
      const h = sc.home ?? 0, a = sc.away ?? 0;
      if (firstScorer === 'NONE' && (h > prevH || a > prevA)) {
        firstScorer = h > prevH ? 'HOME' : 'AWAY';
      }
      prevH = Math.max(prevH, h); prevA = Math.max(prevA, a);
    }
  }
  return {
    homeScore, awayScore,
    totalGoals: homeScore + awayScore,
    totalCorners: Math.max(cCorners, nCorners),
    totalCards: Math.max(cCards, nCards),
    btts: homeScore > 0 && awayScore > 0,
    firstScorer,
  };
}
