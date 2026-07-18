import type { OddsSnapshot, Outcome } from '../types';

/**
 * In-Play Market Maker — the third TxLINE agent archetype (a standalone,
 * deployable trading tool). It quotes a continuous two-sided market (bid/ask) on
 * every 1X2 outcome, priced off TxLINE's live consensus, and earns the spread as
 * takers hit its quotes while the match moves.
 *
 * The model is a compact Avellaneda–Stoikov: the half-spread widens with
 * realised volatility (protect against fast markets) and quotes skew against
 * inventory (a long book lowers both quotes to attract sells and mean-revert
 * exposure toward flat). Pure + deterministic and shared, so the SAME code runs
 * the headless maker (apps/agent) and the browser card (apps/web) — the UI is a
 * mirror of the live process, not a re-implementation.
 *
 * P&L is honest mark-to-market: cash from fills plus inventory valued at the
 * current fair. It rises with spread captured and falls under adverse selection,
 * exactly the trade-off a real market operator evaluates a maker on.
 */

export interface MMConfig {
  baseHalfSpread: number;   // floor half-spread in probability (e.g. 0.008 = 0.8pp)
  volK: number;             // half-spread added per unit of realised vol
  minHalfSpread: number;
  maxHalfSpread: number;
  skew: number;             // quote shift per unit of inventory (inventory control)
  size: number;             // units filled each time a quote is crossed
  volDecay: number;         // EWMA weight on the previous vol estimate (0–1)
}

export const DEFAULT_MM: MMConfig = {
  baseHalfSpread: 0.008,
  volK: 0.9,
  minHalfSpread: 0.004,
  maxHalfSpread: 0.06,
  skew: 0.005,
  size: 10,
  volDecay: 0.8,
};

const OUTCOMES: Outcome[] = ['HOME', 'DRAW', 'AWAY'];
const clampProb = (p: number) => Math.max(0.01, Math.min(0.99, p));
const fairOf = (o: OddsSnapshot): Record<Outcome, number> => ({
  HOME: o.impliedProb.home, DRAW: o.impliedProb.draw, AWAY: o.impliedProb.away,
});

export interface MMQuote {
  outcome: Outcome;
  fair: number;      // fair implied probability (0–1)
  bid: number;       // maker BUYS (backs) here
  ask: number;       // maker SELLS (lays) here
  inventory: number; // net units held (+long / −short)
}

export interface MMState {
  inventory: Record<Outcome, number>;
  cash: number;               // running cash from fills (probability units × size)
  edgeCaptured: number;       // cumulative theoretical half-spread earned
  fills: number;
  volume: number;             // total units traded
  vol: number;                // EWMA of |Δfair| across outcomes
  halfSpread: number;         // current half-spread (for display)
  lastFair: Record<Outcome, number> | null;
  quotes: MMQuote[] | null;   // live two-sided market
}

export function initMM(): MMState {
  return {
    inventory: { HOME: 0, DRAW: 0, AWAY: 0 },
    cash: 0, edgeCaptured: 0, fills: 0, volume: 0, vol: 0, halfSpread: DEFAULT_MM.baseHalfSpread,
    lastFair: null, quotes: null,
  };
}

/**
 * Advance the maker by one TxLINE odds tick: (1) apply any fills where the new
 * fair crossed the quotes we were showing, (2) re-estimate volatility, (3)
 * re-quote around the new fair with a vol-scaled spread and inventory skew.
 * Pure — returns a fresh state.
 */
export function mmStep(prev: MMState, odds: OddsSnapshot, cfg: MMConfig = DEFAULT_MM): MMState {
  const fair = fairOf(odds);
  const inventory = { ...prev.inventory };
  let { cash, edgeCaptured, fills, volume } = prev;

  // 1) fills against the quotes we were previously showing
  if (prev.quotes) {
    for (const q of prev.quotes) {
      const nf = fair[q.outcome];
      if (nf >= q.ask) {
        // taker lifted our offer → we SOLD `size` at ask (go shorter)
        cash += q.ask * cfg.size;
        inventory[q.outcome] -= cfg.size;
        edgeCaptured += (q.ask - q.fair) * cfg.size;
        fills++; volume += cfg.size;
      } else if (nf <= q.bid) {
        // taker hit our bid → we BOUGHT `size` at bid (go longer)
        cash -= q.bid * cfg.size;
        inventory[q.outcome] += cfg.size;
        edgeCaptured += (q.fair - q.bid) * cfg.size;
        fills++; volume += cfg.size;
      }
    }
  }

  // 2) realised volatility — EWMA of the mean absolute fair move
  let vol = prev.vol;
  if (prev.lastFair) {
    const move = (Math.abs(fair.HOME - prev.lastFair.HOME)
      + Math.abs(fair.DRAW - prev.lastFair.DRAW)
      + Math.abs(fair.AWAY - prev.lastFair.AWAY)) / 3;
    vol = cfg.volDecay * prev.vol + (1 - cfg.volDecay) * move;
  }

  // 3) re-quote: vol-scaled half-spread, quotes skewed against inventory
  const halfSpread = Math.max(cfg.minHalfSpread, Math.min(cfg.maxHalfSpread, cfg.baseHalfSpread + cfg.volK * vol));
  const quotes: MMQuote[] = OUTCOMES.map(o => {
    const skewAdj = cfg.skew * inventory[o]; // long → shift quotes down to sell off
    return {
      outcome: o,
      fair: fair[o],
      bid: clampProb(fair[o] - halfSpread - skewAdj),
      ask: clampProb(fair[o] + halfSpread - skewAdj),
      inventory: inventory[o],
    };
  });

  return { inventory, cash, edgeCaptured, fills, volume, vol, halfSpread, lastFair: fair, quotes };
}

/** Mark-to-market P&L: cash booked from fills + inventory valued at current fair. */
export function mmPnl(s: MMState, odds: OddsSnapshot): number {
  const fair = fairOf(odds);
  let pnl = s.cash;
  for (const o of OUTCOMES) pnl += s.inventory[o] * fair[o];
  return pnl;
}

/** Gross exposure = total absolute inventory across outcomes (a risk read). */
export function mmExposure(s: MMState): number {
  return Math.abs(s.inventory.HOME) + Math.abs(s.inventory.DRAW) + Math.abs(s.inventory.AWAY);
}

/** Average quoted spread across outcomes, in probability points (for display). */
export function mmSpreadPct(s: MMState): number {
  return s.halfSpread * 2 * 100;
}
