# 🎬 Video Script — Track 1: bozSettle (Prediction & Settlement)

**Page:** `boz-picks.vercel.app/markets` · **Length:** 3–5 min · **Tone:** confident, technical, calm.

## 🎥 پلنِ ضبط — دو فاز
- **فاز A — حینِ بازیِ واقعی (زنده):** نشان می‌دهی روی بازیِ واقعیِ جام‌جهانی و دادهٔ زندهٔ TxLINE کار می‌کند (مارکت‌های باز + اثباتِ رمزنگارانهٔ نتیجهٔ واقعی). تسویهٔ کامل چون بازی تمام نشده اینجا نیست.
- **فاز B — بعد از پایانِ بازیِ واقعی، با یک دمو:** یک بازیِ دمو با outcomeِ دلخواه ران می‌کنی تا **چرخهٔ کامل**، مخصوصاً **تسویهٔ خودکار + رسیدِ اثبات** را کنترل‌شده نشان دهی.

> ⚠️ برای فاز A باید سرویسِ ingest روی Railway ری‌دیپلوی و در حال اجرا باشد تا دادهٔ بازیِ واقعی جاری شود. فاز B (دمو) تضمینی کار می‌کند.

راهنماها فارسی، 🎙 را انگلیسی بگو، 📝 را به‌صورت text روی ویدیو بیاور.

---

## بخش ۱ — تعریفِ مشکل (The Problem) · ~30s

🎙 **SAY:**
> "Onchain prediction markets have one hard problem: **settlement**. Who decides the result, and can you trust them? Almost everyone leans on a human or a centralized oracle to declare the winner — a single point of trust and failure. We built **bozSettle** to remove it: parimutuel markets that settle themselves, trustlessly, straight from **TxLINE's** cryptographically‑signed match data — no oracle, no operator."

📝 `The settlement problem` · `No oracle. No operator.` · `Trustless settlement from signed data`

---

## بخش ۲ — Walkthrough

### 🔴 فاز A — روی بازیِ واقعیِ زنده (اثبات می‌کند واقعی است)

**گام A1 — بگو الان واقعیه.** روی هیرو + بنرِ زندهٔ Pool بایست (اسمِ تیم‌های واقعی + دقیقه).
🎙 **SAY:**
> "What you're seeing right now is a **live World Cup match**, streaming from TxLINE. The moment it kicked off, our app opened a live **USDC parimutuel pool** on it — automatically, no operator."
📝 `LIVE World Cup match` · `Auto‑opened USDC parimutuel pool`

**گام A2 — ۸ مارکتِ باز روی بازیِ واقعی.** اسکرول به **Predict & stake**، روی کارت‌ها بایست.
🎙 **SAY:**
> "Eight parametric prop markets open on this real match — Match Result, Total Goals, Corners, Cards, First‑Half Corners and Cards, Both Teams To Score, First Goal. Each one resolves from a single number in TxLINE's data, so each one is provable. I can stake on any of them right now, live."
📝 `8 provable prop markets on a REAL match` · `Instant vault stake`

**گام A3 — «Verify a real result» (قوی‌ترین لحظهٔ فاز A).** اسکرول به **How settlement works** → کارتِ **Verify a real result**؛ بگذار لود شود (این بازیِ واقعیِ زنده / تمام‌شده را می‌گیرد).
🎙 **SAY:**
> "And here's the proof it's real, not a mock. This card pulls **this fixture's** actual TxLINE **Merkle proof** and re‑folds it right in my browser to reproduce **TxLINE's own committed root**. Green check — the score is proven against real cryptography, live, with no oracle and nothing bundled."
📝 `Real TxLINE Merkle proof` · `Re‑folded in‑browser` · `Reproduces TxLINE's committed root`

**گام A4 — on-chain.** روی نوارِ **On‑chain · Solana devnet** بایست.
🎙 **SAY:**
> "Both programs — our parimutuel + USDC escrow, and the TxLINE `validate_stat` verifier — are deployed and live on Solana devnet. One click opens them on the explorer."
📝 `Live on Solana devnet` · `Parimutuel + USDC escrow · validate_stat verifier`

🎙 **بستنِ فاز A:**
> "The one thing I can't show on a live match is the final settlement — because it isn't over yet. So let me run a controlled demo and take you through the whole cycle end to end."

### 🎮 فاز B — چرخهٔ کامل روی دمو (بعد از پایانِ بازیِ واقعی)

**گام B1 — دمو را راه بینداز.** روی ⚡ **پایین‑چپ** (Command Bridge)، یک fixtureِ واقعی + یک **outcome** انتخاب کن، **Runs in: 3m**، بعد **Run**.
🎙 **SAY:**
> "The Command Bridge lets me replay a match deterministically — I choose the exact final outcome so you can watch every market resolve to it. Everything still runs off the same live pipeline."
📝 `Command Bridge · deterministic replay` · `You pick the outcome`

**گام B2 — stake + تغییرِ نظر.** روی یک outcome کلیک کن (تگِ **You** طلایی + Order Flow). بعد روی outcomeِ دیگرِ همان کارت کلیک کن.
🎙 **SAY:**
> "I stake instantly from my game vault — no signature per bet, I signed once at deposit. Change my mind and the app **refunds the old stake and moves it** — one pick per market, never a double charge. My orders are tagged in the live Order Flow."
📝 `Instant vault stake · no per‑bet signing` · `Change pick = refund + move` · `Live Order Flow`

**گام B3 — تسویهٔ خودکار در full‑time.** بگذار بازی به پایان برسد؛ کارت‌ها **Settled** می‌شوند و رسید stamp می‌خورد.
🎙 **SAY:**
> "At full time, every market settles **automatically** — no button, no operator, all eight at once."
📝 `Auto‑settle at full time · no operator`

**گام B4 — رسیدِ Verifiable Resolution.** روی رسیدِ یک کارتِ settled کلیک کن.
🎙 **SAY:**
> "And every settlement shows its work: the exact TxLINE **stat key and value** that decided it, the **Merkle root**, the proof path, and the `validate_stat` transaction. No trusted oracle — you can re‑check the math yourself."
📝 `Verifiable Resolution receipt` · `Stat key · Merkle root · proof path · validate_stat`

**گام B5 — My Predictions (سریع).** از **More → My Predictions**.
🎙 **SAY:**
> "Every stake lands in the player's record — pick, market, stake, result, payout — anchored on devnet."
📝 `Your on‑chain record · graded from proofs`

---

## بخش ۳ — نقشِ TxLINE

🎙 **SAY:**
> "TxLINE is the entire backbone of settlement. We settle each market from the exact `Stats` key that decides it, proven at the `game_finalised` record under period 100. For the trustless proof we fetch TxLINE's `stat-validation` **Merkle proof** and either re‑fold it in the browser — as you saw on the live match — or pass it into our on‑chain `validate_stat` CPI. First‑half markets prove the same base keys under TxLINE's H1 period prefix. Because the deciding number comes from TxLINE's own signed commitment, the whole market is trustless by construction."

**Endpoints:** `/api/fixtures/snapshot` · `/api/scores/snapshot` (goals/corners/cards) · `/api/scores/stat-validation` (Merkle proof → validate_stat) · `game_finalised`, period 100.
