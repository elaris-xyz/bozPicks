import { NextRequest } from 'next/server';
import Redis from 'ioredis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');
  const channel = matchId ? `boz:events:${matchId}` : 'boz:global';

  // ioredis emits an 'error' event on transient TLS resets (Upstash idle drops).
  // Without a listener it becomes an "Unhandled error event" that crashes the
  // dev overlay — attach a quiet handler; ioredis auto-reconnects.
  const quietErrors = (c: Redis) => c.on('error', (e: Error) => {
    if (!/ECONNRESET|ECONNREFUSED|ETIMEDOUT|Connection is closed/.test(e.message)) {
      console.error('[stream:redis]', e.message);
    }
  });

  // read catch-up history before opening the stream
  const reader = new Redis(process.env.REDIS_URL!);
  quietErrors(reader);
  const historyRaw = await reader.lrange('boz:global:history', 0, 19);
  await reader.quit();
  const history = historyRaw.reverse(); // oldest first

  const sub = new Redis(process.env.REDIS_URL!);
  quietErrors(sub);

  const encoder = new TextEncoder();

  // Shared teardown state across start()/cancel(). Once the client disconnects
  // the controller is closed; any later enqueue()/close() throws
  // ERR_INVALID_STATE and — inside the async Redis callbacks — surfaces as an
  // uncaughtException that destabilises the server. Guard every touch.
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const teardown = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    sub.disconnect();
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          teardown(); // controller already closed → stop the subscription
        }
      };

      send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));

      // send recent events so client is up-to-date immediately after connect
      for (const raw of history) {
        try {
          send(JSON.stringify({ type: 'event', data: JSON.parse(raw), ts: new Date().toISOString() }));
        } catch { /* skip malformed */ }
      }

      sub.on('message', (ch, message) => {
        try {
          const data = JSON.parse(message);
          send(JSON.stringify({ type: ch === 'boz:signals' ? 'signal' : 'event', data, ts: new Date().toISOString() }));
        } catch { /* malformed payload — skip */ }
      });

      sub.subscribe(channel).catch(teardown);
      sub.subscribe('boz:signals').catch(teardown);

      // heartbeat keeps proxies from dropping an idle connection
      heartbeat = setInterval(() => send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() })), 25_000);
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
