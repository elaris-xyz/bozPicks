'use client';

import { useCallback, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent } from '@bozpicks/shared';
import { playSfx } from '@/lib/sfx';

/**
 * Cinematic layer. Always-on drifting aurora + film grain + vignette, plus
 * full-screen event VFX driven off the live TxLINE stream: a goal fires an
 * expanding shockwave, flash, "GOAL" title and confetti; a red card pulses the
 * screen red; full-time gives a gold finale. Purely decorative (pointer-events
 * none) and reduced-motion aware.
 */

type BurstInput =
  | { kind: 'GOAL'; team?: string; score?: { home: number; away: number } }
  | { kind: 'RED'; team?: string }
  | { kind: 'END' };
type Burst = BurstInput & { id: number };

const CONFETTI_COLORS = ['#34d399', '#3b82f6', '#a78bfa', '#fbbf24', '#f87171', '#ffffff'];

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="fx-confetti absolute inset-0">
      {pieces.map(i => (
        <span key={i} style={{
          left: `${Math.random() * 100}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${Math.random() * 0.4}s`,
          ['--d' as string]: `${1.8 + Math.random() * 1.2}s`,
          transform: `translateY(0) rotate(${Math.random() * 360}deg)`,
        }} />
      ))}
    </div>
  );
}

function Overlay({ burst }: { burst: Burst }) {
  if (burst.kind === 'GOAL') {
    return (
      <div className="fx-overlay">
        <div className="fx-flash fx-flash-goal" />
        <div className="fx-ring" style={{ borderColor: 'rgba(16,185,129,0.8)' }} />
        <div className="fx-ring" style={{ borderColor: 'rgba(59,130,246,0.5)', animationDelay: '0.12s' }} />
        <Confetti />
        <div className="fx-title text-center">
          <p className="font-display font-black tracking-tighter leading-none"
             style={{ fontSize: 'clamp(3.5rem, 14vw, 9rem)', color: '#fff', textShadow: '0 0 40px rgba(16,185,129,0.7), 0 6px 30px rgba(0,0,0,0.6)' }}>
            GOAL
          </p>
          {burst.team && (
            <p className="font-display font-bold uppercase tracking-widest mt-1"
               style={{ fontSize: 'clamp(0.9rem, 3vw, 1.6rem)', color: '#a7f3d0', textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
              {burst.team}{burst.score ? ` · ${burst.score.home}–${burst.score.away}` : ''}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (burst.kind === 'RED') {
    return (
      <div className="fx-overlay">
        <div className="fx-flash fx-flash-red" />
        <div className="fx-ring" style={{ borderColor: 'rgba(239,68,68,0.7)' }} />
        <div className="fx-title text-center">
          <div className="mx-auto mb-3 rounded-sm" style={{ width: 44, height: 60, background: '#ef4444', boxShadow: '0 0 40px rgba(239,68,68,0.7)' }} />
          <p className="font-display font-black uppercase tracking-widest"
             style={{ fontSize: 'clamp(1.4rem, 5vw, 2.6rem)', color: '#fecaca', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
            Red Card{burst.team ? ` · ${burst.team}` : ''}
          </p>
        </div>
      </div>
    );
  }
  // END
  return (
    <div className="fx-overlay">
      <div className="fx-flash fx-flash-gold" />
      <div className="fx-ring" style={{ borderColor: 'rgba(245,158,11,0.7)' }} />
      <div className="fx-title text-center">
        <p className="font-display font-black uppercase tracking-widest"
           style={{ fontSize: 'clamp(1.6rem, 6vw, 3.2rem)', color: '#fde68a', textShadow: '0 0 40px rgba(245,158,11,0.6), 0 4px 20px rgba(0,0,0,0.7)' }}>
          Full Time
        </p>
      </div>
    </div>
  );
}

export function CinematicFX() {
  const [burst, setBurst] = useState<Burst | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFire = useRef(0);

  const fire = useCallback((b: BurstInput) => {
    // debounce rapid duplicates (SSE catch-up can replay recent events)
    const now = Date.now();
    if (now - lastFire.current < 1200) return;
    lastFire.current = now;
    setBurst({ ...b, id: now });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBurst(null), b.kind === 'GOAL' ? 2600 : 1900);
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      // only react to fresh events, not the connect catch-up burst
      if (Date.now() - new Date(e.timestamp).getTime() > 8000) return;
      if (e.type === 'GOAL') { fire({ kind: 'GOAL', team: e.team, score: e.score }); playSfx('goal'); }
      else if (e.type === 'RED_CARD') { fire({ kind: 'RED', team: e.team }); playSfx('red'); }
      else if (e.type === 'MATCH_END') { fire({ kind: 'END' }); playSfx('end'); }
    },
  });

  return (
    <>
      <div className="fx-layer fx-aurora" aria-hidden />
      <div className="fx-layer fx-grain" aria-hidden />
      <div className="fx-layer fx-vignette" aria-hidden />
      {burst && <Overlay burst={burst} />}
    </>
  );
}
