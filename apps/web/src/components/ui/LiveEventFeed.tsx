'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { BozEvent, SSEMessage } from '@bozpicks/shared';
import {
  IconBall, IconCard, IconSub, IconTrendUp, IconKickoff,
  IconFlagEnd, IconPause, IconChart, IconRadar,
} from './Icons';

type EventCfg = { color: string; bg: string; border: string; icon: React.ReactNode };

const EVENT_CFG: Record<string, EventCfg> = {
  GOAL:        { color: 'var(--green)',  bg: 'var(--green-dim)',             border: 'rgba(16,185,129,0.3)',  icon: <IconBall size={14} /> },
  RED_CARD:    { color: 'var(--red)',    bg: 'var(--red-dim)',               border: 'rgba(239,68,68,0.3)',   icon: <IconCard size={13} /> },
  YELLOW_CARD: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)',         border: 'rgba(245,158,11,0.3)',  icon: <IconCard size={13} /> },
  ODDS_UPDATE: { color: 'var(--blue)',  bg: 'var(--blue-dim)',              border: 'rgba(59,130,246,0.3)',  icon: <IconTrendUp size={13} /> },
  MATCH_START: { color: 'var(--green)', bg: 'var(--green-dim)',             border: 'rgba(16,185,129,0.3)',  icon: <IconKickoff size={14} /> },
  MATCH_END:   { color: '#6b7280',      bg: 'rgba(107,114,128,0.1)',        border: 'rgba(107,114,128,0.2)', icon: <IconFlagEnd size={13} /> },
  HALFTIME:    { color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)',         border: 'rgba(245,158,11,0.3)',  icon: <IconPause size={13} /> },
  SUBSTITUTION:{ color: '#9ca3af',      bg: 'rgba(156,163,175,0.08)',       border: 'rgba(156,163,175,0.2)', icon: <IconSub size={13} /> },
  SCORE_UPDATE:{ color: 'var(--green)', bg: 'var(--green-dim)',             border: 'rgba(16,185,129,0.3)',  icon: <IconChart size={13} /> },
  CORNER:      { color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)',         border: 'rgba(245,158,11,0.3)',  icon: <IconFlagEnd size={13} /> },
  PENALTY:     { color: 'var(--green)', bg: 'var(--green-dim)',             border: 'rgba(16,185,129,0.3)',  icon: <IconBall size={14} /> },
  VAR:         { color: 'var(--blue)',  bg: 'var(--blue-dim)',              border: 'rgba(59,130,246,0.3)',  icon: <IconRadar size={13} /> },
  SHOT:        { color: 'var(--blue)',  bg: 'var(--blue-dim)',              border: 'rgba(59,130,246,0.3)',  icon: <IconBall size={13} /> },
  OFFSIDE:     { color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)',         border: 'rgba(245,158,11,0.3)',  icon: <IconFlagEnd size={13} /> },
  FOUL:        { color: '#9ca3af',      bg: 'rgba(156,163,175,0.08)',       border: 'rgba(156,163,175,0.2)', icon: <IconCard size={13} /> },
};

/** A short outcome tag shown under the event label (shot result, VAR verdict). */
function detailOf(e: BozEvent): string | null {
  if (e.type === 'SHOT' && e.shotOutcome) return e.shotOutcome.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (e.type === 'VAR') return `${e.varType ?? 'Review'} · ${e.varOutcome ?? 'checking'}`;
  return null;
}
const DEFAULT_CFG: EventCfg = { color: '#9ca3af', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', icon: <span className="text-[10px]">•</span> };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h`;
}

export function LiveEventFeed() {
  const [events, setEvents] = useState<BozEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'ping') { setConnected(true); return; }
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;
        setEvents(prev => {
          if (prev.some(x => x.id === e.id)) return prev;
          return [e, ...prev].slice(0, 30);
        });
      }
    },
    onError: () => setConnected(false),
    onReconnect: () => setConnected(false),
  });

  return (
    <div className="glass p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'badge-live' : ''}`}
                style={{ background: connected ? 'var(--green)' : '#4b5563' }} />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Live Feed</span>
        </div>
        {events.length > 0 && (
          <span className="text-[10px] text-gray-600">{events.length} events</span>
        )}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center text-gray-500"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <IconRadar size={18} />
          </div>
          <p className="text-xs text-gray-600">Listening for live events...</p>
        </div>
      )}

      {/* Events — horizontal timeline: newest on the left, dots strung along
          a single axis, each with a card hanging beneath it */}
      {events.length > 0 && (
        <div className="relative overflow-x-auto rail-scroll pb-1">
          <div className="flex gap-3 min-w-max pt-0.5">
            {events.map(e => {
              const cfg = EVENT_CFG[e.type] ?? DEFAULT_CFG;
              return (
                <div key={e.id} className="w-[132px] shrink-0 flex flex-col items-center anim-in">
                  {/* node on the axis — connector bridges the gap to neighbours */}
                  <div className="relative w-full flex justify-center">
                    <div className="absolute top-1/2 -translate-y-1/2 left-[-6px] right-[-6px] h-px"
                         style={{ background: 'var(--glass-border)' }} />
                    <div className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center"
                         style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      {cfg.icon}
                    </div>
                  </div>
                  {/* card */}
                  <div className="mt-2.5 w-full rounded-xl p-2 border text-center"
                       style={{ background: cfg.bg, borderColor: cfg.border }}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[11px] font-bold leading-tight" style={{ color: cfg.color }}>
                        {e.type.replace(/_/g, ' ')}
                      </span>
                      {e.matchMinute > 0 && (
                        <span className="text-[10px] text-gray-600 font-mono">{e.matchMinute}'</span>
                      )}
                    </div>
                    {detailOf(e) && (
                      <p className="text-[9px] font-bold uppercase tracking-wide truncate mt-0.5" style={{ color: cfg.color }}>
                        {detailOf(e)}
                      </p>
                    )}
                    {(e.team || e.player) && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">
                        {e.team}{e.player ? ` · ${e.player}` : ''}
                      </p>
                    )}
                    {e.score && (
                      <p className="text-xs font-bold font-mono mt-0.5" style={{ color: 'var(--green)' }}>
                        {e.score.home}–{e.score.away}
                      </p>
                    )}
                    <p className="text-[9px] text-gray-700 mt-0.5">{timeAgo(e.timestamp)} ago</p>
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
