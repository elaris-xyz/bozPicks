'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated number — counts from 0 (or previous value) to `value` with an
 * ease-out curve. Numbers feel "live" instead of popping in.
 * Non-numeric strings (e.g. "—", "97%") render as-is when unparsable.
 */
export function CountUp({
  value, duration = 900, className, style, suffix = '',
}: {
  value: number | string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  suffix?: string;
}) {
  const target = typeof value === 'number' ? value : parseFloat(value);
  const isNumeric = Number.isFinite(target);
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isNumeric) return;
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, isNumeric]);

  if (!isNumeric) return <span className={className} style={style}>{value}</span>;

  const rounded = Number.isInteger(target)
    ? Math.round(display).toLocaleString('en-US')
    : display.toFixed(1);
  return <span className={className} style={style}>{rounded}{suffix}</span>;
}
