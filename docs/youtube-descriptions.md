# YouTube video descriptions (one per track)

Copy-paste ready. Chapter timestamps are approximate — **adjust to your actual
recording** (keep the `0:00` line so YouTube generates chapters).

Links: live app `https://boz-picks.vercel.app` · repo
`https://github.com/elaris-xyz/bozPicks` · program (devnet)
`https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet`
· data `https://txline.io`.

---

## Track 1 — bozSettle (Prediction Markets & Settlement)

```
bozSettle — trustless prediction markets that settle themselves from TxLINE's signed match data. No oracle. No operator.

Onchain prediction markets have one hard problem: settlement. Who decides the result — and can you trust them? bozSettle removes the trusted party entirely. It opens USDC parimutuel prop markets on live World Cup matches and resolves each one from a single number in TxLINE's cryptographically-signed data, verified on-chain via a Merkle proof (validate_stat) on Solana devnet.

In this video: 8 provable prop markets (Match Result, Total Goals, Corners, Cards, 1st-Half Corners & Cards, BTTS, First Goal) open on a REAL live match, a real TxLINE Merkle proof re-folded in the browser to reproduce TxLINE's own committed root, then a controlled demo runs the full cycle end to end — stake, auto-settlement, and the verifiable-resolution receipt.

▶ Try it live: https://boz-picks.vercel.app/markets
💻 Code (open source): https://github.com/elaris-xyz/bozPicks
⛓ On-chain program (Solana devnet): https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet
📊 Data by TxLINE: https://txline.io

⏱ Chapters (adjust to your recording)
0:00  The settlement problem — no oracle, no operator
0:30  Phase A · live match — auto-opened USDC parimutuel pool
1:00  8 provable prop markets on a real match
1:30  Verify a real result — TxLINE Merkle proof, re-folded in-browser
2:15  Live on Solana devnet — parimutuel escrow + validate_stat verifier
2:45  Phase B · demo — stake instantly from the vault
3:15  Full time — 8/8 markets auto-settle
3:40  Verifiable-resolution receipt — every hop checkable
4:20  Why it matters

TxLINE endpoints used
• /api/fixtures/snapshot — auto-create markets per fixture
• /api/scores/stream + /snapshot + /historical — live + final stats
• /api/scores/stat-validation — the Merkle proof settled on-chain

Built with Next.js · Solana + Anchor (devnet) · Postgres · Redis · TypeScript.
Built for the TxLINE World Cup Hackathon — Track 1: Prediction Markets & Settlement.

#Solana #PredictionMarkets #TxLINE #Web3 #Blockchain #DeFi #WorldCup #Hackathon #Anchor #MerkleProof
```

---

## Track 2 — bozPicks (Consumer & Fan Experience)

```
bozPicks — read the game as it happens. A phone-first World Cup companion where every number is live, powered by TxLINE.

On your phone, live match data is either boring or buried — a tiny score and a flat stats table, a minute late. bozPicks turns TxLINE's live feed into something you read at a glance and play with: a win-probability gauge, a broadcast-style momentum wave, a Hi-Lo guessing game, and an AI pundit that calls the big moments out loud in a natural neural voice.

In this video: the full fan experience on a REAL live World Cup match — Match Momentum swinging on real events, the AI Pundit (written by Claude, spoken with neural TTS) reacting to a live goal, a win-probability gauge from TxLINE's implied odds, Hi-Lo streaks on real momentum, and confirmed starting lineups — then a demo replay to show how fast it all reacts on demand.

▶ Try it live: https://boz-picks.vercel.app/play
💻 Code (open source): https://github.com/elaris-xyz/bozPicks
📊 Data by TxLINE: https://txline.io

⏱ Chapters (adjust to your recording)
0:00  Live data, but boring — the problem
0:30  Phase A · a real World Cup match, live
0:55  Match Momentum — possession · threat · shots
1:30  AI Pundit — Claude-written, neural voice, on a real goal
2:10  Win Probability — implied from TxLINE odds
2:40  Hi-Lo — call the next swing on real momentum
3:10  Real starting lineups from TxLINE
3:35  Phase B · demo — how fast it all reacts
4:20  Wrap-up

TxLINE endpoints used
• /api/scores/stream + /snapshot — possession, threat, corners, cards, lineups
• /api/odds/snapshot — implied win probability
• /api/fixtures/snapshot — the live fixture list

Built with Next.js · Anthropic Claude + neural TTS · Solana (devnet) · SSE · TypeScript.
Built for the TxLINE World Cup Hackathon — Track 2: Consumer & Fan Experiences.

#TxLINE #WorldCup #Football #Soccer #AI #Claude #Solana #Web3 #SportsTech #Hackathon
```

---

## Track 3 — bozAgent (Trading Tools & Agents)

```
bozAgent — three fully-autonomous trading agents on one live TxLINE odds feed. Zero human input.

Sports data is usually too slow or too coarse to trade on programmatically. TxLINE changes that: real-time, normalized, cryptographically-anchored odds and scores. So we built three autonomous agents that read the same live feed and act with no human in the loop — a Sharp-Move Detector that self-grades its own calls, a Momentum-vs-Contrarian Arena racing two opposed strategies head-to-head, and an In-Play Market Maker quoting a two-sided market.

In this video: all three agents reacting to REAL in-running odds on a live World Cup match — sharp signals firing, the Arena opening paper positions, the market maker quoting the real 1X2 — with a live-tunable sensitivity control applied to the headless agent in seconds. Then a demo runs to full time to close the accountability loop: signals graded (accuracy), Arena settled (career P&L), market maker realized.

▶ Try it live: https://boz-picks.vercel.app/agent
💻 Code (open source): https://github.com/elaris-xyz/bozPicks
📊 Data by TxLINE: https://txline.io

⏱ Chapters (adjust to your recording)
0:00  Autonomous agents on fast, granular data
0:30  Phase A · live in-running odds, headless on a server
1:00  Sharp-Move Detector — live-tunable threshold
1:35  Live sharp signals — direction · size · confidence
2:10  Arena — Momentum vs Contrarian, live paper positions
2:40  In-Play Market Maker — quoting the real 1X2
3:15  Phase B · demo to full time — closing the loop
3:40  Verified history + accuracy · Arena settled · MM realized
4:20  Production-readiness — deterministic, headless, self-graded

TxLINE endpoints used
• /api/odds/stream + /snapshot + /updates — live in-running 1X2 odds
• /api/scores/stream — final result for grading signals

Built with Node (headless) · Solana (devnet) · Postgres · Redis · deterministic strategy math (unit-tested) · TypeScript.
Built for the TxLINE World Cup Hackathon — Track 3: Trading Tools & Agents.

#TradingBots #Solana #TxLINE #Quant #AutonomousAgents #Web3 #AlgoTrading #SportsBetting #Hackathon #DeFi
```
