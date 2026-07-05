# bozAgent — Trading Tools & Agents (Track 3)

**One-liner:** Two fully-autonomous agents trade the same TxLINE odds stream with
opposite theses in a head-to-head **Arena**, plus a sharp-move detector with
accuracy and closing-line-value tracking.

## Links
- Live app: `https://<deploy>/agent`
- Repo: https://github.com/elaris-xyz/bozPicks
- Live stats API: `https://<deploy>/api/agents/stats`
- Demo video: `<loom/youtube link>`

## Core idea
- **Agent-vs-Agent Arena** (`lib/arena.ts`): on every significant implied-prob
  move, **Momentum** rides the move and **Contrarian** fades it. Both open
  notional positions autonomously, settle against the result at full-time, and
  compound P&L across matches — the better strategy pulls ahead over the
  tournament. Each bet is scored for **CLV** (did it beat the closing line?).
- **Sharp-move detector** (`apps/agent`): monitors the odds stream, flags
  >threshold shifts in a rolling window, publishes signals, and later verifies
  whether each signal predicted the outcome (accuracy %). CSV export included.

## Business / technical highlights
- **Fully autonomous & deterministic**: strategy logic is pure functions (same
  code drives the headless agent and the UI), no human input once running.
- **Production-ready signals**: SSE reconnect/backoff, live `/api/agents/stats`
  (accuracy, confidence mix), deterministic thresholds a desk could tune.
- **Novel**: the opposed-strategy Arena with CLV is a genuinely new way to
  benchmark algorithmic reads of a live market.

## TxLINE endpoints used
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier).
- `GET /api/odds/stream` — the core signal: live consensus StablePrice moves.
- `GET /api/odds/snapshot/{fixtureId}` (with `asOf`) — closing line for CLV /
  backtesting.
- `GET /api/scores/stream` — result for settlement + signal verification.

## API feedback
- **Loved:** the demargined **StablePrice** consensus odds + implied `Pct` — a
  clean, single-source probability that makes move detection and CLV trustworthy
  without stitching bookmakers together.
- **Friction:** for cross-book "steam" detection we'd want the per-`Bookmaker`
  breakdown surfaced on the stream (not only snapshots), and a documented rate
  cadence for the 60s free tier so agents can align their windows exactly.
