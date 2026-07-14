'use client';

import { useEffect, useState } from 'react';
import type { BozEvent } from '@bozpicks/shared';
import { IconBall, IconCard, IconSub, IconTarget, IconFlagEnd } from './Icons';

type Pair = [number, number];
type Stats = {
  goals: Pair; shots: Pair; onTarget: Pair; corners: Pair;
  yellow: Pair; red: Pair; offsides: Pair; fouls: Pair; subs: Pair;
};

function calcStats(events: BozEvent[], homeTeam: string): Stats {
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
  return s;
}

type Props = { events: BozEvent[]; homeTeam: string; awayTeam: string };

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
      <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
        <div className="rounded-full"
             style={{ width: grow ? `${(home / max) * 50}%` : '0%', background: 'var(--green)', marginLeft: 'auto',
                      transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` }} />
        <div className="w-px flex-shrink-0" style={{ background: 'var(--glass-border)' }} />
        <div className="rounded-full"
             style={{ width: grow ? `${(away / max) * 50}%` : '0%', background: 'var(--blue)',
                      transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` }} />
      </div>
    </div>
  );
}

export function MatchStats({ events, homeTeam, awayTeam }: Props) {
  // bars sweep in from the centre on first paint
  const [grow, setGrow] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setGrow(true)); return () => cancelAnimationFrame(t); }, []);

  if (events.length === 0) return null;
  const s = calcStats(events, homeTeam);

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
