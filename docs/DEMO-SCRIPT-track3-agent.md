# 🎬 Demo Script — Track 3: Trading Tools & Agents (bozAgent)

**Target length:** ≤ 5 minutes · **Page:** `https://boz-picks.vercel.app/agent`
**Recommended run:** Command Bridge → scenario **Away win 0–2** or **Draw 1–1**
· speed **4×** (a scenario with a mid-match red card / big odds swing shows the
detector at its best — "Home win 2–1" also works well)

---

## Pre-flight (before you hit record)
1. Open `https://boz-picks.vercel.app/agent`.
2. No wallet/vault needed for this track — the agent runs headless regardless.
3. One Command Bridge run per video — don't re-run mid-recording.

---

## Scene 1 — The hook (0:00–0:25)
**DO:** Start on `/agent` idle, pointing at the live stats banner (signal count,
accuracy, confidence mix — even at zero/idle it's a real, wired dashboard).
**SAY:**
> "This is bozAgent — autonomous trading tools built on TxLINE's live odds and
> scores. Everything on this page is driven by a real headless process, not a
> mocked-up UI. Let me show you the odds stream first-hand."

## Scene 2 — Kick off a live match (0:25–0:55)
**DO:** Open **⚡ Command Bridge**, pick a scenario, speed **4×**, press **Run**.
**SAY:**
> "I'll run a real TxLINE-shaped match through the Command Bridge — same replay
> engine, same event stream the agent consumes in production. This is exactly
> what it looks like when odds are actually moving."

## Scene 3 — The autonomous detection pipeline (0:55–1:40)
**DO:** Point at **AgentPipeline** (the detection-loop visual).
**SAY:**
> "This is the pipeline: the headless process — `apps/agent`, running as its own
> service — subscribes to the live odds stream, tracks a rolling window, and
> flags any implied-probability shift above threshold as a sharp-move signal.
> Fully event-driven, zero manual input once deployed."

## Scene 4 — Signals landing live (1:40–2:20)
**DO:** Watch a goal or red card fire; point at a new entry appearing in
**Active signals** with its confidence badge (HIGH/MEDIUM/LOW) and delta %.
**SAY:**
> "There — a signal just fired. HIGH confidence, the direction, the percentage
> move, and a timestamp. Later, once the market closes, we verify whether each
> signal actually predicted the right side — that's the accuracy number in the
> banner up top, not a vanity metric."

## Scene 5 — What The Agent Saw (2:20–3:15)
**DO:** Scroll to the **What The Agent Saw** momentum chart. Point at the orange
bolt markers pinned to the wave, hover one to show the tooltip.
**SAY:**
> "This is unique to us: the same broadcast pressure wave you'd see on a fan
> page, but overlaid with the detector's actual calls. Each bolt is a real
> sharp-move signal pinned to the exact minute — so you can see, at a glance,
> *why* the market moved: a goal, a red card, a shift in pressure. It's market
> analysis grounded in the pitch data, not just a number in a table."

## Scene 6 — Agent-vs-Agent Arena (3:15–4:10)
**DO:** Scroll to the **Arena**. Point at the two strategies — MOMENTUM and
CONTRARIAN — their live P&L, bet count, win rate.
**SAY:**
> "And this is the Arena: two fully autonomous agents reading the same feed with
> opposite theses. MOMENTUM rides every significant odds move, CONTRARIAN fades
> it. Both open notional positions on their own, settle automatically at full
> time, and compound P&L across matches — so the better strategy provably pulls
> ahead over the tournament, not by our say-so but by the numbers."

## Scene 7 — Production-readiness signals (4:10–4:45)
**DO:** Point briefly at repeated-signal aggregation (the ×N badge for stacked
same-direction calls) and mention the live API.
**SAY:**
> "A few production details: repeated calls in the same direction aggregate into
> one stance with a multiplier badge, so a desk can read market posture at a
> glance instead of scrolling noise. And every number here is also exposed at
> `/api/agents/stats` — a real endpoint a trading desk could poll directly, no
> scraping required."

## Scene 8 — Close (4:45–5:00)
**SAY:**
> "That's bozAgent: a genuinely autonomous detector, a novel agent-vs-agent
> benchmark, and market analysis that's grounded in the same live pitch data
> driving the rest of the product. Thanks for watching."

---

## Say-once for the submission form
- **TxLINE endpoints:** `POST /auth/guest/start`, `POST /api/token/activate`,
  `GET /api/odds/stream` (core signal — live consensus StablePrice moves),
  `GET /api/odds/snapshot/{fixtureId}` with `asOf` (closing line for CLV),
  `GET /api/scores/stream?fixtureId=` (result for settlement + verification).
- **Headless process:** `apps/agent` — runs independently of the browser tab;
  `/api/agents/stats` and `/api/agents/signals` are its live public API.
- **Repo:** github.com/elaris-xyz/bozPicks · **Live:** boz-picks.vercel.app/agent
