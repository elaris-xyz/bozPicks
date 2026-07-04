-- bozPicks database schema

CREATE TABLE IF NOT EXISTS boz_matches (
  id             TEXT PRIMARY KEY,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  home_flag      TEXT,
  away_flag      TEXT,
  home_score     INTEGER DEFAULT 0,
  away_score     INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'SCHEDULED',
  current_minute INTEGER DEFAULT 0,
  kickoff_time   TIMESTAMPTZ NOT NULL,
  current_odds   JSONB,
  last_updated   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boz_events (
  id           TEXT PRIMARY KEY,
  match_id     TEXT NOT NULL REFERENCES boz_matches(id),
  type         TEXT NOT NULL,
  match_minute INTEGER,
  timestamp    TIMESTAMPTZ,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boz_events_match_id ON boz_events(match_id);

CREATE TABLE IF NOT EXISTS boz_replay_events (
  id          TEXT PRIMARY KEY,
  match_id    TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  delay_ms    INTEGER NOT NULL,
  payload     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS boz_replay_match_id ON boz_replay_events(match_id, delay_ms);

CREATE TABLE IF NOT EXISTS boz_signals (
  id                  TEXT PRIMARY KEY,
  match_id            TEXT NOT NULL,
  type                TEXT NOT NULL,
  detected_at         TIMESTAMPTZ NOT NULL,
  odds_before         JSONB,
  odds_after          JSONB,
  delta_percent       NUMERIC(8,4),
  affected_outcome    TEXT NOT NULL,
  confidence          TEXT NOT NULL,
  context             TEXT,
  correlated_event_id TEXT,
  outcome_verified    BOOLEAN DEFAULT FALSE,
  was_accurate        BOOLEAN,
  verified_at         TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS boz_signals_match_id ON boz_signals(match_id);
CREATE INDEX IF NOT EXISTS boz_signals_unverified ON boz_signals(match_id) WHERE outcome_verified = FALSE;

CREATE TABLE IF NOT EXISTS boz_pools (
  match_id         TEXT PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'OPEN',
  pool_home        BIGINT DEFAULT 0,
  pool_draw        BIGINT DEFAULT 0,
  pool_away        BIGINT DEFAULT 0,
  total_pool       BIGINT DEFAULT 0,
  fee_bps          INTEGER DEFAULT 200,
  escrow_pda       TEXT,
  winning_outcome  TEXT,
  settled_at       TIMESTAMPTZ,
  settlement_tx    TEXT
);

CREATE TABLE IF NOT EXISTS boz_predictions (
  id             TEXT PRIMARY KEY,
  match_id       TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  amount_usdc    BIGINT NOT NULL,
  placed_at      TIMESTAMPTZ DEFAULT NOW(),
  escrow_tx      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  payout_amount  BIGINT,
  claim_tx       TEXT
);
CREATE INDEX IF NOT EXISTS boz_predictions_wallet ON boz_predictions(wallet_address);
CREATE INDEX IF NOT EXISTS boz_predictions_match ON boz_predictions(match_id);

CREATE TABLE IF NOT EXISTS boz_explanations (
  id           TEXT PRIMARY KEY,
  match_id     TEXT NOT NULL,
  event_id     TEXT NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  headline     TEXT,
  body         TEXT,
  market_impact TEXT,
  importance   TEXT
);
