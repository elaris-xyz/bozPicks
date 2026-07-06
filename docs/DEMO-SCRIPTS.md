# Demo scripts — what each track shows the judge

One monorepo, three separate submissions. Each track has its own landing and its
own ≤5-min video. Since real matches end before judging, everything is driven by
the **global Run Demo control** (bottom of the screen) — pick a speed (1×–8×) and
a full World-Cup match (Brazil vs Argentina, ~26 events) plays live: goals,
corners, cards, a red card, odds moves, possession/danger. For a video, record at
**1× or 2×** (natural pace); for quick judging use 4×/8×.

Big moments (goal / red card / full-time) get a full-screen cinematic effect +
sound; every other event flows into the feed / timeline / stats. Sound toggle is
bottom-right.

---

## 🔵 Track 2 — Consumer & Fan Experiences (bozPicks)
**Link:** `picks.<domain>` → `/` (and `/play`)

**What to show (shot list):**
1. **Home `/`** — live ticker, match grid, the hero. Hit **Run Demo (2×)**. A match
   goes LIVE in the grid; a goal fires the cinematic celebration + sound.
2. **`/play`** — the fan experience:
   - **Hi-Lo game** — guess whether possession swings higher/lower before the next
     TxLINE reading. Get a few right → the streak counter catches fire, "+1" pops,
     sound plays. Miss → the card shakes. Hit **Share**.
   - **Win-probability gauge** — swings the instant the market reacts to the goal /
     red card.
   - **Momentum panel** — live possession, danger state, corners, cards.
   - **AI Pundit** — live commentary typing out on each event; toggle **Voice** for TTS.
3. Point out the wallet **Connect** (Solana sign-in).

**What it proves:** fan UX + polish, real-time responsiveness, an *original*
replayable format (Hi-Lo), a monetization path (freemium / premium), a complete
end-to-end product.

---

## 🟢 Track 1 — Prediction Markets & Settlement (bozSettle)
**Link:** `settle.<domain>` → `/markets`

**What to show (shot list):**
1. **`/markets`** — six auto-generated prop markets: Match Result, Total Goals O/U,
   **Total Corners O/U**, Total Cards O/U, BTTS, First Scorer — each a **USDC
   parimutuel** pool with live odds.
2. (Optional) **Connect wallet**, tap an outcome to stake 5 USDC — the pool updates
   live over SSE.
3. Hit **Run Demo (2×)**. Markets are OPEN and react as the match plays.
4. **At full-time** every market **auto-settles**. Open one and show the
   **Verifiable Resolution receipt**: the resolved stat (e.g. Corners = 9), the
   TxLINE record id, the **Merkle root + proof**, and the **`validate_stat` tx** —
   the outcome is proven, not asserted by us.
5. Mention the deployed Anchor program (devnet) + keeper that CPIs `validate_stat`.

**What it proves:** ingests TxLINE, **deterministic** resolution, **trustless
Merkle settlement** with a user-visible receipt (the differentiator the sponsor
explicitly rewards), USDC-only value (never the TxL data token).

---

## 🟣 Track 3 — Trading Tools & Agents (bozAgent)
**Link:** `agent.<domain>` → `/agent`

**What to show (shot list):**
1. **`/agent`** — the stats grid (signals, accuracy, high-confidence) and the
   **Agent-vs-Agent Arena**: Momentum (rides the move) vs Contrarian (fades it).
2. Hit **Run Demo (2×)**. With no human input:
   - both agents **autonomously open positions** on each significant odds move;
   - **live mark-to-market P&L** + **equity-curve sparklines** diverge in real time;
   - the **tug-of-war bar** shows who's ahead;
   - a **sharp-move signal** toast fires on the red card.
3. **At full-time** the agents settle: realized P&L, **win%**, and **CLV** (did each
   bet beat the closing line). Note the **career P&L compounds** across matches, so
   the better strategy pulls ahead over the tournament.
4. Show **Export CSV** of signals.

**What it proves:** clean data ingestion, **fully autonomous** operation,
deterministic + defensible strategy logic, genuine **innovation** (opposed-strategy
arena + CLV), and production-readiness (reconnecting SSE, live `/api/agents/stats`).

---

## Submission checklist (per track)
- Demo video ≤5 min (mandatory) — use the shot list above.
- Public repo: https://github.com/elaris-xyz/bozPicks
- Deployed link (subdomain or deep link).
- Tech doc — see `docs/submissions/trackN-*.md` (idea + endpoints used + API feedback).
- Value: **USDC/SOL only**, settlement via Merkle proof.

See also: [TXLINE-REFERENCE.md](./TXLINE-REFERENCE.md) · [WINNING-STRATEGY.md](./WINNING-STRATEGY.md).
