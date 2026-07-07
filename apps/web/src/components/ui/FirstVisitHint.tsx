'use client';

import { useEffect, useState } from 'react';

/**
 * One-time, dismissible welcome hint that points first-time visitors at the
 * Command Bridge launcher (bottom-left) — the fastest way to see the whole
 * product come alive. Stored in localStorage so it never nags a returning user.
 */
const KEY = 'boz_seen_hint_v2';

export function FirstVisitHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) {
      const t = setTimeout(() => setShow(true), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(KEY, '1');
  };

  if (!show) return null;

  return (
    <div className="fx-rise fixed z-40 bottom-32 left-3 md:bottom-16 md:left-4 w-[min(92vw,340px)]">
      <div className="glass flex items-center gap-3 px-4 py-3"
           style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.25)' }}>
        <span className="text-lg flex-shrink-0">👋</span>
        <p className="text-[13px] text-gray-200 leading-snug flex-1">
          New here? Tap the{' '}
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full align-middle mx-0.5" style={{ background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))' }}>
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
          </span>{' '}
          <span className="font-bold" style={{ color: 'var(--blue)' }}>Command Bridge</span> (bottom-left) to run a
          live match — goals, markets and agents react in real time.
        </p>
        <button onClick={dismiss} aria-label="Dismiss"
          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
