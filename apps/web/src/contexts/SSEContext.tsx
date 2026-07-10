'use client';

import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import type { SSEMessage } from '@bozpicks/shared';

type Subscriber = (msg: SSEMessage) => void;

interface SSEContextValue {
  connected: boolean;
  subscribe: (fn: Subscriber) => () => void;
  /** Force a fresh EventSource — used by the Run watchdog to heal a stream
      that reports connected but has stopped delivering events. */
  reconnect: () => void;
  /** Date.now() of the last real (non-ping) live message — watchdog input. */
  lastEventAt: () => number;
}

const SSEContext = createContext<SSEContextValue>({
  connected: false,
  subscribe: () => () => {},
  reconnect: () => {},
  lastEventAt: () => 0,
});

export function SSEProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const subs = useRef<Set<Subscriber>>(new Set());
  const esRef = useRef<EventSource | null>(null);
  const lastEvent = useRef(0);

  const connect = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource('/api/stream');
    esRef.current = es;
    lastEvent.current = Date.now(); // grace period for the fresh connection

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as SSEMessage;
        if (msg.type === 'ping') { setConnected(true); return; }
        if (!msg.catchup) lastEvent.current = Date.now();
        subs.current.forEach(fn => fn(msg));
      } catch { /* skip malformed */ }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource handles reconnect automatically
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  const subscribe = useCallback((fn: Subscriber) => {
    subs.current.add(fn);
    return () => { subs.current.delete(fn); };
  }, []);

  const lastEventAt = useCallback(() => lastEvent.current, []);

  return (
    <SSEContext.Provider value={{ connected, subscribe, reconnect: connect, lastEventAt }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSEContext() {
  return useContext(SSEContext);
}

/** Subscribe to global SSE events without creating a new connection */
export function useSSESubscription(fn: ((msg: SSEMessage) => void) | null) {
  const { subscribe } = useSSEContext();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return subscribe((msg) => { if (fnRef.current) fnRef.current(msg); });
  }, [subscribe]);
}
