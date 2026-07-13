'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { stepMomentum, relaxMomentum, MOM_CLAMP, type MomentumPoint } from '@/lib/momentum';
import { Flag } from './Flag';

/**
 * MATCH MOMENTUM — a broadcast-style two-sided pressure curve. Home pressure
 * rises ABOVE the centre line (green), away pressure dips BELOW (blue), built
 * live from TxLINE possession + threat state + attacking events. Goals plant a
 * flag; a pulsing cursor marks "now". Backfills from the SSE catch-up.
 *
 * The SVG has a FIXED pixel height and only stretches horizontally, so the
 * vertical proportions stay true (no exaggerated spikes) and the HTML overlays
 * (crests, labels) line up with the curve.
 */

const W = 1000, H = 200;              // viewBox — H matches the rendered px height
const PAD_L = 8, PAD_R = 10, PAD_T = 16, PAD_B = 22;
const BASE_Y = PAD_T + (H - PAD_T - PAD_B) / 2;   // centre line
const AMP = (H - PAD_T - PAD_B) / 2 - 6;          // px per full-scale side
const MAX_POINTS = 320;

export function MatchMomentum({ home: homeProp, away: awayProp }: { home?: string; away?: string } = {}) {
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const [points, setPoints] = useState<MomentumPoint[]>([]);
  const mRef = useRef(0);                 // running momentum
  const statsRef = useRef<MatchStats | undefined>(undefined);
  const matchRef = useRef<string | null>(null);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;

      if (e.matchId && matchRef.current !== e.matchId && (e.type === 'MATCH_START' || !matchRef.current)) {
        matchRef.current = e.matchId; mRef.current = 0; statsRef.current = undefined; setPoints([]);
      }
      if (e.type === 'MATCH_START') { mRef.current = 0; setPoints([]); return; }

      if (e.stats) statsRef.current = e.stats;
      const { m, point } = stepMomentum(mRef.current, e, home);
      mRef.current = m;
      setPoints(prev => {
        const last = prev[prev.length - 1];
        if (last && last.min === point.min && Math.abs(last.v - point.v) < 0.2 && !point.goal) return prev;
        return [...prev, point].slice(-MAX_POINTS);
      });
    },
  });

  // relax toward the baseline between events so spikes decay + the line crosses
  // zero, adding a fresh sample at the live minute (only while a match is on)
  useEffect(() => {
    if (!live?.live) return;
    const t = setInterval(() => {
      const m = relaxMomentum(mRef.current, statsRef.current);
      mRef.current = m;
      setPoints(prev => {
        if (prev.length === 0) return prev;
        const min = live.minute || prev[prev.length - 1].min;
        return [...prev, { min, v: m }].slice(-MAX_POINTS);
      });
    }, 2500);
    return () => clearInterval(t);
  }, [live?.live, live?.minute]);

  const maxMin = Math.max(90, live?.minute ?? 0, points.length ? points[points.length - 1].min : 0);
  const xFor = (min: number) => PAD_L + (Math.min(min, maxMin) / maxMin) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;

  const pts = points.map(p => ({ x: xFor(p.min), p }));
  const homeArea = areaPath(pts.map(q => ({ x: q.x, y: yFor(Math.max(0, q.p.v)) })), BASE_Y);
  const awayArea = areaPath(pts.map(q => ({ x: q.x, y: yFor(-Math.max(0, -q.p.v)) })), BASE_Y);
  const goals = points.filter(p => p.goal);
  const latest = pts[pts.length - 1];
  const ticks = [0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMin + 1);
  const hasData = points.length > 1;

  return (
    <div className="glass p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 10px rgba(245,158,11,0.6)' }} />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-300">Match Momentum</p>
        </div>
        <p className="text-[10px] text-gray-500 hidden sm:block">possession · threat · shots — live from TxLINE</p>
      </div>

      {/* fixed-height plot; the SVG stretches horizontally only */}
      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="momHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.5)" /><stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
            </linearGradient>
            <linearGradient id="momAway" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(59,130,246,0.5)" /><stop offset="100%" stopColor="rgba(59,130,246,0.04)" />
            </linearGradient>
          </defs>

          {ticks.map(m => (
            <line key={m} x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

          {hasData && (
            <>
              <path d={awayArea} fill="url(#momAway)" stroke="rgba(59,130,246,0.9)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <path d={homeArea} fill="url(#momHome)" stroke="rgba(16,185,129,0.9)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

              {goals.map((g, i) => {
                const x = xFor(g.min);
                const up = g.goal === 'home';
                const yTip = up ? PAD_T + 8 : H - PAD_B - 8;       // flag near the outer edge of its side
                const c = up ? 'var(--green)' : 'var(--blue)';
                return (
                  <g key={i}>
                    <line x1={x} y1={BASE_Y} x2={x} y2={yTip} stroke={c} strokeWidth={1.3} strokeDasharray="none" vectorEffect="non-scaling-stroke" opacity={0.5} />
                    <path d={up ? `M ${x} ${yTip} l 11 4 l -11 4 z` : `M ${x} ${yTip} l 11 -4 l -11 -4 z`} fill={c} />
                  </g>
                );
              })}

              {latest && live?.live && (
                <>
                  <line x1={latest.x} y1={PAD_T} x2={latest.x} y2={H - PAD_B} stroke="rgba(245,158,11,0.35)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                  <circle cx={latest.x} cy={yFor(latest.p.v)} r={3.5} fill="var(--amber)" />
                </>
              )}
            </>
          )}
        </svg>

        {/* minute labels (crisp HTML, not stretched with the SVG) */}
        {ticks.map(m => (
          <span key={m} className="absolute text-[9px] text-gray-500 -translate-x-1/2" style={{ left: `${(xFor(m) / W) * 100}%`, bottom: 2 }}>
            {m === 45 ? 'HT' : `${m}'`}
          </span>
        ))}

        {/* team crests, pinned to their side of the baseline */}
        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y - AMP * 0.6) - 8 }}>
          <Flag team={home} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--green)' }}>{shortName(home)}</span>
        </div>
        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y + AMP * 0.6) - 8 }}>
          <Flag team={away} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--blue)' }}>{shortName(away)}</span>
        </div>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-gray-600">Momentum builds as the match plays — run one from the ⚡ Command Bridge.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** smooth two-sided area path (quadratic through midpoints), closed to baseline. */
function areaPath(line: { x: number; y: number }[], baseY: number): string {
  if (line.length < 2) return '';
  let d = `M ${line[0].x.toFixed(1)} ${baseY} L ${line[0].x.toFixed(1)} ${line[0].y.toFixed(1)}`;
  for (let i = 1; i < line.length; i++) {
    const xc = (line[i - 1].x + line[i].x) / 2;
    const yc = (line[i - 1].y + line[i].y) / 2;
    d += ` Q ${line[i - 1].x.toFixed(1)} ${line[i - 1].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
  }
  const last = line[line.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${baseY} Z`;
  return d;
}

function shortName(t?: string): string {
  if (!t) return '';
  return t.length > 3 ? t.slice(0, 3).toUpperCase() : t.toUpperCase();
}
