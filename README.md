# bozPicks

**Pick smart. Watch live. Get paid on-chain.**

One live TxLINE data core → three World Cup products: a fan game, a trustless
prediction market, and an autonomous trading arena.
Built for the TxLINE World Cup Hackathon — submitted to **all three tracks**.

---

## Judge it in 60 seconds

1. Open any page and tap the **⚡ Command Bridge** (bottom-left corner).
2. Pick a **real TxLINE fixture** (live from `/api/fixtures/snapshot`) or the
   preset, choose the exact outcome scenario + speed, hit **Run**.
3. Every page goes live off one SSE stream: the feed, Hi-Lo, the AI pundit
   (with a neural voice), win probability, the agent arena — and at full time
   all six prop markets settle to your chosen outcome with verifiable-resolution
   receipts, honestly labelled **Simulated** (upcoming fixture) vs **Verified**
   (on-chain proof).
4. Prove determinism offline: `pnpm --filter=web test` — **28 tests**, no mocks,
   the exact pure functions the demo + keeper run.

## Tracks

| Track | Product | Page |
|---|---|---|
| 1 · Prediction Markets & Settlement | **bozSettle** — USDC parimutuel prop markets settled from TxLINE Merkle proofs (`validate_stat`) | `/markets` |
| 2 · Consumer & Fan Experiences | **bozPicks** — Hi-Lo stat game, win-prob gauge, AI pundit with neural TTS | `/play` |
| 3 · Trading Tools & Agents | **bozAgent** — headless Momentum-vs-Contrarian arena + self-grading sharp-move detector | `/agent` |

Per-track briefs (with TxLINE endpoints + API feedback): `docs/submissions/`.

## Services

| Service | Location | Purpose |
|---------|----------|---------|
| `web` | `apps/web` | Next.js UI + API routes + SSE fan-out |
| `ingest` | `apps/ingest` | TxLINE SSE worker → Redis + Postgres |
| `agent` | `apps/agent` | Headless sharp-move detector + Arena strategies |
| `keeper` | `apps/keeper` | Merkle proof fetch + `validate_stat` settlement |
| `settlement` | `programs/settlement` | Anchor program (Solana devnet) |

## Quick start

```bash
cp .env.example .env       # TXLINE_API_KEY, DATABASE_URL, REDIS_URL (+ optional AI/TTS keys)
pnpm install
psql $DATABASE_URL < docs/db/001_init.sql

pnpm --filter=web dev      # UI + APIs (the Command Bridge drives demos)
pnpm --filter=ingest dev   # live TxLINE ingest (optional for demos)
pnpm --filter=agent dev    # headless agent (optional for demos)

pnpm --filter=web test     # 28 deterministic settlement/replay tests
```

## Architecture

```
TxLINE (fixtures · scores SSE · odds SSE · stat-validation proofs)
        │
        ▼
   boz-ingest ──► Redis pub/sub ──► /api/stream (SSE, catchup-flagged)
        │                                 │
        ▼                                 ▼
   Postgres (Neon)              every page reacts live
        │                        (feed · Hi-Lo · pundit · markets · arena)
        ▼
   keeper ──► TxLINE Merkle proof ──► validate_stat CPI ──► USDC payout
                                (Solana devnet, Anchor)
```

- **Honesty by design:** demo fixtures are upcoming, so their receipts are
  stamped `SIMULATED`; the keeper runs the real proof + CPI the moment TxLINE
  publishes a final stat (`game_finalised`, total-goals stat keys 1/2).
- **TxL is data-authorization only** — all value flows are USDC/SOL.

## Reference

- `docs/TXLINE-REFERENCE.md` — the full API reference incl. the team-confirmed
  stat-key legend and settlement guidance.
- `docs/submissions/track{1,2,3}-*.md` — per-track submission briefs.
