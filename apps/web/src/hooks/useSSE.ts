'use client';

import { useEffect, useRef } from 'react';
import type { SSEMessage } from '@bozpicks/shared';
import { useSSESubscription } from '@/contexts/SSEContext';

type SSEOptions = {
  matchId?: string;
  onMessage: (msg: SSEMessage) => void;
  onError?: () => void;
  onReconnect?: () => void;
};

export function useSSE({ matchId, onMessage, onError, onReconnect }: SSEOptions) {
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  // Global stream → use shared SSEContext (no extra connection)
  useSSESubscription(matchId ? null : (msg) => onMsgRef.current(msg));

  // Match-specific stream → dedicated EventSource
  useEffect(() => {
    if (!matchId) return;

    const es = new EventSource(`/api/stream?matchId=${matchId}`);
    es.onmessage = (e) => {
      try { onMsgRef.current(JSON.parse(e.data) as SSEMessage); } catch { /* skip */ }
    };
    es.onerror = () => {
      onError?.();
      onReconnect?.();
      // EventSource auto-reconnects
    };
    return () => es.close();
  }, [matchId, onError, onReconnect]);
}
