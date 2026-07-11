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
    clearTimer.current = setTimeout(() => setGoal(null), 2500);
  });

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  if (!match?.live) return null;
  const pct = Math.min(100, Math.max(2, (match.minute / FULL) * 100));
  pctRef.current = pct;

  return (
    <>
      {/* the flying goal ball + word — fixed, above everything, non-interactive.
          The ball's home `left` tracks the LIVE pct (not the frozen goal-time
          value) so when it lands and the clip ends, the orbiting bar ball is at
          the exact same spot — a seamless hand-off, no teleport to the start. */}
      {goal && (
        <div key={goal.id} className="fixed inset-0 z-[120] pointer-events-none" aria-hidden>
          <div className="boz-goal-ball absolute" style={{ left: `${pct}%`, bottom: 18, marginLeft: -16, ['--dx' as string]: `${goal.dx}px`, willChange: 'transform' }}>
            <div className="relative" style={{ width: 32, height: 32 }}>
              {/* pulsing energy aura (does not spin) */}
              <span className="boz-goal-aura absolute left-1/2 top-1/2" style={{
                width: 96, height: 96, marginLeft: -48, marginTop: -48, borderRadius: '9999px',
                background: 'radial-gradient(circle, rgba(52,211,153,0.6) 0%, rgba(59,130,246,0.25) 45%, transparent 70%)',
              }} />
              {/* comet trail streaking behind the ball (does not spin) */}
              <span className="boz-goal-trail absolute left-1/2 top-1/2" style={{
                width: 14, height: 120, marginLeft: -7, marginTop: -8,
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(52,211,153,0.4), transparent)',
                filter: 'blur(4px)', borderRadius: '9999px',
              }} />
              {/* only the ball itself spins */}
              <div className="boz-ball-spin absolute inset-0"><Ball size={32} glow /></div>
            </div>
          </div>
          {/* GOAL word — sits below the ball's apex */}
          <div className="boz-goal-word absolute left-1/2" style={{ bottom: '38vh' }}>
            <p className="font-display font-black tracking-tighter leading-none text-center"
               style={{ fontSize: 'clamp(2.6rem, 11vw, 7rem)', color: '#fff', textShadow: '0 0 40px rgba(16,185,129,0.75), 0 6px 30px rgba(0,0,0,0.6)' }}>
              GOAL
            </p>
          </div>
          {/* team + score — its own label UNDER the ball, fades out before the ball drops */}
          {(goal.team || goal.score) && (
            <div className="boz-goal-team absolute left-1/2 text-center" style={{ bottom: '28vh' }}>
              <p className="font-display font-bold uppercase tracking-widest whitespace-nowrap"
                 style={{ fontSize: 'clamp(0.8rem, 2.6vw, 1.4rem)', color: '#a7f3d0', textShadow: '0 2px 16px rgba(0,0,0,0.85)' }}>
                {goal.team}{goal.score ? ` · ${goal.score.home}–${goal.score.away}` : ''}
              </p>
            </div>
          )}
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

// Classic 32-panel football: the black pentagon/seam pattern (user-supplied
// path) laid over a white sphere, with a clip so it stays inside the ball and a
// soft highlight for roundness.
const BALL_PATTERN = 'M255.03 33.813c-1.834-.007-3.664-.007-5.5.03-6.73.14-13.462.605-20.155 1.344.333.166.544.32.47.438L204.78 75.063l73.907 49.437-.125.188 70.625.28L371 79.282 342.844 52c-15.866-6.796-32.493-11.776-49.47-14.78-12.65-2.24-25.497-3.36-38.343-3.407zM190.907 88.25l-73.656 36.78-13.813 98.407 51.344 33.657 94.345-43.438 14.875-76.5-73.094-48.906zm196.344.344l-21.25 44.5 36.75 72.72 62.063 38.905 11.312-21.282c.225.143.45.403.656.75-.77-4.954-1.71-9.893-2.81-14.782-6.446-28.59-18.59-55.962-35.5-79.97-9.07-12.872-19.526-24.778-31.095-35.5l-20.125-5.342zm-302.656 23c-6.906 8.045-13.257 16.56-18.938 25.5-15.676 24.664-26.44 52.494-31.437 81.312C31.783 232.446 30.714 246.73 31 261l20.25 5.094 33.03-40.5L98.75 122.53l-14.156-10.936zm312.719 112.844l-55.813 44.75-3.47 101.093 39.626 21.126 77.188-49.594 4.406-78.75-.094.157-61.844-38.783zm-140.844 6.406l-94.033 43.312-1.218 76.625 89.155 57.376 68.938-36.437 3.437-101.75-66.28-39.126zm-224.22 49.75c.91 8.436 2.29 16.816 4.156 25.094 6.445 28.59 18.62 55.96 35.532 79.968 3.873 5.5 8.02 10.805 12.374 15.938l-9.374-48.156.124-.032-27.03-68.844-15.782-3.968zm117.188 84.844l-51.532 8.156 10.125 52.094c8.577 7.49 17.707 14.332 27.314 20.437 14.612 9.287 30.332 16.88 46.687 22.594l62.626-13.69-4.344-31.124-90.875-58.47zm302.437.5l-64.22 41.25-42 47.375 4.408 6.156c12.027-5.545 23.57-12.144 34.406-19.72 23.97-16.76 44.604-38.304 60.28-62.97 2.51-3.947 4.87-7.99 7.125-12.092zm-122.78 97.656l-79.94 9.625-25.968 5.655c26.993 4 54.717 3.044 81.313-2.813 9.412-2.072 18.684-4.79 27.75-8.062l-3.156-4.406z';

function Ball({ size = 18, glow = false }: { size?: number; glow?: boolean }) {
  const id = 'ballclip';
  return (
    <svg viewBox="0 0 512 512" width={size} height={size}
         style={glow ? { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55)) drop-shadow(0 0 5px rgba(255,255,255,0.55))' } : undefined}>
      <defs>
        <clipPath id={id}><circle cx="256" cy="256" r="248" /></clipPath>
        <radialGradient id="ballshade" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#c9d3e0" />
        </radialGradient>
      </defs>
      <circle cx="256" cy="256" r="248" fill="url(#ballshade)" stroke="#0b1020" strokeWidth="10" />
      <g clipPath={`url(#${id})`}>
        <path fill="#0b1020" d={BALL_PATTERN} />
      </g>
      {/* specular highlight for a rounded, lively look */}
      <ellipse cx="185" cy="150" rx="70" ry="46" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
