-- bozPicks — in-game vault economy (deposit once, stake instantly, cash out)
--
-- The vault is a devnet game balance: the user signs ONE Solana transaction to
-- deposit, then stakes debit the balance with no further signing (frictionless
-- gameplay), and a withdraw signs once to cash back out. Balances are USDC
-- micro-units (1 USDC = 1_000_000). Devnet + simulated USDC — no real funds.

CREATE TABLE IF NOT EXISTS boz_vault (
  wallet_address  TEXT PRIMARY KEY,
  balance_micro   BIGINT NOT NULL DEFAULT 0,   -- spendable game balance
  deposited_micro BIGINT NOT NULL DEFAULT 0,   -- lifetime deposited (for stats)
  won_micro       BIGINT NOT NULL DEFAULT 0,   -- lifetime winnings credited
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Every balance movement, newest-first — powers the vault activity list and
-- keeps the economy auditable.
CREATE TABLE IF NOT EXISTS boz_vault_ledger (
  id             TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  kind           TEXT NOT NULL,               -- DEPOSIT | STAKE | WIN | REFUND | WITHDRAW
  amount_micro   BIGINT NOT NULL,             -- signed: + credit, - debit
  balance_after  BIGINT NOT NULL,
  ref            TEXT,                         -- market id / label
  tx_sig         TEXT,                         -- on-chain anchor (deposit/withdraw)
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boz_vault_ledger_wallet ON boz_vault_ledger(wallet_address, created_at DESC);
