'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useSSEContext } from '@/contexts/SSEContext';
import { useLiveMatchContext } from '@/contexts/LiveMatchContext';
import { useQuiet } from '@/lib/quiet';
import type { BozEvent, MatchState, SSEMessage } from '@bozpicks/shared';
import { Flag } from './Flag';
import {
  IconBall, IconCard, IconSub, IconTrendUp, IconKickoff,
  IconFlagEnd, IconPause, IconChart, IconTarget,
} from './Icons';

/**
 * Broadcast-grade live feed. Every TxLINE event type gets its own colour and
 * icon; each card carries a match-identity footer (flag · score · VS · score ·
 * flag) so several concurrent matches stay legible. The newest event glows;
 * events from a finished match fade to a muted "dead" palette so a freshly
 * kicked-off match reads as distinctly live.
 */

const IconOffside = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3v18" /><path d="M5 4h11l-2.5 3.5L16 11H5" />
  </svg>
);
const IconWhistle = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="14" r="5" /><path d="M14 12h7M14 12l-1-4h5l-1 4" />
  </svg>
);
const IconVar = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" />
  </svg>
);

type EventCfg = { label: string; color: string; icon: React.ReactNode };

// distinct hue per event type — no two categories share a colour
const EVENT_CFG: Record<string, EventCfg> = {
  GOAL:        { label: 'Goal',        color: '#22c55e', icon: <IconBall size={14} /> },
  PENALTY:     { label: 'Penalty',     color: '#4ade80', icon: <IconBall size={14} /> },
  SHOT:        { label: 'Shot',        color: '#06b6d4', icon: <IconTarget size={13} /> },
  CORNER:      { label: 'Corner',      color: '#f59e0b', icon: <IconFlagEnd size={13} /> },
  YELLOW_CARD: { label: 'Yellow',      color: '#eab308', icon: <IconCard size={13} /> },
  RED_CARD:    { label: 'Red Card',    color: '#ef4444', icon: <IconCard size={13} /> },
  OFFSIDE:     { label: 'Offside',     color: '#fb7185', icon: <IconOffside size={13} /> },
  FOUL:        { label: 'Foul',        color: '#8b9bb4', icon: <IconWhistle size={13} /> },
  VAR:         { label: 'VAR Review',  color: '#a855f7', icon: <IconVar size={13} /> },
  SUBSTITUTION:{ label: 'Sub',         color: '#38bdf8', icon: <IconSub size={13} /> },
  ODDS_UPDATE: { label: 'Odds',        color: '#3b82f6', icon: <IconTrendUp size={13} /> },
  SCORE_UPDATE:{ label: 'Score',       color: '#2dd4bf', icon: <IconChart size={13} /> },
  MATCH_START: { label: 'Kick-off',    color: '#34d399', icon: <IconKickoff size={14} /> },
  MATCH_END:   { label: 'Full time',   color: '#94a3b8', icon: <IconFlagEnd size={13} /> },
  HALFTIME:    { label: 'Half time',   color: '#fbbf24', icon: <IconPause size={13} /> },
};
const DEFAULT_CFG: EventCfg = { label: 'Event', color: '#9ca3af', icon: <span className="text-[10px]">•</span> };

// event-specific detail line (what actually happened)
function detailOf(e: BozEvent): string {
  if (e.type === 'SHOT' && e.shotOutcome) return e.shotOutcome.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (e.type === 'VAR') return `${e.varType ?? 'Review'} — ${e.varOutcome ?? 'checking'}`;
  if (e.player) return e.player;
  if (e.team) return e.team;
  return '';
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface Meta { home: string; away: string }

export function LiveEventFeed() {
  const { recentEvents } = useSSEContext();
  const liveMatch = useLiveMatchContext();
  // seed from the provider's ring buffer — navigating away and back keeps the
  // feed populated instead of restarting empty mid-match.
  // SCORE_UPDATE is the normalizer's catch-all for routine stat ticks (the real
  // feed emits dozens per minute) — they carry nothing a viewer can read, so
  // they never become cards; every card's footer already shows the live score.
  const [events, setEvents] = useState<BozEvent[]>(() => recentEvents().filter(e => e.type !== 'SCORE_UPDATE'));
  const [connected, setConnected] = useState(false);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const activeMatch = useRef<string | null>(null);
  const [, force] = useState(0);

  // team names for the match-identity footer — (re)loaded on mount and whenever
  // a new match kicks off (a fresh demo match won't be in the first fetch).
  const loadMeta = useRef<() => void>(() => {});
  loadMeta.current = () => {
    fetch('/api/matches', { cache: 'no-store' })
      .then(r => r.json())
      .then((ms: MatchState[]) => {
        if (!Array.isArray(ms)) return;
        setMeta(prev => {
          const next = { ...prev };
          for (const m of ms) next[m.id] = { home: m.homeTeam, away: m.awayTeam };
          return next;
        });
      })
      .catch(() => {});
  };
  useEffect(() => { loadMeta.current(); }, []);

  // re-tick "x ago" labels every 10s
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 10_000); return () => clearInterval(t); }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'ping') { setConnected(true); return; }
      if (msg.type === 'match_update' && msg.data) {
        const m = msg.data as MatchState;
        setMeta(prev => ({ ...prev, [m.id]: { home: m.homeTeam, away: m.awayTeam } }));
        return;
      }
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;
        if (e.type === 'SCORE_UPDATE') return; // routine stat tick — not a feed moment
        if (e.type === 'MATCH_START') { activeMatch.current = e.matchId; loadMeta.current(); }
        if (e.type === 'MATCH_END') setFinished(f => new Set(f).add(e.matchId));
        setEvents(prev => {
          if (prev.some(x => x.id === e.id)) return prev;
          if (!activeMatch.current) activeMatch.current = e.matchId;
          return [e, ...prev].slice(0, 30);
        });
      }
    },
    onError: () => setConnected(false),
    onReconnect: () => setConnected(false),
  });

  const isLive = Boolean(liveMatch?.live);
  const quiet = useQuiet();
  // quiet mode → hide the odds-tick cards that flood a live match's feed
  const shown = quiet ? events.filter(e => e.type !== 'ODDS_UPDATE') : events;
  const hasEvents = shown.length > 0;

  // No events at all → collapse to a slim bar with a corner note. Nothing to
  // show, so we don't reserve a tall empty box.
  if (!hasEvents) {
    return (
      <div className="glass px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#4b5563' }} />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Live Feed</span>
        </div>
        <span className="text-[11px] text-gray-500">No active match</span>
      </div>
    );
  }

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected && isLive ? 'badge-live' : ''}`}
                style={{ background: connected && isLive ? 'var(--green)' : '#4b5563' }} />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Live Feed</span>
          {/* a finished match's events stay visible but read as inactive */}
          {!isLive && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>Finished</span>
          )}
        </div>
        <span className="text-[10px] text-gray-500">{shown.length} events</span>
      </div>

      {(
        <div className={`relative overflow-x-auto rail-scroll pb-1 ${isLive ? '' : 'opacity-60 saturate-50'}`}>
          <div className="flex gap-2.5 min-w-max pt-1">
            {shown.map((e, idx) => {
              const cfg = EVENT_CFG[e.type] ?? DEFAULT_CFG;
              // when no match is live, every card reads as inactive (grey)
              const dead = !isLive || finished.has(e.matchId) || (activeMatch.current != null && e.matchId !== activeMatch.current);
              const newest = idx === 0 && !dead;
              const c = dead ? '#64748b' : cfg.color;
              const m = meta[e.matchId];
              const detail = detailOf(e);

              return (
                <div key={e.id}
                     className={`relative w-[158px] h-[120px] shrink-0 rounded-xl flex flex-col overflow-hidden anim-in ${newest ? 'fx-rise' : ''}`}
                     style={{
                       background: dead ? 'rgba(30,41,59,0.35)' : `linear-gradient(180deg, ${c}14, rgba(12,18,32,0.6))`,
                       border: `1px solid ${dead ? 'rgba(100,116,139,0.25)' : c + '66'}`,
                       boxShadow: newest ? `0 0 0 1px ${c}66, 0 6px 22px ${c}44` : undefined,
                       filter: dead ? 'saturate(0.5)' : undefined,
                       opacity: dead ? 0.7 : 1,
                     }}>
                  {/* colour accent bar */}
                  <div className="h-[3px] w-full flex-shrink-0" style={{ background: c }} />

                  <div className="flex-1 flex flex-col px-2.5 py-2 min-h-0">
                    {/* header: icon + label + minute */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: `${c}22`, color: c }}>
                          {cfg.icon}
                        </span>
                        <span className="text-[11px] font-bold truncate" style={{ color: c }}>{cfg.label}</span>
                      </div>
                      {e.matchMinute > 0 && (
                        <span className="text-[10px] font-mono font-bold tabular-nums flex-shrink-0" style={{ color: dead ? '#94a3b8' : '#e2e8f0' }}>
                          {e.matchMinute}&rsquo;
                        </span>
                      )}
                    </div>

                    {/* detail: player / outcome */}
                    <p className="text-[11px] text-gray-300 leading-tight mt-1 line-clamp-2 flex-1">{detail}</p>

                    {/* newest badge / time */}
                    <div className="flex items-center justify-between">
                      {newest
                        ? <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: `${c}22`, color: c }}>Latest</span>
                        : <span className="text-[9px] text-gray-500">{timeAgo(e.timestamp)}</span>}
                    </div>
                  </div>

                  {/* match-identity footer: flag · score · VS · score · flag */}
                  <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 flex-shrink-0"
                       style={{ background: 'rgba(3,7,18,0.55)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Flag team={m?.home} size="xs" />
                    <span className="text-[11px] font-black tabular-nums" style={{ color: dead ? '#94a3b8' : '#f8fafc' }}>{e.score?.home ?? 0}</span>
                    <span className="text-[8px] text-gray-500 font-bold">VS</span>
                    <span className="text-[11px] font-black tabular-nums" style={{ color: dead ? '#94a3b8' : '#f8fafc' }}>{e.score?.away ?? 0}</span>
                    <Flag team={m?.away} size="xs" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
