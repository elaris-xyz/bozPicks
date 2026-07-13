# bozPicks — Consumer & Fan Experiences (Track 2)

**One-liner:** A phone-first World Cup companion where every number is live
TxLINE data — headlined by **Hi-Lo**, a replayable stat-reading game, alongside a
live win-probability and momentum dashboard.

## Links
- Live app: `https://<deploy>/` (games at `/play`)
- Repo: https://github.com/elaris-xyz/bozPicks
- Demo video: `<loom/youtube link>`

## Core idea
Most fans watch with a phone in hand. bozPicks turns the live feed into things you
*do*, not just read:
- **Hi-Lo** (`/play`): guess whether the next possession reading swings higher or
  lower. Build a streak, chase your best, share it — replayable across all 104
  games. It's a genuine read of the run of play, powered by TxLINE possession.
- **Live win-probability gauge** from the consensus implied probability — it
  swings the instant the market reacts to a goal or red card.
- **Match Momentum**: a broadcast-style two-sided pressure curve (the TV
  graphic) computed live from TxLINE possession, danger state, and attacking
  events — one smooth wave crossing the centre line, goal flags pinned per side.
- **Momentum & threat meter**: possession, corners, cards, and TxLINE's
  attack/danger state per side.
- **Cinematic live scoreboard** with a calm, readable ticker and a rich event
  feed (goals with scorer/type, cards, corners, subs, VAR).
- **AI Pundit booth**: Claude Haiku writes veteran-commentator lines and a
  neural TTS voice (Groq Orpheus, browser fallback) reads them — with a
  **commentator voice picker** (3 male / 3 female), a **3-level energy control**,
  an on-air equaliser, a finish-current-then-next speech queue (no mid-sentence
  clipping), and honest AI/voice labelling.
- **Vault economy**: deposit devnet SOL once, stake on games instantly (no
  per-bet wallet popups), cash out anytime — Postgres ledger + on-chain
  reconciliation, balance chip in the nav.
- **Solana wallet sign-in** (in-house modal, any Wallet-Standard wallet, devnet).

## Business / technical highlights
- **Original, replayable format** (not a repackaged feed) with a built-in viral
  loop (streak sharing) and a **working monetization rail**: the vault
  (deposit → stake → cash out) is the real freemium path, live on devnet today.
- **Real-time**: one shared SSE connection fans out to every widget; the whole UI
  reacts live within the same replay a judge can trigger on demand.
- **Completeness**: end-to-end product — nav, games, live stats, broadcast-grade
  feed (per-event colours, match-identity footers), schedule browser, wallet.
- **Judge control**: the Command Bridge (bottom-left ⚡) runs any real TxLINE
  fixture with a chosen outcome — every widget reacts live within seconds.

## TxLINE endpoints used
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier).
- `GET /api/fixtures/snapshot` — schedule + competition grouping.
- `GET /api/scores/stream` — live scores, events, possession, corners, cards.
- `GET /api/odds/stream` + `GET /api/odds/snapshot/{fixtureId}` — win probability.

## API feedback
- **Loved:** possession + danger state and the per-event richness (goal type,
  player ids, corners) — that granularity is exactly what makes a *game* possible
  on top of the feed, not just a scoreboard.
- **Friction:** flag/name resolution is client-side (team names only), so a
  fixture `competitionId → name` map and player-name inclusion on score events
  (vs id-only) would remove a lookup step.
