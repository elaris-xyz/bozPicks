'use client';

import { useState } from 'react';
import type { MatchState } from '@bozpicks/shared';

/**
 * Live section for the poster view. Live match cards fill a 3-column grid;
 * the striker hero image fills whatever space is left over on the first row
 * so there's never an empty gap:
 *   • 1 live match  → card + hero spanning 2 cols
 *   • 2 live        → 2 cards + hero spanning 1 col
 *   • 3 (or 6, 9…)  → full row of cards, hero hidden
 *   • 4 live        → 3 + (1 card + hero span 2) on the next row
 * The same math holds at every breakpoint since it keys off the column count.
 * On mobile there's no spare width, so the hero is hidden and cards stack.
 *
 * Drop the artwork at /public/hero-striker.png (transparent PNG). If it's
 * missing the panel degrades to a themed gradient with a tagline.
 */
export function LiveHero({
  matches, renderCard,
}: {
  matches: MatchState[];
  renderCard: (m: MatchState, i: number) => React.ReactNode;
}) {
  const [imgOk, setImgOk] = useState(true);

  const COLS = 3;
  const rem = matches.length % COLS;
  const heroSpan = rem === 0 ? 0 : COLS - rem; // 0 = no leftover → hide hero

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m, i) => (
        <div key={m.id}>{renderCard(m, i)}</div>
      ))}

      {heroSpan > 0 && (
        <div
          className="hidden lg:block relative overflow-hidden rounded-2xl border anim-in"
          style={{ gridColumn: `span ${heroSpan}`, borderColor: 'var(--glass-border)', minHeight: 200 }}
        >
          {/* themed backdrop — also the fallback when the image is absent */}
          <div className="absolute inset-0"
               style={{ background: 'radial-gradient(ellipse 80% 90% at 78% 60%, rgba(245,158,11,0.16), transparent 70%), linear-gradient(135deg, rgba(11,16,32,0.6), rgba(7,11,24,0.9))' }} />
          {/* pitch-glow floor */}
          <div className="absolute inset-x-0 bottom-0 h-1/3"
               style={{ background: 'linear-gradient(to top, rgba(245,158,11,0.10), transparent)' }} />

          {imgOk && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/hero-striker-baner.png"
              alt=""
              onError={() => setImgOk(false)}
              className="absolute right-0 bottom-0 h-[112%] w-auto max-w-none object-contain object-right-bottom select-none pointer-events-none"
              style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.6))' }}
              draggable={false}
            />
          )}

          {/* tagline, tucked bottom-left so it never collides with the striker */}
          <div className="absolute left-5 bottom-5 z-10 max-w-[55%]">
            <p className="font-display text-lg font-black uppercase leading-tight tracking-tight"
               style={{ color: '#fde68a', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
              Pick smart.<br />Get paid on-chain.
            </p>
            <p className="mt-1 text-[11px] text-gray-400">Live World Cup intelligence</p>
          </div>
        </div>
      )}
    </div>
  );
}
