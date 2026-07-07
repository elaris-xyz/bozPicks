/**
 * Arena strategy core now lives in @bozpicks/shared so the browser Arena and the
 * real headless agent (apps/agent) run the exact same deterministic code. This
 * re-export keeps the `@/lib/arena` import path stable for the UI components.
 */
export {
  initAgent, evaluate, settleAgent, resultFrom, avgClv, winRate, markToMarket,
  type AgentId, type AgentState, type Position, type SettledBet,
} from '@bozpicks/shared';
