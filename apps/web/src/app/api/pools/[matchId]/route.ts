import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ParimutuelPool } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const { rows } = await db.query<ParimutuelPool>(
    `SELECT * FROM boz_pools WHERE match_id = $1`,
    [matchId]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: 'pool not found' }, { status: 404 });
  }

  const r = rows[0] as unknown as Record<string, unknown>;
  const pool: ParimutuelPool = {
    matchId:        String(r.match_id ?? r.matchId ?? ''),
    status:         (r.status as ParimutuelPool['status']) ?? 'OPEN',
    pools: {
      home: Number(r.pool_home ?? 0),
      draw: Number(r.pool_draw ?? 0),
      away: Number(r.pool_away ?? 0),
    },
    totalPool:      Number(r.total_pool ?? 0),
    feeBps:         Number(r.fee_bps ?? 200),
    escrowPda:      String(r.escrow_pda ?? r.escrowPda ?? ''),
    winningOutcome: (r.winning_outcome as ParimutuelPool['winningOutcome']) ?? undefined,
    settledAt:      r.settled_at ? String(r.settled_at) : undefined,
    settlementTx:   r.settlement_tx ? String(r.settlement_tx) : undefined,
  };

  return NextResponse.json(pool);
}
