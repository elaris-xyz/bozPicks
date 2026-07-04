# bozPicks — Track 2: Consumer & Fan Experiences

> **TxLINE World Cup Hackathon · Prize: 10,000 USDT**

**Pick smart. Watch live. Win on-chain.**

Live World Cup fan experience powered by real-time TxLINE data, AI analysis, and Solana wallet predictions.

---

## What It Does

- **Live match feed** — scores, odds, and key events streamed in real-time from TxLINE
- **AI Pundit** — Claude Haiku explains every match event in plain language ("Why did the odds shift?")
- **Wallet predictions** — connect Phantom, sign a prediction TX on Solana devnet
- **Leaderboard** — ranked prediction accuracy across all users
- **Demo mode** — Brazil vs Argentina live demo without API key

---

## TxLINE Integration

| Endpoint | Usage |
|----------|-------|
| `GET /sports/soccer/events` | Live match list + scores |
| `GET /sports/soccer/odds` | Real-time odds per match |
| `SSE /stream` | Live event push → Redis → UI via `/api/stream` |

TxLINE data flows through `apps/ingest` → Redis Pub/Sub → `apps/web` SSE endpoint → browser.

---

## Live Demo

- **URL:** `https://picks.bozpicks.com`
- **Solana Network:** Devnet
- **Wallet:** Phantom (devnet mode)

---

## Quick Start

```bash
cp .env.example .env
# fill: TXLINE_API_KEY, DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY

pnpm install
psql $DATABASE_URL < docs/db/001_init.sql

pnpm --filter=web dev      # http://localhost:3000
pnpm --filter=ingest dev   # TxLINE SSE worker
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 App Router, TailwindCSS |
| AI | Claude Haiku (Anthropic) — streaming |
| Real-time | TxLINE SSE → Redis Pub/Sub → `/api/stream` |
| Wallet | `@solana/wallet-adapter` — Phantom devnet |
| DB | PostgreSQL (Neon) |
| Deploy | Vercel (serverless) |

---

## Folder Structure

```
apps/web/src/app/
├── page.tsx              # Home — live matches
├── match/[id]/page.tsx   # Match detail + AI Pundit
├── picks/page.tsx        # Prediction UI + wallet TX
├── leaderboard/page.tsx  # Rankings
└── insights/page.tsx     # AI insights feed
```
