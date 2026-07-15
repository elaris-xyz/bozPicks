# 🎬 Demo Script — Track 1: Prediction Markets & Settlement (bozSettle)

**Target length:** ≤ 5 minutes · **Page:** `https://boz-picks.vercel.app/markets`
**Recommended run:** Command Bridge → scenario **Home win 2–1** · speed **4×**
(a clear-cut result settles cleanly and is easy to narrate)

---

## Pre-flight (before you hit record)
1. Open `https://boz-picks.vercel.app/markets`.
2. Connect a wallet (Solflare recommended). From the vault chip, **Reset vault
   (demo)**, then **Deposit 100** — so the numbers you show are obviously clean.
3. Have the Solana Explorer devnet tab ready in a second window:
   `explorer.solana.com/?cluster=devnet` (for the on-chain proof moment).
4. One Command Bridge run per video — don't re-run mid-recording.

---

## Scene 1 — The hook (0:00–0:25)
**DO:** Start on `/markets` idle (no live match).
**SAY:**
> "This is bozSettle — prediction markets on World Cup matches that settle
> trustlessly the instant TxLINE confirms the result. No admin, no self-asserted
> outcome — every payout carries an on-chain Merkle proof receipt."

## Scene 2 — Six markets, one fixture (0:25–1:00)
**DO:** Open **⚡ Command Bridge**, pick scenario **Home win 2–1**, speed **4×**,
press **Run**. Point at the six market cards as they appear: Match Result,
Total Goals O/U, Total Corners O/U, Total Cards O/U, BTTS, First Scorer.
**SAY:**
> "The moment a fixture is live, six market kinds auto-generate from the TxLINE
> stat feed — match result, total goals, corners, cards, both-teams-to-score,
> first scorer. Each is a USDC parimutuel pool: everyone who picks correctly
> splits the pot, minus a 2% fee. No liquidity provider needed, no price oracle."

## Scene 3 — Place a stake (1:00–1:45)
**DO:** Click an outcome on **Match Result** (e.g. Home Win). Show the stake
input, confirm with a quick amount (e.g. 10 USDC). Point at the pool bar
growing.
**SAY:**
> "Staking is instant — no wallet pop-up per bet. That's because of our vault:
> one signature funds a devnet game balance, then every stake just debits it.
> Watch the pool bar move — that's the real parimutuel math updating live."

## Scene 4 — Let it run to full time (1:45–2:30)
**DO:** Let the match play at 4× speed. Narrate over the live feed / odds
ticking in the background while markets stay open.
**SAY:**
> "While the match plays, markets stay open and odds-implied probabilities move
> with every goal and card — all driven by the same live TxLINE stream powering
> the rest of the product."

## Scene 5 — Settlement + the Verifiable Resolution receipt (2:30–3:45)
**DO:** Wait for full time. Point at a settled market card — click to expand the
**Receipt**. Zoom on the stat key, Merkle root, proof nodes, and the
`validate_stat` transaction reference.
**SAY:**
> "Full time — and every market settles deterministically. This receipt is the
> 'verifiable resolution' the track explicitly asks for: the exact TxLINE stat
> key and value that decided the market, the Merkle root, the proof path, and
> the on-chain `validateStatV2` call that checked it. No one has to trust us —
> they can check the proof themselves."

## Scene 6 — Honesty: SIMULATED vs on-chain (3:45–4:15)
**DO:** Point to the receipt's source label (Simulated / On-chain verified).
**SAY:**
> "We label every receipt honestly. Fixtures that are upcoming settle in demo
> mode and are stamped SIMULATED — no pretend 'verified' badge. Our keeper runs
> the real Merkle proof and `validateStatV2` CPI the moment TxLINE publishes a
> genuine final stat. That distinction matters for a settlement product."

## Scene 7 — Proof it's real: on-chain program + tests (4:15–4:50)
**DO:** Switch to the Explorer tab, show the deployed program
(`GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`) on devnet. Mention the test
suite.
**SAY:**
> "The settlement program is deployed on Solana devnet — here it is on Explorer.
> And every resolution path is covered by 35 deterministic tests judges can run
> themselves with `pnpm test` — zero mocks, the exact functions the keeper uses
> in production."

## Scene 8 — Close (4:50–5:00)
**SAY:**
> "That's bozSettle: six auto-generated markets, instant parimutuel staking, and
> settlement that anyone can independently verify against TxLINE's own proof.
> Thanks for watching."

---

## Say-once for the submission form
- **TxLINE endpoints:** `POST /auth/guest/start`, `POST /api/token/activate`,
  `GET /api/fixtures/snapshot`, `GET /api/scores/stream?fixtureId=` (final
  score / `game_finalised`), `GET /api/scores/stat-validation` (Merkle proof) →
  on-chain CPI into `validateStatV2`.
- **On-chain program (devnet):** `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`
  ([Explorer](https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet))
- **Repo:** github.com/elaris-xyz/bozPicks · **Live:** boz-picks.vercel.app/markets
