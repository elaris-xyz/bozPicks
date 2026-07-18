import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { rowToMarket } from '@/lib/markets';
import { displayToUsdc } from '@bozpicks/shared';
import { moveVault, getVault, InsufficientFunds } from '@/lib/vault';

export const dynamic = 'force-dynamic';

// Bots and the legacy demo wallet stake straight into the pool (simulated order
// flow) — real players stake from their signed game vault.
const NON_VAULT = (w: string) => w === 'demo-wallet' || w.startsWith('bot.');

/**
 * POST /api/markets/[id]/predict
 * body: { outcome, amountUsdc, wallet, escrowTx? }
 * Debits the player's game vault instantly (no per-stake signing) and grows the
 * outcome pool. 402 if the vault can't cover the stake — the client prompts a
 * top-up. Winnings are credited back to the vault at settlement.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { outcome?: string; amountUsdc?: number; wallet?: string; escrowTx?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }

  const { outcome, amountUsdc, wallet } = body;
  if (!outcome || !amountUsdc || amountUsdc <= 0 || !wallet) {
    return NextResponse.json({ error: 'outcome, amountUsdc, wallet required' }, { status: 400 });
  }
  const micro = displayToUsdc(amountUsdc);

  try {
    const { rows } = await db.query(`SELECT * FROM boz_markets WHERE id=$1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'market not found' }, { status: 404 });
    const m = rowToMarket(rows[0]);
    if (m.status !== 'OPEN') return NextResponse.json({ error: 'market not open' }, { status: 409 });
    if (!m.outcomes.includes(outcome)) return NextResponse.json({ error: 'invalid outcome' }, { status: 400 });

    const isVault = !NON_VAULT(wallet);
    const pools = { ...m.pools };
    let total = m.totalPool;
    let replacedFrom: string | null = null;

    // ── Change-of-mind = REPLACE, not a second charge ────────────────────────
    // One active pick per market for a real player. If they already staked and
    // now tap a DIFFERENT outcome, refund the old stake and move it to the new
    // pick — never leave them charged twice for two picks they can't both track.
    // (Bots / the demo sim flow always append, so their order flow is untouched.)
    if (isVault) {
      const { rows: mine } = await db.query(
        `SELECT id, outcome, amount_usdc FROM boz_predictions
         WHERE market_id=$1 AND wallet_address=$2 AND status='ACTIVE'`,
        [id, wallet]
      );
      // already this exact pick → no-op, so a double-tap never double-charges
      if (mine.length === 1 && mine[0].outcome === outcome) {
        const v = await getVault(wallet).catch(() => null);
        return NextResponse.json({ ok: true, market: m, unchanged: true, balance: v?.balance });
      }
      if (mine.length > 0) {
        const refund = mine.reduce((s, p) => s + Number(p.amount_usdc), 0);
        for (const p of mine) {
          pools[p.outcome] = Math.max(0, (pools[p.outcome] ?? 0) - Number(p.amount_usdc));
          total = Math.max(0, total - Number(p.amount_usdc));
          if (!replacedFrom) replacedFrom = p.outcome;
        }
        // refund FIRST (leaves state consistent if it throws), then drop the rows
        await moveVault({ wallet, delta: refund, kind: 'REFUND', ref: `Changed pick · ${m.label}`, requireExisting: true });
        await db.query(
          `DELETE FROM boz_predictions WHERE market_id=$1 AND wallet_address=$2 AND status='ACTIVE'`,
          [id, wallet]
        );
      }
    }

    // Debit the vault for the new stake — if the player can't afford it, nothing
    // else moves (any refund above already put the old stake back).
    let vaultBalance: number | undefined;
    if (isVault) {
      try {
        // ref carries the outcome, not just the market name, so a viewer
        // reading the activity log later can tell WHAT was picked, not just
        // which market — "Staked on OVER — Total Corners 9.5" vs. just
        // "Total Corners 9.5"
        vaultBalance = await moveVault({ wallet, delta: -micro, kind: 'STAKE', ref: `${outcome} · ${m.label}` });
      } catch (e) {
        if (e instanceof InsufficientFunds) {
          return NextResponse.json({ error: 'insufficient', balance: e.balance, needed: micro }, { status: 402 });
        }
        throw e;
      }
    }

    pools[outcome] = (pools[outcome] ?? 0) + micro;
    total = total + micro;

    await db.query(
      `UPDATE boz_markets SET pools=$1, total_pool=$2 WHERE id=$3`,
      [JSON.stringify(pools), total, id]
    );
    await db.query(
      `INSERT INTO boz_predictions (id, match_id, market_id, wallet_address, outcome, amount_usdc, escrow_tx, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')`,
      [randomUUID(), m.matchId, id, wallet, outcome, micro, body.escrowTx ?? 'vault-stake']
    );

    const updated = { ...m, pools, totalPool: total };
    // fire-and-forget: the stake is already committed (DB), and the client
    // gets the fresh market in this response either way — a slow/degraded
    // Redis must never add seconds to the button's response time (this was
    // an `await`, so a stalled Redis directly caused the "click takes up to
    // 10s" lag reported during the recent quota outage)
    void redis.publish('boz:markets', JSON.stringify(updated)).catch(() => {});
    return NextResponse.json({ ok: true, market: updated, balance: vaultBalance, replacedFrom });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
