# 🎬 Demo Script — Track 2: Consumer & Fan Experiences (bozPicks)

**Target length:** ≤ 5 minutes · **Page:** `https://boz-picks.vercel.app/play`
**Recommended run:** Command Bridge → scenario **Goal fest 3–3** · speed **4×**

> **Real match vs. demo:** on an actual live World Cup fixture, everything on
> this page — score, Hi-Lo, the pundit, win probability — comes from the real
> TxLINE feed automatically, no Command Bridge involved, and the pundit opens
> with a live momentum read the moment you land on the page instead of sitting
> silent. If nothing is live when you record, the Command Bridge replay below
> is the fallback and is what these cues assume.

---

## Pre-flight (before you hit record)
1. Open `https://boz-picks.vercel.app/play` in a clean, full-screen browser.
2. Connect a wallet (Solflare — Phantom's devnet RPC is flaky) and, from the
   balance chip → **Game Vault**, hit **Reset vault (demo)**, then
   **Deposit 100**.
3. Turn the pundit **voice ON** and set **energy to high** so it narrates.
4. Do NOT press Run twice mid-recording — one run per video.

---

## Scene 1 — The hook (0:00–0:25)
**DO:** Start on `/play` before running a match (idle state showing the invite).
**SAY:**
> "This is bozPicks — a phone-first World Cup companion. Every number you'll see
> is live data from TxLINE, the on-chain sports data layer, streamed over a
> single connection. Let me bring a match to life."

## Scene 2 — Kick off a live match (0:25–0:55)
**DO:** Click the **⚡ Command Bridge** (bottom-left). Point at the fixture picker.
Choose scenario **Goal fest 3–3**, speed **4×**, press **Run**.
**SAY:**
> "The Command Bridge lets a judge drive any real TxLINE fixture on demand — so
> you're never waiting for a live kickoff to see the product work. I'll run a
> high-scoring game. Watch — every widget on the page goes live off one SSE
> stream."

## Scene 3 — Broadcast scoreboard + Momentum (0:55–1:40)
**DO:** Let the match play. Point to the **LiveScoreboard**, then the
**Match Momentum** curve as it builds.
**SAY:**
> "Here's the broadcast scorebug, updating in real time. And this is Match
> Momentum — the two-sided pressure wave you see on TV, except we compute it
> live from real TxLINE inputs: ball possession, the per-side threat state, and
> attacking events. Green is the home side pressing, blue the away side. It's an
> honest read of the run of play, not a canned animation."

## Scene 4 — Hi-Lo, the original game (1:40–2:30)
**DO:** In the centre column, play one round of **Hi-Lo** — click **Higher** or
**Lower** before the next possession reading, show the streak tick up by
exactly one per correct call.
**SAY:**
> "This is our headline original experience: Hi-Lo. Before each TxLINE update you
> guess whether the next stat — here, possession — swings higher or lower. Build
> a streak, chase your best, share it. It's replayable across all 104 games and
> turns a passive feed into something you actually *play* — that's the
> originality and the built-in viral loop."

## Scene 5 — AI Pundit with a real voice (2:30–3:15)
**DO:** When a goal fires, let the **AI Pundit** speak. Point to the
**commentator voice picker** and the **energy control**.
**SAY:**
> "Every big moment, Claude writes a broadcaster line and a neural voice reads
> it — 'Mbappé scores for France!' — naming the actual player from TxLINE's
> player-level data. You can pick the commentator's voice and dial the energy up
> or down. Goals barge in, chatter never clips over them. On a real fixture the
> booth stays on the whole match — not just the highlights — reading momentum
> off the live possession and danger state between the big moments, the way a
> real broadcast does. This is the 'bonus-points TTS' the brief asked for, done
> properly."

## Scene 6 — Win Probability + Live Feed (3:15–3:45)
**DO:** Point to **Win Probability** swinging on a goal, then scroll the
**Live Feed** (goals, cards, corners, VAR).
**SAY:**
> "Win Probability comes straight from the consensus implied odds — it swings the
> instant the market reacts. And the Live Feed is broadcast-grade: goals with
> scorer, cards, corners, VAR reviews — every event coloured and timestamped,
> with no noise from routine stat ticks cluttering the rail."

## Scene 7 — The match page + the money rail (3:45–4:30)
**DO:** Let the match reach full time, click the finished match card → the
**match detail page**. Show goalscorers under each team, the winner's trophy,
**Momentum Recap**, **Turning Points**, **Match Stats**. Then open the **vault
chip** in the nav.
**SAY:**
> "Full time — and the match page becomes a full post-match analysis: named
> goalscorers, the winner highlighted, a momentum recap, and Turning Points that
> tie the biggest probability swings to the event that caused them. And this is
> the monetization path — a vault: deposit devnet SOL once, then stake instantly
> with no wallet pop-ups, and cash out anytime. Notice how clearly it breaks
> down what you put in, what's staked, what you've won, and what's still
> waiting on a result — a real freemium rail, live on Solana today, that you
> never have to take on faith."

## Scene 8 — Share + close (4:30–5:00)
**DO:** Click **Share** → show the flag-themed scoreline card.
**SAY:**
> "And you share a match with a flag-themed card that shows the result the moment
> it's known. That's bozPicks: real TxLINE data turned into things fans *do* —
> playable, real-time, original, and monetizable. Thanks for watching."

---

## What's new since the last pass (context for you, not to read aloud)
- **The pundit talks the whole match now, not just the highlights.** The old
  gating (only ~25–90% of routine events made it to screen, randomly) was
  built for a fast demo replay; on a real fixture at real pace it made the
  booth read as dead for minutes at a time. It now speaks on every classified
  event at real speed, plus a throttled momentum read every ~20s built from
  possession/danger/corners, and opens with a live read pulled from history
  the moment you load the page — the booth is never silent when you arrive.
- **Hi-Lo's streak counter is exact now.** A burst of events arriving close
  together used to score one correct guess multiple times (a streak could
  jump by 10 instead of 1); it's a single, race-safe resolution per guess now.
- **The vault card was redesigned** around the exact question a viewer asks:
  "where did my balance go?" A new amber chip calls out money currently
  sitting in open bets — not lost, just waiting — right where the old design
  used to just show a smaller number with no explanation.

---

## Say-once for the submission form
- **TxLINE endpoints:** `POST /auth/guest/start`, `POST /api/token/activate`
  (free WC tier access), `GET /api/fixtures/snapshot`, `GET /api/scores/stream`
  and `?fixtureId=` (live scores/events/possession/cards), `GET /api/odds/stream`
  + `GET /api/odds/snapshot/{id}` (win probability).
- **Repo:** github.com/elaris-xyz/bozPicks · **Live:** boz-picks.vercel.app/play
