# bozPicks

**Pick smart. Watch live. Get paid on-chain.**

Live World Cup intelligence · Autonomous sharp-move agent · On-chain parimutuel settlement

Built for TxLINE World Cup Hackathon — Track 1 + 2 + 3

---

## Services

| Service | Location | Purpose |
|---------|----------|---------|
| `web` | `apps/web` | Next.js UI + API routes + SSE |
| `ingest` | `apps/ingest` | TxLINE SSE worker → Redis + Postgres |
| `agent` | `apps/agent` | Event-driven sharp-move detector |
| `settlement` | `programs/settlement` | Anchor program (Solana) |

## Quick Start

```bash
cp .env.example .env
# fill in TXLINE_API_KEY, DATABASE_URL, REDIS_URL

pnpm install
psql $DATABASE_URL < docs/db/001_init.sql

# terminal 1 — web
pnpm --filter=web dev

# terminal 2 — ingest
pnpm --filter=ingest dev

# terminal 3 — agent
pnpm --filter=agent dev
```

## Architecture

```
TxLINE SSE → boz-ingest → Redis Pub/Sub
                                ↓
             boz-web (SSE /api/stream → UI)
             boz-agent (event-driven sharp move)
             boz-settle (Anchor: parimutuel settlement)
```

## Tracks

- **Track 2** — `/` `/match/[id]` `/insights` — Fan experience with AI Pundit
- **Track 3** — `/agent` — Autonomous sharp-move detector, accuracy tracking
- **Track 1** — `/picks/[matchId]` — Parimutuel pool + on-chain USDC settlement

## Day 0 Checklist

- [ ] Verify TxLINE `validate_stat` CPI → choose Plan A or Plan B in `programs/settlement`
- [ ] Copy `.env.example` → `.env` and fill all values
- [ ] Run DB migration `docs/db/001_init.sql`
- [ ] Confirm first SSE message logs in `boz-ingest`
