'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Horizontal scroll container that also pans by mouse drag and converts a
 * vertical mouse-wheel into horizontal scrolling while hovered — so the poster
 * rails feel like a physical shelf you can flick left/right.
 */
export function PanScroller({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  const onWheel = (e: React.WheelEvent) => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;       // nothing to scroll
    // let a genuinely horizontal wheel/trackpad gesture pass through untouched
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      el.setPointerCapture?.(e.pointerId);
      // grabbing everywhere, including over the card links (they set pointer)
      el.style.cursor = 'grabbing';
      el.querySelectorAll('a').forEach(a => { (a as HTMLElement).style.cursor = 'grabbing'; });
    }
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent) => {
    const el = ref.current;
    if (el) {
      el.style.cursor = '';
      el.querySelectorAll('a').forEach(a => { (a as HTMLElement).style.cursor = ''; });
    }
    // suppress the click that follows a real drag (so cards don't navigate)
    if (drag.current.moved) {
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      el?.addEventListener('click', stop, { capture: true, once: true });
    }
    drag.current.active = false;
    el?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div ref={ref} className={`${className ?? ''} select-none`}
         style={{ cursor: 'grab', touchAction: 'pan-x' }}
         onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
         onPointerUp={endDrag} onPointerLeave={endDrag}
         // the flag posters are draggable images by default — a drag must pan
         // the rail, not pick the picture up
         onDragStart={e => e.preventDefault()}>
      {children}
    </div>
  );
}
