'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Height-animated expand/collapse. Measures the content's scrollHeight and
 * transitions max-height, then releases the cap once open so nested content
 * (rails resizing, images loading) isn't clipped. Robust across engines —
 * unlike the grid-template-rows 0fr→1fr trick, which some renderers won't
 * animate.
 */
export function Collapsible({
  open, children, className = '',
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // undefined = uncapped (fully open, natural height); number = pixel cap
  const [maxH, setMaxH] = useState<number | undefined>(open ? undefined : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // setTimeout (not rAF) drives the two-step transition — rAF is paused in
    // backgrounded/headless renderers, which would leave the drawer stuck.
    if (open) {
      setMaxH(el.scrollHeight);                       // 0 → content height
      const t = setTimeout(() => setMaxH(undefined), 520); // release the cap
      return () => clearTimeout(t);
    }
    setMaxH(el.scrollHeight);                          // pin current height
    const t = setTimeout(() => setMaxH(0), 20);        // then collapse to 0
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        maxHeight: maxH === undefined ? undefined : maxH,
        overflow: 'hidden',
        transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}
