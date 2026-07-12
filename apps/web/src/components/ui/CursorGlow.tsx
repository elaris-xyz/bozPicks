'use client';

import { useEffect, useRef } from 'react';

/**
 * Cursor aura — a soft gold + cyan "flashlight" that trails the pointer and
 * subtly lights the dark UI as you move (screen blend). Two offset orbs give it
 * a cyberpunk chromatic feel. It also publishes the pointer position as CSS
 * vars (--px/--py in %) so interactive elements can react to the cursor. Pure
 * decoration: pointer-events none, disabled on touch + reduced-motion.
 */
export function CursorGlow() {
  const goldRef = useRef<HTMLDivElement>(null);
  const cyanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = window.innerWidth / 2, ty = window.innerHeight * 0.35;
    // gold leads, cyan lags slightly → a soft chromatic trail
    let gx = tx, gy = ty, cx = tx, cy = ty;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY;
      document.documentElement.style.setProperty('--px', `${(tx / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty('--py', `${(ty / window.innerHeight) * 100}%`);
    };
    const tick = () => {
      gx += (tx - gx) * 0.16; gy += (ty - gy) * 0.16;
      cx += (tx - cx) * 0.09; cy += (ty - cy) * 0.09;
      if (goldRef.current) goldRef.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      if (cyanRef.current) cyanRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div aria-hidden className="cursor-aura">
      <div ref={cyanRef} className="cursor-orb cursor-orb-cyan" />
      <div ref={goldRef} className="cursor-orb cursor-orb-gold" />
    </div>
  );
}
