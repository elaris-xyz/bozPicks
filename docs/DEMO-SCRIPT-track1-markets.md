# 🎬 Demo Script — Track 1: Prediction Markets & Settlement (bozSettle)

**Target length:** ≤ 5 minutes · **Page:** `https://boz-picks.vercel.app/markets`
**Recommended run:** Command Bridge → scenario **Home win 2–1** · speed **4×**
(a clear-cut result settles cleanly and is easy to narrate)

> **Real match vs. demo:** if a real World Cup fixture happens to be live when
> you record, `/markets` now builds its own six-market board for it
> automatically the moment you load the page — no Command Bridge needed, and
> the receipts are real (not `SIMULATED`). If nothing is live, the Command
> Bridge replay below is the fallback and is what these cues assume.

---

## Pre-flight (before you hit record)
1. Open `https://boz-picks.vercel.app/markets`.
2. Connect a wallet (Solflare recommended — Phantom's devnet RPC is flaky).
3. Open the **Game Vault** chip in the nav. Hit **Reset vault (demo)**, then
   **Deposit 100** — so the numbers you show are obviously clean, and the new
   "how this adds up" tiles start from a simple story.
4. Have the Solana Explorer devnet tab ready in a second window:
   `explorer.solana.com/?cluster=devnet` (for the on-chain proof moment).
5. One Command Bridge run per video — don't re-run mid-recording.

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
> splits the pot, minus a 2% fee. No liquidity provider needed, no price oracle.
> And this isn't demo-only plumbing — the exact same board now builds itself
> for any real fixture the instant it kicks off, so a judge watching this on a
> live match day sees identical behavior, no simulated fallback required."

## Scene 3 — Place a stake, premium and instant (1:00–1:45)
**DO:** Click an outcome on **Match Result** (e.g. Home Win). Point at the
button lighting up with a gold **YOU** chip the instant you tap it, and the
brief spinner where the odds number sits while the stake lands. Then point at
the pool bar growing.
**SAY:**
> "Staking is instant — no wallet pop-up per bet. That's because of our vault:
> one signature funds a devnet game balance, then every stake just debits it.
> Notice the button responds the moment you tap — that gold badge is your pick,
> confirmed. Watch the pool bar move — that's the real parimutuel math updating
> live, and the **Order Flow** rail on the right shows every stake landing in
> real time, yours included."

## Scene 4 — Let it run to full time (1:45–2:30)
**DO:** Let the match play at 4× speed. Narrate over the live feed / odds
ticking in the background while markets stay open.
**SAY:**
> "While the match plays, markets stay open and odds-implied probabilities move
> with every goal and card — all driven by the same live TxLINE stream powering
> the rest of the product."

## Scene 5 — Settlement + the Verifiable Resolution receipt (2:30–3:45)
**DO:** Wait for full time — point at the **checkered-flag** full-time banner.
Point at a settled market card → click to expand the **Receipt**. Zoom on the
stat key, Merkle root, proof nodes, and the `validate_stat` transaction
reference.
**SAY:**
> "Full time — and every market settles deterministically. This receipt is the
> 'verifiable resolution' the track explicitly asks for: the exact TxLINE stat
> key and value that decided the market, the Merkle root, the proof path, and
> the on-chain `validateStatV2` call that checked it. No one has to trust us —
> they can check the proof themselves."

## Scene 6 — Honesty: SIMULATED, then the REAL proof (3:45–4:30)
**DO:** First point to the receipt's `SIMULATED` label. Then scroll up to the
**"Verify a real result"** card and click **Verify England v Argentina live**.
Wait ~1s for the rows to turn green.
**SAY:**
> "We label every receipt honestly — the synthetic demo match settles SIMULATED,
> no pretend 'verified' badge. But here's the real thing: this pulls a *played*
> World Cup fixture — England 1–2 Argentina — its actual TxLINE Merkle proof,
> live, right now, and re-folds it in the browser to reproduce TxLINE's own
> committed root. Both goal stats check out — key 1 equals 1, key 2 equals 2,
> period 100 from the finalised record. That's a real cryptographic proof of a
> real result, verified against TxLINE's own cryptography, not our word."

## Scene 7 — Proof it's real: on-chain program + tests (4:15–4:50)
**DO:** Switch to the Explorer tab, show the deployed program
(`GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`) on devnet. Mention the test
suite.
**SAY:**
> "The settlement program is deployed on Solana devnet — here it is on Explorer.
> And every resolution path is covered by 71 deterministic tests judges can run
> themselves with `pnpm test` — zero mocks, the exact functions the keeper uses
> in production. We stress-tested the accounting ourselves too: staking across
> every market, running settlement, and reconciling the vault to the last cent
> before we ever put this in front of you."

## Scene 8 — Close (4:50–5:00)
**SAY:**
> "That's bozSettle: six auto-generated markets, instant parimutuel staking, and
> settlement that anyone can independently verify against TxLINE's own proof.
> Thanks for watching."

---

## What's new since the last pass (context for you, not to read aloud)
- **Real fixtures now build their own market board** — previously only demo
  runs created markets, so `/markets` sat empty during an actual live game.
  Now the first person to load the page while a match is LIVE creates it.
- **A board can never mix two matches' cards anymore.** There was a bug where
  a finished real fixture's settled markets and a fresh demo's open ones
  rendered together (12 cards instead of 6, pool totals summed across both).
  Fixed at the source — the page always resolves to exactly one match, the
  same one Hi-Lo/Pundit/the header agree on.
- **Outcome buttons and the Order Flow rail got a full visual pass** — gradient
  fills, a glowing top edge, a soft glow behind the odds number, a shine sweep
  on hover, matching the same premium treatment the match page's odds
  selector already used. The **YOU** pick badge is now a gold chip instead of
  plain blue, and every button shows an immediate spinner the instant you tap
  it so a slow network round trip never reads as "did my click even land."
- **The "Full time" icon is a checkered flag** now, not a whistle that read as
  a wrench at small size.

---

## Say-once for the submission form
- **TxLINE endpoints:** `POST /auth/guest/start`, `POST /api/token/activate`,
  `GET /api/fixtures/snapshot`, `GET /api/scores/stream?fixtureId=` (final
  score / `game_finalised`), `GET /api/scores/stat-validation` (Merkle proof) →
  on-chain CPI into `validateStatV2`.
- **On-chain program (devnet):** `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`
  ([Explorer](https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet))
- **Repo:** github.com/elaris-xyz/bozPicks · **Live:** boz-picks.vercel.app/markets
