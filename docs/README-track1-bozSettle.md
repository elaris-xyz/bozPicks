# bozSettle — Track 1: Prediction Markets & Settlement

> **TxLINE World Cup Hackathon · Prize: 12,000 USDT**

**Parimutuel prediction pools. Verified by TxLINE. Settled on Solana.**

On-chain prediction market for World Cup matches — users stake SOL, outcomes are verified via TxLINE match data, winners are paid out automatically by an Anchor program.

---

## What It Does

- **Parimutuel pools** — users pick Home / Draw / Away before kickoff
- **On-chain stakes** — Phantom wallet signs TX on Solana devnet
- **TxLINE settlement** — match result pulled from TxLINE API to resolve pool
- **Keeper bot** — autonomous process that calls `settle_pool` when match ends
- **Transparent math** — parimutuel payout: winner's share ∝ stake size

---

## TxLINE Integration

| Endpoint | Usage |
|----------|-------|
| `GET /sports/soccer/events/:id` | Match result for settlement trigger |
| `SSE /stream` | Live score updates → keeper bot watches for FT |
| *(optional)* `validate_stat` CPI | On-chain stat verification via TxLINE program |

The keeper bot (`apps/keeper`) polls TxLINE for match status and calls `settle_pool` on the Anchor program when `status === "FT"`.

---

## Solana Program

| Detail | Value |
|--------|-------|
| **Program ID** | `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh` |
| **Network** | Devnet |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet) |
| **Deploy wallet** | `AtZfuUU9qdEdBwHYb29Na9Fy6Bck8NdUF3N5eTCrnnYH` |

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_pool` | Create pool for a match |
| `place_prediction` | User stakes SOL on outcome |
| `settle_pool` | Resolve pool after match ends |
| `claim_winnings` | Winner withdraws their share |

---

## Live Demo

- **URL:** `https://settle.bozpicks.com`
- **Network:** Solana Devnet
- **Wallet:** Phantom (devnet mode — free SOL from faucet)

---

## Quick Start

```bash
cp .env.example .env
# fill: TXLINE_API_KEY, DATABASE_URL, REDIS_URL
# fill: BOZPICKS_PROGRAM_ID=GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh
# fill: SETTLEMENT_KEEPER_KEYPAIR=[...bytes...]

pnpm install
psql $DATABASE_URL < docs/db/001_init.sql

pnpm --filter=web dev      # UI at localhost:3000/settle
pnpm --filter=keeper dev   # keeper bot
```

---

## Architecture

```
User → /settle UI → Phantom sign TX → Solana devnet
                                           ↓
                               Anchor: initialize_pool
                               Anchor: place_prediction

TxLINE SSE (FT event)
    ↓
apps/keeper → Anchor: settle_pool → payouts on-chain
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Smart contract | Anchor (Rust) — Solana devnet |
| Keeper | Node.js long-running process |
| Parimutuel math | `packages/shared/src/parimutuel.ts` |
| UI | Next.js — `/settle` route |
| Deploy | Railway (keeper) + Vercel (web) |

---

## Key Files

```
programs/settlement/src/lib.rs       # Anchor program
apps/keeper/src/index.ts             # keeper bot
apps/web/src/app/settle/page.tsx     # /settle landing
packages/shared/src/parimutuel.ts    # payout math
```
