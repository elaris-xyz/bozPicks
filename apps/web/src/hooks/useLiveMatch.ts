'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent, MatchState } from '@bozpicks/shared';

export interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  live: boolean;
}

/**
 * Authoritative "is a match live right now" source. Inferring live/idle purely
 * from the SSE stream is fragile — the connect catch-up replays old events (a
 * stale MATCH_END would wrongly show idle). So we fetch the current LIVE match
 * from /api/matches on mount, ignore catch-up events (>8s old), and only update
 * from fresh events. Returns the live match (with score/minute) or null.
 */
export function useLiveMatch(): LiveMatch | null {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const list = await fetch('/api/matches').then(r => r.json());
      const m: MatchState | undefined = Array.isArray(list)
        ? list.find((x: MatchState) => x.status === 'LIVE' || x.status === 'HALFTIME')
        : undefined;
      setMatch(m ? {
        id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore, awayScore: m.awayScore,
        minute: m.currentMinute, live: true,
      } : null);
    } catch { /* keep current */ } finally { loading.current = false; }
  }, []);

  useEffect(() => { load(); }, [load]);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (Date.now() - new Date(e.timestamp).getTime() > 8000) return; // ignore catch-up

      if (e.type === 'MATCH_START') { load(); return; }

      setMatch(prev => {
        // an event for a match we're not tracking → discover it (unless it's an end)
        if (!prev || prev.id !== e.matchId) {
          if (e.type !== 'MATCH_END') load();
          return prev;
        }
        return {
          ...prev,
          homeScore: e.score?.home ?? prev.homeScore,
          awayScore: e.score?.away ?? prev.awayScore,
          minute: e.matchMinute || prev.minute,
          live: e.type !== 'MATCH_END',
        };
      });
    },
  });

  return match;
}
