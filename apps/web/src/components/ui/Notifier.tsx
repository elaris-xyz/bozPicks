'use client';

import { useSSESubscription } from '@/contexts/SSEContext';
import { fireToast } from './Toast';
import type { BozEvent, AgentSignal, SSEMessage } from '@bozpicks/shared';

export function Notifier() {
  useSSESubscription((msg: SSEMessage) => {
    if (msg.type === 'event' && msg.data) {
      const ev = msg.data as BozEvent;
      // Ignore SSE catch-up: on first load the stream replays recent events from
      // an already-finished demo match. Firing "Goal!"/"Red Card" toasts for a
      // match that's over is confusing — only notify on genuinely live events.
      if (Date.now() - new Date(ev.timestamp).getTime() > 8000) return;
      if (ev.type === 'GOAL') {
        fireToast({
          kind: 'goal',
          title: `Goal! ${ev.team ?? ''}`,
          body: `${ev.player ? ev.player + ' · ' : ''}${ev.matchMinute}'${ev.score ? ` (${ev.score.home}–${ev.score.away})` : ''}`,
        });
      }
      if (ev.type === 'RED_CARD') {
        fireToast({ kind: 'warn', title: 'Red Card', body: `${ev.player ?? ''} · ${ev.team ?? ''} ${ev.matchMinute}'` });
      }
      if (ev.type === 'MATCH_START') {
        fireToast({ kind: 'info', title: 'Match Started', body: 'Live odds now active' });
      }
    }

    if (msg.type === 'signal' && msg.data) {
      const sig = msg.data as AgentSignal;
      const dir = sig.deltaPercent > 0 ? '↑' : '↓';
      fireToast({
        kind: 'signal',
        title: `Sharp Move: ${sig.affectedOutcome} ${dir}${Math.abs(sig.deltaPercent).toFixed(1)}%`,
        body: sig.context ?? `Confidence: ${sig.confidence}`,
      });
    }
  });

  return null;
}
