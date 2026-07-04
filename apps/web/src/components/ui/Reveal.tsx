'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper: children start slightly offset + transparent and
 * ease into place the first time they enter the viewport. One-shot per element
 * (observer disconnects after reveal) so scrolling back up doesn't re-animate.
 * Falls back to visible immediately when IntersectionObserver is unavailable
 * or the user prefers reduced motion.
 */
export function Reveal({
  children, className = '', delay = 0, as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** stagger, in ms */
  delay?: number;
  as?: 'div' | 'section';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    let done = false;
    const reveal = () => { if (!done) { done = true; setShown(true); } };

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) { reveal(); io.disconnect(); break; }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    io.observe(el);

    // Safety net: if the observer never reports (backgrounded tab, headless
    // renderer, or an element that starts on-screen before observe fires),
    // reveal anyway so content can never get stuck invisible.
    const t = setTimeout(reveal, 1500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
