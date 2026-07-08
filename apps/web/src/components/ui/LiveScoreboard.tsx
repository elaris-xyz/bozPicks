'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { Flag } from './Flag';

/**
 * Broadcast-style scorebug — the live centrepiece of /play. When a match is on
 * air it shows the scoreline, clock, competition, a live possession bar and the
 * latest event ticker, all off the TxLINE stream. When idle it invites the
 * judge to kick a match off from the Command Bridge (bottom-left ⚡).
 */
export function LiveScoreboard() {
  const live = useLiveMatch();
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [ticker, setTicker] = useState<{ text: string; kind: string } | null>(null);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (Date.now() - new Date(e.timestamp).getTime() > 8000) return; // ignore catch-up
      if (e.stats) setStats(e.stats);
      const label = e.type.replace(/_/g, ' ').toLowerCase();
      if (['GOAL', 'RED_CARD', 'YELLOW_CARD', 'CORNER', 'SHOT', 'VAR', 'PENALTY', 'HALFTIME', 'SUBSTITUTION'].includes(e.type)) {
        setTicker({ text: `${e.matchMinute}' · ${label}${e.team ? ` — ${e.team}` : ''}${e.player ? ` (${e.player})` : ''}`, kind: e.type });
      }
    },
  });

  if (!live?.live) {
    return (
      <div className="glass fx-rise relative overflow-hidden p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
             style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18M3.5 9h17M3.5 15h17M12 3c-2.5 2.4-2.5 15.6 0 18M12 3c2.5 2.4 2.5 15.6 0 18" strokeLinecap="round" />
          </svg>
        </div>
        <p className="font-display text-lg font-bold text-gray-200">No match on air</p>
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          Tap the{' '}
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full align-middle mx-0.5" style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)' }}>
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
          </span>{' '}
          <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left) to kick one off — pick a
          real TxLINE fixture, choose the story, and watch every game come alive.
        </p>
      </div>
    );
  }

  const poss = typeof stats?.possession === 'number' ? stats.possession : 50;

  return (
    <div className="glass fx-rise relative overflow-hidden"
         style={{ borderColor: 'rgba(16,185,129,0.28)', boxShadow: '0 0 34px rgba(16,185,129,0.10)' }}>
      {/* top edge live glow */}
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,var(--green),transparent)' }} />

      <div className="relative p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="chip-glass chip-green"><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />LIVE · {live.minute}&rsquo;</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Powered by TxLINE</span>
        </div>

        {/* scoreline */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <div className="flex flex-col items-center gap-2 min-w-0">
            <Flag team={live.homeTeam} size="lg" />
            <span className="text-sm md:text-base font-bold uppercase tracking-tight truncate max-w-full text-center">{live.homeTeam}</span>
          </div>
          <div className="font-display text-4xl md:text-6xl font-black tabular-nums flex items-baseline gap-2 md:gap-3"
               style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.8))' }}>
            <span className="score-shimmer">{live.homeScore}</span>
            <span className="text-2xl md:text-3xl text-gray-600 font-light">–</span>
            <span className="score-shimmer">{live.awayScore}</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-0">
            <Flag team={live.awayTeam} size="lg" />
            <span className="text-sm md:text-base font-bold uppercase tracking-tight truncate max-w-full text-center">{live.awayTeam}</span>
          </div>
        </div>

        {/* live possession bar */}
        <div className="mt-5">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 mb-1">
            <span className="text-[var(--green)] font-bold">{poss}%</span>
            <span>Possession</span>
            <span className="text-[var(--blue)] font-bold">{100 - poss}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${poss}%`, background: 'linear-gradient(90deg,var(--green),rgba(16,185,129,0.55))', transition: 'width .6s' }} />
            <div style={{ width: `${100 - poss}%`, background: 'linear-gradient(90deg,rgba(59,130,246,0.55),var(--blue))', transition: 'width .6s' }} />
          </div>
        </div>

        {/* last-event ticker */}
        {ticker && (
          <div key={ticker.text} className="anim-in mt-4 flex items-center gap-2 rounded-xl px-3 py-2"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full badge-live flex-shrink-0" style={{ background: 'var(--green)' }} />
            <span className="text-[12px] text-gray-300 truncate">{ticker.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
