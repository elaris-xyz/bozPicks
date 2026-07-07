import type { MatchStats, DangerLevel } from '@bozpicks/shared';

/**
 * The Hi-Lo "reading" — a live, bidirectional 0–100 value the player bets will
 * go higher or lower on the next TxLINE tick.
 *
 * Primary source is TxLINE's `possession` (home's share of the ball, which
 * genuinely swings both ways). But some feeds/ticks omit possession, and every
 * other soccer stat (corners, cards, goals) is monotonic — useless for Hi-Lo.
 * So when possession is absent we derive an equivalent *attacking-pressure*
 * index from fields that ARE always present: the per-side danger state plus the
 * running corner share. This keeps the game honest and playable on any real
 * feed, not just the demo — it is always a real read of live TxLINE momentum.
 */

const DANGER_WEIGHT: Record<DangerLevel, number> = {
  SAFE: 0, ATTACK: 1, DANGER: 2, HIGH_DANGER: 3,
};

export function hiloReading(stats: MatchStats | undefined): number | null {
  if (!stats) return null;
  if (typeof stats.possession === 'number') {
    return clampReading(Math.round(stats.possession));
  }
  // fallback: home attacking-pressure share from danger + corner momentum
  const d = stats.danger;
  const cornersTotal = (stats.cornersHome ?? 0) + (stats.cornersAway ?? 0);
  if (!d && cornersTotal === 0) return null; // nothing to read yet
  const dangerDiff = d ? DANGER_WEIGHT[d.home] - DANGER_WEIGHT[d.away] : 0; // -3..3
  const cornerShare = cornersTotal > 0
    ? ((stats.cornersHome ?? 0) / cornersTotal - 0.5) * 20 // -10..10
    : 0;
  return clampReading(Math.round(50 + dangerDiff * 6 + cornerShare));
}

/** Keep readings inside a sane band so the bar + game stay meaningful. */
export function clampReading(v: number): number {
  return Math.max(25, Math.min(75, v));
}

/** Whether this reading came from a real possession field vs the pressure proxy. */
export function isPossession(stats: MatchStats | undefined): boolean {
  return typeof stats?.possession === 'number';
}
