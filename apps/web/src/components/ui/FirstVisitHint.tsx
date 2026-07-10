'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * One-time welcome hint that points first-time visitors at the Command Bridge
 * launcher (bottom-left). Solid (non-glass) panel so it never blends with the
 * flag posters behind it, wrapped in a rotating cinematic glow to draw the eye.
 * Auto-dismisses after 10s (or on click) and is remembered so it never returns.
 */
const KEY = 'boz_seen_hint_v3';

export function FirstVisitHint() {
  const [show, setShow] = useState(false);

  const dismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  }, []);

  // first visit → reveal after a beat
  useEffect(() => {
    try { if (localStorage.getItem(KEY)) return; } catch { return; }
    const appear = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(appear);
  }, []);

  // once shown, live for 10s then dismiss for good
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(dismiss, 10000);
    return () => clearTimeout(t);
  }, [show, dismiss]);

  if (!show) return null;

  return (
    <div className="fx-rise fixed z-40 bottom-32 left-3 md:bottom-16 md:left-4 w-[min(92vw,344px)]">
      <div className="relative">
        {/* rotating cinematic glow ring */}
        <div className="absolute -inset-[10px] rounded-[22px] animate-spin pointer-events-none"
             style={{
               animationDuration: '4s',
               background: 'conic-gradient(from 0deg, transparent 0deg, #3b82f6 60deg, transparent 140deg, transparent 220deg, #a78bfa 300deg, transparent 360deg)',
               filter: 'blur(12px)', opacity: 0.75,
             }} />

        {/* solid card */}
        <div className="relative rounded-2xl flex items-start gap-3 px-4 py-3.5"
             style={{
               background: 'linear-gradient(180deg, #101a30, #0a0f1e)',
               border: '1px solid rgba(99,140,255,0.35)',
               boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
             }}>
          {/* attention avatar — the bolt, matching the launcher */}
          <span className="relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #a78bfa)', boxShadow: '0 0 16px rgba(59,130,246,0.5)' }}>
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(99,140,255,0.35)' }} />
            <svg viewBox="0 0 24 24" className="relative w-4 h-4" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
          </span>

          <p className="text-[13px] text-gray-200 leading-snug flex-1">
            New here? Tap the{' '}
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full align-middle mx-0.5" style={{ background: 'linear-gradient(135deg, #3b82f6, #a78bfa)' }}>
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
            </span>{' '}
            <span className="font-bold" style={{ color: 'var(--blue)' }}>Command Bridge</span> (bottom-left) to run a live match.
            <span className="block text-gray-400 mt-0.5">Watch goals, markets, and agents react in real time.</span>
          </p>

          <button onClick={dismiss} aria-label="Dismiss"
            className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
