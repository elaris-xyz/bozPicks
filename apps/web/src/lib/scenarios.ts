/**
 * Match scenarios — client-safe (no node deps) so both the replay engine
 * (server) and the Command Bridge (client) can share them. A scenario fully
 * determines the match outcome, so every downstream result (market settlement,
 * agent P&L, Hi-Lo) is controllable and verifiable by a judge.
 */
export interface ReplayScenario {
  key: string;
  label: string;
  homeGoals: number;
  awayGoals: number;
  cornersHome: number;
  cornersAway: number;
  yellowHome: number;
  yellowAway: number;
  redAway: number;
  firstScorer: 'HOME' | 'AWAY';
}

export const SCENARIOS: Record<string, ReplayScenario> = {
  'home-win':     { key: 'home-win',     label: 'Home win 2–1',            homeGoals: 2, awayGoals: 1, cornersHome: 6, cornersAway: 3, yellowHome: 2, yellowAway: 1, redAway: 1, firstScorer: 'AWAY' },
  'away-win':     { key: 'away-win',     label: 'Away win 0–2',            homeGoals: 0, awayGoals: 2, cornersHome: 4, cornersAway: 5, yellowHome: 1, yellowAway: 1, redAway: 0, firstScorer: 'AWAY' },
  'draw':         { key: 'draw',         label: 'Draw 1–1',                homeGoals: 1, awayGoals: 1, cornersHome: 4, cornersAway: 4, yellowHome: 1, yellowAway: 2, redAway: 0, firstScorer: 'HOME' },
  'goal-fest':    { key: 'goal-fest',    label: 'Goal fest 3–3',           homeGoals: 3, awayGoals: 3, cornersHome: 7, cornersAway: 6, yellowHome: 2, yellowAway: 2, redAway: 0, firstScorer: 'HOME' },
  'high-corners': { key: 'high-corners', label: 'Cagey 1–0, corners fly',  homeGoals: 1, awayGoals: 0, cornersHome: 7, cornersAway: 6, yellowHome: 3, yellowAway: 3, redAway: 0, firstScorer: 'HOME' },
  'clean-sheet':  { key: 'clean-sheet',  label: 'Dominant 2–0',            homeGoals: 2, awayGoals: 0, cornersHome: 8, cornersAway: 2, yellowHome: 0, yellowAway: 2, redAway: 0, firstScorer: 'HOME' },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
