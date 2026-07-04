# bozAgent — Track 3: Trading Tools & Agents

> **TxLINE World Cup Hackathon · Prize: 10,000 USDT**

**Autonomous sharp-move detection. Real-time signal tracking. On-chain accuracy.**

An event-driven agent that detects suspicious betting patterns from live TxLINE odds streams and tracks prediction accuracy over time.

---

## What It Does

- **Sharp-move detector** — flags odds shifts ≥10% within 2-minute windows as "sharp" (informed money)
- **Autonomous operation** — runs continuously, no human in the loop
- **Accuracy tracking** — compares signals to match outcomes, publishes live accuracy %
- **Signal dashboard** — `/agent` page with live stats: total signals, accuracy, active signals
- **CSV export** — full signal history downloadable

---

## TxLINE Integration

| Endpoint | Usage |
|----------|-------|
| `SSE /stream` | Live odds events → sharp-move analysis |
| `GET /sports/soccer/odds` | Baseline odds per match |
| `GET /sports/soccer/events` | Match metadata for signal context |

The agent (`apps/agent`) subscribes to Redis Pub/Sub (fed by `apps/ingest` from TxLINE SSE) and runs `detector.ts` on every odds update.

---

## Live Demo

- **URL:** `https://agent.bozpicks.com`
- **API:** `GET /api/agents/signals` — latest sharp-move signals
- **API:** `GET /api/agents/stats` — `{ total, accuracy, live }` real-time

---

## Quick Start

```bash
cp .env.example .env
# fill: TXLINE_API_KEY, DATABASE_URL, REDIS_URL
# optional: SHARP_THRESHOLD=0.10, SHARP_WINDOW_MS=120000

pnpm install
psql $DATABASE_URL < docs/db/001_init.sql

pnpm --filter=agent dev    # autonomous agent process
pnpm --filter=ingest dev   # TxLINE SSE feeder
pnpm --filter=web dev      # dashboard UI
```

---

## Agent Architecture

```
TxLINE SSE
    ↓
apps/ingest → Redis Pub/Sub (channel: txline:events)
    ↓
apps/agent
  └── detector.ts   — odds delta analysis → signal emit
  └── tracker.ts    — outcome resolution → accuracy update
  └── Redis pub: boz:signals
    ↓
apps/web /api/agents/* — REST + SSE to UI
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Agent runtime | Node.js (long-running process) |
| Signal bus | Redis Pub/Sub |
| Persistence | PostgreSQL — `boz_signals` table |
| Dashboard | Next.js — `/agent` route |
| Deploy | Railway (persistent process) |

---

## Key Files

```
apps/agent/src/
├── detector.ts    # sharp-move detection logic
├── tracker.ts     # accuracy tracking + outcome resolution
└── index.ts       # Redis subscriber + main loop

apps/web/src/app/api/agents/
├── signals/route.ts   # GET latest signals
└── stats/route.ts     # GET { total, accuracy, live }
```
