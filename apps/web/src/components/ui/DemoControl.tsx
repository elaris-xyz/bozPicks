'use client';

import { useEffect, useState } from 'react';

/**
 * Single global demo control (replaces the scattered Run Demo buttons). Pick a
 * speed and start a live replay match — the whole app reacts over SSE. The
 * request resolves when the match finishes, so the button reflects "live"
 * state for the duration. Speed is persisted.
 */
const SPEEDS = [1, 2, 4, 8] as const;
const SPEED_KEY = 'boz_demo_speed';

export function DemoControl() {
  const [speed, setSpeed] = useState<number>(4);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const s = Number(localStorage.getItem(SPEED_KEY));
    if (SPEEDS.includes(s as (typeof SPEEDS)[number])) setSpeed(s);
  }, []);

  const chooseSpeed = (s: number) => { setSpeed(s); localStorage.setItem(SPEED_KEY, String(s)); };

  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      await fetch(`/api/demo?speed=${speed}`, { method: 'POST' });
    } catch { /* ignore */ }
    setRunning(false);
  };

  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[4.5rem] md:bottom-5 print:hidden">
      <div className="glass flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-full"
           style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.45)' }}>
        {/* speed selector */}
        <div className="flex items-center rounded-full overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => chooseSpeed(s)} disabled={running}
              className="px-2 h-6 text-[11px] font-bold tabular-nums transition-colors disabled:opacity-50"
              style={speed === s
                ? { background: 'var(--blue-dim)', color: 'var(--blue)' }
                : { background: 'transparent', color: '#6b7280' }}>
              {s}×
            </button>
          ))}
        </div>

        {/* run */}
        <button onClick={run} disabled={running}
          className="flex items-center gap-1.5 text-xs font-bold px-3 h-7 rounded-full transition-all hover:brightness-110 active:scale-95 disabled:cursor-default"
          style={running
            ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }
            : { background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff' }}>
          {running ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />
              Live demo…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
                <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
              </svg>
              Run Demo
            </>
          )}
        </button>
      </div>
    </div>
  );
}
