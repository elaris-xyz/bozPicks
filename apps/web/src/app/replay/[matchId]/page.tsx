'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { BozEvent } from '@bozpicks/shared';
import {
  IconBall, IconCard, IconSub, IconTrendUp, IconKickoff,
  IconFlagEnd, IconPause,
} from '@/components/ui/Icons';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  GOAL: <IconBall size={13} />, RED_CARD: <IconCard size={12} />, YELLOW_CARD: <IconCard size={12} />,
  SUBSTITUTION: <IconSub size={12} />, ODDS_UPDATE: <IconTrendUp size={12} />,
  MATCH_START: <IconKickoff size={13} />, MATCH_END: <IconFlagEnd size={12} />, HALFTIME: <IconPause size={12} />,
};
const EVENT_COLOR: Record<string, string> = {
  GOAL: 'var(--green)', RED_CARD: 'var(--red)', YELLOW_CARD: 'var(--amber)',
  MATCH_START: 'var(--green)', MATCH_END: '#6b7280', HALFTIME: 'var(--amber)',
  ODDS_UPDATE: 'var(--blue)', SUBSTITUTION: '#9ca3af',
};

type RawEvent = { id: string; delayMs: number; payload: BozEvent };
const SPEEDS = [0.5, 1, 2, 5, 10];

export default function ReplayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();

  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [visible, setVisible] = useState<BozEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [speed, setSpeed] = useState(2);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [minute, setMinute] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(-1);
  const rawRef = useRef<RawEvent[]>([]);

  useEffect(() => {
    fetch(`/api/replay/${matchId}/events`)
      .then(r => r.json())
      .then((data: RawEvent[]) => {
        setRawEvents(data);
        rawRef.current = data;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [matchId]);

  const advance = useCallback((idx: number, spd: number) => {
    const evts = rawRef.current;
    if (idx >= evts.length) { setPlaying(false); return; }

    const ev = evts[idx];
    const payload = ev.payload;
    cursorRef.current = idx;
    setCursor(idx);
    setMinute(payload.matchMinute || 0);
    if (payload.score) setScore({ home: payload.score.home, away: payload.score.away });
    setVisible(prev => [payload, ...prev].slice(0, 50));

    if (idx + 1 < evts.length) {
      const gap = Math.max((evts[idx + 1].delayMs - ev.delayMs) / spd, 80);
      timerRef.current = setTimeout(() => advance(idx + 1, spd), gap);
    } else {
      setPlaying(false);
    }
  }, []);

  const play = useCallback(() => {
    const start = cursorRef.current + 1;
    if (start >= rawRef.current.length) {
      setVisible([]); setCursor(-1); cursorRef.current = -1;
      setScore({ home: 0, away: 0 }); setMinute(0);
      setTimeout(() => { setPlaying(true); advance(0, speed); }, 0);
      return;
    }
    setPlaying(true);
    advance(start, speed);
  }, [advance, speed]);

  const pause = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    pause();
    setVisible([]); setCursor(-1); cursorRef.current = -1;
    setScore({ home: 0, away: 0 }); setMinute(0);
  }, [pause]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const progress = rawEvents.length > 0 ? ((cursor + 1) / rawEvents.length) * 100 : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin mx-auto"
             style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'var(--blue)' }} />
        <p className="text-sm text-gray-400">Loading replay...</p>
      </div>
    </div>
  );

  if (rawEvents.length === 0) return (
    <div className="glass text-center py-20 max-w-sm mx-auto">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-gray-500"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
        <IconKickoff size={26} />
      </div>
      <p className="text-gray-400 font-semibold mb-1">No replay data</p>
      <p className="text-xs text-gray-600 mb-5">This match hasn&rsquo;t been recorded yet</p>
      <button onClick={() => router.back()} className="btn-ghost mx-auto text-xs">← Back</button>
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M19 12H5m7-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      {/* Player card */}
      <div className="glass p-5 space-y-5">
        <div className="text-center">
          <p className="section-label mb-3 flex items-center justify-center gap-1.5">
            <IconKickoff size={12} /> Match Replay
          </p>
          <div className="font-display text-5xl font-bold tabular-nums tracking-tight">
            {score.home}
            <span className="text-gray-700 mx-3 font-light">–</span>
            {score.away}
          </div>
          <p className="text-xs text-gray-500 mt-2 font-mono">
            {minute > 0 ? `${minute}'` : 'Pre-match'}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-300"
                 style={{ width: `${progress}%`, background: 'var(--blue)' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600">
            <span>{cursor + 1} / {rawEvents.length} events</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button onClick={playing ? pause : play}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--blue)' }}>
            {playing ? (
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6zm8-14v14h4V5z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex gap-1">
            {SPEEDS.map(s => (
              <button key={s} onClick={() => { setSpeed(s); if (playing) { pause(); setTimeout(() => { setPlaying(true); advance(cursorRef.current + 1, s); }, 0); } }}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={speed === s
                  ? { background: 'var(--blue-dim)', color: 'var(--blue)' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#6b7280' }}>
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event log */}
      <div className="glass p-4">
        <p className="section-label mb-3">
          Event Log
        </p>
        <div className="space-y-1.5 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {visible.length === 0 ? (
            <p className="text-xs text-gray-600 py-8 text-center">
              {cursor === -1 ? 'Press play to start replay' : 'Replay complete'}
            </p>
          ) : visible.map((e, i) => {
            const color = EVENT_COLOR[e.type] ?? '#9ca3af';
            return (
              <div key={`${e.id}-${i}`}
                   className={`flex items-center gap-3 p-2.5 rounded-xl border ${i === 0 ? 'anim-in' : ''}`}
                   style={{
                     borderColor: i === 0 ? 'rgba(59,130,246,0.4)' : 'var(--glass-border)',
                     background: i === 0 ? 'var(--blue-dim)' : 'rgba(255,255,255,0.02)',
                   }}>
                <span className="w-6 flex justify-center flex-shrink-0" style={{ color }}>{EVENT_ICONS[e.type] ?? <span className="text-[10px]">•</span>}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color }}>{e.type.replace(/_/g, ' ')}</span>
                  {e.team && <span className="text-[10px] text-gray-500 ml-1.5">{e.team}</span>}
                  {e.player && <span className="text-[10px] text-gray-600 ml-1">({e.player})</span>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-gray-500">{e.matchMinute}'</p>
                  {e.score && (
                    <p className="text-[10px] font-bold font-mono" style={{ color: 'var(--green)' }}>
                      {e.score.home}–{e.score.away}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
