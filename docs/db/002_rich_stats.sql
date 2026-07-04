-- bozPicks — rich TxLINE stats + parametric prop markets (Track 1)

-- Live stats snapshot + competition on matches
ALTER TABLE boz_matches ADD COLUMN IF NOT EXISTS competition    TEXT;
ALTER TABLE boz_matches ADD COLUMN IF NOT EXISTS competition_id INTEGER;
ALTER TABLE boz_matches ADD COLUMN IF NOT EXISTS stats          JSONB;

-- Parametric prop markets (Total Corners/Goals/Cards O/U, BTTS, First Scorer)
CREATE TABLE IF NOT EXISTS boz_markets (
  id              TEXT PRIMARY KEY,
  match_id        TEXT NOT NULL,
  kind            TEXT NOT NULL,           -- MarketKind
  label           TEXT NOT NULL,
  stat_key        TEXT NOT NULL,           -- StatKey the market resolves against
  line            NUMERIC,                 -- O/U threshold (nullable)
  outcomes        JSONB NOT NULL,          -- ordered outcome keys
  pools           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- outcome → USDC micro
  total_pool      BIGINT NOT NULL DEFAULT 0,
  fee_bps         INTEGER NOT NULL DEFAULT 200,
  status          TEXT NOT NULL DEFAULT 'OPEN',
  escrow_pda      TEXT,
  winning_outcome TEXT,
  settled_at      TIMESTAMPTZ,
  settlement_tx   TEXT,
  receipt         JSONB,                   -- SettlementReceipt (proof + validate tx)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boz_markets_match  ON boz_markets(match_id);
CREATE INDEX IF NOT EXISTS boz_markets_status ON boz_markets(status);

-- Predictions can now target a specific prop market (NULL = legacy 1X2 pool)
ALTER TABLE boz_predictions ADD COLUMN IF NOT EXISTS market_id TEXT;
CREATE INDEX IF NOT EXISTS boz_predictions_market_id ON boz_predictions(market_id);
