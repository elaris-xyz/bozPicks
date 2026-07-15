-- bozPicks — vault: track lifetime STAKED and WITHDRAWN totals
--
-- The vault UI shows Deposited / Won / Balance, but not how much has been
-- staked or cashed out — so a viewer can't visually check
-- "deposited − staked + won − withdrawn = balance" the way they can already
-- check deposited/won. Add the two missing lifetime counters, mirroring how
-- deposited_micro/won_micro already work, and backfill from the ledger (the
-- durable source of truth) so existing vaults reconcile immediately.

ALTER TABLE boz_vault ADD COLUMN IF NOT EXISTS staked_micro    BIGINT NOT NULL DEFAULT 0;
ALTER TABLE boz_vault ADD COLUMN IF NOT EXISTS withdrawn_micro BIGINT NOT NULL DEFAULT 0;

UPDATE boz_vault v SET
  staked_micro    = COALESCE((SELECT -SUM(amount_micro) FROM boz_vault_ledger WHERE wallet_address = v.wallet_address AND kind = 'STAKE'), 0),
  withdrawn_micro = COALESCE((SELECT -SUM(amount_micro) FROM boz_vault_ledger WHERE wallet_address = v.wallet_address AND kind = 'WITHDRAW'), 0);
