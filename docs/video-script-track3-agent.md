# 🎬 Video Script — Track 3: bozAgent (Trading Tools & Agents)

**Page:** `boz-picks.vercel.app/agent` · **Target length:** 3–4 min · **Tone:** quant / trading‑desk, precise.
**Before you record:** Command Bridge (⚡) ready. Have a terminal/second tab ready to hit an API endpoint live (optional but strong). Judges weight this track on *working logic* — show the agents actually deciding.

راهنماها فارسی، 🎙 را انگلیسی بگو، 📝 را به‌صورت text روی ویدیو بیاور.

---

## بخش ۱ — تعریفِ مشکل (The Problem) · ~30s

روی `/agent` بایست.

🎙 **SAY:**
> "The organizers asked a great question: what do autonomous agents look like when the underlying data is *this* granular and *this* fast? Sports data is usually too slow or too coarse to trade on programmatically. TxLINE changes that — real‑time, normalized, cryptographically anchored odds and scores. So we built **three fully‑autonomous agents** that read the exact same live TxLINE feed and act on it with no human in the loop: a signal detector, two opposed strategies racing head‑to‑head, and a market maker."

📝 **on-screen:** `What do agents look like on fast, granular data?` · `Three autonomous agents · one TxLINE feed · zero human input`

---

## بخش ۲ — Walkthrough (کلیک‌به‌کلیک) · ~2.5min

### گام ۱ — یک بازیِ زنده راه بینداز
- روی ⚡ **پایین‑چپ** (Command Bridge) بزن، fixtureِ واقعی + outcome + **Runs in: 3m** انتخاب کن و **Run**.

🎙 **SAY:**
> "I start a live match. Everything you'll see now runs off the same TxLINE odds stream — and critically, it also runs **headless on a server**, with no browser open. The page you're watching is a live mirror of the real autonomous process."

📝 **on-screen:** `Headless on Railway · no browser needed` · `The UI mirrors the live agent`

### گام ۲ — Autonomous detection loop + Config
- روی **Autonomous detection loop** (pipeline) بایست. بعد **Agent Config** را باز کن و اسلایدرِ threshold را حرکت بده.

🎙 **SAY:**
> "Agent one is a **Sharp‑Move Detector**. It watches implied probability and flags any shift past a threshold inside a rolling window. And this is a **real** control — I drag the sensitivity here, and the live headless agent picks it up within a few seconds, no redeploy."

📝 **on-screen:** `Sharp‑Move Detector` · `Live‑tunable threshold + window` · `Applied to the running agent in ~5s`

### گام ۳ — Active signals
- اسکرول به **Active signals**. روی یک ردیفِ سیگنال اشاره کن (جهت ▲/▼، درصد، confidence طلایی/آبی/خاکستری، «N× this stance»).

🎙 **SAY:**
> "When a sharp move fires, it lands here as a signal: the outcome, the direction and size of the move, and a confidence tier. Repeated calls on the same stance collapse into one row so the desk reads the market posture at a glance."

📝 **on-screen:** `Sharp signals` · `Direction · size · confidence` · `Aggregated stance`

### گام ۴ — Verified history + accuracy
- اسکرول به **Verified history** (نمودارِ دقت + ردیف‌های HIT/MISS).

🎙 **SAY:**
> "And every signal is held accountable. At full time we grade each one against the real result and track **accuracy** — hit or miss — so the detector isn't just noise, it has a scored track record."

📝 **on-screen:** `Signals graded vs final result` · `Accuracy tracked · HIT / MISS`

### گام ۵ — Agent‑vs‑Agent Arena
- اسکرول به **Agent‑vs‑Agent Arena**. روی دو ستون (Momentum / Contrarian) بایست، منحنیِ P&L و آمار (win%, CLV, ROI, max DD) را نشان بده.

🎙 **SAY:**
> "Agent two and three race here. **Momentum** rides every price move; **Contrarian** fades it. Same feed, opposite theses. Both open paper positions autonomously, settle at full time, and compound career P&L across matches — the better strategy pulls ahead over the tournament. And we score them like a real desk: **win rate, closing‑line value, ROI, and max drawdown**."

📝 **on-screen:** `Momentum vs Contrarian` · `Opposite strategies · one feed` · `CLV · ROI · win% · max drawdown` · `Career P&L compounds`

### گام ۶ — In‑Play Market Maker
- اسکرول به **In‑Play Market Maker**. روی نردبانِ bid/fair/ask، inventory، و کارت‌های Spread edge/Fills/Volume و منحنیِ P&L بایست.

🎙 **SAY:**
> "The fourth idea — a real **In‑Play Market Maker**. It quotes a two‑sided market on every outcome off the TxLINE consensus. It's a compact Avellaneda‑Stoikov: the spread **widens with volatility**, and quotes **skew against inventory** to mean‑revert exposure. It books the spread as price crosses its quotes, and its P&L is honest mark‑to‑market — spread captured minus adverse selection. Exactly what a market operator evaluates a maker on."

📝 **on-screen:** `In‑Play Market Maker` · `Avellaneda‑Stoikov` · `Vol‑scaled spread · inventory skew` · `Mark‑to‑market P&L · spread edge`

### گام ۷ — API عمومی (قویه، اگر بلدی نشان بده)
- یک تبِ دیگر یا ترمینال باز کن، بزن: `boz-picks.vercel.app/api/agents/mm` (یا `/signals`).

🎙 **SAY:**
> "And it's not just a UI. Every agent exposes a **public JSON API** — live quotes, inventory, P&L, the raw signal log, and the tunable config — so a professional desk or a B2B integrator can consume the agent directly. Here's the market maker's live state as JSON."

📝 **on-screen:** `Public API for judges / B2B` · `/api/agents/mm · /signals · /stats · /config`

### گام ۸ — Export (اختیاری)
- روی **Export CSV** بزن.

🎙 **SAY:**
> "Full signal history exports to CSV in one click, for offline backtesting."

📝 **on-screen:** `Signal history → CSV`

---

## بخش ۳ — نقشِ TxLINE

🎙 **SAY:**
> "All three agents are pure functions of the TxLINE feed. TxLINE's **consensus StablePrice** odds — de‑margined, with implied probability — are the single clean price signal that makes move‑detection, closing‑line value, and fair‑value market‑making trustworthy without stitching bookmakers together. In‑running odds drive every decision; the final score verifies every signal and settles every position. The detection logic lives in a shared, deterministic core, so the exact same code runs the headless server agent and this UI — the browser is a mirror, not a re‑implementation."

**TxLINE endpoints used (بگو یا روی صفحه بیاور):**
`/api/odds/snapshot` & odds stream (in‑running consensus 1X2 → implied probability, the core signal) · `/api/odds/snapshot?asOf=` (closing line for CLV) · `/api/scores/snapshot` (final result → settlement + signal verification).

---

### 💡 نکتهٔ ضبط (مهم برای این track)
داورها روی «واقعاً کار می‌کند» تمرکز دارند. حتماً نشان بده که سیگنال‌ها **زنده ظاهر می‌شوند** و اعداد Arena/Market‑Maker **در حالِ تغییرند** — یک بازیِ ۳ دقیقه‌ایِ پرحادثه بزن تا حرکتِ قیمت و سیگنال زیاد باشد.
