'use client';

import { useState, useCallback, useEffect } from 'react';

export type OddsFormat = 'decimal' | 'fractional' | 'american';

export function useOddsFormat() {
  const [format, setFormat] = useState<OddsFormat>('decimal');

  useEffect(() => {
    const saved = localStorage.getItem('odds_format') as OddsFormat | null;
    if (saved) setFormat(saved);
  }, []);

  const setFmt = useCallback((f: OddsFormat) => {
    setFormat(f);
    localStorage.setItem('odds_format', f);
  }, []);

  return { format, setFormat: setFmt };
}

export function formatOdds(decimal: number, format: OddsFormat): string {
  if (format === 'decimal') return decimal.toFixed(2);

  if (format === 'fractional') {
    const frac = decimal - 1;
    // Find best fraction
    const denom = [1, 2, 4, 5, 8, 10, 20].find(d => Math.abs(Math.round(frac * d) - frac * d) < 0.02) ?? 10;
    const num = Math.round(frac * denom);
    return `${num}/${denom}`;
  }

  // American
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}
