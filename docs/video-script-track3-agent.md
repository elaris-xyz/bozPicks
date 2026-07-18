# 🎬 Video Script — Track 3: bozAgent (Trading Tools & Agents)

**Page:** `boz-picks.vercel.app/agent` · **Length:** 3–5 min · **Tone:** quant / trading‑desk, precise.
Judges weight this track on **working logic** — show the agents actually deciding, on real data first.

## 🎥 پلنِ ضبط — دو فاز
- **فاز A — حینِ بازیِ واقعیِ زنده:** ایجنت‌ها روی حرکتِ اودزِ **واقعی** واکنش نشان می‌دهند (سیگنال، Arena، Market Maker). اثبات می‌کند روی دادهٔ واقعی کار می‌کند. اما چون بازی تمام نشده، «verify/settlement» هنوز نیست — سیگنال‌ها فقط جمع می‌شوند.
- **فاز B — بعد از پایانِ بازیِ واقعی، با دمو:** یک دمو تا full‑time ران می‌کنی تا **چرخهٔ کاملِ پاسخگویی** را ببینی: سیگنال‌ها **verified** (accuracy)، Arena **settled** (career P&L)، Market Maker **realized**.

> ⚠️ فاز A به جاری‌بودنِ اودزِ in‑running بازیِ واقعی (ری‌دیپلوی ingest) وابسته است؛ فاز B تضمینی کار می‌کند.

راهنماها فارسی، 🎙 انگلیسی بگو، 📝 روی صفحه بیاور.

---

## بخش ۱ — تعریفِ مشکل (The Problem) · ~30s

🎙 **SAY:**
> "The organizers asked: what do autonomous agents look like when the data is *this* granular and *this* fast? Sports data is usually too slow or too coarse to trade on programmatically. TxLINE changes that — real‑time, normalized, cryptographically anchored odds and scores. So we built **three fully‑autonomous agents** that read the same live TxLINE feed and act with no human in the loop: a signal detector, two opposed strategies racing head‑to‑head, and a market maker."

📝 `Agents on fast, granular data` · `Three autonomous agents · one TxLINE feed · zero human input`

---

## بخش ۲ — Walkthrough

### 🔴 فاز A — روی حرکتِ اودزِ واقعیِ زنده

**گام A1 — بگو زنده و headless است.** روی هیرو/بنر بایست.
🎙 **SAY:**
> "Everything here runs off TxLINE's **live in‑running odds** on a real World Cup match — and it also runs **headless on a server**, with no browser open. This page is a live mirror of the real autonomous process."
📝 `LIVE real‑match odds` · `Headless on Railway · UI is a mirror`

**گام A2 — Detector + Config روی بازیِ واقعی.** روی **Autonomous detection loop** بایست؛ **Agent Config** را باز کن و اسلایدرِ threshold را حرکت بده.
🎙 **SAY:**
> "Agent one, the **Sharp‑Move Detector**, watches the real implied probability and flags any shift past a threshold. And it's a live control — I drag the sensitivity and the running headless agent applies it within seconds, no redeploy."
📝 `Sharp‑Move Detector` · `Live‑tunable · applied in ~5s`

**گام A3 — Active signals روی حرکتِ واقعی.** اسکرول به **Active signals**؛ روی یک سیگنالِ واقعی اشاره کن (جهت، درصد، confidence).
🎙 **SAY:**
> "As the real market moves, sharp signals land here — the outcome, the direction and size of the move, and a confidence tier. These are firing on the live match right now."
📝 `Live sharp signals` · `Direction · size · confidence`

**گام A4 — Arena + Market Maker روی بازیِ واقعی.** اسکرول به **Arena** و **In‑Play Market Maker**؛ نشان بده اعداد در حالِ تغییرند.
🎙 **SAY:**
> "The **Arena** — Momentum rides each real move, Contrarian fades it, both opening paper positions live. And the **In‑Play Market Maker** is quoting a two‑sided market on the real odds this very second — its inventory and P&L moving with the match."
📝 `Momentum vs Contrarian · live` · `Market maker quoting the REAL 1X2`

🎙 **بستنِ فاز A:**
> "What I can't show mid‑match is the scoring — signals get graded, and positions settle, only at full time. So let me run a demo to full time and close the loop."

### 🎮 فاز B — چرخهٔ کاملِ پاسخگویی روی دمو (بعد از بازیِ واقعی)

**گام B1 — دموی پرحادثه تا full‑time.** ⚡ Command Bridge → outcome + **Runs in: 3m** → **Run**. بگذار تمام شود.
🎙 **SAY:**
> "A deterministic replay to full time, so you can see the whole accountability cycle."
📝 `Command Bridge · replay to full time`

**گام B2 — Verified history + accuracy.** اسکرول به **Verified history** (HIT/MISS + نمودارِ دقت).
🎙 **SAY:**
> "At full time every signal is graded against the real result — hit or miss — and the detector's **accuracy** is tracked. It isn't noise; it has a scored record."
📝 `Signals graded vs result · accuracy · HIT/MISS`

**گام B3 — Arena settled + career P&L.** روی ستون‌های Arena (win%, CLV, ROI, max DD, career).
🎙 **SAY:**
> "The Arena settles: both strategies scored like a real desk — **win rate, closing‑line value, ROI, max drawdown** — and career P&L compounds across matches so the better thesis pulls ahead over the tournament."
📝 `CLV · ROI · win% · max drawdown` · `Career P&L compounds`

**گام B4 — Market Maker realized + API.** روی نردبانِ bid/fair/ask + Spread edge/Fills/Volume. بعد یک تبِ دیگر: `boz-picks.vercel.app/api/agents/mm`.
🎙 **SAY:**
> "The market maker realizes its book — a compact Avellaneda‑Stoikov: spread widens with volatility, quotes skew against inventory, P&L is honest mark‑to‑market. And it's not just a UI — every agent exposes a **public JSON API** a real desk could consume. Here's the maker's live state as JSON."
📝 `Avellaneda‑Stoikov · vol spread · inventory skew` · `Public API · /api/agents/mm · /signals · /stats`

---

## بخش ۳ — نقشِ TxLINE

🎙 **SAY:**
> "All three agents are pure functions of the TxLINE feed. TxLINE's **consensus StablePrice** odds — de‑margined, with implied probability — are the single clean signal that makes move‑detection, closing‑line value, and fair‑value market‑making trustworthy without stitching bookmakers together. In‑running odds drive every decision; the final score verifies every signal and settles every position. The logic lives in a shared, deterministic core, so the exact same code runs the headless server agent and this UI — the browser is a mirror, not a re‑implementation."

**Endpoints:** `/api/odds/snapshot` & odds stream (in‑running consensus 1X2 → implied prob — the core signal) · `/api/odds/snapshot?asOf=` (closing line for CLV) · `/api/scores/snapshot` (final result → verification + settlement).

---

### 💡 نکتهٔ ضبط
داورها روی «واقعاً کار می‌کند» حساس‌اند. در فاز A حتماً نشان بده اعداد **زنده تغییر می‌کنند**؛ در فاز B یک outcomeِ پرحرکت بزن تا سیگنال و P&L زیاد باشد.
