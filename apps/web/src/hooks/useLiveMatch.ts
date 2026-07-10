'use client';

import { useLiveMatchContext, type LiveMatch } from '@/contexts/LiveMatchContext';

export type { LiveMatch };

/**
 * The app-wide live-match state. Backed by LiveMatchProvider (one fetch, one
 * poll, one SSE subscription for the whole app) so every component flips
 * live/idle in the same render tick — the import path is kept for the dozen
 * existing consumers.
 */
export function useLiveMatch(): LiveMatch | null {
  return useLiveMatchContext();
}
