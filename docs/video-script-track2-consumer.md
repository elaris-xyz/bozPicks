# 🎬 Video Script — Track 2: bozPicks (Consumer / Fan)

**Page:** `boz-picks.vercel.app/play` (+ a match detail page) · **Target length:** 3–4 min · **Tone:** energetic, fan‑first.
**Before you record:** sound ON (the AI Pundit speaks!), Command Bridge (⚡) ready. Pick a dramatic outcome (a red card / goal‑fest) so the momentum and pundit have something to react to.

راهنماها فارسی، 🎙 را انگلیسی بگو، 📝 را به‌صورت text روی ویدیو بیاور.

---

## بخش ۱ — تعریفِ مشکل (The Problem) · ~30s

روی `/play` بایست.

🎙 **SAY:**
> "Watching a match on your phone, the live data is either boring or buried. A tiny score, a flat stats table, numbers that update a minute late. There's granular, real‑time data flowing underneath — possession, threat, the market's own read of who's winning — but fans never get to *feel* it. **bozPicks** turns TxLINE's live feed into something you can read at a glance and play with: a live win‑probability gauge, a momentum wave, a guessing game, and an AI commentator that calls the big moments out loud."

📝 **on-screen:** `Live data, but boring` · `Read the match as it happens` · `Powered by TxLINE`

---

## بخش ۲ — Walkthrough (کلیک‌به‌کلیک) · ~2.5min

### گام ۱ — یک بازیِ زنده راه بینداز
- روی ⚡ **پایین‑چپ** (Command Bridge) بزن، یک fixtureِ واقعیِ TxLINE + یک outcomeِ پرحادثه (مثلاً red card / goal‑fest) و **Runs in: 3m** انتخاب کن، بعد **Run**.

🎙 **SAY:**
> "I start a live match from real TxLINE data. No wallet, no stakes here — this is pure fan experience, and every number you're about to see updates the instant the ball moves."

📝 **on-screen:** `Real TxLINE feed` · `No wallet · just the match`

### گام ۲ — اسکوربوردِ زنده + possession
- به بالای صفحه، روی اسکوربورد بایست (اسکور، دقیقه، نوارِ possession، خطِ رویداد مثل red card).

🎙 **SAY:**
> "Live score, live minute, and TxLINE's **ball‑possession** split — the one stat that genuinely swings both ways. When a red card or a goal hits, it shows up here immediately."

📝 **on-screen:** `Live possession` · `Events land instantly`

### گام ۳ — Match Momentum
- اسکرول به **Match Momentum**. بگذار موج شکل بگیرد؛ روی swingِ بعد از یک رویداد اشاره کن.

🎙 **SAY:**
> "This is **Match Momentum** — a broadcast‑style pressure wave. We don't have an ML model, but we have the same raw inputs TxLINE gives us: possession, the per‑side **threat state**, and attacking events. Home pressure rises green, away dips blue. Watch it swing on a goal or a red card."

📝 **on-screen:** `Match Momentum` · `Possession · threat · shots — from TxLINE`

### گام ۴ — AI Pundit (صدا را بلند کن!)
- روی کارتِ **AI Pundit** بایست، دکمهٔ **Voice** را روشن کن، بگذار یک گل/کارت اتفاق بیفتد تا صحبت کند.

🎙 **SAY:**
> "Meet the **AI Pundit**. On the big moments — goals, red cards — it calls a line written live by **Claude**, and reads it out loud in a natural neural voice, just like a TV commentator. You can even set its energy from calm to hyped."

📝 **on-screen:** `AI Pundit` · `Claude‑written commentary` · `Neural voice · live`

### گام ۵ — Hi‑Lo game
- روی کارتِ **Hi‑Lo · Possession** بایست. یک بار **Higher** یا **Lower** بزن، بگذار reading بعدی resolve کند، streak را نشان بده.

🎙 **SAY:**
> "**Hi‑Lo** turns the feed into a game: will the next possession reading go higher or lower? It's never a coin flip — it reads real TxLINE momentum, falls back to a threat‑pressure index when possession is missing, and tracks your streak. Fully shareable."

📝 **on-screen:** `Hi‑Lo · guess the swing` · `Real TxLINE momentum` · `Streaks · shareable`

### گام ۶ — Win Probability + آمار
- روی کارتِ **Win Probability** بایست (سه‌نوارِ implied prob، متر threat، possession/corners/cards).

🎙 **SAY:**
> "The **Win Probability** gauge is the market's own read — the implied probability straight from TxLINE's consensus odds — so it swings the instant the market reacts to a goal or a red card. Below it: threat state, possession, corners, cards — all live."

📝 **on-screen:** `Win Probability` · `Implied from TxLINE odds` · `Threat · possession · corners · cards`

### گام ۷ — صفحهٔ match: ترکیب + آمارِ عمیق
- روی هر بازیِ زنده کلیک کن تا صفحهٔ **match detail** باز شود. اسکرول به **Starting Lineups**، بعد **Match Stats**.

🎙 **SAY:**
> "Open any match and you get the full picture. The **Starting Lineups** — the real confirmed XI and formation pulled from TxLINE, laid out on a pitch. And **Match Stats** with the shot breakdown — on target, off target, blocked — plus goals split by half. Below, a full event **Timeline** and the odds‑movement turning points."

📝 **on-screen:** `Starting Lineups from TxLINE` · `Real XI + formation` · `Shot breakdown · goals by half` · `Timeline · turning points`

---

## بخش ۳ — نقشِ TxLINE

🎙 **SAY:**
> "Every number on this page is TxLINE. The possession split and the danger‑state drive Hi‑Lo and the momentum wave; the consensus odds drive the win‑probability gauge; the score and player‑level events — goals, cards, subs with real player names — drive the feed and the AI Pundit; and the lineup record gives us the confirmed starting eleven and formation. One normalized TxLINE stream fans out to every card in real time — nothing on this page is mocked."

**TxLINE endpoints used (بگو یا روی صفحه بیاور):**
`/api/fixtures/snapshot` · `/api/scores/updates` & `/api/scores/snapshot` (goals, cards, corners, possession, danger, lineups, player IDs) · `/api/odds/snapshot` (consensus 1X2 → implied probability).
