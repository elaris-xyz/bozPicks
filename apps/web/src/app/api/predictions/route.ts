import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { matchId, walletAddress, outcome, amountUsdc, escrowTx } = body;

  if (!matchId || !walletAddress || !outcome || !amountUsdc || !escrowTx) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['HOME', 'DRAW', 'AWAY'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }

  if (amountUsdc < 1_000_000) {
    return NextResponse.json({ error: 'Minimum 1 USDC' }, { status: 400 });
  }

  const id = randomUUID();

  try {
    await db.query(
      `INSERT INTO boz_predictions
         (id, match_id, wallet_address, outcome, amount_usdc, escrow_tx, status)
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')`,
      [id, matchId, walletAddress, outcome, amountUsdc, escrowTx]
    );

    // Update pool totals
    const col = outcome === 'HOME' ? 'pool_home' : outcome === 'DRAW' ? 'pool_draw' : 'pool_away';
    await db.query(
      `UPDATE boz_pools
       SET ${col} = ${col} + $1, total_pool = total_pool + $1
       WHERE match_id = $2`,
      [amountUsdc, matchId]
    );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('[predictions] DB error:', e);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const { rows } = await db.query(
    `SELECT p.*, m.home_team, m.away_team, m.home_score, m.away_score, m.status AS match_status
     FROM boz_predictions p
     JOIN boz_matches m ON m.id = p.match_id
     WHERE p.wallet_address = $1
     ORDER BY p.placed_at DESC LIMIT 50`,
    [wallet]
  );

  return NextResponse.json(rows);
}
