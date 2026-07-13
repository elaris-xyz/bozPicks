import type { BozEvent, MatchStats, DangerLevel } from '@bozpicks/shared';

/**
 * Match-momentum model. Broadcasters show a two-sided "who's on top right now"
 * curve built from an ML pressure model; we don't have ML, but we DO have the
 * same raw inputs from TxLINE — ball possession, the per-side threat/danger
 * state, and attacking events (shots, corners, goals). So we derive an honest
 * pressure index: a signed value where >0 = home pressing, <0 = away pressing.
 * Not a probability — a live read of the run of play.
 */

const DANGER_W: Record<DangerLevel, number> = { SAFE: 0, ATTACK: 1, DANGER: 2.2, HIGH_DANGER: 3.4 };

export interface MomentumPoint { min: number; v: number; goal?: 'home' | 'away' }

export const MOM_CLAMP = 10;

/** Steady-state pressure from possession + threat state (no event spike). */
export function basePressure(stats?: MatchStats): number {
  if (!stats) return 0;
  let v = 0;
  if (typeof stats.possession === 'number') v += (stats.possession - 50) / 12; // ±~4
  if (stats.danger) v += DANGER_W[stats.danger.home] - DANGER_W[stats.danger.away]; // ±~3.4
  return v;
}

/**
 * The instant spike an event adds, signed toward home (+) / away (−). `isHome`
 * says whether the event's team is the home side (null = unknown → no spike for
 * team-specific events).
 */
export function eventImpulse(e: BozEvent, isHome: boolean | null): number {
  let mag = 0;
  switch (e.type) {
    case 'GOAL':    mag = 7; break;
    case 'PENALTY': mag = 5.5; break;
    case 'SHOT':    mag = e.shotOutcome === 'Woodwork' ? 4 : e.shotOutcome === 'OnTarget' ? 3 : 1.4; break;
    case 'CORNER':  mag = 1.8; break;
    case 'OFFSIDE': mag = 0.8; break;
    case 'RED_CARD': // the carded team is weakened → the OPPONENT gains momentum
      if (isHome == null) return 0;
      return isHome ? -5 : 5;
    default: return 0;
  }
  if (isHome == null) return 0;
  return isHome ? mag : -mag;
}

const clamp = (v: number) => Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v));

// possession/threat is only a gentle, persistent lean; the spikes carry the drama
const LEAN = 0.22;
// how much lingering momentum survives to the next sample — the rest decays back
// toward the lean, so the curve crosses the baseline between attacks (not a
// permanently one-sided fill)
const DECAY = 0.5;

/**
 * Advance the running momentum with one event: decay the lingering pressure,
 * apply a small possession/threat lean, then add this event's attacking spike.
 * `prev` is the current momentum value; returns the new value + the point.
 */
export function stepMomentum(
  prev: number,
  e: BozEvent,
  homeTeam?: string,
): { m: number; point: MomentumPoint } {
  const isHome = e.team && homeTeam ? e.team === homeTeam : null;
  const lean = e.stats ? basePressure(e.stats) * LEAN : 0; // no fresh stats → prev's lean carries via decay
  const m = clamp(prev * DECAY + lean + eventImpulse(e, isHome));
  const goal = e.type === 'GOAL' && isHome != null ? (isHome ? 'home' : 'away') : undefined;
  return { m, point: { min: e.matchMinute || 0, v: m, goal } };
}

/** Relax momentum toward the possession/threat lean between events (decay). */
export function relaxMomentum(prev: number, stats?: MatchStats): number {
  return clamp(prev * (DECAY + 0.1) + basePressure(stats) * LEAN);
}
