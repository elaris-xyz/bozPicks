# TxLINE — Complete API Reference (self-contained)

> Single source of truth for the TxLINE data layer so we never have to re-paste
> the docs. Captures auth, networks, every endpoint, the full soccer schema, and
> — critically — **which rich fields we don't ingest yet**. Docs index:
> https://txline-docs.txodds.com/llms.txt · Quickstart:
> https://txline.txodds.com/documentation/quickstart · World Cup free tier:
> https://txline.txodds.com/documentation/worldcup · OpenAPI: https://txline.txodds.com/docs/docs.yaml

---

## 1. What TxLINE is

High-performance sports data layer: real-time **scores, match events, and
consensus betting odds** for all 104 World Cup 2026 matches, delivered as a
single normalised JSON schema. Every record is **canonicalised and
cryptographically anchored on Solana** — you can pull a Merkle proof and verify
any fixture/odds/score record on-chain via `validate_*` instructions. Delivered
as request/response **or** Server-Sent Events (SSE) streams.

Hackathon: all commercial data fees waived through **2026-07-19 23:59 UTC**.

---

## 2. Networks & on-chain constants

| | mainnet | devnet |
|---|---|---|
| `apiOrigin` | `https://txline.txodds.com` | `https://txline-dev.txodds.com` |
| Solana RPC | `https://api.mainnet-beta.solana.com` | `https://api.devnet.solana.com` |
| TxLINE program id | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL mint (Token-2022) | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL` | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| Free World Cup service level | **1** (60s delay) + **12** (real-time) | **1** (60s delay) only |

- Use ONE network end-to-end. A devnet subscribe tx **cannot** be activated on
  the mainnet API host and vice-versa.
- PDAs: `token_treasury_v2`, `pricing_matrix`. Token program = **TOKEN_2022**.
- **Real-time free data is mainnet SL 12.** Devnet free tier is 60-second
  delayed. → For a real-time feel on devnet we must use a **replay engine**
  (see §7). For real-time live, subscribe SL 12 on mainnet (charges 0 TxL).

---

## 3. Access flow (World Cup FREE tier — no payment)

1. `POST {apiOrigin}/auth/guest/start` → `{ token }` guest **JWT** (valid 30 days;
   on HTTP 401 just re-fetch).
2. On-chain `subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)` — free tier SL `1`
   (or `12` on mainnet). `DURATION_WEEKS` must be a multiple of 4. Charges **0
   TxL** for free tiers but still registers the subscription on-chain. Record
   `txSig`.
3. Build message `${txSig}:${leagues.join(',')}:${jwt}` (for `leagues = []` this
   is `${txSig}::${jwt}`). Sign it detached with the wallet, base64-encode.
4. `POST {apiBaseUrl}/token/activate` body `{ txSig, walletSignature, leagues }`
   with `Authorization: Bearer ${jwt}` → returns the long-lived **API token**.
5. Every data call sends BOTH headers:
   - `Authorization: Bearer ${jwt}`
   - `X-Api-Token: ${apiToken}`

Re-subscribe (multiple of 4 weeks) to extend; leagues can be amended. TxL is
strictly for data authorization — **no P2P transfers / staking with TxL** (see §8).

Our client: `packages/txline-client/src/auth.ts` caches the JWT and reads the
API token from `TXLINE_API_KEY`. `apiBaseUrl = ${apiOrigin}/api`.

---

## 4. Endpoints

Base = `{apiOrigin}/api` unless noted. ✅ = wrapped in our client today.

### Auth / subscription
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/guest/start` ✅ | guest JWT (30-day) |
| POST | `/api/guest/purchase/quote` | partially-signed TxL purchase tx (paid tiers; base 1000 TxL = 1 USDT, 0% fee) |
| POST | `/api/token/activate` | activate API token after on-chain subscribe |

### Fixtures
| Method | Path | Notes |
|---|---|---|
| GET | `/api/fixtures/snapshot` ✅ | latest fixtures; **params: `startEpochDay`, `competitionId`** (we ignore both) |
| GET | `/api/fixtures/updates/{epochDay}/{hourOfDay}` | **historical fixture updates** — NOT used |

### Odds  (`OddsPayload`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/odds/snapshot/{fixtureId}` ✅ | latest per-market line; **`asOf` (ms) → historical snapshot** (we ignore) |
| GET | `/api/odds/updates/{fixtureId}` | live offers from the 5-min cache — NOT used |
| SSE | `/api/odds/stream?fixtureId=` ✅ | live odds stream |

### Scores  (`Scores` — the FULL schema, see §5)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/scores/snapshot/{fixtureId}` ✅ | latest score snapshot (we read only Total) |
| GET | `/api/scores/historical/{fixtureId}` | **full ordered sequence of every score update** for a fixture (start time between 2 weeks and 6h ago) — **NOT used, huge for replay & analytics** |
| SSE | `/api/scores/stream?fixtureId=` ✅ | live score/event stream |

### Validation proofs (on-chain verification) — **NOT used yet, central to Track 1**
Retrieve Merkle proofs for a fixture / odds / score record, then verify against
the on-chain Merkle roots via the program's `validate_*` instructions (e.g.
`validate_stat`). This is the "verifiable resolution / receipt" primitive the
Prediction-Markets track explicitly rewards. Exact proof endpoints live under the
API-reference "Validation Proofs" section of the docs index (llms.txt).

---

## 5. Soccer data schema — what we're leaving on the table

`GET /api/scores/*` returns the `Scores` object. Our client's `TxScores` only
models a thin slice. The real payload (soccer-relevant fields) includes:

**Identity / state**
- `fixtureId, competitionId, countryId, fixtureGroupId, sportId`
- `participant1Id, participant2Id, participant1IsHome`
- `gameState` + `statusSoccerId` — rich states incl. `NS, A, HT, ET1, ET2, P`
  (penalties), `PE`, `F/END`, `I` (interrupted), `C` (cancelled)…
- `clock { running, seconds }` — **live match clock in seconds**
- `id, ts, seq, connectionId, confirmed` — ordering + canonical proof keys

**`scoreSoccer` → SoccerFixtureScore → per participant `SoccerTotalScore`**
Period breakdown: `H1, HT, H2, ET1, ET2, PE, ETTotal, Total`, each a
`SoccerScore { Goals, YellowCards, RedCards, Corners }`.
→ **half-by-half scores, corners, card counts — all free, all unused.**

**`dataSoccer` → SoccerData (the event that just happened)**
`Goal, GoalType (Head|Shot|OwnGoal|Other), Penalty, Corner, VAR, RedCard,
YellowCard, FreeKickType, ThrowInType, Minutes, PlayerId, PlayerInId,
PlayerOutId (subs), VenueType (Home|Away|Neutral), Conditions (weather/pitch),
Outcome, Type`.
→ goalscorer/assist by player id, own-goals, penalties, VAR, corners, throw-ins,
weather — we only surface goal/card/sub today.

**Live momentum (unused, very "wow")**
- `possession` (int %) + `possessionType` (`Attack|Danger|HighDanger|Safe`)
- `parti1StateSoccer.PossibleEvent` / `parti2StateSoccer.PossibleEvent` →
  `{ Goal, Penalty, Corner }` booleans = **imminent-event predictor**
- `possibleEventSoccer` → `{ RedCard, YellowCard, VAR }`

**`lineups` → LineupData → PlayerLineupData → PlayerData**
Full lineups: `preferredName, country, team, dateOfBirth, position, rosterNumber,
starter, starred`. → real player names for commentary / first-scorer markets.

**`stats` (Map_ScoreStatKey)** — arbitrary integer stat map (shots, etc.).

> The schema is multi-sport (also Basketball & USFootball variants in the same
> `Scores` object) — soccer fields are the `*Soccer` ones. World Cup = soccer.

### Odds schema (`OddsPayload`)
`FixtureId, MessageId, Ts, Bookmaker, BookmakerId, SuperOddsType, InRunning,
GameState, MarketParameters, MarketPeriod, PriceNames[] (e.g. ["1","X","2"]),
Prices[] (decimal ×1000, int), Pct[] ("52.632" implied prob, or "NA" for quarter
handicap lines)`.
- **`Bookmaker`/`BookmakerId`** → many books → price comparison / best price / arb.
- **`SuperOddsType` + `PriceNames`/`Prices`** → markets beyond 1X2 (Over/Under,
  handicap, BTTS, correct score). Odds are **`StablePrice` demargined** consensus
  prices → cleaner probabilities than a single book.
- **`Pct`** → ready-made implied probability. **`InRunning`** → pre-match vs live.

---

## 6. What we ingest today vs. what's available

| Capability | Available | Using |
|---|---|---|
| Fixtures list | ✅ | ✅ (no competition filter) |
| 1X2 odds (snapshot + stream) | ✅ | ✅ |
| Multi-bookmaker prices | ✅ | ❌ |
| Non-1X2 markets (O/U, handicap, BTTS, CS) | ✅ | ❌ |
| Implied prob `Pct` | ✅ | ❌ |
| Historical odds (`asOf`) | ✅ | ❌ |
| Score Total | ✅ | ✅ |
| Corners / cards / half scores | ✅ | ❌ |
| Possession + danger state | ✅ | ❌ |
| Lineups / player names | ✅ | ❌ |
| Goalscorer / own goal / penalty / VAR | ✅ | ❌ (only goal/card/sub) |
| Live match clock (seconds) | ✅ | ❌ |
| Full historical score sequence | ✅ | ❌ |
| Merkle proofs + on-chain `validate_*` | ✅ | ⚠️ CPI wired in bozSettle; proof fetch/UI not surfaced |

---

## 7. Replay engine (demo-critical)

Matches finish before judging, and "there may not be live activity during
review." Judges score **heavily on the demo video**. So we should build a
**replay engine**: pull `/api/scores/historical/{fixtureId}` (full ordered
sequence) + `/api/odds/snapshot/{fixtureId}?asOf=` at stepped timestamps, then
re-emit them through our own SSE at 1×/8×/60× speed. Every track's demo then
shows a "live" match on demand. This is also honest: it's real TxLINE data, just
time-shifted.

---

## 8. Hard rules / gotchas

- **No P2P with TxL.** The TxL token is locked to data authorization. Wagering
  pools / escrows / payouts must use **USDC or SOL**, never TxL.
- Settlement must be **trustless via Merkle proofs → CPI `validate_stat`**, not a
  self-asserted oracle. Showing the proof "receipt" is explicitly rewarded.
- JWT expires in 30 days → handle 401 by re-fetching (our client caches 29d).
- Odds `Prices` are integers = decimal × 1000 (e.g. 1850 → 1.85).
- `Pct` is a 3-dp string or `"NA"` (quarter handicap) — parse defensively.
- Use the matching `apiOrigin` for the network you subscribed on.
- Prefer SSE for live; snapshots/`updates`/`historical` for backfill & replay.

---

## 9. Prize / logistics snapshot (as of 2026-07-04, ~15 days left)

| Track | Product | 1st | 2nd | 3rd | Live submissions |
|---|---|---|---|---|---|
| Prediction Markets & Settlement | bozSettle | 12k | 4k | 2k | **17** (most competitive) |
| Consumer & Fan Experiences | bozPicks | 10k | 4k | 2k | **4** (least competitive) |
| Trading Tools & Agents | bozAgent | 10k | 4k | 2k | **8** |

Deadline **2026-07-19 23:59 UTC** · winners **2026-07-29**. Each submission needs:
demo video ≤5 min (mandatory), public repo, deployed/devnet link, brief tech doc
listing TxLINE endpoints used, and API feedback. Winner interviews follow.

---

## 10. Team-confirmed intel (hackathon channel, Jul 2026)

Direct answers from the TxLINE team — closes gaps the public docs left open.
Our code that consumes these lives in `packages/txline-client/src/stat-keys.ts`
(legend + `FINAL_ACTION`/`FINAL_GOAL_STAT_KEYS`) with tests in
`apps/web/src/lib/statkeys.test.ts`.

### 10.1 `Stats` map key legend (score/discipline counters, NOT advanced stats)
A key is `periodPrefix + baseKey`. Base keys (participant 1 / 2):

| base | stat |
|---|---|
| 1 / 2 | goals |
| 3 / 4 | yellow cards |
| 5 / 6 | red cards |
| 7 / 8 | corners |

Period prefixes: `0`=Total, `1000`=H1, `2000`=HT, `3000`=H2, `4000`=ET1,
`5000`=ET2, `6000`=PE (penalties), `7000`=ETTotal. e.g. `7008` = P2 corners in
ETTotal; `1002` = P2 goals in H1 (**this is why our old `SCORE_STAT_KEY=1002`
was wrong for final settlement** — it's a first-half stat, not the total).

### 10.2 Final-result settlement (knockouts w/ ET & penalties)
Do **not** settle off an arbitrary 90-minute / in-play record. Select the score
record where `Action = "game_finalised"`, then prove **total goals** for both
sides: `/api/scores/stat-validation?fixtureId=<id>&seq=<Seq>&statKeys=1,2`.
That finalised record already reflects ET/penalties. Our ingest now maps
`action === 'game_finalised'` → `MATCH_END`.

### 10.3 On-chain validation path
Currently-supported instruction is **`validateStatV2`** (not the older
`validate_stat`). Published devnet IDL + example scripts:
- IDL: `https://raw.githubusercontent.com/txodds/tx-on-chain/nojira-re-adding-examples/examples/devnet/idl/txoracle.json`
- scripts: `https://github.com/txodds/tx-on-chain/tree/main/examples/devnet/scripts`
- Known-good devnet case (reached `finalStatus: VERIFIED`): fixture `17588309`
  (Egypt v Iran), `seq 1141`. PDA seed uses `epochDay` as **u16 LE**;
  `epochDay = floor(ts/86_400_000)`, `interval = floor((ts%86_400_000)/300_000)`
  — the timestamp used for `validateStat`'s first arg and the daily-roots PDA
  must be the **same** (use `summary.updateStats.minTimestamp`). Proof hashes
  are exactly 32 bytes, not reversed. Predicate: `{ threshold: value,
  comparison: { equalTo: {} } }`. The low-level manual Merkle hash spec
  (sha256/keccak, leaf preimage, `is_right_sibling` order) is **not yet
  published** — use the payload + `validateStatV2`, don't hand-verify.

### 10.4 Rich event semantics (score events, not `Stats` keys)
- possession → `Possession` / `PossessionType`
- shots → `shot` with `Data.Outcome` ∈ {OnTarget, OffTarget, Woodwork, Blocked}
- free kicks → `free_kick` with `Data.FreeKickType` ∈ {Safe, Attack, Danger,
  HighDanger, Offside}. A **foul** = any `free_kick` with `FreeKickType != Offside`
  (no dedicated foul signal). Offside is its own `FreeKickType`.
- VAR → `var` / `var_end`; `var.Data.Type` ∈ {Goal, Penalty, RedCard,
  SecondYellowCard, CornerKick, MistakenIdentity, Other}; `var_end.Data.Outcome`
  ∈ {Stands, Overturned}. No dedicated disallowed-goal reason field yet.
- penalty outcomes: Scored / Missed / Retake
- hydration/water break → `Action = "comment"`, `Data.Text = "Water-drinking break"`

### 10.5 Devnet liveness
Devnet is largely historical/scheduled replay — often **no live fixture in
progress**. Use the SSE stream during scheduled windows
(`/documentation/scores/schedule`) or full per-fixture historical replay. This
is exactly why our demo drives a deterministic **replay engine** (§7) rather
than depending on a live devnet match at judging time.

### 10.6 Track mapping (overview cards were swapped on the site — detail pages correct)
- **Trading Tools & Agents** = autonomous agents / odds & scores / signals /
  strategies / execution → our **Agent Arena** (Track 3).
- **Consumer & Fan Experiences** = fan-facing apps / games / bots / social →
  our **Hi-Lo + Pundit** (Track 2).
- **Prediction Markets & Settlement** → our **prop markets + settlement** (Track 1).
