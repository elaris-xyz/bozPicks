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
}

const SSEContext = createContext<SSEContextValue>({
  connected: false,
  subscribe: () => () => {},
});

export function SSEProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const subs = useRef<Set<Subscriber>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/stream');
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as SSEMessage;
          if (msg.type === 'ping') { setConnected(true); return; }
          subs.current.forEach(fn => fn(msg));
        } catch { /* skip malformed */ }
      };

      es.onerror = () => {
        setConnected(false);
        // EventSource handles reconnect automatically
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, []);

  const subscribe = useCallback((fn: Subscriber) => {
    subs.current.add(fn);
    return () => { subs.current.delete(fn); };
  }, []);

  return (
    <SSEContext.Provider value={{ connected, subscribe }}>
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
