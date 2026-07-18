'use client';

import { useEffect, useState } from 'react';

/**
 * "Quiet mode" — a single global switch that silences the noisy live stream:
 *  · toasts stop firing (fireToast becomes a no‑op)
 *  · odds ticks are hidden from the timelines / feeds
 * A real match reprices constantly, so the odds spam buries everything else —
 * quiet mode lets you actually read the match. Persisted in localStorage.
 */
const KEY = 'boz_quiet';
let _quiet = false;
const listeners = new Set<(q: boolean) => void>();

/** Sync the flag from localStorage — call once on the client (the toggle does). */
export function initQuiet(): void {
  if (typeof window === 'undefined') return;
  try { _quiet = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
}

export function isQuiet(): boolean { return _quiet; }

export function setQuiet(v: boolean): void {
  _quiet = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(fn => fn(v));
}

/** Subscribe to quiet‑mode changes (components re‑filter/re‑render on toggle). */
export function onQuietChange(fn: (q: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** React hook: current quiet state, re-rendering the caller when it toggles. */
export function useQuiet(): boolean {
  const [q, setQ] = useState(false);
  useEffect(() => { initQuiet(); setQ(isQuiet()); return onQuietChange(setQ); }, []);
  return q;
}
