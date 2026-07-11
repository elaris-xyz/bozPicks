'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveMatchContext } from '@/contexts/LiveMatchContext';
import { useSSESubscription } from '@/contexts/SSEContext';
import type { SSEMessage, BozEvent } from '@bozpicks/shared';

/**
 * The pitch-clock. A hair-thin bar just above the bottom of every screen while
 * a match is live: it fills from 0' to 90' with the run of play, a little
 * football rides the leading edge (spinning, bobbing), and the score sits at
 * the right. When a goal drops, the ball launches FROM ITS CURRENT SPOT up to
 * centre-screen, swells into a "GOAL" with the scorer + score, then flies back
 * to that spot and bounces a couple of times before playing on. Purely ambient
 * — pointer-events none.
 */

const FULL = 92; // clamp minute → % (a touch past 90 for stoppage)

type Goal = { id: number; team?: string; score?: { home: number; away: number }; leftPct: number; dx: number };

export function LiveMatchBar() {
  const match = useLiveMatchContext();
  const [goal, setGoal] = useState<Goal | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoal = useRef(0);
  const pctRef = useRef(2);

  useSSESubscription((msg: SSEMessage) => {
    if (msg.type !== 'event' || !msg.data || msg.catchup) return;
    const e = msg.data as BozEvent;
    if (e.type !== 'GOAL') return;
    const now = Date.now();
    if (now - lastGoal.current < 1500) return; // de-dupe SSE replays
    lastGoal.current = now;
    // launch point = the ball's current x; dx = px it must travel to reach centre
    const leftPct = pctRef.current;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const dx = vw / 2 - (vw * leftPct) / 100;
    setGoal({ id: now, team: e.team, score: e.score, leftPct, dx });
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setGoal(null), 2700);
  });

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  if (!match?.live) return null;
  const pct = Math.min(100, Math.max(2, (match.minute / FULL) * 100));
  pctRef.current = pct;

  return (
    <>
      {/* the flying goal ball + word — fixed, above everything, non-interactive */}
      {goal && (
        <div key={goal.id} className="fixed inset-0 z-[120] pointer-events-none" aria-hidden>
          <div className="boz-goal-ball absolute" style={{ left: `${goal.leftPct}%`, bottom: 18, marginLeft: -13, ['--dx' as string]: `${goal.dx}px`, willChange: 'transform' }}>
            <Ball size={26} glow />
          </div>
          <div className="boz-goal-word absolute left-1/2 text-center" style={{ bottom: '52vh' }}>
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

      {/* the clock bar — lifted off the very bottom so the ball is fully visible,
          and above the mobile tab bar */}
      <div className="fixed inset-x-0 z-[45] pointer-events-none bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] md:bottom-2"
           aria-hidden>
        {/* score + minute pill, right-aligned just above the line */}
        <div className="flex justify-end px-3 md:px-6 mb-1.5">
          <div className="flex items-center gap-2 rounded-full px-2.5 py-1"
               style={{ background: 'rgba(9,13,26,0.9)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}>
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
        <div className="relative h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="absolute inset-y-0 left-0 rounded-r-full transition-[width] duration-1000 ease-linear"
               style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(59,130,246,0.7), var(--green))', boxShadow: '0 0 10px rgba(16,185,129,0.55)' }} />
          {/* the ball rides ON TOP of the line at the leading edge (hidden while
              it's flying for a goal). bottom:0 rests it on the line, fully visible. */}
          {!goal && (
            <div className="boz-ball-bob absolute bottom-0" style={{ left: `calc(${pct}% - 9px)`, transition: 'left 1s linear' }}>
              <div className="boz-ball-spin"><Ball size={18} glow /></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** A proper football — white sphere, black centre pentagon, seams to the edge. */
function Ball({ size = 18, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size}
         style={glow ? { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5)) drop-shadow(0 0 5px rgba(255,255,255,0.6))' } : undefined}>
      <circle cx="16" cy="16" r="15" fill="#f8fafc" stroke="#0b1020" strokeWidth="1.3" />
      {/* central pentagon */}
      <polygon points="16,9 21.7,13.2 19.5,19.9 12.5,19.9 10.3,13.2" fill="#0b1020" />
      {/* seams radiating from each pentagon vertex to the rim */}
      <path d="M16 9V3.2M21.7 13.2l5.4-2.9M19.5 19.9l3.4 5.2M12.5 19.9l-3.4 5.2M10.3 13.2l-5.4-2.9"
            stroke="#0b1020" strokeWidth="1.5" strokeLinecap="round" />
      {/* soft top highlight for roundness */}
      <ellipse cx="12" cy="10.5" rx="4" ry="2.6" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
