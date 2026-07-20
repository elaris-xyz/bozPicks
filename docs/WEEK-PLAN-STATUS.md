# Improvement week — status & next steps

Post-submission code-hardening pass. Everything below is committed and pushed;
CI (type-check + lint + 71 tests) gates every push.

## Done

| Area | What changed |
| --- | --- |
| **Atomicity** | `predict` route is now one DB transaction with a `SELECT … FOR UPDATE` lock on the market — kills the concurrent-stake pool race (last-writer-wins) and can't charge a vault with no stake recorded. |
| **Real vault (gated)** | `lib/solana.ts` verifies deposits on devnet and signs cash-outs; deposit/withdraw routes + the client build real `SystemProgram.transfer`s. **Dormant** until a treasury is configured, so the live demo is unchanged. |
| **1st-half markets** | `skipUnreliable1H` leaves a CORNERS_1H/CARDS_1H market OPEN instead of settling it wrong when the event stream had gaps (no cumulative H1 snapshot to fall back on). |
| **Track 3 depth** | `lib/clv.ts` — closing-line-value backtest (beat-close rate, de-vig, expected vs realized ROI). |
| **CI / quality** | Lean flat ESLint (`eslint.config.mjs`, 0 errors); CI now runs type-check **+ lint + the test suite** (tests were never run before). Secrets audit clean. |

## What YOU need to do

### To activate the real devnet vault (optional)
A treasury keypair was generated at `treasury.keypair.json` (gitignored).
Pubkey: `2kmkkcBoQ5noGA1gJGuNd8XDhjfNxpgupn9sqNJYpscd`

1. **Fund it** — the automated devnet airdrop failed (flaky default faucet). Use
   https://faucet.solana.com (paste the pubkey) or, with a good RPC:
   `solana airdrop 2 2kmkkcBoQ5noGA1gJGuNd8XDhjfNxpgupn9sqNJYpscd --url <helius-devnet-rpc>`
2. **Set env** (Vercel + Railway):
   - `TREASURY_SECRET_KEY` = the byte array inside `treasury.keypair.json`
   - `NEXT_PUBLIC_TREASURY_ADDRESS` = `2kmkkcBoQ5noGA1gJGuNd8XDhjfNxpgupn9sqNJYpscd`
   - (optional) `TREASURY_LAMPORTS_PER_USD` / `NEXT_PUBLIC_LAMPORTS_PER_USD` — default `1000000` ($1 → 0.001 SOL)
3. **Test** a deposit + cash-out with a real Phantom wallet (needs a human signature — I can't do this).

### Verify
- Check the CI run went green on GitHub after the pushes.

## Day 4 — real on-chain parimutuel: DONE ✅
The deployed settlement program was driven through a full cycle on devnet with
real SPL escrow and **verified**: `create_pool → two players stake USDC →
settle_pool → winner claims +7.84 of an 8.00 pool (2% fee retained); loser's
claim rejected on-chain`. Reproducible anytime:

```
TREASURY_SECRET_KEY="$(cat treasury.keypair.json)" pnpm --filter=keeper onchain:e2e
```

Instructions are built manually (anchor discriminator + borsh) since the program's
IDL isn't published on-chain. The escrow + payout are REAL, not simulated.

### Remaining (optional, needs a wallet): wire it into the UI
The proof shows the program works; routing a *live* market through it from the
web UI (players staking their own wallet USDC, keeper settling, claim button)
is the last mile. It needs a persistent devnet USDC mint + real wallet testing,
so it's a with-you task, not an unattended one.
