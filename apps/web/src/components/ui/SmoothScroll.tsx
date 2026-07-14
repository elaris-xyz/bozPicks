'use client';

import { useEffect } from 'react';

/**
 * Buttery page scrolling — a dependency-free Lenis-style inertia layer.
 * Wheel input moves a TARGET; a rAF loop eases the real scroll toward it, so
 * every flick glides and settles instead of stepping. Deliberately narrow:
 *   · touch devices keep native momentum (already good, and hijacking it is worse)
 *   · prefers-reduced-motion keeps native scrolling
 *   · nested scrollers (timeline, rails, modals) stay native — we only take the
 *     wheel when nothing under the cursor can consume it
 *   · PanScroller's horizontal-rail handling wins (defaultPrevented respected)
 * Keyboard / scrollbar / anchor scrolling stays native; the target re-syncs on
 * any scroll we didn't cause.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let target = window.scrollY;
    let current = window.scrollY;
    let raf = 0;
    let animating = false;

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    /** anything between the cursor and <body> that can still scroll this way? */
    const nestedScroller = (el: Element | null, dy: number): boolean => {
      while (el && el !== document.body && el !== document.documentElement) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          const canUp = el.scrollTop > 0;
          const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
          if ((dy < 0 && canUp) || (dy > 0 && canDown)) return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const tick = () => {
      current += (target - current) * 0.11;               // ease-out glide
      if (Math.abs(target - current) < 0.5) {
        current = target;
        animating = false;
        window.scrollTo({ top: current, behavior: 'instant' as ScrollBehavior });
        return;
      }
      window.scrollTo({ top: current, behavior: 'instant' as ScrollBehavior });
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey) return;        // rails / pinch-zoom win
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal gesture
      if (nestedScroller(e.target as Element, e.deltaY)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      target = Math.max(0, Math.min(maxScroll(), target + dy));
      if (!animating) {
        animating = true;
        current = window.scrollY;
        raf = requestAnimationFrame(tick);
      }
    };

    // keyboard / scrollbar / anchor scrolls happen natively — re-sync so the
    // next wheel continues from wherever the page really is
    const onNativeScroll = () => {
      if (!animating) { target = window.scrollY; current = window.scrollY; }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onNativeScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onNativeScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
