// ─── Match ──────────────────────────────────────────────────────────────────

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HALFTIME' | 'FINISHED';

export interface OddsSnapshot {
  timestamp: string;
  homeWin: number;      // decimal odds
  draw: number;
  awayWin: number;
  impliedProb: {
    home: number;       // 0–1
    draw: number;
    away: number;
  };
}

export interface MatchState {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlagEmoji?: string;
  awayFlagEmoji?: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  currentMinute: number;
  kickoffTime: string;
  currentOdds?: OddsSnapshot;
  lastUpdated: string;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type BozEventType =
  | 'GOAL'
  | 'RED_CARD'
  | 'YELLOW_CARD'
  | 'SUBSTITUTION'
  | 'ODDS_UPDATE'
  | 'SCORE_UPDATE'
  | 'MATCH_START'
  | 'MATCH_END'
  | 'HALFTIME';

export interface BozEvent {
  id: string;
  matchId: string;
  type: BozEventType;
  timestamp: string;
  matchMinute: number;
  team?: string;
  player?: string;
  score?: { home: number; away: number };
  odds?: OddsSnapshot;
  rawPayload: object;
  txlineSignature?: string;
}

// ─── AI Explanation ──────────────────────────────────────────────────────────

export type ImportanceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AIExplanation {
  id: string;
  matchId: string;
  eventId: string;
  generatedAt: string;
  headline: string;
  body: string;
  marketImpact: string;
  importance: ImportanceLevel;
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export type SignalType = 'SHARP_MOVE' | 'MOMENTUM_SHIFT';
export type Outcome = 'HOME' | 'DRAW' | 'AWAY';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type VerificationSource = 'TXLINE_FINAL' | 'PENDING';

export interface AgentSignal {
  id: string;
  matchId: string;
  type: SignalType;
  detectedAt: string;
  oddsBefore: OddsSnapshot;
  oddsAfter: OddsSnapshot;
  deltaPercent: number;
  affectedOutcome: Outcome;
  confidence: Confidence;
  context: string;
  correlatedEventId?: string;
  outcomeVerified: boolean;
  wasAccurate?: boolean;
  verifiedAt?: string;
  verificationSource: VerificationSource;
}

// ─── Parimutuel Pool (Track 1) ───────────────────────────────────────────────

export type PoolStatus = 'OPEN' | 'LOCKED' | 'SETTLED';

export interface ParimutuelPool {
  matchId: string;
  status: PoolStatus;
  pools: {
    home: number;   // USDC micro-units (1 USDC = 1_000_000)
    draw: number;
    away: number;
  };
  totalPool: number;
  feeBps: number;           // 200 = 2%
  escrowPda: string;
  winningOutcome?: Outcome;
  settledAt?: string;
  settlementTx?: string;
}

export interface Prediction {
  id: string;
  matchId: string;
  walletAddress: string;
  outcome: Outcome;
  amountUsdc: number;       // micro-units
  placedAt: string;
  escrowTx: string;
  status: 'ACTIVE' | 'WON' | 'LOST';
  payoutAmount?: number;
  claimTx?: string;
}

// ─── Replay ──────────────────────────────────────────────────────────────────

export interface ReplayEvent {
  id: string;
  matchId: string;
  recordedAt: string;
  delayMs: number;          // ms from match start
  payload: BozEvent;
}

// ─── SSE Message ─────────────────────────────────────────────────────────────

export type SSEMessageType = 'event' | 'match_update' | 'signal' | 'ping';

export interface SSEMessage {
  type: SSEMessageType;
  data: BozEvent | MatchState | AgentSignal | null;
  ts: string;
}
