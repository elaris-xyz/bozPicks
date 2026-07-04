import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import type { ReplayEvent } from '@bozpicks/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const speed = parseFloat(req.nextUrl.searchParams.get('speed') ?? '1');
  const { matchId } = await params;

  const { rows } = await db.query<ReplayEvent>(
    `SELECT * FROM boz_replay_events WHERE match_id = $1 ORDER BY delay_ms ASC`,
    [matchId]
  );

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
      };

      // initial meta
      send(JSON.stringify({ type: 'replay_start', matchId, totalEvents: rows.length }));

      let lastDelayMs = 0;
      for (const row of rows) {
        const waitMs = Math.max(0, (row.delayMs - lastDelayMs) / speed);
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
        }
        send(JSON.stringify(row.payload));
        lastDelayMs = row.delayMs;
      }

      send(JSON.stringify({ type: 'replay_end', matchId }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Replay-Match': matchId,
    },
  });
}
