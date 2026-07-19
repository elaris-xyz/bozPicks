# bozAgent — Trading Tools & Agents (Track 3)

**One-liner:** THREE fully-autonomous agents run off one live TxLINE odds feed —
a **Sharp-Move Detector**, a head-to-head **Momentum-vs-Contrarian Arena**, and
an **In-Play Market Maker** — each with professional P&L / CLV / spread-capture
tracking. All three of TxLINE's suggested agent ideas, in one deployed system.

## Links
- Live app: https://boz-picks.vercel.app/agent
- Repo: https://github.com/elaris-xyz/bozPicks
- Live APIs (judges can hit directly):
  - `GET /api/agents/stats` — detector accuracy, confidence mix, uptime
  - `GET /api/agents/signals` — the raw signal log (JSON)
  - `GET /api/agents/mm` — market-maker live quotes, inventory, P&L
  - `GET/POST /api/agents/config` — live-tune the detector (no redeploy)
- Demo video: `<loom/youtube link>`

## Core idea — three agents, one feed
All three run headless in **`apps/agent`** (Railway), consuming the SAME live
TxLINE event stream over Redis pub/sub, no browser and no human input:

1. **Sharp-move detector** (`apps/agent/src/detector.ts`): flags implied-prob
   shifts past a threshold in a rolling window, publishes each signal, and later
   verifies whether it predicted the outcome (accuracy %). Live-tunable, CSV
   export.
2. **Agent-vs-Agent Arena** (`packages/shared/src/strategy/arena.ts` →
   `apps/agent/src/arena.ts`): **Momentum** rides each move, **Contrarian** fades
   it; both settle at full-time and compound career P&L, each bet scored for
   **CLV** (beat the closing line?).
3. **In-Play Market Maker** (`packages/shared/src/strategy/marketmaker.ts` →
   `apps/agent/src/marketmaker.ts`): quotes a two-sided market on every 1X2
   outcome — a compact **Avellaneda–Stoikov** maker whose half-spread widens with
   realised volatility and whose quotes skew against inventory to mean-revert
   exposure. Books fills as price crosses its quotes; P&L is honest
   mark-to-market (spread captured minus adverse selection).

## Business / technical highlights
- **Fully autonomous & deterministic**: every strategy core is a pure function in
  the shared package; the SAME code drives the headless process and the UI, so
  the browser is a *mirror* of the live agent, not a re-implementation. Covered
  by unit tests (`marketmaker.test.ts`, arena/detector math).
- **Professional metrics**: CLV, win-rate, mark-to-market equity curves,
  spread-capture, inventory/exposure, career compounding — the figures a desk
  actually evaluates a strategy on.
- **Production-ready**: SSE reconnect/backoff, isolated agents (a maker error
  can't take down the detector), live JSON APIs, deterministic tunable configs, a
  maker with built-in inventory control.
- **Novel**: three opposed archetypes benchmarked side-by-side on one feed —
  directional (detector), opposed-directional (arena), and non-directional
  (maker) — is a genuinely new way to see "what agents look like when the data is
  this granular and this fast."

## TxLINE endpoints used
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier).
- `GET /api/odds/stream` + `GET /api/odds/updates/{fixtureId}` — the core signal:
  live consensus StablePrice moves that drive all three agents.
- `GET /api/odds/snapshot/{fixtureId}` (with `asOf`) — closing line for CLV /
  backtesting.
- `GET /api/scores/stream` + `GET /api/scores/snapshot/{fixtureId}` — result for
  settlement + signal verification.

## API feedback
- **Loved:** the demargined **StablePrice** consensus odds + implied `Pct` — a
  clean, single-source probability that makes move detection, CLV, and fair-value
  market-making trustworthy without stitching bookmakers together.
- **Friction:** for cross-book "steam" detection we'd want the per-`Bookmaker`
  breakdown on the stream (not only snapshots), and a documented rate cadence for
  the 60s free tier so agents can align their windows exactly.
