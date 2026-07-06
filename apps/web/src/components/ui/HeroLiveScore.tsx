'use client';

import { useLiveMatch } from '@/hooks/useLiveMatch';
import { Flag } from './Flag';

/**
 * Right-column hero panel for /play — the current live scoreline, or a prompt
 * when idle. Fills the hero instead of leaving empty space.
 */
export function HeroLiveScore() {
  const live = useLiveMatch();

  if (!live?.live) {
    return (
      <div className="glass rounded-2xl px-5 py-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <p className="text-sm font-semibold text-gray-300">No match live right now</p>
        <p className="text-[11px] text-gray-600 mt-1">Hit <span className="font-bold text-[var(--blue)]">Run Demo</span> to kick one off</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl px-5 py-4" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="chip-glass chip-green"><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />LIVE {live.minute}&rsquo;</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">TxLINE</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <Flag team={live.homeTeam} size="md" />
          <span className="text-[11px] font-bold uppercase truncate max-w-full">{live.homeTeam}</span>
        </div>
        <div className="font-display text-3xl font-black tabular-nums flex-shrink-0">
          {live.homeScore}<span className="text-gray-600 mx-1">–</span>{live.awayScore}
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <Flag team={live.awayTeam} size="md" />
          <span className="text-[11px] font-bold uppercase truncate max-w-full">{live.awayTeam}</span>
        </div>
      </div>
    </div>
  );
}
