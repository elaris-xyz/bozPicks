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
  GoalType?: string;
  YellowCard?: boolean;
  RedCard?: boolean;
  Penalty?: boolean;
  Corner?: boolean;
  VAR?: boolean;
  PlayerId?: number;
  PlayerInId?: number;
  PlayerOutId?: number;
  Minutes?: number;
}

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

export interface TxScores {
  fixtureId: number;
  gameState: SoccerGameState;
  startTime: number;
  sportId: number;
  competitionId: number;
  participant1Id: number;
  participant2Id: number;
  participant1IsHome: boolean;
  action: string;
  id: string;
  ts: number;
  seq: number;
  score?: {
    participant1: SoccerScore;
    participant2: SoccerScore;
  };
  data?: SoccerData;
}

// ─── REST methods ────────────────────────────────────────────────────────────

export const txlineRest = {
  fixtures: (startEpochDay?: number) =>
    txFetch<TxFixture[]>('/api/fixtures/snapshot', startEpochDay ? { startEpochDay } : undefined),

  oddsSnapshot: (fixtureId: number, asOf?: number) =>
    txFetch<TxOddsPayload[]>(`/api/odds/snapshot/${fixtureId}`, asOf ? { asOf } : undefined),

  scoresSnapshot: (fixtureId: number) =>
    txFetch<TxScores[]>(`/api/scores/snapshot/${fixtureId}`),

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
