import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rowToMarket } from '@/lib/markets';

export const dynamic = 'force-dynamic';

/** GET /api/markets?matchId=… → prop markets for a match (pools + settlement). */
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');
  try {
    const { rows } = matchId
      ? await db.query(`SELECT * FROM boz_markets WHERE match_id=$1 ORDER BY created_at ASC`, [matchId])
      : await db.query(`SELECT * FROM boz_markets ORDER BY created_at DESC LIMIT 60`);
    return NextResponse.json(rows.map(rowToMarket));
  } catch {
    return NextResponse.json([]);
  }
}
