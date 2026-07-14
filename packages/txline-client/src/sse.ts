// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const EventSource = require('eventsource') as any;
import { authHeaders } from './auth';
import type { TxOddsPayload, TxScores } from './rest';

const TXLINE_BASE = 'https://txline.txodds.com';

export type SSEStreamType = 'odds' | 'scores';

export type SSEHandlers<T> = {
  onMessage: (data: T, eventId?: string) => void;
  onHeartbeat?: (ts: number) => void;
  onError?: (err: Event) => void;
  onReconnect?: (attempt: number) => void;
};

const MAX_BACKOFF_MS = 30_000;
// If neither a data message NOR a heartbeat arrives within this window, the
// connection has gone "zombie" (TCP still open, load balancer stopped feeding
// it) — EventSource never fires onerror for that, so we detect the stall
// ourselves and force a reconnect. Longer than the 60s free-tier update cadence
// so a quiet in-play minute never false-triggers.
const STALL_MS = 75_000;
const WATCHDOG_MS = 15_000;

export function connectOddsStream(
  fixtureId: number | undefined,
  handlers: SSEHandlers<TxOddsPayload>
): () => void {
  return connectStream<TxOddsPayload>('odds', fixtureId, handlers);
}

export function connectScoresStream(
  fixtureId: number | undefined,
  handlers: SSEHandlers<TxScores>
): () => void {
  return connectStream<TxScores>('scores', fixtureId, handlers);
}

function connectStream<T>(
  type: SSEStreamType,
  fixtureId: number | undefined,
  handlers: SSEHandlers<T>
): () => void {
  let es: EventSource | null = null;
  let attempt = 0;
  let stopped = false;
  let lastEventId: string | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastActivity = Date.now();
  let watchdog: ReturnType<typeof setInterval> | null = null;

  const bump = () => { lastActivity = Date.now(); };

  async function connect() {
    const headers = await authHeaders();
    const url = new URL(`${TXLINE_BASE}/api/${type}/stream`);
    if (fixtureId) url.searchParams.set('fixtureId', String(fixtureId));

    const esHeaders: Record<string, string> = { ...headers };
    if (lastEventId) esHeaders['Last-Event-ID'] = lastEventId;

    es = new EventSource(url.toString(), { headers: esHeaders });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const localEs = es!;
    bump();

    localEs.onopen = () => { bump(); };

    localEs.onmessage = (e: MessageEvent) => {
      attempt = 0;
      bump();
      if (e.lastEventId) lastEventId = e.lastEventId;
      try {
        const parsed = JSON.parse(e.data);
        if (parsed?.Ts && Object.keys(parsed).length === 1) {
          handlers.onHeartbeat?.(parsed.Ts);
        } else {
          handlers.onMessage(parsed as T, e.lastEventId);
        }
      } catch { /* skip malformed */ }
    };

    // heartbeat events
    localEs.addEventListener('heartbeat', (e: MessageEvent) => {
      bump();
      try { handlers.onHeartbeat?.(JSON.parse(e.data)?.Ts); } catch { /* skip */ }
    });

    localEs.onerror = (err: Event) => {
      handlers.onError?.(err);
      es?.close();
      es = null;
      if (!stopped) scheduleReconnect();
    };
  }

  // stall watchdog — if the stream goes silent past STALL_MS (no error fired),
  // tear it down and reconnect so a zombie connection self-heals.
  watchdog = setInterval(() => {
    if (stopped || !es) return;
    if (Date.now() - lastActivity > STALL_MS) {
      handlers.onReconnect?.(attempt + 1);
      try { es.close(); } catch { /* ignore */ }
      es = null;
      scheduleReconnect();
    }
  }, WATCHDOG_MS);

  function scheduleReconnect() {
    attempt++;
    const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
    handlers.onReconnect?.(attempt);
    reconnectTimer = setTimeout(() => { void connect(); }, delay);
  }

  void connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (watchdog) clearInterval(watchdog);
    es?.close();
  };
}
