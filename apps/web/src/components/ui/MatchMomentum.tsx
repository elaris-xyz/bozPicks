'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent } from '@bozpicks/shared';
import { foldMomentum, MOM_CLAMP, type MomentumPoint } from '@/lib/momentum';
import { Flag } from './Flag';

/**
 * MATCH MOMENTUM — a broadcast-style two-sided pressure curve. Home pressure
 * spikes UP (green), away pressure spikes DOWN (blue), around a centre baseline,
 * built live from TxLINE possession + threat state + attacking events. Goals
 * plant a flag on the curve. Backfills from the SSE catch-up so joining mid-match
 * still shows the whole story.
 */

const W = 640, H = 190;
const PAD_L = 46, PAD_R = 14, PAD_T = 30, PAD_B = 22;
const BASE_Y = PAD_T + (H - PAD_T - PAD_B) / 2;       // centre line
const AMP = (H - PAD_T - PAD_B) / 2 - 4;               // px per full-scale side
const MAX_POINTS = 260;

export function MatchMomentum({ home: homeProp, away: awayProp }: { home?: string; away?: string } = {}) {
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const [points, setPoints] = useState<MomentumPoint[]>([]);
  const baseRef = useRef(0);
  const matchRef = useRef<string | null>(null);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'match_update' && msg.data) return;
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;

      // new match → reset the curve
      if (e.matchId && matchRef.current !== e.matchId) {
        if (e.type === 'MATCH_START' || !matchRef.current) {
          matchRef.current = e.matchId; baseRef.current = 0; setPoints([]);
        }
      }
      if (e.type === 'MATCH_START') { baseRef.current = 0; setPoints([]); return; }

      const { base, point } = foldMomentum(baseRef.current, e, home);
      baseRef.current = base;
      // stat-only ticks refresh the baseline without a spike; skip flat dupes
      setPoints(prev => {
        const last = prev[prev.length - 1];
        if (last && last.min === point.min && Math.abs(last.v - point.v) < 0.25 && !point.goal) return prev;
        return [...prev, point].slice(-MAX_POINTS);
      });
    },
  });

  // gently relax toward the possession/threat baseline between events so spikes
  // decay like the real thing (only while a match is live)
  useEffect(() => {
    if (!live?.live) return;
    const t = setInterval(() => {
      setPoints(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const target = baseRef.current;
        if (Math.abs(last.v - target) < 0.3) return prev;
        const v = last.v + (target - last.v) * 0.5;
        return [...prev.slice(-MAX_POINTS + 1), { min: (live.minute || last.min), v }];
      });
    }, 3000);
    return () => clearInterval(t);
  }, [live?.live, live?.minute]);

  const maxMin = Math.max(90, live?.minute ?? 0, points.length ? points[points.length - 1].min : 0);
  const xFor = (min: number) => PAD_L + (Math.min(min, maxMin) / maxMin) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;

  // split into home (v>0 → up) and away (v<0 → down) so each side spikes on its
  // own half of the baseline
  const pts = points.map(p => ({ x: xFor(p.min), vUp: Math.max(0, p.v), vDown: Math.max(0, -p.v), p }));
  const homeArea = areaPath(pts.map(q => ({ x: q.x, y: yFor(q.vUp) })), BASE_Y);
  const awayArea = areaPath(pts.map(q => ({ x: q.x, y: yFor(-q.vDown) })), BASE_Y);
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
        <p className="text-[10px] text-gray-500">possession · threat · shots — live from TxLINE</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="momHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.55)" /><stop offset="100%" stopColor="rgba(16,185,129,0.05)" />
          </linearGradient>
          <linearGradient id="momAway" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(59,130,246,0.55)" /><stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
          </linearGradient>
        </defs>

        {/* minute grid + labels */}
        {ticks.map(m => (
          <g key={m}>
            <line x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={xFor(m)} y={H - 6} textAnchor="middle" fontSize="9" fill="#64748b">{m === 45 ? 'HT' : `${m}'`}</text>
          </g>
        ))}
        {/* centre baseline */}
        <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

        {hasData && (
          <>
            <path d={awayArea} fill="url(#momAway)" stroke="rgba(59,130,246,0.9)" strokeWidth={1.4} />
            <path d={homeArea} fill="url(#momHome)" stroke="rgba(16,185,129,0.9)" strokeWidth={1.4} />

            {/* goal flags on the curve */}
            {goals.map((g, i) => {
              const x = xFor(g.min);
              const up = g.goal === 'home';
              const y = yFor(up ? Math.max(1.5, g.v) : Math.min(-1.5, g.v));
              const c = up ? 'var(--green)' : 'var(--blue)';
              return (
                <g key={i}>
                  <line x1={x} y1={y} x2={x} y2={up ? y - 16 : y + 16} stroke={c} strokeWidth={1.5} />
                  <path d={up ? `M ${x} ${y - 16} l 9 3 l -9 3 z` : `M ${x} ${y + 16} l 9 -3 l -9 -3 z`} fill={c} />
                </g>
              );
            })}

            {/* live cursor */}
            {latest && live?.live && (
              <g>
                <line x1={latest.x} y1={PAD_T - 2} x2={latest.x} y2={H - PAD_B} stroke="rgba(245,158,11,0.4)" strokeWidth={1} strokeDasharray="2 3" />
                <circle cx={latest.x} cy={yFor(latest.p.v)} r={3.5} fill="var(--amber)" />
                <circle cx={latest.x} cy={yFor(latest.p.v)} r={3.5} fill="none" stroke="var(--amber)" strokeWidth={1.5}>
                  <animate attributeName="r" from="3.5" to="10" dur="1.3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.7" to="0" dur="1.3s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </>
        )}
      </svg>

      {/* team crests left, tied to their side of the baseline */}
      <div className="absolute left-3 top-9 flex flex-col justify-between" style={{ height: H - PAD_T - PAD_B }}>
        <div className="flex items-center gap-1"><Flag team={home} size="xs" /><span className="text-[9px] font-bold" style={{ color: 'var(--green)' }}>{shortName(home)}</span></div>
        <div className="flex items-center gap-1"><Flag team={away} size="xs" /><span className="text-[9px] font-bold" style={{ color: 'var(--blue)' }}>{shortName(away)}</span></div>
      </div>

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-gray-600">Momentum builds as the match plays — run one from the ⚡ Command Bridge.</p>
        </div>
      )}
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
