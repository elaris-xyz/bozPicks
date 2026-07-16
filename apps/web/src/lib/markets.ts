import type { PropMarket, MarketKind, StatKey, SettlementReceipt } from '@bozpicks/shared';
import { statKey } from '@bozpicks/txline-client';

/**
 * Parametric prop markets derived from TxLINE stats. Every market resolves
 * deterministically from the final SoccerScore, so a keeper can settle it
 * trustlessly against a TxLINE Merkle proof (validate_stat). USDC parimutuel:
 * winners split the whole pool (minus fee) pro-rata to their stake.
 */

export interface FinalStats {
  homeScore: number; awayScore: number;
  totalGoals: number; totalCorners: number; totalCards: number;
  btts: boolean; firstScorer: 'HOME' | 'AWAY' | 'NONE';
}

interface Template {
  kind: MarketKind;
  statKey: StatKey;
  line?: number;
  outcomes: string[];
  label: (home: string, away: string, line?: number) => string;
}

const TEMPLATES: Template[] = [
  { kind: 'MATCH_WINNER',  statKey: 'RESULT',        outcomes: ['HOME', 'DRAW', 'AWAY'],
    label: (h, a) => `Match Result — ${h} / Draw / ${a}` },
  { kind: 'TOTAL_GOALS',   statKey: 'GOALS_TOTAL',   line: 2.5, outcomes: ['OVER', 'UNDER'],
    label: (_h, _a, l) => `Total Goals Over/Under ${l}` },
  { kind: 'TOTAL_CORNERS', statKey: 'CORNERS_TOTAL', line: 9.5, outcomes: ['OVER', 'UNDER'],
    label: (_h, _a, l) => `Total Corners Over/Under ${l}` },
  { kind: 'TOTAL_CARDS',   statKey: 'CARDS_TOTAL',   line: 4.5, outcomes: ['OVER', 'UNDER'],
    label: (_h, _a, l) => `Total Cards Over/Under ${l}` },
  { kind: 'BTTS',          statKey: 'GOALS_HOME',    outcomes: ['YES', 'NO'],
    label: () => `Both Teams To Score` },
  { kind: 'FIRST_SCORER',  statKey: 'FIRST_SCORER',  outcomes: ['HOME', 'AWAY', 'NONE'],
    label: (h, a) => `First Goal — ${h} / ${a} / None` },
];

/**
 * The REAL TxLINE `Stats` keys that decide each market — validated on-chain via
 * validateStatV2 against the `game_finalised` record. Per TxLINE guidance the
 * finalisation record carries statusId=100 and the ScoreStat leaf's `period`
 * field = 100 (the "final" marker, NOT period-prefix 0/Total) — so a proven
 * total-goals leaf is { key:1, value, period:100 }. The base KEYS below are the
 * team-confirmed legend (goals 1/2, yellow 3/4, red 5/6, corners 7/8), NOT the
 * earlier placeholder codes (1002 etc., which were actually H1 keys). We don't
 * hardcode the leaf period — the keeper passes TxLINE's own proof into the CPI.
 */
const G = [statKey('GOALS', 1), statKey('GOALS', 2)];         // [1, 2]
export const TXLINE_STAT_KEYS: Record<MarketKind, number[]> = {
  MATCH_WINNER:  G,                                            // winner from final goals
  TOTAL_GOALS:   G,
  BTTS:          G,                                            // both participants' goals
  FIRST_SCORER:  G,                                            // anchored by goals (order from goal events)
  TOTAL_CORNERS: [statKey('CORNERS', 1), statKey('CORNERS', 2)],                     // [7, 8]
  TOTAL_CARDS:   [statKey('YELLOW', 1), statKey('YELLOW', 2), statKey('RED', 1), statKey('RED', 2)], // [3,4,5,6]
};

export function buildMarketsForMatch(matchId: string, home: string, away: string, escrowPda: string): PropMarket[] {
  return TEMPLATES.map(t => ({
    id: `mkt-${matchId}-${t.kind}`.toLowerCase(),
    matchId,
    kind: t.kind,
    label: t.label(home, away, t.line),
    statKey: t.statKey,
    line: t.line,
    outcomes: [...t.outcomes],
    pools: Object.fromEntries(t.outcomes.map(o => [o, 0])),
    totalPool: 0,
    feeBps: 200,
    status: 'OPEN' as const,
    escrowPda,
  }));
}

/** Deterministic winning outcome + the numeric stat value that decides it. */
export function resolveMarket(m: PropMarket, f: FinalStats): { winningOutcome: string; statValue: number } {
  switch (m.kind) {
    case 'MATCH_WINNER': {
      const w = f.homeScore > f.awayScore ? 'HOME' : f.homeScore < f.awayScore ? 'AWAY' : 'DRAW';
      return { winningOutcome: w, statValue: f.homeScore * 100 + f.awayScore };
    }
    case 'TOTAL_GOALS':
      return { winningOutcome: f.totalGoals > (m.line ?? 2.5) ? 'OVER' : 'UNDER', statValue: f.totalGoals };
    case 'TOTAL_CORNERS':
      return { winningOutcome: f.totalCorners > (m.line ?? 9.5) ? 'OVER' : 'UNDER', statValue: f.totalCorners };
    case 'TOTAL_CARDS':
      return { winningOutcome: f.totalCards > (m.line ?? 4.5) ? 'OVER' : 'UNDER', statValue: f.totalCards };
    case 'BTTS':
      return { winningOutcome: f.btts ? 'YES' : 'NO', statValue: f.btts ? 1 : 0 };
    case 'FIRST_SCORER':
      return { winningOutcome: f.firstScorer, statValue: f.firstScorer === 'HOME' ? 1 : f.firstScorer === 'AWAY' ? 2 : 0 };
  }
}

/** Implied probability for an outcome from its pool share (parimutuel). */
export function impliedFromPool(m: PropMarket, outcome: string): number {
  if (m.totalPool === 0) return 1 / m.outcomes.length;
  return (m.pools[outcome] ?? 0) / m.totalPool;
}

/** Decimal odds an outcome currently pays (whole pool / outcome pool, after fee). */
export function poolOdds(m: PropMarket, outcome: string): number {
  const oPool = m.pools[outcome] ?? 0;
  if (oPool === 0) return m.outcomes.length; // no stake yet → nominal
  const afterFee = m.totalPool * (1 - m.feeBps / 10_000);
  return afterFee / oPool;
}

/** Payout (USDC micro) for a stake on the winning outcome. */
export function payoutFor(stakeMicro: number, winningPoolMicro: number, totalPoolMicro: number, feeBps: number): number {
  if (winningPoolMicro === 0) return stakeMicro; // refund if nobody else backed it
  const afterFee = totalPoolMicro * (1 - feeBps / 10_000);
  return Math.floor((stakeMicro / winningPoolMicro) * afterFee);
}

/** Map a boz_markets row to a PropMarket. */
export function rowToMarket(r: Record<string, unknown>): PropMarket {
  return {
    id: r.id as string,
    matchId: r.match_id as string,
    kind: r.kind as MarketKind,
    label: r.label as string,
    statKey: r.stat_key as StatKey,
    line: r.line != null ? Number(r.line) : undefined,
    outcomes: r.outcomes as string[],
    pools: (r.pools as Record<string, number>) ?? {},
    totalPool: Number(r.total_pool ?? 0),
    feeBps: Number(r.fee_bps ?? 200),
    status: r.status as PropMarket['status'],
    escrowPda: (r.escrow_pda as string) ?? '',
    winningOutcome: (r.winning_outcome as string) ?? undefined,
    settledAt: r.settled_at ? new Date(r.settled_at as string).toISOString() : undefined,
    settlementTx: (r.settlement_tx as string) ?? undefined,
    receipt: (r.receipt as SettlementReceipt) ?? undefined,
  };
}
