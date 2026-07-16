# bozSettle — Prediction Markets & Settlement (Track 1)

**One-liner:** Parametric prop markets on World Cup matches, escrowed in USDC and
**settled trustlessly the instant TxLINE confirms the result** — every payout
carries an on-chain Merkle proof receipt, so no one has to trust an oracle.

## Links
- Live app: https://boz-picks.vercel.app/markets
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
- **Vault-backed stakes:** users deposit devnet SOL once into the vault and
  stake instantly (Postgres ledger + on-chain reconciliation) — no per-bet
  wallet friction, clean cash-out path.
- **Judge-runnable proof:** `pnpm --filter=web test` — 35 deterministic tests
  covering every Command-Bridge scenario → market resolution → parimutuel payout
  (pool conservation, refunds, odds/implied consistency). Zero mocks.
- **Command Bridge** (bottom-left ⚡ on every page): pick a real TxLINE fixture,
  choose the exact outcome, run — all six markets settle to it, verifiably.

## Settlement path (the real one)
1. Select the decisive record: `Action = game_finalised` (statusId 100; the
   ScoreStat leaf carries `period = 100`, the finalisation marker — not the
   period-prefix 0/Total) — never an in-play/90-minute record. This already
   accounts for ET + penalties.
2. Prove the deciding stat via `GET /api/scores/stat-validation?fixtureId=&seq=
   &statKey=…` and CPI into **validateStatV2**, reading the returned bool. The
   keeper currently anchors the on-chain proof on the total-goals stat
   (participant-1, key 1); validateStatV2's two-stat form (`stat_b` + `op`) is
   the natural extension to co-prove both goals in one call.
3. Each market's DECIDING TxLINE Stats keys (team-confirmed legend, goals 1/2,
   yellow 3/4, red 5/6, corners 7/8) are shown on every receipt: winner/goals/
   BTTS → 1,2 · corners → 7,8 · cards → 3,4,5,6 — so a judge sees exactly which
   on-chain-provable stat resolves each market.
4. Leaf format we reproduce locally (`lib/statproof.ts`, unit-tested):
   `sha256(u32_le(key) ‖ i32_le(value) ‖ i32_le(period))`, folded by
   `is_right_sibling` — so a real proof is verifiable client-side too, not just
   trusted from the feed.

**Data-licence note:** our judge demo replays a *synthetic, deterministic*
match (no recorded TxLINE data is bundled or redistributed), so it stays within
§7.1 "use" and never ships the feed's data.

**Abandoned matches:** phase codes 14/15/16/19 aren't carried in the proven
ScoreStat leaf, so an abandoned fixture can't be settled trustlessly — we fall
back to a full refund rather than an oracle switch.

## TxLINE endpoints used
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier,
  devnet host `txline-dev.txodds.com`; same network for tx + JWT + activation).
- `GET /api/fixtures/snapshot` — auto-create markets per fixture.
- `GET /api/scores/stream` — watch for the authoritative `game_finalised` record.
- `GET /api/scores/historical/{fixtureId}` — canonical final stats for resolution.
- `GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=` — Merkle proof for
  `validateStatV2` (goals 1,2 · corners 7,8 · cards 3,4,5,6).
- `GET /api/odds/snapshot/{fixtureId}` — pre-match implied prob for seeding.

## API feedback
- **Loved:** the on-chain Merkle anchoring + `validate_stat` primitive — it makes
  "trustless settlement" real instead of aspirational, and the confirmed
  stat-key legend let us prove corners/cards on-chain too, not just the score.
  CPI into `validateStatV2` verified at ~55–175k CU, well under the 1.4M ceiling,
  leaving room for our own escrow logic.
- **Friction:** the stat-key legend (period prefixes 1000–7000, base keys 1–8)
  and the Merkle leaf spec weren't in the public docs — we relied on the team's
  channel answers. A dedicated **phase/status proof** (abandoned vs finished) and
  documented **correction semantics** (is `game_finalised` exactly-once? do
  corrections carry strictly-increasing timestamps?) would let settlement handle
  edge cases trustlessly instead of with a refund/timeout fallback.
