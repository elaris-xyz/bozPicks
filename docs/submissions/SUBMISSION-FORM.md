# Submission form — all three tracks

Copy-paste ready. One monorepo, three submissions. Replace the demo-video
placeholder once the videos are uploaded.

- Repo: https://github.com/elaris-xyz/bozPicks
- Live app: https://boz-picks.vercel.app
- On-chain program (Solana devnet): `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh`

---

# Track 1 — bozSettle (Prediction Markets & Settlement)

**Link to Your Submission:** _(most useful link)_ — the Track 1 demo video once
uploaded; until then use the live page: https://boz-picks.vercel.app/markets

**Project Title:** bozSettle — Trustless Prediction Markets & Settlement

**Briefly explain your Project:**
bozSettle opens USDC parimutuel prop markets on World Cup matches and settles each
one trustlessly, straight from TxLINE's cryptographically-signed match data — no
oracle, no operator. Eight provable prop markets are auto-created per fixture; at
full time a keeper resolves each deterministically, fetches TxLINE's Merkle proof
for the deciding stat, and verifies it on-chain (`validate_stat`) on Solana
devnet. Every settled market shows a verifiable-resolution receipt.

**Link to your live & working MVP:** https://boz-picks.vercel.app/markets

**Link to your Project's Technical Documentation:**
https://github.com/elaris-xyz/bozPicks/blob/main/docs/submissions/track1-bozSettle.md
(overview: https://github.com/elaris-xyz/bozPicks/blob/main/README.md)

### Quick overview for judges

**Main idea:** Onchain prediction markets have one hard problem — settlement. Who
decides the result, and can you trust them? bozSettle removes the trusted party:
parimutuel markets that settle themselves from TxLINE's signed data, with an
on-chain Merkle proof behind every payout.

**Commercial value & technical highlights:**
- **8 provable prop markets** per fixture (Match Result, Total Goals, Total
  Corners, Total Cards, 1st-Half Corners, 1st-Half Cards, BTTS, First Goal) —
  each resolves from one number in TxLINE's data.
- **Trustless settlement:** Merkle proof → `validate_stat` CPI → USDC payout, one
  atomic path. Never a self-asserted result. (`lib/settle.ts`, `apps/keeper`.)
- **Verifiable Resolution UI** — the "data receipt" the track asks for: stat
  key/value, Merkle root, proof nodes, and the on-chain validation tx.
- **Live real-proof verifier** — for a played fixture we fetch TxLINE's actual
  Merkle proof at click-time and re-fold it in the browser to reproduce TxLINE's
  own committed root. Confirmed on England 1–2 Argentina (fixture 18241006,
  `game_finalised` seq 962, `period=100`).
- **Parimutuel** needs no price oracle or LPs; **USDC/SOL only** for value.
- **38 deterministic unit tests** (no mocks) cover every scenario → resolution →
  payout. Honest receipts: synthetic demos are labelled SIMULATED, never
  "verified".
- Two programs live on devnet: the parimutuel + USDC escrow and the
  `validate_stat` verifier.

**Exact TxLINE endpoints used:**
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier, devnet host `txline-dev.txodds.com`)
- `GET /api/fixtures/snapshot` — auto-create markets per fixture
- `GET /api/scores/stream` — watch for the authoritative `game_finalised` record
- `GET /api/scores/historical/{fixtureId}` — canonical final stats for resolution
- `GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=` — Merkle proof for `validateStatV2`
- `GET /api/odds/snapshot/{fixtureId}` — pre-match implied probability for seeding

**Your experience using the TxLINE API:**
- **Liked most:** the on-chain Merkle anchoring + `validate_stat` primitive makes
  "trustless settlement" real instead of aspirational, and the confirmed stat-key
  legend let us prove corners/cards on-chain, not just the score. The CPI verified
  at ~55–175k CU, well under the compute ceiling, leaving room for our escrow.
- **Friction:** the stat-key legend (period prefixes, base keys 1–8) and the
  Merkle leaf spec weren't in the public docs — we relied on team channel answers.
  A documented phase/status proof (abandoned vs finished) and correction semantics
  (is `game_finalised` exactly-once? do corrections carry strictly-increasing
  timestamps?) would let settlement handle edge cases trustlessly instead of a
  refund fallback.

---

# Track 2 — bozPicks (Consumer & Fan Experiences)

**Link to Your Submission:** _(most useful link)_ — the Track 2 demo video once
uploaded; until then use the live page: https://boz-picks.vercel.app/play

**Project Title:** bozPicks — Read the Game as it Happens

**Briefly explain your Project:**
bozPicks is a phone-first World Cup companion where every number is live TxLINE
data. It turns the feed into things you play with, not just read: Hi-Lo (a
replayable stat-reading game), a broadcast-style Match Momentum wave, a live
win-probability gauge, and an AI Pundit that calls the big moments out loud in a
natural neural voice. A one-signature devnet vault lets fans deposit once and play
instantly.

**Link to your live & working MVP:** https://boz-picks.vercel.app/play

**Link to your Project's Technical Documentation:**
https://github.com/elaris-xyz/bozPicks/blob/main/docs/submissions/track2-bozPicks.md
(overview: https://github.com/elaris-xyz/bozPicks/blob/main/README.md)

### Quick overview for judges

**Main idea:** On a phone, live match data is either boring or buried — a tiny
score and a flat stats table a minute late. bozPicks turns TxLINE's granular live
feed into a glanceable, playable experience fans actually *feel*.

**Commercial value & technical highlights:**
- **Hi-Lo** — an original, replayable game (guess the next possession swing;
  build a streak; share it) across all 104 games. Not a repackaged feed.
- **Match Momentum** — a TV-style two-sided pressure wave from possession, danger
  state, and attacking events.
- **AI Pundit** — Claude writes veteran-commentator lines, neural TTS reads them,
  with a voice picker, energy control, and honest AI/voice labelling.
- **Live win-probability gauge** from TxLINE's implied odds; possession / threat /
  corners / cards meters; confirmed starting lineups.
- **Monetization rail:** the vault (deposit → stake → cash out) is a real freemium
  path, live on devnet today, honestly labelled as a simulated balance.
- **Real-time:** one shared SSE connection fans out to every widget; a judge can
  trigger any fixture on demand via the Command Bridge.

**Exact TxLINE endpoints used:**
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier)
- `GET /api/fixtures/snapshot` — schedule + competition grouping
- `GET /api/scores/stream` — live scores, events, possession, corners, cards, lineups
- `GET /api/odds/stream` + `GET /api/odds/snapshot/{fixtureId}` — win probability

**Your experience using the TxLINE API:**
- **Liked most:** possession + danger state and the per-event richness (goal type,
  player ids, corners) — that granularity is exactly what makes a *game* possible
  on top of the feed, not just a scoreboard.
- **Friction:** flag/name resolution is client-side (team names only), so a
  `competitionId → name` map and player-name inclusion on score events (instead of
  id-only) would remove a lookup step.

---

# Track 3 — bozAgent (Trading Tools & Agents)

**Link to Your Submission:** _(most useful link)_ — the Track 3 demo video once
uploaded; until then use the live page: https://boz-picks.vercel.app/agent

**Project Title:** bozAgent — Three Autonomous Agents on One Live Feed

**Briefly explain your Project:**
bozAgent runs three fully-autonomous trading agents off one live TxLINE odds feed,
headless, with zero human input: a Sharp-Move Detector that self-grades its own
calls, a Momentum-vs-Contrarian Arena racing two opposed strategies head-to-head,
and an In-Play Market Maker (Avellaneda–Stoikov) quoting a two-sided market. Each
carries professional P&L / CLV / spread-capture tracking; the web page is a live
mirror of the real headless process.

**Link to your live & working MVP:** https://boz-picks.vercel.app/agent

**Link to your Project's Technical Documentation:**
https://github.com/elaris-xyz/bozPicks/blob/main/docs/submissions/track3-bozAgent.md
(overview: https://github.com/elaris-xyz/bozPicks/blob/main/README.md)

### Quick overview for judges

**Main idea:** What do autonomous agents look like when the data is this granular
and this fast? TxLINE's real-time, normalized, cryptographically-anchored odds make
sports data tradable programmatically — so we built all three of TxLINE's suggested
agent archetypes in one deployed system.

**Commercial value & technical highlights:**
- **Three agents, one feed:** directional (Sharp-Move Detector), opposed-
  directional (Momentum vs Contrarian Arena), and non-directional (In-Play Market
  Maker) — benchmarked side-by-side.
- **Fully autonomous & deterministic:** every strategy core is a pure function in
  the shared package; the same code drives the headless process and the UI, so the
  browser is a mirror, not a re-implementation. Unit-tested.
- **Professional metrics:** CLV, win-rate, mark-to-market equity curves, spread
  capture, inventory/exposure, career compounding — what a desk actually evaluates.
- **Self-grading:** every signal is graded against the TxLINE final result; live
  accuracy at `/api/agents/stats`.
- **Production-ready:** SSE reconnect/backoff, isolated agents, live JSON APIs,
  live-tunable configs applied in ~5s with no redeploy.
- **Live APIs judges can hit directly:** `GET /api/agents/stats`,
  `GET /api/agents/signals`, `GET /api/agents/mm`, `GET/POST /api/agents/config`.

**Exact TxLINE endpoints used:**
- `POST /auth/guest/start`, `POST /api/token/activate` — access (free WC tier)
- `GET /api/odds/stream` + `GET /api/odds/updates/{fixtureId}` — live consensus StablePrice moves (the core signal)
- `GET /api/odds/snapshot/{fixtureId}` (with `asOf`) — closing line for CLV / backtesting
- `GET /api/scores/stream` + `GET /api/scores/snapshot/{fixtureId}` — result for settlement + signal verification

**Your experience using the TxLINE API:**
- **Liked most:** the demargined StablePrice consensus odds + implied `Pct` — a
  clean, single-source probability that makes move detection, CLV, and fair-value
  market-making trustworthy without stitching bookmakers together.
- **Friction:** for cross-book "steam" detection we'd want the per-`Bookmaker`
  breakdown on the stream (not only snapshots), and a documented rate cadence for
  the 60s free tier so agents can align their windows exactly.
