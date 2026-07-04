'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { BozEvent, AgentSignal, SSEMessage } from '@bozpicks/shared';
import { SignalModal } from '@/components/ui/SignalModal';
import { NotificationSettings } from '@/components/ui/NotificationSettings';
import { IconBall, IconCard, IconTrendUp, IconBolt, IconRadar } from '@/components/ui/Icons';

type FeedItem =
  | { kind: 'event'; data: BozEvent; ts: string }
  | { kind: 'signal'; data: AgentSignal; ts: string };

const CONFIDENCE_COLOR = {
  HIGH: 'text-red-400 border-red-500/30 bg-red-500/10',
  MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  LOW: 'text-gray-400 border-gray-600 bg-gray-800',
};

const EVENT_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  GOAL:        { icon: <IconBall size={16} />,    color: 'var(--green)' },
  RED_CARD:    { icon: <IconCard size={14} />,    color: 'var(--red)' },
  YELLOW_CARD: { icon: <IconCard size={14} />,    color: 'var(--amber)' },
  ODDS_UPDATE: { icon: <IconTrendUp size={15} />, color: 'var(--blue)' },
};

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function InsightsPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'signals' | 'events'>('all');
  const [sessionEvents, setSessionEvents] = useState(0);
  const [sessionSignals, setSessionSignals] = useState(0);
  const [selectedSignal, setSelectedSignal] = useState<AgentSignal | null>(null);
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      const now = new Date().toISOString();
      if (msg.type === 'signal' && msg.data) {
        const s = msg.data as AgentSignal;
        setSessionSignals(n => n + 1);
        setFeed(prev => {
          if (prev.some(i => i.data.id === s.id)) return prev;
          return [{ kind: 'signal' as const, data: s, ts: now }, ...prev].slice(0, 50);
        });
      }
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;
        if (['GOAL', 'RED_CARD', 'YELLOW_CARD', 'ODDS_UPDATE', 'MATCH_START', 'MATCH_END', 'HALFTIME', 'SUBSTITUTION'].includes(e.type)) {
          setSessionEvents(n => n + 1);
          setFeed(prev => {
            if (prev.some(i => i.data.id === e.id)) return prev;
            return [{ kind: 'event' as const, data: e, ts: now }, ...prev].slice(0, 50);
          });
        }
      }
    },
  });

  const filtered = feed.filter(item =>
    filter === 'all' ? true :
    filter === 'signals' ? item.kind === 'signal' :
    item.kind === 'event'
  );

  return (
    <div className="space-y-5">
      {/* Header row: title + notification bell */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg md:text-xl font-bold tracking-tight">Live Insights</h1>
          {(sessionEvents > 0 || sessionSignals > 0) && (
            <div className="flex items-center gap-2.5 mt-1 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--green)' }} />
              <span className="text-gray-600">This session</span>
              {sessionEvents > 0 && <span style={{ color: 'var(--blue)' }}>{sessionEvents} events</span>}
              {sessionSignals > 0 && <span style={{ color: 'var(--orange)' }}>{sessionSignals} signals</span>}
            </div>
          )}
        </div>
        <button onClick={() => setShowNotifSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:opacity-80 text-gray-400"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          title="Notification settings">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Filter segmented control */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        {(['all', 'signals', 'events'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
            style={filter === f
              ? { background: 'var(--blue-dim)', color: 'var(--blue)', boxShadow: '0 0 12px rgba(59,130,246,0.15)' }
              : { color: '#6b7280' }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass text-center py-20">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-gray-500"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <IconRadar size={26} />
          </div>
          <p className="font-semibold text-gray-300">Waiting for live events...</p>
          <p className="text-sm mt-1 text-gray-600">Signals and events will appear here during matches</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((item, i) => (
          item.kind === 'signal' ? (
            <div key={i} onClick={() => setSelectedSignal(item.data as AgentSignal)} className="cursor-pointer">
              <SignalCard signal={item.data} ts={item.ts} />
            </div>
          ) : (
            <EventCard key={i} event={item.data} ts={item.ts} />
          )
        ))}
      </div>

      {selectedSignal && <SignalModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} />}
      {showNotifSettings && <NotificationSettings onClose={() => setShowNotifSettings(false)} />}
    </div>
  );
}

function SignalCard({ signal, ts }: { signal: AgentSignal; ts: string }) {
  const dir = signal.deltaPercent > 0 ? '↑' : '↓';
  const confStyle = {
    HIGH:   { color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(239,68,68,0.3)' },
    MEDIUM: { color: 'var(--orange)', bg: 'var(--orange-dim)', border: 'rgba(249,115,22,0.3)' },
    LOW:    { color: '#9ca3af',       bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
  }[signal.confidence];

  return (
    <div className="glass anim-in signal-glow rounded-2xl p-4"
         style={{ borderColor: confStyle.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: confStyle.color }}>
              <IconBolt size={13} /> Sharp Move
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: confStyle.bg, color: confStyle.color, border: `1px solid ${confStyle.border}` }}>
              {signal.confidence}
            </span>
          </div>
          <p className="font-bold text-sm md:text-base" style={{ color: confStyle.color }}>
            {signal.affectedOutcome} {dir}{Math.abs(signal.deltaPercent).toFixed(1)}%
          </p>
          {signal.context && <p className="text-xs text-gray-500 mt-1">{signal.context}</p>}
        </div>
        <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">{timeAgo(ts)}</span>
      </div>
    </div>
  );
}

function EventCard({ event, ts }: { event: BozEvent; ts: string }) {
  const cfg = EVENT_ICON[event.type];
  return (
    <div className="glass glass-hover anim-in rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ color: cfg?.color ?? '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
            {cfg?.icon ?? <span className="text-xs">•</span>}
          </span>
          <div>
            <p className="font-semibold text-sm text-gray-100">
              {event.type.replace(/_/g, ' ')}
              {event.matchMinute > 0 && (
                <span className="ml-2 text-xs text-gray-500">{event.matchMinute}'</span>
              )}
            </p>
            {event.team && <p className="text-xs text-gray-500 mt-0.5">{event.team}</p>}
            {event.score && (
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--green)' }}>
                {event.score.home} – {event.score.away}
              </p>
            )}
          </div>
        </div>
        <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">{timeAgo(ts)}</span>
      </div>
    </div>
  );
}
