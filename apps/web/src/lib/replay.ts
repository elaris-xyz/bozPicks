import { randomUUID } from 'crypto';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStats, DangerLevel, GoalKind } from '@bozpicks/shared';

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

/** A believable World-Cup-knockout script: end-to-end, 3 goals, BTTS, red card. */
function script(home: string, away: string): Act[] {
  return [
    { minute: 0,  kind: 'MATCH_START' },
    { minute: 2,  kind: 'ODDS', odds: makeOdds(2.10, 3.20, 3.50) },
    { minute: 6,  kind: 'CORNER', side: 'home' },
    { minute: 12, kind: 'CORNER', side: 'away' },
    { minute: 15, kind: 'YELLOW_CARD', side: 'home', player: `${home} · #6` },
    { minute: 19, kind: 'CORNER', side: 'home' },
    { minute: 23, kind: 'GOAL', side: 'away', player: `${away} · #10`, goalKind: 'SHOT' },
    { minute: 24, kind: 'ODDS', odds: makeOdds(3.20, 2.80, 2.10) },
    { minute: 31, kind: 'CORNER', side: 'away' },
    { minute: 34, kind: 'YELLOW_CARD', side: 'away', player: `${away} · #4` },
    { minute: 39, kind: 'GOAL', side: 'home', player: `${home} · #7`, goalKind: 'HEAD' },
    { minute: 40, kind: 'ODDS', odds: makeOdds(2.50, 3.00, 2.70) },
    { minute: 43, kind: 'CORNER', side: 'home' },
    { minute: 45, kind: 'HALFTIME' },
    { minute: 46, kind: 'ODDS', odds: makeOdds(2.60, 3.10, 2.60) },
    { minute: 52, kind: 'CORNER', side: 'home' },
    { minute: 58, kind: 'SUBSTITUTION', side: 'home', playerIn: `${home} · #19`, playerOut: `${home} · #9` },
    { minute: 61, kind: 'CORNER', side: 'away' },
    { minute: 67, kind: 'RED_CARD', side: 'away', player: `${away} · #11` },
    { minute: 68, kind: 'ODDS', odds: makeOdds(1.80, 3.50, 4.20) },
    { minute: 72, kind: 'CORNER', side: 'home' },
    { minute: 74, kind: 'YELLOW_CARD', side: 'home', player: `${home} · #8` },
    { minute: 78, kind: 'GOAL', side: 'home', player: `${home} · #19`, goalKind: 'SHOT' },
    { minute: 79, kind: 'ODDS', odds: makeOdds(1.35, 4.50, 7.00) },
    { minute: 84, kind: 'CORNER', side: 'home' },
    { minute: 90, kind: 'MATCH_END' },
  ];
}

const DANGER_CYCLE: DangerLevel[] = ['SAFE', 'ATTACK', 'DANGER', 'ATTACK', 'HIGH_DANGER', 'SAFE'];

export function generateMatchReplay(
  matchId: string, homeTeam: string, awayTeam: string,
  { durationMs = 42_000 }: { durationMs?: number } = {},
): ReplayResult {
  const acts = script(homeTeam, awayTeam);

  // accumulators
  let hScore = 0, aScore = 0, hCorners = 0, aCorners = 0, hY = 0, aY = 0, hR = 0, aR = 0;
  let possession = 50, firstScorer: 'HOME' | 'AWAY' | 'NONE' = 'NONE';
  const steps: ReplayStep[] = [];

  acts.forEach((a, i) => {
    const minute = a.minute;
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
