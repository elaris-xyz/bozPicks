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
  bookmaker?: string;   // TxLINE Bookmaker (undefined = consensus/StablePrice)
  inRunning?: boolean;  // true = in-play, false = pre-match
}

/**
 * Live match statistics from TxLINE's SoccerScore period breakdown +
 * possession/danger state. All per-team; `possession` is home's share (0–100).
 */
export interface MatchStats {
  cornersHome: number;
  cornersAway: number;
  yellowHome: number;
  yellowAway: number;
  redHome: number;
  redAway: number;
  /** home possession share, 0–100 (away = 100 − this) */
  possession?: number;
  /** live attacking pressure per side, from TxLINE possessionType */
  danger?: { home: DangerLevel; away: DangerLevel };
  /** first-half score, once known */
  halfTime?: { home: number; away: number };
  /** live match clock in seconds, if streamed */
  clockSeconds?: number;
}

export type DangerLevel = 'SAFE' | 'ATTACK' | 'DANGER' | 'HIGH_DANGER';

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
  /** competition name from the fixtures feed (e.g. "FIFA World Cup") */
  competition?: string;
  competitionId?: number;
  /** live stats — corners, cards, possession, danger */
  stats?: MatchStats;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type BozEventType =
  | 'GOAL'
  | 'RED_CARD'
  | 'YELLOW_CARD'
  | 'SUBSTITUTION'
  | 'CORNER'
  | 'PENALTY'
  | 'VAR'
  | 'SHOT'
  | 'OFFSIDE'
  | 'FOUL'
  | 'ODDS_UPDATE'
  | 'SCORE_UPDATE'
  | 'MATCH_START'
  | 'MATCH_END'
  | 'HALFTIME';

export type GoalKind = 'SHOT' | 'HEAD' | 'PENALTY' | 'OWN_GOAL' | 'OTHER';

/** TxLINE `shot` outcomes (Data.Outcome). */
export type ShotOutcome = 'OnTarget' | 'OffTarget' | 'Woodwork' | 'Blocked';
/** TxLINE `var` review type (Data.Type). */
export type VarType = 'Goal' | 'Penalty' | 'RedCard' | 'SecondYellowCard' | 'CornerKick' | 'MistakenIdentity' | 'Other';
/** TxLINE `var_end` outcome (Data.Outcome). */
export type VarOutcome = 'Stands' | 'Overturned';

export interface BozEvent {
  id: string;
  matchId: string;
  type: BozEventType;
  timestamp: string;
  matchMinute: number;
  team?: string;
  player?: string;         // resolved from lineups by PlayerId when possible
  score?: { home: number; away: number };
  odds?: OddsSnapshot;
  rawPayload: object;
  txlineSignature?: string;
  /** TxLINE canonical sequence number — used for Merkle proof lookups */
  seq?: number;
  // ── rich event detail (optional, populated from SoccerData) ──
  goalKind?: GoalKind;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
  isVAR?: boolean;
  /** SHOT: on/off target, woodwork, blocked (TxLINE shot Data.Outcome) */
  shotOutcome?: ShotOutcome;
  /** VAR: what's under review + how it resolved (TxLINE var / var_end) */
  varType?: VarType;
  varOutcome?: VarOutcome;
  /** FOUL/OFFSIDE: the TxLINE free_kick FreeKickType that produced it */
  freeKickType?: string;
  playerIn?: string;       // substitution in
  playerOut?: string;      // substitution out
  /** stats snapshot at the moment of this event — for the Hi-Lo game */
  stats?: MatchStats;
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

// ─── Prop / parametric markets (Track 1) ─────────────────────────────────────

/**
 * Market kinds derived from TxLINE stats. Each resolves deterministically from
 * the final SoccerScore, so a keeper can settle it trustlessly via a Merkle
 * proof + CPI into validate_stat.
 */
export type MarketKind =
  | 'MATCH_WINNER'    // outcomes: HOME | DRAW | AWAY
  | 'TOTAL_GOALS'     // outcomes: OVER | UNDER  (needs line)
  | 'TOTAL_CORNERS'   // outcomes: OVER | UNDER  (needs line)
  | 'TOTAL_CARDS'     // outcomes: OVER | UNDER  (needs line)
  | 'CORNERS_1H'      // outcomes: OVER | UNDER  — 1st-half corners (period-H1 proof)
  | 'CARDS_1H'        // outcomes: OVER | UNDER  — 1st-half cards   (period-H1 proof)
  | 'BTTS'            // outcomes: YES | NO
  | 'FIRST_SCORER';   // outcomes: HOME | AWAY | NONE

/** The TxLINE stat a market resolves against (used as the validate_stat key). */
export type StatKey =
  | 'GOALS_TOTAL' | 'CORNERS_TOTAL' | 'CARDS_TOTAL'
  | 'CORNERS_1H' | 'CARDS_1H'
  | 'GOALS_HOME' | 'GOALS_AWAY' | 'RESULT' | 'FIRST_SCORER';

export type MarketStatus = 'OPEN' | 'LOCKED' | 'SETTLED' | 'VOID';

export interface PropMarket {
  id: string;
  matchId: string;
  kind: MarketKind;
  label: string;               // e.g. "Total Corners Over/Under 9.5"
  statKey: StatKey;
  line?: number;               // O/U threshold (e.g. 9.5)
  outcomes: string[];          // ordered outcome keys
  pools: Record<string, number>; // outcome key → USDC micro-units staked
  totalPool: number;
  feeBps: number;
  status: MarketStatus;
  escrowPda: string;
  winningOutcome?: string;
  settledAt?: string;
  settlementTx?: string;
  receipt?: SettlementReceipt;
}

/**
 * The verifiable-resolution "receipt": proof that the settlement value came
 * from TxLINE's on-chain-anchored data, not a self-asserted oracle.
 */
export interface SettlementReceipt {
  statKey: StatKey;
  statValue: number;           // the resolved value (e.g. 11 total corners)
  txlineStatKeys: number[];    // the real TxLINE Stats keys this market proves (e.g. [7,8] corners)
  fixtureId: string;
  txlineRecordId: string;      // TxScores.id / seq that carried the final stat
  merkleRoot: string;          // on-chain root the record proves against
  merkleProof: string[];       // sibling hashes
  validateTx: string;          // Solana tx that CPI'd validate_stat
  verifiedAt: string;
  /**
   * TXLINE_ONCHAIN = real TxLINE Merkle proof + validate_stat tx (played match).
   * SIMULATED = the fixture is upcoming so no real proof exists yet; the keeper
   * runs the real path the moment TxLINE publishes the final stat. Being honest
   * about which one it is matters more than pretending.
   */
  source: 'TXLINE_ONCHAIN' | 'SIMULATED';
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

export type SSEMessageType =
  | 'event' | 'match_update' | 'signal' | 'market_update' | 'ping';

export interface SSEMessage {
  type: SSEMessageType;
  data: BozEvent | MatchState | AgentSignal | PropMarket | null;
  ts: string;
  /**
   * True when this event is connect-time HISTORY replay, not a live event.
   * Consumers that must only react to genuinely-live moments (toasts, sounds,
   * VFX, Hi-Lo readings) skip on this flag. Deterministic — replaces the old
   * "is the timestamp older than 8s" heuristic, which silently dropped EVERY
   * live event whenever the client clock disagreed with the server clock.
   */
  catchup?: boolean;
}
