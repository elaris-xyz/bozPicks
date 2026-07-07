import { authHeaders } from './auth';

const TXLINE_BASE = 'https://txline.txodds.com';

async function txFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${TXLINE_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  if (!res.ok) throw new Error(`TxLINE ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Fixture types ──────────────────────────────────────────────────────────

export interface TxFixture {
  Ts: number;
  StartTime: number;          // Unix ms
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;       // home team name
  Participant2Id: number;
  Participant2: string;       // away team name
  FixtureId: number;
  Participant1IsHome: boolean;
}

// ─── Odds types ──────────────────────────────────────────────────────────────

export interface TxOddsPayload {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  InRunning: boolean;
  GameState?: string;
  MarketParameters?: string;
  MarketPeriod?: string;
  PriceNames?: string[];      // e.g. ["1", "X", "2"]
  Prices?: number[];          // decimal odds * 1000 (int)
  Pct?: string[];             // implied probability strings
}

// ─── Score types ─────────────────────────────────────────────────────────────

export type SoccerGameState = 'NS' | 'A' | 'HT' | 'F' | 'C' | 'I' | 'ET1' | 'ET2' | 'FET' | 'P' | 'PE';

export interface SoccerData {
  Goal?: boolean;
  GoalType?: string;          // Head | Shot | OwnGoal | Other
  YellowCard?: boolean;
  RedCard?: boolean;
  Penalty?: boolean;
  Corner?: boolean;
  VAR?: boolean;
  FreeKickType?: string;      // Safe | Attack | Danger | HighDanger | Offside
  ThrowInType?: string;
  VenueType?: string;         // Home | Away | Neutral
  PlayerId?: number;
  PlayerInId?: number;
  PlayerOutId?: number;
  Minutes?: number;
  // ── rich event Data (present on `shot` / `var` / `var_end` / `comment`) ──
  Outcome?: string;           // shot: OnTarget|OffTarget|Woodwork|Blocked · var_end: Stands|Overturned
  Type?: string;              // var: Goal|Penalty|RedCard|SecondYellowCard|CornerKick|MistakenIdentity|Other
  Text?: string;              // comment: e.g. "Water-drinking break"
}

/**
 * SSE score shape: numeric aggregates keyed by period. NOTE the historical
 * REST endpoint uses a nested object shape (SoccerTotalScore) instead — read
 * both defensively via `readSoccerStats()`.
 */
export interface SoccerScore {
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
  Corners?: number;
  H1?: number;
  HT?: number;
  H2?: number;
  Total?: number;
}

/** Historical REST shape: each period is a full SoccerScore object. */
export interface SoccerScoreObj {
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
  Corners?: number;
}
export interface SoccerTotalScore {
  H1?: SoccerScoreObj;
  HT?: SoccerScoreObj;
  H2?: SoccerScoreObj;
  Total?: SoccerScoreObj;
}

export type SoccerPossessionKind = 'Safe' | 'Attack' | 'Danger' | 'HighDanger';

export interface SoccerPartiState {
  PossibleEvent?: { Goal?: boolean; Penalty?: boolean; Corner?: boolean };
}

export interface TxLineupPlayer {
  fixturePlayerId?: number;
  rosterNumber?: string;
  starter?: boolean;
  player?: { id?: string; normativeId?: number; preferredName?: string; country?: string; team?: string };
}
export interface TxLineup {
  id?: string;
  preferredName?: string;
  lineups?: TxLineupPlayer[];
}

export interface TxScores {
  fixtureId: number;
  gameState: SoccerGameState;
  startTime: number;
  sportId: number;
  competitionId: number;
  fixtureGroupId?: number;
  countryId?: number;
  participant1Id: number;
  participant2Id: number;
  participant1IsHome: boolean;
  action: string;
  id: string;
  ts: number;
  seq: number;
  // ── SSE shape ──
  score?: {
    participant1: SoccerScore;
    participant2: SoccerScore;
  };
  data?: SoccerData;
  // ── historical REST shape (nested) ──
  scoreSoccer?: {
    Participant1?: SoccerTotalScore;
    Participant2?: SoccerTotalScore;
  };
  dataSoccer?: SoccerData;
  // ── live momentum / meta (present on either shape) ──
  clock?: { running?: boolean; seconds?: number };
  possession?: number;                 // home share 0–100
  possessionType?: SoccerPossessionKind;
  parti1StateSoccer?: SoccerPartiState;
  parti2StateSoccer?: SoccerPartiState;
  lineups?: TxLineup[];
}

// ─── REST methods ────────────────────────────────────────────────────────────

/**
 * Read team stats from a TxScores record, tolerating both the flat SSE shape
 * (`score.participantN.{Goals,Corners,...}`) and the nested historical REST
 * shape (`scoreSoccer.ParticipantN.Total.{...}`).
 */
export function readSoccerStats(
  s: TxScores,
  which: 1 | 2,
): { goals: number; corners: number; yellow: number; red: number } {
  const nested = which === 1 ? s.scoreSoccer?.Participant1?.Total : s.scoreSoccer?.Participant2?.Total;
  if (nested) {
    return {
      goals: nested.Goals ?? 0,
      corners: nested.Corners ?? 0,
      yellow: nested.YellowCards ?? 0,
      red: nested.RedCards ?? 0,
    };
  }
  const flat = which === 1 ? s.score?.participant1 : s.score?.participant2;
  return {
    goals: flat?.Total ?? flat?.Goals ?? 0,
    corners: flat?.Corners ?? 0,
    yellow: flat?.YellowCards ?? 0,
    red: flat?.RedCards ?? 0,
  };
}

export const txlineRest = {
  fixtures: (startEpochDay?: number, competitionId?: number) => {
    const params: Record<string, number> = {};
    if (startEpochDay) params.startEpochDay = startEpochDay;
    if (competitionId) params.competitionId = competitionId;
    return txFetch<TxFixture[]>('/api/fixtures/snapshot', Object.keys(params).length ? params : undefined);
  },

  oddsSnapshot: (fixtureId: number, asOf?: number) =>
    txFetch<TxOddsPayload[]>(`/api/odds/snapshot/${fixtureId}`, asOf ? { asOf } : undefined),

  /** Live odds offers from the current 5-minute cache (all bookmakers/markets). */
  oddsUpdates: (fixtureId: number) =>
    txFetch<TxOddsPayload[]>(`/api/odds/updates/${fixtureId}`),

  scoresSnapshot: (fixtureId: number) =>
    txFetch<TxScores[]>(`/api/scores/snapshot/${fixtureId}`),

  /** Full ordered sequence of every score update for a fixture — powers replay. */
  scoresHistorical: (fixtureId: number) =>
    txFetch<TxScores[]>(`/api/scores/historical/${fixtureId}`),

  /** Convenience: get final home/away score for a match after it ends */
  score: async (matchId: string): Promise<{ homeScore: number; awayScore: number }> => {
    const snapshots = await txFetch<TxScores[]>(`/api/scores/snapshot/${matchId}`);
    const latest = snapshots[snapshots.length - 1];
    if (!latest?.score) throw new Error(`No score data for fixture ${matchId}`);
    const p1 = latest.score.participant1.Total ?? 0;
    const p2 = latest.score.participant2.Total ?? 0;
    return {
      homeScore: latest.participant1IsHome ? p1 : p2,
      awayScore: latest.participant1IsHome ? p2 : p1,
    };
  },
};
