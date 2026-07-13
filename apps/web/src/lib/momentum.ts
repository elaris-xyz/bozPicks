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
    case 'GOAL':    mag = 6; break;
    case 'PENALTY': mag = 5; break;
    case 'SHOT':    mag = e.shotOutcome === 'Woodwork' ? 3 : e.shotOutcome === 'OnTarget' ? 2.4 : 1.1; break;
    case 'CORNER':  mag = 1.3; break;
    case 'OFFSIDE': mag = 0.6; break;
    case 'RED_CARD': // the carded team is weakened → the OPPONENT gains momentum
      if (isHome == null) return 0;
      return isHome ? -4.5 : 4.5;
    default: return 0;
  }
  if (isHome == null) return 0;
  return isHome ? mag : -mag;
}

const clamp = (v: number) => Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v));

// possession/threat is only a gentle, persistent lean; the spikes carry the drama
const LEAN = 0.22;
// the TARGET pressure decays toward the lean each tick (how long a spike lingers)
const HOLD = 0.86;
// the DISPLAYED value eases toward the target each tick — this is what rounds the
// rise AND the fall, so a goal reads as a smooth swell, not a vertical needle
const EASE = 0.42;

export interface MomentumState { target: number; m: number }

/** Add an event's attacking spike to the momentum TARGET (not the displayed
    value — the sampler eases toward it, keeping the curve smooth). */
export function addImpulse(
  target: number,
  e: BozEvent,
  homeTeam?: string,
): { target: number; goal?: 'home' | 'away' } {
  const isHome = e.team && homeTeam ? e.team === homeTeam : null;
  const goal = e.type === 'GOAL' && isHome != null ? (isHome ? 'home' : 'away') : undefined;
  return { target: clamp(target + eventImpulse(e, isHome)), goal };
}

/**
 * One sampler tick: the target relaxes toward the possession/threat lean, and
 * the displayed value eases toward the target. Called on a fixed timer so the
 * series is evenly spaced and every rise/fall is a rounded curve.
 */
export function tickMomentum(s: MomentumState, stats?: MatchStats): MomentumState {
  const lean = basePressure(stats) * LEAN;
  const target = clamp(s.target * HOLD + lean * (1 - HOLD));
  const m = clamp(s.m + (target - s.m) * EASE);
  return { target, m };
}
