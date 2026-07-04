# bozPicks — Strategy to win 1st in all three tracks

> Goal: 1st place ×3 = **32,000 USDT** (12k + 10k + 10k). One monorepo, three
> focused submissions. Deadline **2026-07-19 23:59 UTC**. See
> [TXLINE-REFERENCE.md](./TXLINE-REFERENCE.md) for every endpoint/field.

## The core insight

Each track scores on **different** criteria and is judged **heavily on the demo
video**. So we don't build "one app three times" — we build **one data core**
(rich TxLINE ingest + replay engine) and **three sharply-focused hero features**,
each nailing its track's rubric. The base sportsbook is table stakes; it does not
win on its own ("repackaging existing feeds"). Each track needs one *original*,
*complete*, *demo-able* thing.

Competition reality (live submissions): **Consumer = 4, Trading = 8, Prediction =
17.** Consumer is the softest 10k; Prediction is the richest but hardest.

## Foundation to build first (shared, unblocks all 3)

1. **Rich ingest** — extend `packages/txline-client` + ingest to capture the full
   soccer schema: corners, cards, half scores, possession + danger state,
   goalscorer/PlayerId, lineups, `Pct`, multi-bookmaker, `SuperOddsType` markets.
   (Ref §5.)
2. **Replay engine** — re-emit `/api/scores/historical` + `/api/odds/snapshot?asOf=`
   through our SSE at 1×/8×/60×. Makes every demo show a "live" match on command.
   (Ref §7.) **This is the single highest-leverage build** — it de-risks all three
   demo videos.
3. **Merkle proof fetch + verify** helper — pull a score proof, CPI `validate_stat`,
   surface the "receipt". Powers Track 1's differentiator.

---

## 🟢 Track 2 — Consumer & Fan Experiences (bozPicks) — EASIEST 1st (4 rivals)

Rubric: fan UX, real-time responsiveness, **originality**, monetization, completeness.

**Hero (pick ONE original experience, polish to completion):**
- **Hi-Lo Stats Game** — "Will the next stat (corners / possession / shots) be
  higher or lower?" Guess before each TxLINE update, build a streak, share score,
  replayable across 104 games. Directly uses the unused rich stats + possession.
  This is *new*, replayable, and screenshots beautifully. **Recommended flagship.**
- **Group Sweepstake** — friends get assigned teams; leaderboard updates live from
  TxLINE instead of a spreadsheet. Strong social/monetization angle.
- **AI Pundit** (we already have Claude Haiku) — on goal/red card/big odds shift,
  auto-explain "what happened + what the market now thinks," with TTS. Ship as a
  Telegram bot AND an on-page live-commentary rail.

**Supporting polish (real-time responsiveness):** live possession/danger meter,
win-probability gauge from `Pct` that swings on goals, goalscorer names from
lineups. Wallet signup via Solana (required).

**Monetization story (they grade it):** freemium — free scores, premium
predictions/pundit; sponsor-able sweepstakes.

**Demo (≤5 min):** open during a replayed match → Hi-Lo streak → live pundit
explains a goal → win-prob swings → share card. Say "powered by TxLINE" and show
which endpoints.

---

## 🟣 Track 3 — Trading Tools & Agents (bozAgent) — 8 rivals

Rubric: data ingestion, **fully autonomous**, deterministic logic/architecture,
innovation, production-readiness (a real trading desk could deploy it).

**Hero: Agent-vs-Agent Arena.** Two autonomous agents read the same TxLINE feed,
run opposite strategies (e.g. momentum vs mean-reversion on `StablePrice`/`Pct`
moves), open notional positions, and **settle on-chain**; the better strategy
compounds over the tournament. Visual, novel, obviously autonomous.

**Upgrade the Sharp Detector we already have:**
- Multi-bookmaker steam detection (per-book divergence, not one source).
- Signal on multiple `SuperOddsType` markets (O/U, cards), not just 1X2.
- **CLV tracking** — compare signal odds vs closing odds via `asOf` snapshots.
- **Backtest** over `/api/odds/*` history to prove the edge is real.
- **In-Play Market Maker** mode: quote buy/sell around `Pct`, widen on danger state.

**Production-readiness signals judges want:** deterministic, well-documented
strategy math; runs headless with no human input; reconnect/backoff on SSE;
`/api/agents/stats` shows live accuracy + CLV. Package as a standalone tool.

**Demo:** start the agents → watch signals fire on a replayed match → show the
accuracy/CLV dashboard → positions settling on devnet. Emphasize "no human in the
loop."

---

## 🔵 Track 1 — Prediction Markets & Settlement (bozSettle) — RICHEST (12k), 17 rivals

Rubric: ingest TxLINE, UX/use case, **clean deterministic resolution + trustless
validation via Merkle proofs**. Ideas the sponsor literally lists: full-tournament
auto-market, **verifiable resolution UI (show the proof receipt)**, parametric
prop bets ("Team A corners + Team B corners > 10").

**Hero: parametric prop-bet markets settled by Merkle proof.**
- Markets beyond 1X2 using rich stats: **Total Corners O/U, Total Goals O/U, BTTS,
  First Scorer, Total Cards** — parimutuel pools in **USDC** escrowed in a PDA
  (never TxL — §8).
- **Trustless settlement:** keeper watches `scores/stream`; on `gameState=F` it
  fetches `/api/scores/historical` + the **Merkle proof**, CPIs `validate_stat`,
  and releases USDC to winners. We already have the parimutuel program + CPI wired
  (PLAN.md) — extend it to multi-stat markets.
- **Verifiable Resolution UI (the differentiator):** for every settled market show
  the data "receipt" — the proof + on-chain validation tx — so users trust the
  outcome without an external oracle. The sponsor says this is "highly valued."
- **Full-tournament auto-market:** auto-create/display/resolve standard markets
  across all 104 fixtures from the fixtures feed.

**Demo:** create a "corners > 10" market → replay the match to full-time → keeper
auto-settles via Merkle proof → show the on-chain validation receipt + USDC payout
on Explorer. This hits every rubric point.

---

## Sequencing (≈15 days)

1. **Days 1–4 (foundation):** rich ingest + **replay engine** + Merkle-proof helper.
2. **Days 5–7 (Track 2):** Hi-Lo game + live pundit/possession/win-prob. *(Softest
   track — bank a 1st early.)*
3. **Days 8–11 (Track 1):** multi-stat prop markets + USDC parimutuel + Verifiable
   Resolution UI + keeper auto-settle.
4. **Days 12–13 (Track 3):** Agent Arena + CLV/backtest + market-maker mode.
5. **Days 14–15:** deploy 3 subdomains, record **3 demo videos**, write 3 tech
   docs (idea + endpoints used + API feedback), submit ×3.

## Non-negotiables (auto-DQ if missed)

- Demo video ≤5 min per track (mandatory to pass screening).
- Working deployed/devnet link + public repo per submission.
- TxLINE as the primary data source; list the exact endpoints used.
- Payouts in **USDC/SOL only** — never TxL. Settlement via Merkle proof, not a
  self-asserted result.
- Solana wallet signup on the consumer product.
