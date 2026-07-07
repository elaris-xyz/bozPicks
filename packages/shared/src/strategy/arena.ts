import type { OddsSnapshot, Outcome } from '../types';

/**
 * Agent-vs-Agent Arena strategy core. Two autonomous agents read the same
 * TxLINE odds stream and run opposite theses on every price move:
 *   • MOMENTUM  — backs the outcome whose implied probability just rose
 *     (the market is moving; ride it).
 *   • CONTRARIAN — fades that same move, backing the outcome the market just
 *     drifted away from (mean-reversion; the move overshot).
 * Pure + deterministic and lives in @bozpicks/shared so the SAME code drives
 * the real headless agent (apps/agent) and the browser Arena (apps/web) — the
 * UI is a mirror of the autonomous process, not a separate implementation.
 */

export type AgentId = 'MOMENTUM' | 'CONTRARIAN';

export interface Position {
  outcome: Outcome;
  oddsTaken: number;   // decimal odds at entry
  stake: number;       // units
  minute: number;
  impliedTaken: number;
}

export interface SettledBet {
  outcome: Outcome;
  oddsTaken: number;
  stake: number;
  won: boolean;
  pnl: number;
  clvPct: number;      // + = beat the closing line
}

export interface AgentState {
  id: AgentId;
  open: Position[];
  settled: SettledBet[];
  realizedPnl: number;
}

export function initAgent(id: AgentId): AgentState {
  return { id, open: [], settled: [], realizedPnl: 0 };
}

const STAKE = 10;                 // units per signal
const MOVE_THRESHOLD = 0.015;     // 1.5pp implied-prob move to trigger

const OUTCOMES: Outcome[] = ['HOME', 'DRAW', 'AWAY'];
const impliedOf = (o: OddsSnapshot, x: Outcome) =>
  x === 'HOME' ? o.impliedProb.home : x === 'DRAW' ? o.impliedProb.draw : o.impliedProb.away;
const oddsOf = (o: OddsSnapshot, x: Outcome) =>
  x === 'HOME' ? o.homeWin : x === 'DRAW' ? o.draw : o.awayWin;

/**
 * Given the previous and new odds, return the position each agent opens (if any).
 * The biggest implied-prob mover drives both agents in opposite directions.
 */
export function evaluate(prev: OddsSnapshot, next: OddsSnapshot, minute: number): Partial<Record<AgentId, Position>> {
  let best: { outcome: Outcome; delta: number } | null = null;
  for (const o of OUTCOMES) {
    const d = impliedOf(next, o) - impliedOf(prev, o);
    if (!best || Math.abs(d) > Math.abs(best.delta)) best = { outcome: o, delta: d };
  }
  if (!best || Math.abs(best.delta) < MOVE_THRESHOLD) return {};

  const riser = best.delta > 0 ? best.outcome : otherFrom(best.outcome, next); // the outcome gaining prob
  const faded = best.delta > 0 ? bottomOutcome(next) : best.outcome;

  return {
    MOMENTUM: mkPos(riser, next, minute),
    CONTRARIAN: mkPos(faded, next, minute),
  };
}

function mkPos(outcome: Outcome, o: OddsSnapshot, minute: number): Position {
  return { outcome, oddsTaken: oddsOf(o, outcome), impliedTaken: impliedOf(o, outcome), stake: STAKE, minute };
}
// when the mover fell, the "riser" is whichever of the others is now highest
function otherFrom(fell: Outcome, o: OddsSnapshot): Outcome {
  return OUTCOMES.filter(x => x !== fell).sort((a, b) => impliedOf(o, b) - impliedOf(o, a))[0];
}
function bottomOutcome(o: OddsSnapshot): Outcome {
  return [...OUTCOMES].sort((a, b) => impliedOf(o, a) - impliedOf(o, b))[0];
}

export function resultFrom(home: number, away: number): Outcome {
  return home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW';
}

/** Settle all open positions for an agent against the result + closing odds. */
export function settleAgent(agent: AgentState, result: Outcome, closing: OddsSnapshot): AgentState {
  const settled = [...agent.settled];
  let realized = agent.realizedPnl;
  for (const p of agent.open) {
    const won = p.outcome === result;
    const pnl = won ? p.stake * (p.oddsTaken - 1) : -p.stake;
    const closeOdds = oddsOf(closing, p.outcome);
    const clvPct = closeOdds > 0 ? ((p.oddsTaken - closeOdds) / closeOdds) * 100 : 0;
    settled.push({ outcome: p.outcome, oddsTaken: p.oddsTaken, stake: p.stake, won, pnl, clvPct });
    realized += pnl;
  }
  return { ...agent, open: [], settled, realizedPnl: realized };
}

/**
 * Mark-to-market P&L: realized plus the current cash-out value of open
 * positions. A back at oddsTaken is worth stake·(oddsTaken/oddsNow − 1) if you
 * could lay it off at the current price — so the number moves live as the
 * market does, giving each agent a running equity curve.
 */
export function markToMarket(agent: AgentState, odds: OddsSnapshot): number {
  let unrealized = 0;
  for (const p of agent.open) {
    const now = oddsOf(odds, p.outcome);
    if (now > 0) unrealized += p.stake * (p.oddsTaken / now - 1);
  }
  return agent.realizedPnl + unrealized;
}

export function avgClv(agent: AgentState): number {
  if (agent.settled.length === 0) return 0;
  return agent.settled.reduce((s, b) => s + b.clvPct, 0) / agent.settled.length;
}

export function winRate(agent: AgentState): number {
  if (agent.settled.length === 0) return 0;
  return (agent.settled.filter(b => b.won).length / agent.settled.length) * 100;
}
