/**
 * TxLINE SoccerScore `Stats` key legend.
 *
 * Confirmed by the TxLINE team (World Cup hackathon channel, Jul 2026). The
 * on-chain `Stats` map is score/discipline counters — NOT advanced stats.
 * A key is `periodPrefix + baseKey`, e.g. `7008` = participant-2 corners in
 * ETTotal. Possession / shots / offsides are NOT in this map — they arrive as
 * score *events* (Possession/PossessionType, `shot`, `free_kick`).
 *
 * Base keys (participant 1 / participant 2):
 *   1 / 2  → goals
 *   3 / 4  → yellow cards
 *   5 / 6  → red cards
 *   7 / 8  → corners
 *
 * Period prefixes:
 *   0     Total          4000  ET1
 *   1000  H1             5000  ET2
 *   2000  HT             6000  PE (penalties)
 *   3000  H2             7000  ETTotal
 */

export type StatBase = 'GOALS' | 'YELLOW' | 'RED' | 'CORNERS';
export type StatPeriod = 'TOTAL' | 'H1' | 'HT' | 'H2' | 'ET1' | 'ET2' | 'PE' | 'ETTOTAL';

/** participant-1 base key for each stat (participant 2 = base + 1). */
export const STAT_BASE: Record<StatBase, number> = {
  GOALS: 1, YELLOW: 3, RED: 5, CORNERS: 7,
};

export const STAT_PERIOD_PREFIX: Record<StatPeriod, number> = {
  TOTAL: 0, H1: 1000, HT: 2000, H2: 3000, ET1: 4000, ET2: 5000, PE: 6000, ETTOTAL: 7000,
};

/** Compose a full TxLINE Stats key from a base stat, period, and participant. */
export function statKey(base: StatBase, participant: 1 | 2, period: StatPeriod = 'TOTAL'): number {
  return STAT_PERIOD_PREFIX[period] + STAT_BASE[base] + (participant - 1);
}

/** Decompose a raw TxLINE Stats key into its period + base + participant. */
export function decodeStatKey(key: number): { period: StatPeriod; base: StatBase; participant: 1 | 2 } | null {
  const prefix = Math.floor(key / 1000) * 1000;
  const period = (Object.entries(STAT_PERIOD_PREFIX).find(([, v]) => v === prefix)?.[0] ?? null) as StatPeriod | null;
  if (period == null) return null;
  const rem = key - prefix;            // 1..8
  const participant = (rem % 2 === 1 ? 1 : 2) as 1 | 2;
  const baseVal = rem - (participant - 1);
  const base = (Object.entries(STAT_BASE).find(([, v]) => v === baseVal)?.[0] ?? null) as StatBase | null;
  if (base == null) return null;
  return { period, base, participant };
}

/**
 * The stat keys that decide the FINAL result of a match. Per TxLINE guidance,
 * settle the winner off the `game_finalised` record proving total goals for
 * both participants (keys 1 & 2), which already accounts for ET / penalties.
 */
export const FINAL_GOAL_STAT_KEYS: [number, number] = [statKey('GOALS', 1), statKey('GOALS', 2)]; // [1, 2]

/**
 * The score record `Action` that carries the decisive final result. Do NOT
 * settle off an arbitrary 90-minute / in-play record — select this one.
 */
export const FINAL_ACTION = 'game_finalised';
