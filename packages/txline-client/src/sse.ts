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

  async function connect() {
    const headers = await authHeaders();
    const url = new URL(`${TXLINE_BASE}/api/${type}/stream`);
    if (fixtureId) url.searchParams.set('fixtureId', String(fixtureId));

    const esHeaders: Record<string, string> = { ...headers };
    if (lastEventId) esHeaders['Last-Event-ID'] = lastEventId;

    es = new EventSource(url.toString(), { headers: esHeaders });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const localEs = es!;

    localEs.onmessage = (e: MessageEvent) => {
      attempt = 0;
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
      try { handlers.onHeartbeat?.(JSON.parse(e.data)?.Ts); } catch { /* skip */ }
    });

    localEs.onerror = (err: Event) => {
      handlers.onError?.(err);
      es?.close();
      es = null;
      if (!stopped) scheduleReconnect();
    };
  }

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
    es?.close();
  };
}
