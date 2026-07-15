'use client';

import { useEffect, useState } from 'react';
import type { BozEvent } from '@bozpicks/shared';
import { IconBall, IconCard, IconSub, IconTarget, IconFlagEnd } from './Icons';

type Pair = [number, number];
type Stats = {
  goals: Pair; shots: Pair; onTarget: Pair; corners: Pair;
  yellow: Pair; red: Pair; offsides: Pair; fouls: Pair; subs: Pair;
};

function calcStats(events: BozEvent[], homeTeam: string, score?: { home: number; away: number }): Stats {
  const s: Stats = {
    goals: [0, 0], shots: [0, 0], onTarget: [0, 0], corners: [0, 0],
    yellow: [0, 0], red: [0, 0], offsides: [0, 0], fouls: [0, 0], subs: [0, 0],
  };
  const add = (p: Pair, isHome: boolean) => { p[isHome ? 0 : 1]++; };
  for (const e of events) {
    const isHome = !e.team || e.team === homeTeam;
    if (e.type === 'GOAL')         add(s.goals, isHome);
    if (e.type === 'SHOT') {
      add(s.shots, isHome);
      if (e.shotOutcome === 'OnTarget' || e.shotOutcome === 'Woodwork') add(s.onTarget, isHome);
    }
    if (e.type === 'CORNER')       add(s.corners, isHome);
    if (e.type === 'YELLOW_CARD')  add(s.yellow, isHome);
    if (e.type === 'RED_CARD')     add(s.red, isHome);
    if (e.type === 'OFFSIDE')      add(s.offsides, isHome);
    if (e.type === 'FOUL')         add(s.fouls, isHome);
    if (e.type === 'SUBSTITUTION') add(s.subs, isHome);
  }

  // Counting events undercounts real matches whenever the ingest has gaps —
  // but every TxLINE record also carries CUMULATIVE totals (event.stats and
  // the running score). Those are authoritative: take the max ever seen per
  // counter and never show less than it. Demo events carry the same fields,
  // so both paths agree when the feed is complete.
  const cum = { goals: [0, 0] as Pair, corners: [0, 0] as Pair, yellow: [0, 0] as Pair, red: [0, 0] as Pair };
  for (const e of events) {
    if (e.score) {
      cum.goals[0] = Math.max(cum.goals[0], e.score.home);
      cum.goals[1] = Math.max(cum.goals[1], e.score.away);
    }
    const st = e.stats;
    if (st) {
      cum.corners[0] = Math.max(cum.corners[0], st.cornersHome ?? 0);
      cum.corners[1] = Math.max(cum.corners[1], st.cornersAway ?? 0);
      cum.yellow[0]  = Math.max(cum.yellow[0],  st.yellowHome ?? 0);
      cum.yellow[1]  = Math.max(cum.yellow[1],  st.yellowAway ?? 0);
      cum.red[0]     = Math.max(cum.red[0],     st.redHome ?? 0);
      cum.red[1]     = Math.max(cum.red[1],     st.redAway ?? 0);
    }
  }
  if (score) {
    cum.goals[0] = Math.max(cum.goals[0], score.home);
    cum.goals[1] = Math.max(cum.goals[1], score.away);
  }
  const lift = (counted: Pair, cumulative: Pair): Pair =>
    [Math.max(counted[0], cumulative[0]), Math.max(counted[1], cumulative[1])];
  s.goals   = lift(s.goals,   cum.goals);
  s.corners = lift(s.corners, cum.corners);
  s.yellow  = lift(s.yellow,  cum.yellow);
  s.red     = lift(s.red,     cum.red);
  return s;
}

type Props = {
  events: BozEvent[]; homeTeam: string; awayTeam: string;
  /** authoritative header score — floors the Goals row when events are sparse */
  score?: { home: number; away: number };
};

function StatRow({ label, pair, icon, iconColor, grow, delay }: {
  label: string; pair: Pair; icon: React.ReactNode; iconColor: string;
  /** false until mount — bars animate from 0 to their width */
  grow: boolean; delay: number;
}) {
  const [home, away] = pair;
  const max = Math.max(home, away, 1);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="font-bold text-gray-200 tabular-nums">{home}</span>
        <span className="uppercase tracking-widest inline-flex items-center gap-1.5">
          <span style={{ color: iconColor }}>{icon}</span> {label}
        </span>
        <span className="font-bold text-gray-200 tabular-nums">{away}</span>
      </div>
      {/* two fixed halves with a CENTERED divider — bars grow outward from the
          middle toward their own team's side, never drifting across */}
      <div className="flex items-center h-1.5">
        <div className="flex-1 h-full flex justify-end">
          <div className="h-full rounded-l-full"
               style={{ width: grow ? `${(home / max) * 100}%` : '0%', background: 'var(--green)',
                        transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` }} />
        </div>
        <div className="w-px h-full flex-shrink-0 mx-0.5" style={{ background: 'var(--glass-border)' }} />
        <div className="flex-1 h-full">
          <div className="h-full rounded-r-full"
               style={{ width: grow ? `${(away / max) * 100}%` : '0%', background: 'var(--blue)',
                        transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` }} />
        </div>
      </div>
    </div>
  );
}

export function MatchStats({ events, homeTeam, awayTeam, score }: Props) {
  // bars sweep in from the centre on first paint
  const [grow, setGrow] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setGrow(true)); return () => cancelAnimationFrame(t); }, []);

  if (events.length === 0) return null;
  const s = calcStats(events, homeTeam, score);

  const rows: { label: string; pair: Pair; icon: React.ReactNode; color: string }[] = [
    { label: 'Goals',     pair: s.goals,    icon: <IconBall size={11} />,    color: 'var(--green)' },
    { label: 'Shots',     pair: s.shots,    icon: <IconTarget size={11} />,  color: '#06b6d4' },
    { label: 'On Target', pair: s.onTarget, icon: <IconTarget size={11} />,  color: '#22d3ee' },
    { label: 'Corners',   pair: s.corners,  icon: <IconFlagEnd size={11} />, color: 'var(--amber)' },
    { label: 'Yellow',    pair: s.yellow,   icon: <IconCard size={10} />,    color: 'var(--amber)' },
    { label: 'Red Cards', pair: s.red,      icon: <IconCard size={10} />,    color: 'var(--red)' },
    { label: 'Offsides',  pair: s.offsides, icon: <IconFlagEnd size={10} />, color: '#fb7185' },
    { label: 'Fouls',     pair: s.fouls,    icon: <IconCard size={10} />,    color: '#8b9bb4' },
    { label: 'Subs',      pair: s.subs,     icon: <IconSub size={11} />,     color: '#9ca3af' },
  ];

  return (
    <div className="glass p-5">
      <p className="section-label mb-4">Match Stats</p>

      {/* Team labels */}
      <div className="flex justify-between text-xs font-bold mb-4">
        <span style={{ color: 'var(--green)' }}>{homeTeam}</span>
        <span style={{ color: 'var(--blue)' }}>{awayTeam}</span>
      </div>

      <div className="space-y-3">
        {rows
          .filter(r => r.pair[0] + r.pair[1] > 0 || ['Goals', 'Shots', 'Corners'].includes(r.label))
          .map((r, i) => (
            <StatRow key={r.label} label={r.label} pair={r.pair} icon={r.icon} iconColor={r.color}
                     grow={grow} delay={i * 60} />
          ))}
      </div>
    </div>
  );
}
