'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSSEContext, useSSESubscription } from './SSEContext';
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

const LiveMatchContext = createContext<LiveMatch | null>(null);

/**
 * ONE live-match truth for the whole app. Previously every component called a
 * useLiveMatch hook that ran its own /api/matches fetch + 10s poll + SSE
 * subscription — a dozen independent copies that flipped live/idle at
 * different moments (the scoreboard could be LIVE while Hi-Lo still said "no
 * live match"). This provider runs the logic once; every consumer re-renders
 * from the same state in the same tick.
 */
export function LiveMatchProvider({ children }: { children: ReactNode }) {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const loading = useRef(false);
  const { reconnect, lastEventAt } = useSSEContext();
  const matchRef = useRef<LiveMatch | null>(null);
  matchRef.current = match;

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const list = await fetch('/api/matches', { cache: 'no-store' }).then(r => r.json());
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

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // poll fallback (SSE may hiccup)
    return () => clearInterval(t);
  }, [load]);

  // Zombie-stream watchdog: the DB says a match is LIVE (poll) but the SSE
  // connection hasn't delivered a single live event for 12s → the stream is
  // connected-but-silent. Force one fresh EventSource; heals every consumer
  // (feed, Hi-Lo, pundit, VFX, sounds) at once.
  useEffect(() => {
    const t = setInterval(() => {
      if (matchRef.current?.live && Date.now() - lastEventAt() > 12_000) {
        reconnect();
      }
    }, 6_000);
    return () => clearInterval(t);
  }, [reconnect, lastEventAt]);

  useSSESubscription((msg: SSEMessage) => {
    if (msg.type !== 'event' || !msg.data) return;
    const e = msg.data as BozEvent;
    if (msg.catchup) return; // history replay — the fetch/poll is authoritative

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
  });

  return <LiveMatchContext.Provider value={match}>{children}</LiveMatchContext.Provider>;
}

export function useLiveMatchContext(): LiveMatch | null {
  return useContext(LiveMatchContext);
}
