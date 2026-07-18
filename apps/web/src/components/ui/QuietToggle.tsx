'use client';

import { useEffect, useState } from 'react';
import { initQuiet, isQuiet, setQuiet } from '@/lib/quiet';

/**
 * Floating "quiet mode" toggle — sits just above the sound toggle. When on, all
 * toasts are suppressed and odds ticks are hidden from the timelines/feeds, so a
 * fast‑repricing live match doesn't bury everything in noise.
 */
export function QuietToggle() {
  const [quiet, setQ] = useState(false);

  useEffect(() => { initQuiet(); setQ(isQuiet()); }, []);

  const toggle = () => { const next = !quiet; setQ(next); setQuiet(next); };

  return (
    <button onClick={toggle} title={quiet ? 'Quiet mode ON — toasts & odds hidden' : 'Quiet mode OFF'}
      aria-label="Toggle quiet mode" aria-pressed={quiet}
      className="fixed z-40 bottom-36 right-3 md:bottom-24 md:right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
      style={{
        background: quiet ? 'rgba(245,158,11,0.16)' : 'rgba(9,13,26,0.8)',
        border: `1px solid ${quiet ? 'rgba(245,158,11,0.5)' : 'var(--glass-border)'}`,
        backdropFilter: 'blur(10px)', color: quiet ? 'var(--amber)' : '#64748b',
      }}>
      {quiet ? (
        /* bell with a slash — notifications off */
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
          <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.33-5" /><path d="M1 1l22 22" />
        </svg>
      ) : (
        /* bell — notifications on */
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )}
    </button>
  );
}
