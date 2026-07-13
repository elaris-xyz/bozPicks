'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { stepMomentum, relaxMomentum, MOM_CLAMP } from '@/lib/momentum';
import { Flag } from './Flag';

/**
 * MATCH MOMENTUM — a broadcast-style two-sided pressure wave. Home pressure
 * rises ABOVE the centre line (green), away DIPS below (blue). The running
 * momentum (TxLINE possession + threat + attacking events) is SAMPLED on a
 * fixed timer, so spikes decay into rounded, organic humps rather than jagged
 * event-driven triangles; the path is a Catmull-Rom spline. Goals plant a small
 * pin; a cursor marks "now". The series is empty until a match is live.
 */

const W = 1000, H = 200;               // viewBox — H matches the rendered px height
const PAD_L = 8, PAD_R = 10, PAD_T = 16, PAD_B = 22;
const BASE_Y = PAD_T + (H - PAD_T - PAD_B) / 2;
const AMP = (H - PAD_T - PAD_B) / 2 - 6;
const MAX_POINTS = 380;
const TICK_MS = 350;

interface Pt { min: number; v: number }
interface Goal { min: number; side: 'home' | 'away' }

export function MatchMomentum({ home: homeProp, away: awayProp }: { home?: string; away?: string } = {}) {
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const isLive = !!live?.live;

  const [points, setPoints] = useState<Pt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const mRef = useRef(0);
  const statsRef = useRef<MatchStats | undefined>(undefined);
  const minRef = useRef(0);
  const matchRef = useRef<string | null>(null);

  // events only nudge the running momentum + record goals; the timer samples it
  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (e.matchId && matchRef.current !== e.matchId && (e.type === 'MATCH_START' || !matchRef.current)) {
        matchRef.current = e.matchId; mRef.current = 0; minRef.current = 0; statsRef.current = undefined;
        setPoints([]); setGoals([]);
      }
      if (e.type === 'MATCH_START') { mRef.current = 0; minRef.current = 0; setPoints([]); setGoals([]); return; }
      if (e.stats) statsRef.current = e.stats;
      const { m, goal } = stepMomentum(mRef.current, e, home);
      mRef.current = m;
      if (goal) setGoals(g => [...g.slice(-12), { min: e.matchMinute || minRef.current, side: goal }]);
    },
  });

  // fixed-cadence sampler → an even, smooth series (only while a match is live)
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => {
      mRef.current = relaxMomentum(mRef.current, statsRef.current);
      const min = Math.max(live?.minute ?? 0, minRef.current + 0.25); // strictly increasing x
      minRef.current = min;
      setPoints(prev => [...prev, { min, v: mRef.current }].slice(-MAX_POINTS));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [isLive, live?.minute]);

  // no live match → wipe the wave so a finished/idle board doesn't show a stale curve
  useEffect(() => {
    if (!isLive) { setPoints([]); setGoals([]); mRef.current = 0; minRef.current = 0; }
  }, [isLive]);

  const maxMin = Math.max(90, live?.minute ?? 0, points.length ? points[points.length - 1].min : 0);
  const xFor = (min: number) => PAD_L + (Math.min(min, maxMin) / maxMin) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;

  const homeLine = points.map(p => ({ x: xFor(p.min), y: yFor(Math.max(0, p.v)) }));
  const awayLine = points.map(p => ({ x: xFor(p.min), y: yFor(-Math.max(0, -p.v)) }));
  const latest = points[points.length - 1];
  const ticks = [0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMin + 1);
  const hasData = points.length > 2;
  const showTeams = !!home && !!away;

  return (
    <div className="glass p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 10px rgba(245,158,11,0.6)' }} />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-300">Match Momentum</p>
        </div>
        <p className="text-[10px] text-gray-500 hidden sm:block">possession · threat · shots — live from TxLINE</p>
      </div>

      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="momHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.45)" /><stop offset="100%" stopColor="rgba(16,185,129,0.03)" />
            </linearGradient>
            <linearGradient id="momAway" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(59,130,246,0.45)" /><stop offset="100%" stopColor="rgba(59,130,246,0.03)" />
            </linearGradient>
          </defs>

          {ticks.map(m => (
            <line key={m} x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

          {hasData && (
            <>
              <path d={smoothArea(awayLine, BASE_Y)} fill="url(#momAway)" stroke="rgba(59,130,246,0.85)" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={smoothArea(homeLine, BASE_Y)} fill="url(#momHome)" stroke="rgba(16,185,129,0.85)" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

              {goals.map((g, i) => {
                const x = xFor(g.min);
                const up = g.side === 'home';
                const yPin = up ? yFor(6.5) : yFor(-6.5);
                const c = up ? 'var(--green)' : 'var(--blue)';
                return (
                  <g key={i}>
                    <line x1={x} y1={BASE_Y} x2={x} y2={yPin} stroke={c} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.45} />
                    <path d={up ? `M ${x} ${yPin} l 9 3 l -9 3 z` : `M ${x} ${yPin} l 9 -3 l -9 -3 z`} fill={c} />
                  </g>
                );
              })}

              {latest && isLive && (
                <>
                  <line x1={xFor(latest.min)} y1={PAD_T} x2={xFor(latest.min)} y2={H - PAD_B} stroke="rgba(245,158,11,0.3)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                  <circle cx={xFor(latest.min)} cy={yFor(latest.v)} r={3.5} fill="var(--amber)" />
                </>
              )}
            </>
          )}
        </svg>

        {ticks.map(m => (
          <span key={m} className="absolute text-[9px] text-gray-500 -translate-x-1/2" style={{ left: `${(xFor(m) / W) * 100}%`, bottom: 2 }}>
            {m === 45 ? 'HT' : `${m}'`}
          </span>
        ))}

        {showTeams && (
          <>
            <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y - AMP * 0.55) - 8 }}>
              <Flag team={home} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--green)' }}>{shortName(home)}</span>
            </div>
            <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y + AMP * 0.55) - 8 }}>
              <Flag team={away} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--blue)' }}>{shortName(away)}</span>
            </div>
          </>
        )}

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-gray-600">Momentum builds as the match plays — run one from the ⚡ Command Bridge.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Catmull-Rom → cubic-Bézier smooth area, closed to the baseline. */
function smoothArea(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${baseY} Z`;
  return d;
}

function shortName(t?: string): string {
  if (!t) return '';
  return t.length > 3 ? t.slice(0, 3).toUpperCase() : t.toUpperCase();
}
