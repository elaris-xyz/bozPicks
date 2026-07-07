import type { TxOddsPayload, TxScores, SoccerGameState, SoccerData, SoccerPossessionKind } from '@bozpicks/txline-client';
import { readSoccerStats } from '@bozpicks/txline-client';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStatus, MatchStats, DangerLevel, GoalKind } from '@bozpicks/shared';
import { randomUUID } from 'crypto';

function safeTs(ts: number | undefined): string {
  if (!ts || isNaN(ts) || ts <= 0) return new Date().toISOString();
  try { return new Date(ts).toISOString(); } catch { return new Date().toISOString(); }
}

// ─── Odds → OddsSnapshot ────────────────────────────────────────────────────

export function oddsToSnapshot(odds: TxOddsPayload): OddsSnapshot | null {
  if (!odds.Prices || odds.Prices.length < 3) return null;
  if (!odds.PriceNames) return null;

  // Prices are integer * 1000 (e.g. 1850 = 1.850 decimal odds)
  const idx1 = odds.PriceNames.indexOf('1');
  const idxX = odds.PriceNames.indexOf('X');
  const idx2 = odds.PriceNames.indexOf('2');

  if (idx1 < 0 || idxX < 0 || idx2 < 0) return null;

  const home = odds.Prices[idx1] / 1000;
  const draw = odds.Prices[idxX] / 1000;
  const away = odds.Prices[idx2] / 1000;

  if (home <= 0 || draw <= 0 || away <= 0) return null;

  const invHome = 1 / home;
  const invDraw = 1 / draw;
  const invAway = 1 / away;
  const total = invHome + invDraw + invAway;

  return {
    timestamp: new Date(odds.Ts).toISOString(),
    homeWin: home,
    draw,
    awayWin: away,
    impliedProb: {
      home: invHome / total,
      draw: invDraw / total,
      away: invAway / total,
    },
    bookmaker: odds.Bookmaker,
    inRunning: odds.InRunning,
  };
}

// ─── GameState → MatchStatus ─────────────────────────────────────────────────

function gameStateToStatus(gs: SoccerGameState): MatchStatus {
  if (gs === 'NS') return 'SCHEDULED';
  if (gs === 'HT') return 'HALFTIME';
  if (gs === 'F' || gs === 'C' || gs === 'FET') return 'FINISHED';
  return 'LIVE';
}

// ─── Live stats (corners, cards, possession, danger) ─────────────────────────

const POSSESSION_DANGER: Record<SoccerPossessionKind, DangerLevel> = {
  Safe: 'SAFE', Attack: 'ATTACK', Danger: 'DANGER', HighDanger: 'HIGH_DANGER',
};

/** Danger for one side from its PossibleEvent flags (goal/penalty > corner). */
function sideDanger(state: { PossibleEvent?: { Goal?: boolean; Penalty?: boolean; Corner?: boolean } } | undefined): DangerLevel | undefined {
  const e = state?.PossibleEvent;
  if (!e) return undefined;
  if (e.Goal || e.Penalty) return 'HIGH_DANGER';
  if (e.Corner) return 'DANGER';
  return undefined;
}

export function buildStats(s: TxScores): MatchStats {
  const isHome1 = s.participant1IsHome;
  const p1 = readSoccerStats(s, 1);
  const p2 = readSoccerStats(s, 2);
  const home = isHome1 ? p1 : p2;
  const away = isHome1 ? p2 : p1;

  // possession share: assume `possession` is participant1's %; map to home
  let possession: number | undefined;
  if (typeof s.possession === 'number') {
    possession = isHome1 ? s.possession : 100 - s.possession;
  }

  // danger per side: prefer per-participant PossibleEvent, fall back to the
  // global possessionType applied to whoever currently has the ball
  let dHome = sideDanger(isHome1 ? s.parti1StateSoccer : s.parti2StateSoccer);
  let dAway = sideDanger(isHome1 ? s.parti2StateSoccer : s.parti1StateSoccer);
  if ((!dHome || !dAway) && s.possessionType) {
    const lvl = POSSESSION_DANGER[s.possessionType];
    const homeHasBall = possession == null ? true : possession >= 50;
    if (homeHasBall) dHome = dHome ?? lvl; else dAway = dAway ?? lvl;
  }

  return {
    cornersHome: home.corners,
    cornersAway: away.corners,
    yellowHome: home.yellow,
    yellowAway: away.yellow,
    redHome: home.red,
    redAway: away.red,
    possession,
    danger: { home: dHome ?? 'SAFE', away: dAway ?? 'SAFE' },
    clockSeconds: s.clock?.seconds,
  };
}

// ─── SoccerData event classification ─────────────────────────────────────────

function goalKind(gt: string | undefined): GoalKind | undefined {
  if (!gt) return undefined;
  const k = gt.toLowerCase();
  if (k.includes('head')) return 'HEAD';
  if (k.includes('own')) return 'OWN_GOAL';
  if (k.includes('penalty')) return 'PENALTY';
  if (k.includes('shot')) return 'SHOT';
  return 'OTHER';
}

function classify(scores: TxScores, d: SoccerData | undefined): BozEventType | null {
  if (scores.gameState === 'HT') return 'HALFTIME';
  // `game_finalised` is the authoritative final record (accounts for ET/pens);
  // TxLINE says settle off it, not an arbitrary 90' / gameState=F record.
  if (scores.action === 'game_finalised') return 'MATCH_END';
  if (scores.gameState === 'F' || scores.gameState === 'FET') return 'MATCH_END';
  if (scores.action === 'MatchStarted') return 'MATCH_START';
  if (d?.Goal) return 'GOAL';
  if (d?.RedCard) return 'RED_CARD';
  if (d?.YellowCard) return 'YELLOW_CARD';
  if (d?.VAR) return 'VAR';
  if (d?.Penalty) return 'PENALTY';
  if (d?.PlayerInId || d?.PlayerOutId) return 'SUBSTITUTION';
  if (d?.Corner) return 'CORNER';
  return 'SCORE_UPDATE';
}

// ─── TxScores → BozEvent ────────────────────────────────────────────────────

export function scoresEventToBozEvent(scores: TxScores): BozEvent | null {
  if (!scores.fixtureId) return null;          // skip events without match ref
  if (scores.gameState === 'NS') return null;  // skip pre-match updates

  const d = scores.data ?? scores.dataSoccer;
  const type = classify(scores, d);
  if (!type) return null;

  const stats = buildStats(scores);
  const s1 = readSoccerStats(scores, 1);
  const s2 = readSoccerStats(scores, 2);
  const home = scores.participant1IsHome ? s1.goals : s2.goals;
  const away = scores.participant1IsHome ? s2.goals : s1.goals;

  const minute = d?.Minutes ?? (stats.clockSeconds != null ? Math.floor(stats.clockSeconds / 60) : 0);

  return {
    id: scores.id ?? randomUUID(),
    matchId: String(scores.fixtureId),
    type,
    timestamp: safeTs(scores.ts),
    matchMinute: minute,
    score: { home, away },
    seq: scores.seq,
    goalKind: type === 'GOAL' ? goalKind(d?.GoalType) : undefined,
    isPenalty: d?.Penalty || undefined,
    isOwnGoal: type === 'GOAL' && goalKind(d?.GoalType) === 'OWN_GOAL' ? true : undefined,
    isVAR: d?.VAR || undefined,
    stats,
    rawPayload: scores as unknown as object,
  };
}

// ─── TxOddsPayload → BozEvent ────────────────────────────────────────────────

export function oddsEventToBozEvent(odds: TxOddsPayload): BozEvent | null {
  // Only process 1X2 match winner market
  if (!odds.PriceNames?.includes('1')) return null;
  if (!odds.InRunning) return null; // only in-game odds for now

  const snapshot = oddsToSnapshot(odds);
  if (!snapshot) return null;

  return {
    id: odds.MessageId,
    matchId: String(odds.FixtureId),
    type: 'ODDS_UPDATE',
    timestamp: snapshot.timestamp,
    matchMinute: 0,
    odds: snapshot,
    rawPayload: odds as unknown as object,
  };
}
