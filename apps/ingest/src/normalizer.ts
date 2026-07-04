import type { TxOddsPayload, TxScores, SoccerGameState } from '@bozpicks/txline-client';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStatus } from '@bozpicks/shared';
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
  };
}

// ─── GameState → MatchStatus ─────────────────────────────────────────────────

function gameStateToStatus(gs: SoccerGameState): MatchStatus {
  if (gs === 'NS') return 'SCHEDULED';
  if (gs === 'HT') return 'HALFTIME';
  if (gs === 'F' || gs === 'C' || gs === 'FET') return 'FINISHED';
  return 'LIVE';
}

// ─── TxScores → BozEvent ────────────────────────────────────────────────────

export function scoresEventToBozEvent(scores: TxScores): BozEvent | null {
  const d = scores.data;
  let type: BozEventType;

  if (!scores.fixtureId) return null;          // skip events without match ref
  if (scores.gameState === 'NS') return null; // skip pre-match updates

  if (scores.gameState === 'HT') {
    type = 'HALFTIME';
  } else if (scores.gameState === 'F' || scores.gameState === 'FET') {
    type = 'MATCH_END';
  } else if (scores.action === 'MatchStarted') {
    type = 'MATCH_START';
  } else if (d?.Goal) {
    type = 'GOAL';
  } else if (d?.RedCard) {
    type = 'RED_CARD';
  } else if (d?.YellowCard) {
    type = 'YELLOW_CARD';
  } else if (d?.PlayerInId || d?.PlayerOutId) {
    type = 'SUBSTITUTION';
  } else {
    type = 'SCORE_UPDATE';
  }

  const p1Score = scores.score?.participant1?.Total ?? 0;
  const p2Score = scores.score?.participant2?.Total ?? 0;

  // Determine home/away based on Participant1IsHome
  const homeScore = scores.participant1IsHome ? p1Score : p2Score;
  const awayScore = scores.participant1IsHome ? p2Score : p1Score;

  return {
    id: scores.id ?? randomUUID(),
    matchId: String(scores.fixtureId),
    type,
    timestamp: safeTs(scores.ts),
    matchMinute: d?.Minutes ?? 0,
    score: { home: homeScore, away: awayScore },
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
