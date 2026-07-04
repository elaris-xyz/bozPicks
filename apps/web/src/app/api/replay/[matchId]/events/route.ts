import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ReplayEvent } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const { rows } = await db.query<ReplayEvent>(
    `SELECT id, match_id, recorded_at, delay_ms, payload
     FROM boz_replay_events
     WHERE match_id = $1
     ORDER BY delay_ms ASC`,
    [matchId]
  );
  return NextResponse.json(rows);
}
