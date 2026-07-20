import type { TxOddsPayload, TxScores, SoccerGameState, SoccerData, SoccerPossessionKind } from '@bozpicks/txline-client';
import { readSoccerStats } from '@bozpicks/txline-client';
import type { BozEvent, BozEventType, OddsSnapshot, MatchStatus, MatchStats, DangerLevel, GoalKind } from '@bozpicks/shared';
import { randomUUID } from 'crypto';

function safeTs(ts: number | undefined): string {
  if (!ts || isNaN(ts) || ts <= 0) return new Date().toISOString();
  try { return new Date(ts).toISOString(); } catch { return new Date().toISOString(); }
}

// ─── Odds → OddsSnapshot ────────────────────────────────────────────────────

/**
 * Find the home/draw/away column of a 1X2 price array.
 *
 * The live TxLINE feed labels them `part1` / `draw` / `part2` — NOT the
 * `1` / `X` / `2` we originally coded against. That single mismatch meant every
 * real odds record was silently rejected: no Match Odds panel, no Odds
 * Movement, no Turning Points on a real fixture, and the agent/Arena never saw
 * a real price move (the demo was unaffected because it synthesises snapshots
 * directly, which is why this hid for so long). Accept both spellings.
 */
function idxOf1X2(names: string[]): { i1: number; iX: number; i2: number } {
  const find = (...cands: string[]) => {
    for (const c of cands) {
      const i = names.findIndex(n => n?.toLowerCase() === c);
      if (i >= 0) return i;
    }
    return -1;
  };
  return { i1: find('part1', '1'), iX: find('draw', 'x'), i2: find('part2', '2') };
}

export function oddsToSnapshot(odds: TxOddsPayload): OddsSnapshot | null {
  if (!odds.Prices || odds.Prices.length < 3) return null;
  if (!odds.PriceNames) return null;

  // Prices are integer * 1000 (e.g. 1850 = 1.850 decimal odds)
  const { i1: idx1, iX: idxX, i2: idx2 } = idxOf1X2(odds.PriceNames);

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
  // CORNER / YELLOW_CARD / RED_CARD are NOT classified from the action here —
  // TxLINE sends those discrete records sparsely (a real fixture logged 4 of 13
  // corners, 1 of 4 yellows, 0 of 1 reds as actions), so the timeline came out
  // nearly empty. They're derived instead from increments of the cumulative
  // Stats map via statDeltaEvents(), which is complete. A card action record
  // still lands here as SCORE_UPDATE; its player name is picked up by the delta
  // event fired on the same record.
  if (a === 'var' || a === 'var_end') return 'VAR';
  if (a === 'substitution' || a === 'sub') return 'SUBSTITUTION';
  if (a === 'shot') return 'SHOT';
  if (a === 'offside') return 'OFFSIDE';
  if (a === 'free_kick') return r.Data?.FreeKickType === 'Offside' ? 'OFFSIDE' : 'FOUL';
  return 'SCORE_UPDATE';
}

const n = (v: number | undefined): number => (typeof v === 'number' ? v : 0);

// Each fixture's last trusted score, only used to carry forward across records
// whose Stats we deliberately don't trust for the score (VAR review records —
// TxLINE emits a transient over-count on a `var_end` Overturned, then the very
// next record and game_finalised carry the corrected total). We do NOT clamp
// the score monotonically: a VAR overturn legitimately lowers it, and the Stats
// map is otherwise authoritative per record.
const lastScore = new Map<string, { home: number; away: number }>();

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

  // The Stats map (participant goals, keys 1/2) is the authoritative running
  // total per record — trust it directly. The ONE exception is a VAR review
  // record: TxLINE emits a transient over-count on `var_end` Overturned (seen
  // live: France v Spain seq 641 shows Spain 3, then the next record + the
  // game_finalised record both carry the corrected 2). A `var`/`var_end`
  // record shouldn't move the displayed score anyway — the correction rides in
  // on the following record — so we carry the last trusted score across it.
  const isVarRecord = type === 'VAR' || action.toLowerCase().startsWith('var');
  if (isVarRecord) {
    const prev = lastScore.get(String(id));
    if (prev) { home = prev.home; away = prev.away; }
  } else {
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

// ─── Discrete events from cumulative-stat increments ─────────────────────────
// The Stats map (corners keys 7/8, yellows 3/4, reds 5/6) carries the COMPLETE
// running total on every record, whereas discrete corner/card action records
// arrive sparsely. So we build the timeline's corner/card pips from increments
// of these totals — one CORNER/YELLOW_CARD/RED_CARD per unit the total advances,
// attributed to the side whose total moved. This guarantees the timeline always
// matches the final stats (13 corners → 13 corner events), the same
// max(cumulative, count) philosophy the settlement resolver uses.

export interface SideCounts { cH: number; cA: number; yH: number; yA: number; rH: number; rA: number }

function countsOf(r: RawScore): SideCounts {
  const S = r.Stats ?? {};
  const sc = r.Score ?? {};
  const isHome1 = r.Participant1IsHome !== false;
  const y1 = S['3'] ?? n(sc.Participant1?.Total?.YellowCards);
  const y2 = S['4'] ?? n(sc.Participant2?.Total?.YellowCards);
  const rr1 = S['5'] ?? n(sc.Participant1?.Total?.RedCards);
  const rr2 = S['6'] ?? n(sc.Participant2?.Total?.RedCards);
  const c1 = S['7'] ?? n(sc.Participant1?.Total?.Corners);
  const c2 = S['8'] ?? n(sc.Participant2?.Total?.Corners);
  return {
    cH: isHome1 ? c1 : c2, cA: isHome1 ? c2 : c1,
    yH: isHome1 ? y1 : y2, yA: isHome1 ? y2 : y1,
    rH: isHome1 ? rr1 : rr2, rA: isHome1 ? rr2 : rr1,
  };
}

/**
 * PURE: given the previous per-side counts and the current record, emit a
 * discrete event for each unit a corner/yellow/red total advanced. `prev`
 * undefined = baseline (first record for the fixture) → no events, just seed the
 * counts, so joining a match mid-stream doesn't dump a burst at one minute.
 * A card event carries the booked player's name when this very record is the
 * card action that moved the total.
 */
export function statDeltaEvents(
  prev: SideCounts | undefined,
  scores: TxScores,
  names?: { home: string; away: string },
  players?: Map<number, { name: string; number?: string }>,
): { events: BozEvent[]; counts: SideCounts } {
  const r = scores as unknown as RawScore;
  const cur = countsOf(r);
  if (!prev) return { events: [], counts: cur };

  const clockSec = n(r.Clock?.Seconds);
  const minute = Math.min(130, Math.floor(clockSec / 60));
  const isHome1 = r.Participant1IsHome !== false;
  const S = r.Stats ?? {};
  const sc = r.Score ?? {};
  const g1 = S['1'] ?? n(sc.Participant1?.Total?.Goals);
  const g2 = S['2'] ?? n(sc.Participant2?.Total?.Goals);
  const home = isHome1 ? g1 : g2;
  const away = isHome1 ? g2 : g1;

  const d = r.Data;
  const action = (r.Action ?? '').toLowerCase();
  const isCardAction = action === 'yellow_card' || action === 'red_card'
    || action === 'second_yellow' || action === 'second_yellow_card';
  const bookedPlayer = (): string | undefined => {
    const pid = d?.PlayerId;
    if (!pid) return undefined;
    const hit = players?.get(pid);
    return hit ? (hit.number ? `${hit.name} · #${hit.number}` : hit.name) : `Player #${pid}`;
  };

  const events: BozEvent[] = [];
  const emit = (type: BozEventType, side: 'home' | 'away', count: number, canName: boolean) => {
    for (let i = 0; i < count; i++) {
      events.push({
        id: randomUUID(),
        matchId: String(r.FixtureId),
        type,
        timestamp: safeTs(r.Ts),
        matchMinute: minute,
        score: { home, away },
        seq: r.Seq,
        team: names ? (side === 'home' ? names.home : names.away) : undefined,
        // only the increment on the actual card action gets the player name
        player: canName && isCardAction && i === count - 1 ? bookedPlayer() : undefined,
        rawPayload: scores as unknown as object,
      });
    }
  };
  emit('CORNER', 'home', Math.max(0, cur.cH - prev.cH), false);
  emit('CORNER', 'away', Math.max(0, cur.cA - prev.cA), false);
  emit('YELLOW_CARD', 'home', Math.max(0, cur.yH - prev.yH), true);
  emit('YELLOW_CARD', 'away', Math.max(0, cur.yA - prev.yA), true);
  emit('RED_CARD', 'home', Math.max(0, cur.rH - prev.rH), true);
  emit('RED_CARD', 'away', Math.max(0, cur.rA - prev.rA), true);
  return { events, counts: cur };
}

// Live wrapper: keeps per-fixture counts across streamed records.
const lastCounts = new Map<string, SideCounts>();
export function deriveStatEvents(
  scores: TxScores,
  names?: { home: string; away: string },
  players?: Map<number, { name: string; number?: string }>,
): BozEvent[] {
  const id = String((scores as unknown as RawScore).FixtureId ?? '');
  if (!id) return [];
  const { events, counts } = statDeltaEvents(lastCounts.get(id), scores, names, players);
  lastCounts.set(id, counts);
  return events;
}
/** Reset the per-fixture stat baseline — used by backfill (folds counts itself). */
export function resetStatCounts(fixtureId?: string): void {
  if (fixtureId) lastCounts.delete(fixtureId); else lastCounts.clear();
}

// ─── TxOddsPayload → BozEvent ────────────────────────────────────────────────

/**
 * @param kickoffMs when known, stamps the tick with a real match minute. Odds
 * records carry no clock of their own, so without it the tick lands at 0' and
 * sorts/paces to the top of a timeline it belongs in the middle of.
 */
export function oddsEventToBozEvent(odds: TxOddsPayload, kickoffMs?: number): BozEvent | null {
  // Only the 1X2 match-winner market (the feed also carries over/under and
  // Asian handicap, whose price arrays we'd otherwise misread)
  if (!odds.PriceNames || idxOf1X2(odds.PriceNames).i1 < 0) return null;
  if (!odds.InRunning) return null; // only in-game odds

  const snapshot = oddsToSnapshot(odds);
  if (!snapshot) return null;

  const minute = kickoffMs && odds.Ts
    ? Math.max(0, Math.min(130, Math.floor((odds.Ts - kickoffMs) / 60_000)))
    : 0;

  return {
    id: odds.MessageId,
    matchId: String(odds.FixtureId),
    type: 'ODDS_UPDATE',
    timestamp: snapshot.timestamp,
    matchMinute: minute,
    odds: snapshot,
    rawPayload: odds as unknown as object,
  };
}
