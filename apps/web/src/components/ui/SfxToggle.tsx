'use client';

import { useEffect, useState } from 'react';
import { initSfx, isSfxEnabled, setSfxEnabled, playSfx } from '@/lib/sfx';

/** Floating sound on/off toggle. Initialises the audio engine on mount. */
export function SfxToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    initSfx();
    setOn(isSfxEnabled());
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSfxEnabled(next);
    if (next) playSfx('tick');
  };

  return (
    <button onClick={toggle} title={on ? 'Sound on' : 'Sound off'} aria-label="Toggle sound"
      className="fixed z-40 bottom-24 right-3 md:bottom-10 md:right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
      style={{ background: 'rgba(9,13,26,0.8)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)', color: on ? 'var(--blue)' : '#64748b' }}>
      {on ? (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6M16 9l6 6" />
        </svg>
      )}
    </button>
  );
}
