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

// ─── Real TxLINE scores shape (PascalCase, from REST snapshot AND SSE) ────────
// The live/REST scores payload is PascalCase (FixtureId, Action, Score, Stats,
// Clock…), NOT the camelCase our old normalizer assumed — which is why real
// score data never ingested. This reads the real shape.
interface RawSide { Total?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number } }
interface RawScore {
  FixtureId?: number;
  Participant1IsHome?: boolean;
  Action?: string;
  StatusId?: number;
  GameState?: string;
  Clock?: { Seconds?: number; Running?: boolean };
  Score?: { Participant1?: RawSide; Participant2?: RawSide };
  Stats?: Record<string, number>;
  Data?: { PlayerId?: number; PlayerInId?: number; PlayerOutId?: number; GoalType?: string; Outcome?: string; FreeKickType?: string; Type?: string; Penalty?: boolean };
  Possession?: number;
  Participant?: number;   // which side (1|2) this specific event belongs to
  Ts?: number;
  Seq?: number;
  Id?: string | number;
}

function goalKind(gt: string | undefined): GoalKind | undefined {
  if (!gt) return undefined;
  const k = gt.toLowerCase();
  if (k.includes('head')) return 'HEAD';
  if (k.includes('own')) return 'OWN_GOAL';
  if (k.includes('penalty')) return 'PENALTY';
  if (k.includes('shot')) return 'SHOT';
  return 'OTHER';
}

const SHOT_OUTCOMES = new Set(['OnTarget', 'OffTarget', 'Woodwork', 'Blocked']);

/** Classify from the snake_case Action + status. */
function classifyReal(action: string, r: RawScore): BozEventType | null {
  const a = action.toLowerCase();
  const gs = (r.GameState ?? '').toLowerCase();
  if (a === 'game_finalised' || r.StatusId === 100) return 'MATCH_END';
  if (a.includes('half_time') || a === 'ht' || gs === 'ht' || gs === 'halftime') return 'HALFTIME';
  if (a === 'kick_off' || a === 'match_started' || a === 'game_started') return 'MATCH_START';
  if (a === 'goal') return 'GOAL';
  if (a === 'penalty') return 'PENALTY';
  // a converted penalty arrives as penalty_outcome{Outcome:'Scored'} — that IS
  // the goal record (there is no separate 'goal' for it); missed/saved ones
  // are just score noise
  if (a === 'penalty_outcome') return r.Data?.Outcome === 'Scored' ? 'GOAL' : 'SCORE_UPDATE';
  if (a === 'red_card' || a === 'second_yellow' || a === 'second_yellow_card') return 'RED_CARD';
  if (a === 'yellow_card') return 'YELLOW_CARD';
  if (a === 'var' || a === 'var_end') return 'VAR';
  if (a === 'substitution' || a === 'sub') return 'SUBSTITUTION';
  if (a === 'corner') return 'CORNER';
  if (a === 'shot') return 'SHOT';
  if (a === 'offside') return 'OFFSIDE';
  if (a === 'free_kick') return r.Data?.FreeKickType === 'Offside' ? 'OFFSIDE' : 'FOUL';
  return 'SCORE_UPDATE';
}

const n = (v: number | undefined): number => (typeof v === 'number' ? v : 0);

// A 'goal' record's OWN Score/Stats snapshot is frequently stale — TxLINE
// emits the goal record before the stat totals it carries are incremented, so
// reading it naively shows the PRE-goal score next to a "GOAL" event (visibly
// wrong on the live scoreboard for the few seconds until the next tick
// corrects it). Track each fixture's last-confirmed score and force a GOAL
// record to reflect at least +1 for the scoring side — guarded so a
// redelivered/duplicate copy of the exact same record can't double-count.
const lastScore = new Map<string, { home: number; away: number }>();
const goalBumped = new Set<string>();

// ─── TxScores → BozEvent (real PascalCase shape) ─────────────────────────────

export function scoresEventToBozEvent(
  scores: TxScores,
  names?: { home: string; away: string },
  players?: Map<number, { name: string; number?: string }>,
): BozEvent | null {
  const r = scores as unknown as RawScore;
  const id = r.FixtureId;
  if (!id) return null;

  const action = r.Action ?? '';
  const clockSec = n(r.Clock?.Seconds);
  const finalised = action.toLowerCase() === 'game_finalised' || r.StatusId === 100;
  // skip pre-match noise (lineups/odds/comments before the clock runs)
  if (!finalised && clockSec <= 0 && !['kick_off', 'match_started', 'game_started'].includes(action.toLowerCase())) {
    return null;
  }

  const type = classifyReal(action, r);
  if (!type) return null;

  const isHome1 = r.Participant1IsHome !== false;

  // totals: prefer the numeric Stats map (period 0 = Total), fall back to Score
  const S = r.Stats ?? {};
  const sc = r.Score ?? {};
  const g1 = S['1'] ?? n(sc.Participant1?.Total?.Goals);
  const g2 = S['2'] ?? n(sc.Participant2?.Total?.Goals);
  const y1 = S['3'] ?? n(sc.Participant1?.Total?.YellowCards);
  const y2 = S['4'] ?? n(sc.Participant2?.Total?.YellowCards);
  const r1 = S['5'] ?? n(sc.Participant1?.Total?.RedCards);
  const r2 = S['6'] ?? n(sc.Participant2?.Total?.RedCards);
  const c1 = S['7'] ?? n(sc.Participant1?.Total?.Corners);
  const c2 = S['8'] ?? n(sc.Participant2?.Total?.Corners);

  let home = isHome1 ? g1 : g2;
  let away = isHome1 ? g2 : g1;

  if (type === 'GOAL') {
    const d0 = r.Data;
    const ownGoal = goalKind(d0?.GoalType) === 'OWN_GOAL';
    // side crediting the goal: Participant 1|2 mapped through isHome1, the
    // same mapping already used below for `team` — independent of whether
    // team names were passed in
    const scoringSide: 'home' | 'away' | undefined =
      r.Participant === 1 ? (isHome1 ? 'home' : 'away')
      : r.Participant === 2 ? (isHome1 ? 'away' : 'home')
      : undefined;
    // own goals are rarer and Participant's meaning for them is unconfirmed —
    // skip the forced bump rather than risk crediting the wrong side; the
    // monotonic clamp below still protects against a regression.
    if (scoringSide && !ownGoal) {
      const goalKey = `${id}:${r.Id ?? r.Seq ?? `${action}-${clockSec}`}`;
      if (!goalBumped.has(goalKey)) {
        goalBumped.add(goalKey);
        const prev = lastScore.get(String(id)) ?? { home: 0, away: 0 };
        // Only force +1 when the cumulative Stats map HASN'T caught up yet
        // (the live lag: a goal record arrives before its own Stats increment,
        // so the side's Stats value still equals the previous confirmed score).
        // In a full-history replay the Stats are already incremented, so we
        // trust them — and a disallowed/duplicate goal whose Stats never moved
        // won't over-count the score (was the 0-3-instead-of-0-2 bug).
        const sideCur = scoringSide === 'home' ? home : away;   // from Stats
        const sidePrev = scoringSide === 'home' ? prev.home : prev.away;
        if (sideCur <= sidePrev) {
          if (scoringSide === 'home') home = sidePrev + 1;
          else away = sidePrev + 1;
        }
      }
    }
  }
  // The game_finalised record is the AUTHORITATIVE final score — trust its
  // Stats verbatim, bypassing the monotonic clamp. A VAR overturn legitimately
  // reduces the score, and TxLINE can emit a transient over-count at the
  // overturn moment (seen live: France v Spain seq 641 var_end shows Spain 3,
  // then game_finalised corrects to 2) that the clamp would otherwise lock in.
  if (finalised) {
    lastScore.set(String(id), { home, away });
  } else {
    // in-play: never let the running score regress below the last confirmed
    // value (an out-of-order or incomplete record must not roll it back)
    const prevScore = lastScore.get(String(id)) ?? { home: 0, away: 0 };
    home = Math.max(home, prevScore.home);
    away = Math.max(away, prevScore.away);
    lastScore.set(String(id), { home, away });
  }

  // the game_finalised record carries Clock.Seconds=0 — don't stamp full-time /
  // late events at 0'; floor them to 90' (or ET if the clock says so)
  let minute = Math.min(130, Math.floor(clockSec / 60));
  if ((type === 'MATCH_END' || type === 'HALFTIME') && minute === 0) {
    minute = type === 'HALFTIME' ? 45 : 90;
  }

  const stats: MatchStats = {
    cornersHome: isHome1 ? c1 : c2, cornersAway: isHome1 ? c2 : c1,
    yellowHome: isHome1 ? y1 : y2,  yellowAway: isHome1 ? y2 : y1,
    redHome: isHome1 ? r1 : r2,     redAway: isHome1 ? r2 : r1,
    possession: typeof r.Possession === 'number' ? (isHome1 ? r.Possession : 100 - r.Possession) : undefined,
    danger: { home: 'SAFE', away: 'SAFE' },
    clockSeconds: clockSec,
  };

  // which team this specific event belongs to (Participant 1|2 → name)
  let team: string | undefined;
  if (names && r.Participant) {
    team = r.Participant === 1 ? (isHome1 ? names.home : names.away)
         : r.Participant === 2 ? (isHome1 ? names.away : names.home)
         : undefined;
  }

  const d = r.Data;
  const isPenaltyGoal = type === 'GOAL' && action.toLowerCase() === 'penalty_outcome';

  // TxLINE gives a numeric PlayerId per event. When a lineups map is available
  // (built from the fixture's lineup records) we resolve it to a real name +
  // shirt number ("Mbappé · #10"); otherwise we surface the id itself
  // ("Player #4231") — honest, never invented, and still lets a reader tell
  // "this player, twice" apart from "two different players".
  const nameFor = (pid?: number): string | undefined => {
    if (!pid) return undefined;
    const hit = players?.get(pid);
    if (hit) return hit.number ? `${hit.name} · #${hit.number}` : hit.name;
    return `Player #${pid}`;
  };
  let player: string | undefined;
  if (type === 'SUBSTITUTION' && (d?.PlayerInId || d?.PlayerOutId)) {
    player = `${nameFor(d?.PlayerInId) ?? '?'} ← ${nameFor(d?.PlayerOutId) ?? '?'}`;
  } else if (d?.PlayerId) {
    player = nameFor(d.PlayerId);
  }

  return {
    id: String(r.Id ?? randomUUID()),
    matchId: String(id),
    type,
    timestamp: safeTs(r.Ts),
    matchMinute: minute,
    score: { home, away },
    seq: r.Seq,
    team,
    player,
    goalKind: type === 'GOAL' ? (isPenaltyGoal ? 'PENALTY' : goalKind(d?.GoalType)) : undefined,
    isPenalty: isPenaltyGoal || d?.Penalty || undefined,
    isOwnGoal: type === 'GOAL' && goalKind(d?.GoalType) === 'OWN_GOAL' ? true : undefined,
    isVAR: type === 'VAR' || undefined,
    shotOutcome: type === 'SHOT' && d?.Outcome && SHOT_OUTCOMES.has(d.Outcome) ? (d.Outcome as BozEvent['shotOutcome']) : undefined,
    varType: type === 'VAR' ? (d?.Type as BozEvent['varType']) : undefined,
    varOutcome: type === 'VAR' && (d?.Outcome === 'Stands' || d?.Outcome === 'Overturned') ? (d.Outcome as BozEvent['varOutcome']) : undefined,
    freeKickType: (type === 'FOUL' || type === 'OFFSIDE') ? d?.FreeKickType : undefined,
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
