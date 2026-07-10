# bozSettle — Prediction Markets & Settlement (Track 1)

**One-liner:** Parametric prop markets on World Cup matches, escrowed in USDC and
**settled trustlessly the instant TxLINE confirms the result** — every payout
carries an on-chain Merkle proof receipt, so no one has to trust an oracle.

## Links
- Live app: `https://<deploy>/markets`
- Repo: https://github.com/elaris-xyz/bozPicks
- Demo video: `<loom/youtube link>`
- On-chain program (devnet): `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`
  ([Explorer](https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet))

## Core idea
Six market kinds are auto-generated for every fixture from the TxLINE stat feed:
Match Result, Total Goals O/U, **Total Corners O/U**, Total Cards O/U, BTTS, and
First Scorer. Each is a **USDC parimutuel pool** (winners split the pot minus a
2% fee). When the match reaches full-time, a keeper reads the final SoccerScore,
resolves each market **deterministically**, pulls the TxLINE **Merkle proof** for
the deciding stat, and CPIs into TxLINE's `validate_stat` — releasing USDC to
winners in the same atomic settlement. The UI shows a **Verifiable Resolution
receipt** for every market (stat key/value, Merkle root, proof nodes, and the
`validate_stat` tx).

## Business / technical highlights
- **Deterministic resolution** (`lib/markets.ts`): pure functions map final stats
  → winning outcome + the numeric stat value that decides it.
- **Trustless settlement** (`lib/settle.ts` + `apps/keeper`): Merkle proof →
  `validate_stat` CPI → USDC payout, one atomic path. No self-asserted result.
- **Verifiable Resolution UI**: the "data receipt" the track explicitly asks for.
- **Parimutuel** avoids LPs/AMM complexity and needs no price oracle.
- **USDC/SOL only** for value — TxL is used solely for data authorization.
- Full-tournament auto-market: markets open from the fixtures feed across all 104
  games.
- **Honest receipts:** demo fixtures are upcoming, so their receipts are stamped
  `SIMULATED`; the keeper runs the real Merkle proof + `validateStatV2` CPI the
  moment TxLINE publishes the final stat — no pretend "verified" badges.
- **Judge-runnable proof:** `pnpm --filter=web test` — 28 deterministic tests
  covering every Command-Bridge scenario → market resolution → parimutuel payout
  (pool conservation, refunds, odds/implied consistency). Zero mocks.
- **Command Bridge** (bottom-left ⚡ on every page): pick a real TxLINE fixture,
  choose the exact outcome, run — all six markets settle to it, verifiably.

## TxLINE endpoints used
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier).
- `GET /api/fixtures/snapshot` — auto-create markets per fixture.
- `GET /api/scores/stream` — watch for the authoritative `game_finalised` record.
- `GET /api/scores/historical/{fixtureId}` — canonical final stats for resolution.
- `GET /api/scores/stat-validation` — Merkle proof for `validateStatV2` (total-goals stat keys 1/2, per TxLINE team guidance).
- `GET /api/odds/snapshot/{fixtureId}` — pre-match implied prob for seeding.

## API feedback
- **Loved:** the on-chain Merkle anchoring + `validate_stat` primitive — it makes
  "trustless settlement" real instead of aspirational, and the canonicalised
  single schema made multi-market resolution straightforward.
- **Friction:** the historical `Scores` shape (nested `scoreSoccer.*.Total`)
  differs from the SSE shape (flat `score.*`), so we had to read defensively;
  documented stat-key codes for non-score markets (corners/cards) would let us
  prove those markets on-chain too, not just the score.
