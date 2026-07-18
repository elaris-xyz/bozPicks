import { randomUUID } from 'crypto';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStats, DangerLevel, GoalKind, ShotOutcome, VarType, VarOutcome } from '@bozpicks/shared';
import { SCENARIOS, type ReplayScenario } from './scenarios';
import { playerFor } from './squads';

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
    corners1H: number; cards1H: number;
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
  | { minute: number; kind: 'SHOT'; side: 'home' | 'away'; player: string; shotOutcome: ShotOutcome }
  | { minute: number; kind: 'OFFSIDE'; side: 'home' | 'away' }
  | { minute: number; kind: 'FOUL'; side: 'home' | 'away' }
  | { minute: number; kind: 'VAR'; side: 'home' | 'away'; varType: VarType; varOutcome: VarOutcome }
  | { minute: number; kind: 'ODDS'; odds: OddsSnapshot };

/** Consensus 1X2 odds implied by the current goal difference. */
function oddsForDiff(diff: number): OddsSnapshot {
  if (diff >= 2)  return makeOdds(1.30, 4.80, 8.00);
  if (diff === 1) return makeOdds(1.85, 3.40, 4.20);
  if (diff === 0) return makeOdds(2.50, 3.10, 2.70);
  if (diff === -1) return makeOdds(4.20, 3.40, 1.85);
  return makeOdds(8.00, 4.80, 1.30);
}

/** A small deterministic (non-random, so replays stay reproducible) per-minute
 *  wobble on top of the bucketed odds — enough for the live win-prob gauge and
 *  the agent Arena's equity curves to visibly move between the big scripted
 *  swings (goals, the red card), not enough to itself read as a sharp move
 *  (the detector's default threshold is 10%). */
function driftOdds(diff: number, minute: number): OddsSnapshot {
  const base = oddsForDiff(diff);
  const wobble = 1 + (((minute * 53) % 9) - 4) / 100; // ±4%
  return makeOdds(
    Math.max(1.05, Math.round(base.homeWin * wobble * 100) / 100),
    base.draw,
    Math.max(1.05, Math.round(base.awayWin / wobble * 100) / 100),
  );
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
  let hRun = 0, aRun = 0;
  sides.forEach((side, i) => {
    if (side === 'home') hRun++; else aRun++;
    const team = side === 'home' ? home : away;
    acts.push({ minute: goalMins[i], kind: 'GOAL', side, player: playerFor(team, 'scorer', goalMins[i] + i), goalKind: i % 2 ? 'HEAD' : 'SHOT' });
    acts.push({ minute: goalMins[i] + 0.4, kind: 'ODDS', odds: oddsForDiff(hRun - aRun) });
  });

  // corners
  spread(s.cornersHome, 6, 88).forEach(m => acts.push({ minute: m + 0.1, kind: 'CORNER', side: 'home' }));
  spread(s.cornersAway, 9, 86).forEach(m => acts.push({ minute: m + 0.2, kind: 'CORNER', side: 'away' }));

  // cards
  spread(s.yellowHome, 15, 80).forEach((m, i) => acts.push({ minute: m, kind: 'YELLOW_CARD', side: 'home', player: playerFor(home, 'card', m + i * 7) }));
  spread(s.yellowAway, 18, 82).forEach((m, i) => acts.push({ minute: m, kind: 'YELLOW_CARD', side: 'away', player: playerFor(away, 'card', m + i * 5) }));
  if (s.redAway > 0) {
    acts.push({ minute: 67, kind: 'RED_CARD', side: 'away', player: playerFor(away, 'card', 91) });
    acts.push({ minute: 67.5, kind: 'ODDS', odds: oddsForDiff((s.homeGoals - s.awayGoals) + 1) });
  }

  // broadcast texture: shots (on/off target), an offside, a foul, and a VAR
  // review — real TxLINE event types (shot / free_kick / var) that don't change
  // the score but make the feed + pundit feel like a live broadcast.
  const leader: 'home' | 'away' = s.homeGoals >= s.awayGoals ? 'home' : 'away';
  const trailer: 'home' | 'away' = leader === 'home' ? 'away' : 'home';
  const leaderTeam = leader === 'home' ? home : away;
  const trailerTeam = trailer === 'home' ? home : away;
  acts.push({ minute: 12, kind: 'SHOT', side: leader,  player: playerFor(leaderTeam, 'scorer', 12), shotOutcome: 'OnTarget' });
  acts.push({ minute: 28, kind: 'FOUL', side: trailer });
  acts.push({ minute: 33, kind: 'OFFSIDE', side: leader });
  acts.push({ minute: 52, kind: 'SHOT', side: trailer, player: playerFor(trailerTeam, 'scorer', 52), shotOutcome: 'OffTarget' });
  // a VAR check on the first goal — stands, so the score is unaffected
  if (s.homeGoals + s.awayGoals > 0) {
    acts.push({ minute: 63, kind: 'VAR', side: leader, varType: 'Goal', varOutcome: 'Stands' });
  }
  acts.push({ minute: 74, kind: 'SHOT', side: leader,  player: playerFor(leaderTeam, 'scorer', 74), shotOutcome: 'Blocked' });

  // a substitution + kickoff odds
  acts.push({ minute: 2, kind: 'ODDS', odds: oddsForDiff(0) });
  acts.push({ minute: 58, kind: 'SUBSTITUTION', side: 'home', playerIn: playerFor(home, 'subIn', 58), playerOut: playerFor(home, 'subOut', 33) });
  acts.push({ minute: 45, kind: 'HALFTIME' });
  acts.push({ minute: 90, kind: 'MATCH_END' });

  // periodic small odds ticks between the scripted moves — otherwise the
  // market (and anything reacting to it: win-prob gauge, agent Arena) sits
  // completely dead for whatever stretch has no goal/card, which is most of
  // a short demo clip. Diff-at-minute reads the same goal schedule above.
  const driftMinutes = [6, 11, 16, 21, 27, 33, 39, 51, 56, 61, 70, 76, 82, 87];
  for (const m of driftMinutes) {
    let diffAt = 0;
    sides.forEach((side, i) => { if (goalMins[i] <= m) diffAt += side === 'home' ? 1 : -1; });
    acts.push({ minute: m, kind: 'ODDS', odds: driftOdds(diffAt, m) });
  }

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
  let cornersH1 = 0, cardsH1 = 0; // 1st-half (≤45') counters for the H1 markets
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
        if (minute <= 45) cornersH1++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        break;
      case 'YELLOW_CARD':
        type = 'YELLOW_CARD';
        if (a.side === 'home') hY++; else aY++;
        if (minute <= 45) cardsH1++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam; ev.player = a.player;
        break;
      case 'RED_CARD':
        type = 'RED_CARD';
        if (a.side === 'home') hR++; else aR++;
        if (minute <= 45) cardsH1++;
        ev.team = a.side === 'home' ? homeTeam : awayTeam; ev.player = a.player;
        break;
      case 'SUBSTITUTION':
        type = 'SUBSTITUTION';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.playerIn = a.playerIn; ev.playerOut = a.playerOut;
        ev.player = `${a.playerIn} ← ${a.playerOut}`;
        break;
      case 'SHOT':
        type = 'SHOT';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.player = a.player; ev.shotOutcome = a.shotOutcome;
        break;
      case 'OFFSIDE':
        type = 'OFFSIDE';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.freeKickType = 'Offside';
        break;
      case 'FOUL':
        type = 'FOUL';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.freeKickType = 'Danger';
        break;
      case 'VAR':
        type = 'VAR';
        ev.team = a.side === 'home' ? homeTeam : awayTeam;
        ev.isVAR = true; ev.varType = a.varType; ev.varOutcome = a.varOutcome;
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
      corners1H: cornersH1, cards1H: cardsH1,
      btts: hScore > 0 && aScore > 0,
      firstScorer,
    },
  };
}
