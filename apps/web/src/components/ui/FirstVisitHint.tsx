'use client';

import { useEffect, useState } from 'react';

/**
 * One-time, dismissible welcome hint that points first-time visitors at the
 * "Run Demo" button — the fastest way to see the whole product come alive.
 * Stored in localStorage so it never nags a returning user.
 */
const KEY = 'boz_seen_hint_v1';

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
    <div className="fx-rise fixed z-40 bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,420px)]">
      <div className="glass flex items-center gap-3 px-4 py-3"
           style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.25)' }}>
        <span className="text-xl flex-shrink-0">👋</span>
        <p className="text-[13px] text-gray-200 leading-snug flex-1">
          New here? Hit <span className="font-bold" style={{ color: 'var(--blue)' }}>Run Demo</span> anywhere to
          watch a live match — with goals, markets and agents reacting in real time.
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
