# 🎬 Demo Script — Track 3: Trading Tools & Agents (bozAgent)

**Target length:** ≤ 5 minutes · **Page:** `https://boz-picks.vercel.app/agent`
**Recommended run:** Command Bridge → scenario **Away win 0–2** or **Draw 1–1**
· speed **4×** (a scenario with a mid-match red card / big odds swing shows the
detector at its best — "Home win 2–1" also works well)

> **Real match vs. demo:** the agent is a headless service — it reacts to
> whatever's live automatically, no Command Bridge involved, on a real
> fixture. If nothing is live when you record, the Command Bridge replay
> below is the fallback and is what these cues assume.

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
> what it looks like when odds are actually moving. On a real fixture this is
> automatic too — we recently fixed the odds feed so it stays live per-match
> instead of going quiet, which is what made the arena come alive in the first
> place."

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
> move, and a timestamp. Once the match ends, we verify whether each signal
> actually predicted the right side against the real final result — that's the
> accuracy number in the banner up top, not a vanity metric. Watch it update the
> moment this match settles."

## Scene 5 — Tune it live, no redeploy (2:20–2:55)
**DO:** Open **Agent Config**, drag the **Sharp Move Threshold** slider a few
points. Point at the "Live control" line turning into a green "Saved" check.
**SAY:**
> "And here's a production-readiness detail most hackathon agents don't have:
> this isn't a cosmetic slider. Moving it writes straight to the running
> service — no redeploy, no restart. The headless agent picks up the new
> threshold within about five seconds. A real trading desk needs to retune
> sensitivity without taking the bot offline, so that's exactly how we built
> it."

## Scene 6 — What The Agent Saw (2:55–3:35)
**DO:** Scroll to the **What The Agent Saw** momentum chart. Point at the orange
bolt markers pinned to the wave, hover one to show the tooltip.
**SAY:**
> "This is unique to us: the same broadcast pressure wave you'd see on a fan
> page, but overlaid with the detector's actual calls. Each bolt is a real
> sharp-move signal pinned to the exact minute — so you can see, at a glance,
> *why* the market moved: a goal, a red card, a shift in pressure. It's market
> analysis grounded in the pitch data, not just a number in a table."

## Scene 7 — Agent-vs-Agent Arena (3:35–4:20)
**DO:** Scroll to the **Arena**. Point at the two strategies — MOMENTUM and
CONTRARIAN — their live P&L, bet count, win rate, and the **Tournament leader**
label.
**SAY:**
> "And this is the Arena: two fully autonomous agents reading the same feed with
> opposite theses. MOMENTUM rides every significant odds move, CONTRARIAN fades
> it. Both open notional positions on their own, settle automatically at full
> time, and compound P&L across matches — so the better strategy provably pulls
> ahead over the tournament, not by our say-so but by the numbers."

## Scene 8 — Close (4:20–5:00)
**DO:** Point briefly at the `/api/agents/stats` endpoint (open it in a second
tab) and the **Export CSV** button.
**SAY:**
> "A few production details: every number on this page is also exposed at
> `/api/agents/stats` — a real endpoint a trading desk could poll directly, no
> scraping required — and the full signal history exports to CSV on demand.
> That's bozAgent: a genuinely autonomous detector, a novel agent-vs-agent
> benchmark, a config a desk can retune live, and market analysis that's
> grounded in the same live pitch data driving the rest of the product. Thanks
> for watching."

---

## What's new since the last pass (context for you, not to read aloud)
- **Signal verification actually completes now, for demo AND real matches.**
  The old code asked TxLINE's REST API for the final score of every match
  including demo ones — which always 404s for a fake fixture id, so every
  demo-run signal stayed unverified forever and Accuracy showed "—"
  permanently. Demo matches now verify against their own final score straight
  from the MATCH_END event; real fixtures still use the authoritative TxLINE
  lookup.
- **The accumulated stale signals were wiped** (146 rows, all from testing,
  all unverified) so the numbers on screen going into recording are honest —
  everything you see was generated fresh, and every one verifies correctly.
- **Config sliders are wired to the live service via Redis**, not local-only —
  see Scene 5. This is a genuine, demoable production-readiness feature, not
  a decorative control.
- **The odds feed now stays live per real fixture** instead of the global
  stream occasionally going quiet mid-match — this is what makes the Arena
  and the sharp-move detector actually react during a real World Cup game,
  not just in the Command Bridge replay.

---

## Say-once for the submission form
- **TxLINE endpoints:** `POST /auth/guest/start`, `POST /api/token/activate`,
  `GET /api/odds/stream` (core signal — live consensus StablePrice moves),
  `GET /api/odds/snapshot/{fixtureId}` with `asOf` (closing line for CLV),
  `GET /api/scores/stream?fixtureId=` (result for settlement + verification).
- **Headless process:** `apps/agent` — runs independently of the browser tab;
  `/api/agents/stats` and `/api/agents/signals` are its live public API.
- **Repo:** github.com/elaris-xyz/bozPicks · **Live:** boz-picks.vercel.app/agent
