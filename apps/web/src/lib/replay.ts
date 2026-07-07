import { randomUUID } from 'crypto';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStats, DangerLevel, GoalKind } from '@bozpicks/shared';
import { SCENARIOS, type ReplayScenario } from './scenarios';

export { SCENARIOS, type ReplayScenario };

/**
 * Replay engine. Produces a realistic, fully-formed rich event stream for a
 * match (goals, cards, corners, subs, possession/danger, reacting odds, and a
 * MatchStats snapshot on every step) that the player publishes to Redis over
 * real time — so the whole app (feed, cards, agent, markets) reacts live during
 * a demo. Mirrors what TxLINE's scores/odds streams would deliver, so the same
 * code path works on real historical data via /api/scores/historical.
 */

export interface ReplayStep {
  /** wall-clock offset from replay start, in ms (compressed match time) */
  delayMs: number;
  event: BozEvent;
}

export interface ReplayResult {
  steps: ReplayStep[];
  /** final resolved stats — used to settle prop markets deterministically */
  final: {
    homeScore: number; awayScore: number;
    totalGoals: number; totalCorners: number; totalCards: number;
    btts: boolean; firstScorer: 'HOME' | 'AWAY' | 'NONE';
  };
}

function makeOdds(home: number, draw: number, away: number, inRunning = true): OddsSnapshot {
  const iH = 1 / home, iD = 1 / draw, iA = 1 / away;
  const t = iH + iD + iA;
  return {
    timestamp: new Date().toISOString(),
    homeWin: home, draw, awayWin: away,
    impliedProb: { home: iH / t, draw: iD / t, away: iA / t },
    bookmaker: 'Consensus', inRunning,
  };
}

type Act =
  | { minute: number; kind: 'MATCH_START' }
  | { minute: number; kind: 'HALFTIME' }
  | { minute: number; kind: 'MATCH_END' }
  | { minute: number; kind: 'GOAL'; side: 'home' | 'away'; player: string; goalKind?: GoalKind }
  | { minute: number; kind: 'YELLOW_CARD' | 'RED_CARD'; side: 'home' | 'away'; player: string }
  | { minute: number; kind: 'CORNER'; side: 'home' | 'away' }
  | { minute: number; kind: 'SUBSTITUTION'; side: 'home' | 'away'; playerIn: string; playerOut: string }
  | { minute: number; kind: 'ODDS'; odds: OddsSnapshot };

/** Consensus 1X2 odds implied by the current goal difference. */
function oddsForDiff(diff: number): OddsSnapshot {
  if (diff >= 2)  return makeOdds(1.30, 4.80, 8.00);
  if (diff === 1) return makeOdds(1.85, 3.40, 4.20);
  if (diff === 0) return makeOdds(2.50, 3.10, 2.70);
  if (diff === -1) return makeOdds(4.20, 3.40, 1.85);
  return makeOdds(8.00, 4.80, 1.30);
}

/** Spread `n` evenly across [lo, hi]. */
function spread(n: number, lo: number, hi: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [Math.round((lo + hi) / 2)];
  return Array.from({ length: n }, (_, i) => Math.round(lo + (i * (hi - lo)) / (n - 1)));
}

/** Build a chronologically-ordered act list that resolves to the scenario. */
function buildScript(s: ReplayScenario, home: string, away: string): Act[] {
  const acts: Act[] = [{ minute: 0, kind: 'MATCH_START' }];

  // goal order: first scorer opens, then the rest fill by remaining count
  const sides: ('home' | 'away')[] = [];
  let h = s.homeGoals, a = s.awayGoals;
  if (s.firstScorer === 'HOME' && h > 0) { sides.push('home'); h--; }
  else if (s.firstScorer === 'AWAY' && a > 0) { sides.push('away'); a--; }
  while (h > 0 || a > 0) {
    if (h >= a && h > 0) { sides.push('home'); h--; }
    else if (a > 0) { sides.push('away'); a--; }
    else { sides.push('home'); h--; }
  }
  const goalMins = spread(sides.length, 14, 85);
  let hRun = 0, aRun = 0, kicker = 7;
  sides.forEach((side, i) => {
    if (side === 'home') hRun++; else aRun++;
    acts.push({ minute: goalMins[i], kind: 'GOAL', side, player: `${side === 'home' ? home : away} · #${kicker++}`, goalKind: i % 2 ? 'HEAD' : 'SHOT' });
    acts.push({ minute: goalMins[i] + 0.4, kind: 'ODDS', odds: oddsForDiff(hRun - aRun) });
  });

  // corners
  spread(s.cornersHome, 6, 88).forEach(m => acts.push({ minute: m + 0.1, kind: 'CORNER', side: 'home' }));
  spread(s.cornersAway, 9, 86).forEach(m => acts.push({ minute: m + 0.2, kind: 'CORNER', side: 'away' }));

  // cards
  spread(s.yellowHome, 15, 80).forEach((m, i) => acts.push({ minute: m, kind: 'YELLOW_CARD', side: 'home', player: `${home} · #${4 + i}` }));
  spread(s.yellowAway, 18, 82).forEach((m, i) => acts.push({ minute: m, kind: 'YELLOW_CARD', side: 'away', player: `${away} · #${4 + i}` }));
  if (s.redAway > 0) {
    acts.push({ minute: 67, kind: 'RED_CARD', side: 'away', player: `${away} · #11` });
    acts.push({ minute: 67.5, kind: 'ODDS', odds: oddsForDiff((s.homeGoals - s.awayGoals) + 1) });
  }

  // a substitution + kickoff odds
  acts.push({ minute: 2, kind: 'ODDS', odds: oddsForDiff(0) });
  acts.push({ minute: 58, kind: 'SUBSTITUTION', side: 'home', playerIn: `${home} · #19`, playerOut: `${home} · #9` });
  acts.push({ minute: 45, kind: 'HALFTIME' });
  acts.push({ minute: 90, kind: 'MATCH_END' });

  return acts.sort((x, y) => x.minute - y.minute);
}

const DANGER_CYCLE: DangerLevel[] = ['SAFE', 'ATTACK', 'DANGER', 'ATTACK', 'HIGH_DANGER', 'SAFE'];

export function generateMatchReplay(
  matchId: string, homeTeam: string, awayTeam: string,
  { durationMs = 42_000, scenario = SCENARIOS['home-win'] }: { durationMs?: number; scenario?: ReplayScenario } = {},
): ReplayResult {
  const acts = buildScript(scenario, homeTeam, awayTeam);

  // accumulators
  let hScore = 0, aScore = 0, hCorners = 0, aCorners = 0, hY = 0, aY = 0, hR = 0, aR = 0;
  let possession = 50, firstScorer: 'HOME' | 'AWAY' | 'NONE' = 'NONE';
  const steps: ReplayStep[] = [];

  acts.forEach((a, i) => {
    const minute = Math.floor(a.minute);
    // possession drifts; the leading side sees a bit more of the ball
    possession = Math.max(35, Math.min(65, possession + (Math.sin(i) * 4) + (hScore - aScore) * 2));
    const danger = { home: DANGER_CYCLE[i % DANGER_CYCLE.length], away: DANGER_CYCLE[(i + 3) % DANGER_CYCLE.length] };

    let type: BozEventType | null = null;
    const ev: Partial<BozEvent> = {};

    switch (a.kind) {
      case 'MATCH_START': type = 'MATCH_START'; break;
      case 'HALFTIME':    type = 'HALFTIME'; break;
      case 'MATCH_END':   type = 'MATCH_END'; break;
      case 'ODDS':        type = 'ODDS_UPDATE'; ev.odds = a.odds; break;
      case 'CORNER':
        type = 'CORNER';
        if (a.side === 'home') hCorners++; else aCorners++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        break;
      case 'YELLOW_CARD':
        type = 'YELLOW_CARD';
        if (a.side === 'home') hY++; else aY++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam; ev.player = a.player;
        break;
      case 'RED_CARD':
        type = 'RED_CARD';
        if (a.side === 'home') hR++; else aR++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam; ev.player = a.player;
        break;
      case 'SUBSTITUTION':
        type = 'SUBSTITUTION';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.playerIn = a.playerIn; ev.playerOut = a.playerOut;
        ev.player = `${a.playerIn} ← ${a.playerOut}`;
        break;
      case 'GOAL':
        type = 'GOAL';
        if (a.side === 'home') hScore++; else aScore++;
        if (firstScorer === 'NONE') firstScorer = a.side === 'home' ? 'HOME' : 'AWAY';
        ev.team = a.side === 'home' ? homeTeam : awayTeam; ev.player = a.player;
        ev.goalKind = a.goalKind; ev.isPenalty = a.goalKind === 'PENALTY' || undefined;
        break;
    }
    if (!type) return;

    const stats: MatchStats = {
      cornersHome: hCorners, cornersAway: aCorners,
      yellowHome: hY, yellowAway: aY, redHome: hR, redAway: aR,
      possession: Math.round(possession),
      danger,
      clockSeconds: minute * 60,
    };

    const event: BozEvent = {
      id: randomUUID(),
      matchId,
      type,
      timestamp: new Date().toISOString(), // player overrides at publish time
      matchMinute: minute,
      score: { home: hScore, away: aScore },
      seq: i + 1,
      stats,
      rawPayload: { replay: true, act: a.kind },
      ...ev,
    };

    steps.push({ delayMs: Math.round((minute / 90) * durationMs), event });
  });

  return {
    steps,
    final: {
      homeScore: hScore, awayScore: aScore,
      totalGoals: hScore + aScore,
      totalCorners: hCorners + aCorners,
      totalCards: hY + aY + hR + aR,
      btts: hScore > 0 && aScore > 0,
      firstScorer,
    },
  };
}
