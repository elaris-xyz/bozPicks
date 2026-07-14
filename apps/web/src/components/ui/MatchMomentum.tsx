'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { addImpulse, tickMomentum, MOM_CLAMP, type MomentumState } from '@/lib/momentum';
import { Flag } from './Flag';

/**
 * MATCH MOMENTUM — a broadcast-style two-sided pressure wave. Home pressure
 * rises ABOVE the centre line (green), away DIPS below (blue). The running
 * momentum (TxLINE possession + threat + attacking events) is SAMPLED on a
 * fixed timer, so spikes decay into rounded, organic humps rather than jagged
 * event-driven triangles; the path is a Catmull-Rom spline. Goals plant a small
 * pin; a cursor marks "now". The series is empty until a match is live.
 */

export const W = 1000, H = 200;        // viewBox — H matches the rendered px height
export const PAD_L = 8, PAD_R = 10, PAD_T = 16, PAD_B = 22;
export const BASE_Y = PAD_T + (H - PAD_T - PAD_B) / 2;
export const AMP = (H - PAD_T - PAD_B) / 2 - 6;
const MAX_POINTS = 380;
const TICK_MS = 350;

export interface Pt { min: number; v: number }
export interface Goal { min: number; side: 'home' | 'away' }

export function MatchMomentum({ home: homeProp, away: awayProp }: { home?: string; away?: string } = {}) {
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const isLive = !!live?.live;

  const [points, setPoints] = useState<Pt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const sRef = useRef<MomentumState>({ target: 0, m: 0 });
  const statsRef = useRef<MatchStats | undefined>(undefined);
  const minRef = useRef(0);
  const matchRef = useRef<string | null>(null);

  // events only nudge the momentum TARGET + record goals; the timer samples the
  // eased displayed value
  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (e.matchId && matchRef.current !== e.matchId && (e.type === 'MATCH_START' || !matchRef.current)) {
        matchRef.current = e.matchId; sRef.current = { target: 0, m: 0 }; minRef.current = 0; statsRef.current = undefined;
        setPoints([]); setGoals([]);
      }
      if (e.type === 'MATCH_START') { sRef.current = { target: 0, m: 0 }; minRef.current = 0; setPoints([]); setGoals([]); return; }
      if (e.stats) statsRef.current = e.stats;
      const { target, goal } = addImpulse(sRef.current.target, e, home);
      sRef.current.target = target;
      if (goal) setGoals(g => [...g.slice(-12), { min: e.matchMinute || minRef.current, side: goal }]);
    },
  });

  // fixed-cadence sampler → an even, smooth series (only while a match is live,
  // and only up to full time so it never trails past 90')
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => {
      sRef.current = tickMomentum(sRef.current, statsRef.current);
      const clock = live?.minute ?? 0;
      if (clock >= 90) return;                                    // match over → stop extending the curve
      // advance the x-clock SMOOTHLY: a steady base step + a gentle catch-up to
      // the real minute. This keeps the sample spacing even (so the curve has
      // uniform curvature) instead of clustering when the minute stalls/jumps.
      minRef.current = Math.min(89.6, minRef.current + 0.16 + Math.max(0, clock - minRef.current) * 0.2);
      setPoints(prev => [...prev, { min: minRef.current, v: sRef.current.m }].slice(-MAX_POINTS));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [isLive, live?.minute]);

  // no live match → wipe the wave so a finished/idle board doesn't show a stale curve
  useEffect(() => {
    if (!isLive) { setPoints([]); setGoals([]); sRef.current = { target: 0, m: 0 }; minRef.current = 0; }
  }, [isLive]);

  const maxMin = Math.max(90, live?.minute ?? 0, points.length ? points[points.length - 1].min : 0);
  const xFor = (min: number) => PAD_L + (Math.min(min, maxMin) / maxMin) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;

  // ONE continuous curve (a light moving average removes sampler jitter); it
  // crosses the baseline smoothly, and the fill/stroke are split into green
  // (above) / blue (below) by clip rects — the broadcast standard, with no hard
  // corners where the curve meets the centre line.
  const sv = movingAverage(points.map(p => p.v), 3);
  const curve = points.map((p, i) => ({ x: xFor(p.min), y: yFor(sv[i]) }));
  const areaD = smoothArea(curve, BASE_Y);
  const lineD = smoothLine(curve);
  const latest = points[points.length - 1];
  const ticks = [0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMin + 1);
  const hasData = points.length > 2;
  const showTeams = !!home && !!away;

  return (
    <div className="glass p-4 relative overflow-hidden">
      {/* card header — section-label dash, same as every other card */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label">Match Momentum</h2>
        <p className="text-[10px] text-gray-500 hidden sm:block">possession · threat · shots — live from TxLINE</p>
      </div>

      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="momHome" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_T} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(16,185,129,0.5)" /><stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
            </linearGradient>
            <linearGradient id="momAway" gradientUnits="userSpaceOnUse" x1="0" y1={H - PAD_B} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(59,130,246,0.5)" /><stop offset="100%" stopColor="rgba(59,130,246,0.04)" />
            </linearGradient>
            <clipPath id="momAbove"><rect x="0" y="0" width={W} height={BASE_Y} /></clipPath>
            <clipPath id="momBelow"><rect x="0" y={BASE_Y} width={W} height={H - BASE_Y} /></clipPath>
          </defs>

          {ticks.map(m => (
            <line key={m} x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

          {hasData && (
            <>
              {/* one smooth curve; fill + stroke clipped into green (above) / blue (below) */}
              <path d={areaD} fill="url(#momHome)" clipPath="url(#momAbove)" />
              <path d={areaD} fill="url(#momAway)" clipPath="url(#momBelow)" />
              <path d={lineD} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momAbove)" vectorEffect="non-scaling-stroke" />
              <path d={lineD} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momBelow)" vectorEffect="non-scaling-stroke" />

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

/**
 * MOMENTUM RECAP — the same broadcast wave, reconstructed AFTER full time from
 * the stored event log. Events drive the impulse target exactly like the live
 * chart; a fixed 0.4' sampler eases the displayed value between them, and the
 * latest stats snapshot supplies the possession/threat lean. Static: no cursor.
 */
/** Re-run the live impulse/ease model over a stored event log — the shared
    core of the full-time recap and the agent-page signal chart. */
export function simulateMomentum(events: BozEvent[], homeTeam: string, upTo = 90): { pts: Pt[]; goals: Goal[] } {
  const evs = [...events]
    .filter(e => e.type !== 'ODDS_UPDATE')
    .sort((a, b) => (a.matchMinute || 0) - (b.matchMinute || 0));

  const pts: Pt[] = [];
  const goals: Goal[] = [];
  let s: MomentumState = { target: 0, m: 0 };
  let stats: MatchStats | undefined;
  let i = 0;
  for (let min = 0; min <= upTo; min += 0.4) {
    while (i < evs.length && (evs[i].matchMinute || 0) <= min) {
      const e = evs[i];
      if (e.stats) stats = e.stats;
      const r = addImpulse(s.target, e, homeTeam);
      s = { ...s, target: r.target };
      if (r.goal) goals.push({ min: e.matchMinute || min, side: r.goal });
      i++;
    }
    s = tickMomentum(s, stats);
    pts.push({ min, v: s.m });
  }
  return { pts, goals };
}

export function MomentumRecap({ events, homeTeam, awayTeam }: {
  events: BozEvent[]; homeTeam: string; awayTeam: string;
}) {
  const evs = events.filter(e => e.type !== 'ODDS_UPDATE');
  const { pts, goals } = simulateMomentum(events, homeTeam);

  const xFor = (min: number) => PAD_L + (Math.min(min, 90) / 90) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;
  const sv = movingAverage(pts.map(p => p.v), 3);
  const curve = pts.map((p, j) => ({ x: xFor(p.min), y: yFor(sv[j]) }));
  const areaD = smoothArea(curve, BASE_Y);
  const lineD = smoothLine(curve);
  const ticks = [0, 15, 30, 45, 60, 75, 90];
  if (evs.length < 4) return null;

  return (
    <div className="glass p-4 relative overflow-hidden">
      {/* card header — section-label dash, same as every other card */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label">Match Momentum</h2>
        <p className="text-[10px] text-gray-500 hidden sm:block">full-time recap — from the recorded TxLINE events</p>
      </div>

      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="momRecHome" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_T} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(16,185,129,0.5)" /><stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
            </linearGradient>
            <linearGradient id="momRecAway" gradientUnits="userSpaceOnUse" x1="0" y1={H - PAD_B} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(59,130,246,0.5)" /><stop offset="100%" stopColor="rgba(59,130,246,0.04)" />
            </linearGradient>
            <clipPath id="momRecAbove"><rect x="0" y="0" width={W} height={BASE_Y} /></clipPath>
            <clipPath id="momRecBelow"><rect x="0" y={BASE_Y} width={W} height={H - BASE_Y} /></clipPath>
          </defs>

          {ticks.map(m => (
            <line key={m} x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

          <path d={areaD} fill="url(#momRecHome)" clipPath="url(#momRecAbove)" />
          <path d={areaD} fill="url(#momRecAway)" clipPath="url(#momRecBelow)" />
          <path d={lineD} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momRecAbove)" vectorEffect="non-scaling-stroke" />
          <path d={lineD} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momRecBelow)" vectorEffect="non-scaling-stroke" />

          {goals.map((g, j) => {
            const x = xFor(g.min);
            const up = g.side === 'home';
            const yPin = up ? yFor(6.5) : yFor(-6.5);
            const c = up ? 'var(--green)' : 'var(--blue)';
            return (
              <g key={j}>
                <line x1={x} y1={BASE_Y} x2={x} y2={yPin} stroke={c} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.45} />
                <path d={up ? `M ${x} ${yPin} l 9 3 l -9 3 z` : `M ${x} ${yPin} l 9 -3 l -9 -3 z`} fill={c} />
              </g>
            );
          })}
        </svg>

        {ticks.map(m => (
          <span key={m} className="absolute text-[9px] text-gray-500 -translate-x-1/2" style={{ left: `${(xFor(m) / W) * 100}%`, bottom: 2 }}>
            {m === 45 ? 'HT' : `${m}'`}
          </span>
        ))}

        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y - AMP * 0.55) - 8 }}>
          <Flag team={homeTeam} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--green)' }}>{shortName(homeTeam)}</span>
        </div>
        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y + AMP * 0.55) - 8 }}>
          <Flag team={awayTeam} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--blue)' }}>{shortName(awayTeam)}</span>
        </div>
      </div>
    </div>
  );
}

/** centered moving average — smooths sampler jitter before drawing. */
export function movingAverage(vals: number[], radius: number): number[] {
  if (radius < 1) return vals;
  return vals.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = i - radius; j <= i + radius; j++) if (j >= 0 && j < vals.length) { sum += vals[j]; n++; }
    return sum / n;
  });
}

/** Catmull-Rom → cubic-Bézier smooth open line (for the stroke). */
export function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** the same smooth curve, closed down to the baseline (for the fill). */
export function smoothArea(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return '';
  const line = smoothLine(pts);
  const last = pts[pts.length - 1];
  return `M ${pts[0].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} ${line.slice(line.indexOf('C'))} L ${last.x.toFixed(1)} ${baseY} Z`;
}

export function shortName(t?: string): string {
  if (!t) return '';
  return t.length > 3 ? t.slice(0, 3).toUpperCase() : t.toUpperCase();
}
