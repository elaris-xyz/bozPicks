'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveMatchContext } from '@/contexts/LiveMatchContext';
import { useSSESubscription } from '@/contexts/SSEContext';
import type { SSEMessage, BozEvent } from '@bozpicks/shared';

/**
 * The pitch-clock. A hair-thin bar pinned to the very bottom of every screen
 * while a match is live: it fills from 0' to 90' with the run of play, a tiny
 * ball rides the leading edge (spinning, bobbing), and the score sits at the
 * right. When a goal drops, the ball launches up to centre-screen, swells into
 * a "GOAL" with the scorer + score, then falls back onto the bar with a bounce
 * and plays on. Purely ambient — pointer-events none, reduced-motion aware.
 */

const FULL = 92; // clamp minute → % (a touch past 90 for stoppage)

export function LiveMatchBar() {
  const match = useLiveMatchContext();
  const [goal, setGoal] = useState<{ id: number; team?: string; score?: { home: number; away: number } } | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoal = useRef(0);

  useSSESubscription((msg: SSEMessage) => {
    if (msg.type !== 'event' || !msg.data || msg.catchup) return;
    const e = msg.data as BozEvent;
    if (e.type !== 'GOAL') return;
    const now = Date.now();
    if (now - lastGoal.current < 1500) return; // de-dupe SSE replays
    lastGoal.current = now;
    setGoal({ id: now, team: e.team, score: e.score });
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setGoal(null), 2600);
  });

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  if (!match?.live) return null;
  const pct = Math.min(100, Math.max(1.5, (match.minute / FULL) * 100));

  return (
    <>
      {/* the flying goal ball + word — fixed, above everything, non-interactive */}
      {goal && (
        <div key={goal.id} className="fixed inset-0 z-[120] pointer-events-none" aria-hidden>
          <div className="boz-goal-ball absolute left-1/2" style={{ willChange: 'transform, bottom' }}>
            <Ball size={20} glow />
          </div>
          <div className="boz-goal-word absolute left-1/2 text-center" style={{ bottom: '54vh' }}>
            <p className="font-display font-black tracking-tighter leading-none"
               style={{ fontSize: 'clamp(2.6rem, 11vw, 7rem)', color: '#fff', textShadow: '0 0 40px rgba(16,185,129,0.75), 0 6px 30px rgba(0,0,0,0.6)' }}>
              GOAL
            </p>
            {(goal.team || goal.score) && (
              <p className="font-display font-bold uppercase tracking-widest mt-1"
                 style={{ fontSize: 'clamp(0.8rem, 2.6vw, 1.4rem)', color: '#a7f3d0', textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
                {goal.team}{goal.score ? ` · ${goal.score.home}–${goal.score.away}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* the clock bar — above content, tucked under the mobile tab bar */}
      <div className="fixed inset-x-0 z-[45] pointer-events-none bottom-[calc(env(safe-area-inset-bottom,0px)+56px)] md:bottom-0"
           aria-hidden>
        {/* score + minute pill, right-aligned just above the line */}
        <div className="flex justify-end px-3 md:px-6 mb-1">
          <div className="flex items-center gap-2 rounded-full px-2.5 py-1"
               style={{ background: 'rgba(9,13,26,0.88)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}>
            <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--green)' }} />
            <span className="text-[10px] font-bold text-gray-300 tabular-nums truncate max-w-[46vw]">
              {match.homeTeam} <span className="text-white">{match.homeScore}</span>
              <span className="text-gray-600 mx-1">–</span>
              <span className="text-white">{match.awayScore}</span> {match.awayTeam}
            </span>
            <span className="text-[10px] font-black tabular-nums px-1.5 rounded-full"
                  style={{ color: 'var(--green)', background: 'var(--green-dim)' }}>{match.minute}&rsquo;</span>
          </div>
        </div>
        {/* the fill line */}
        <div className="relative h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="absolute inset-y-0 left-0 rounded-r-full transition-[width] duration-1000 ease-linear"
               style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(59,130,246,0.7), var(--green))', boxShadow: '0 0 10px rgba(16,185,129,0.55)' }} />
          {/* the ball riding the leading edge (hidden while it's flying for a goal) */}
          {!goal && (
            <div className="boz-ball-bob absolute -top-[7px]" style={{ left: `calc(${pct}% - 8px)`, transition: 'left 1s linear' }}>
              <div className="boz-ball-spin"><Ball size={16} glow /></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** A little football — panel seams so the spin reads. */
function Ball({ size = 16, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
         style={glow ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' } : undefined}>
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0b1020" strokeWidth="1.2" />
      <path d="M12 5.5l3.4 2.5-1.3 4H9.9l-1.3-4L12 5.5z" fill="#0b1020" />
      <path d="M12 5.5V3M15.4 8l2.4-1.2M14.1 12l2.9 1M9.9 12l-2.9 1M8.6 8L6.2 6.8" stroke="#0b1020" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
