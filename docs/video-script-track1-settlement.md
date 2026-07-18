# 🎬 Video Script — Track 1: bozSettle (Prediction & Settlement)

**Page:** `boz-picks.vercel.app/markets` · **Target length:** 3–4 min · **Tone:** confident, technical, calm.
**Before you record:** connect the wallet, make sure you have some vault balance, and have the **Command Bridge** (⚡ bottom‑left) ready. Screen at 100% zoom, sound ON (for the settlement chime).

راهنمای فارسی برای تو، جملاتِ 🎙 را انگلیسی بگو، 📝 را به‌صورت text روی ویدیو بیاور.

---

## بخش ۱ — تعریفِ مشکل (The Problem) · ~30s

روی صفحهٔ `/markets` بایست، دوربین روی هیرو.

🎙 **SAY:**
> "Onchain prediction markets have one hard problem: **settlement**. Who decides the result, and can you trust them? Most markets rely on a human or a centralized oracle to declare the winner — that's a single point of trust and a single point of failure. We built **bozSettle** to remove it: parimutuel prediction markets that settle themselves, trustlessly, straight from **TxLINE's** cryptographically‑signed match data — no oracle, no operator, no 'trust us'."

📝 **on-screen:** `The settlement problem` · `No oracle. No operator.` · `Trustless settlement from signed data`

---

## بخش ۲ — Walkthrough (کلیک‌به‌کلیک) · ~2.5min

### گام ۱ — یک بازی زنده راه بینداز (Command Bridge)
- روی آیکنِ ⚡ **پایین‑چپ** کلیک کن (Command Bridge باز می‌شود).
- یک fixtureِ واقعیِ TxLINE از dropdown انتخاب کن (مثلاً France v England)، یک **outcome** انتخاب کن، و **Runs in: 3m** را بزن، بعد **Run**.

🎙 **SAY:**
> "This is the judge's control panel. I pick a **real TxLINE World Cup fixture**, choose the exact final outcome, and press Run. Every page in the app now reacts to one live data stream — nothing is mocked."

📝 **on-screen:** `Command Bridge` · `Real TxLINE fixture` · `One live feed drives every page`

### گام ۲ — بنرِ زندهٔ Pool
- اسکرول به بالای صفحه، روی **live pool banner** بایست.

🎙 **SAY:**
> "The moment the match kicks off, a live **USDC parimutuel pool** opens. Winners split the whole pool pro‑rata, minus a two‑percent fee. This is the pool everyone stakes into."

📝 **on-screen:** `USDC parimutuel` · `Winners split the pool · 2% fee`

### گام ۳ — بخشِ «Predict & stake» (کارت‌های مارکت)
- اسکرول پایین به بخشِ **Predict & stake**. روی کارت‌ها بایست.

🎙 **SAY:**
> "We open **eight parametric prop markets** on every match — Match Result, Total Goals, Total Corners, Total Cards, First‑Half Corners, First‑Half Cards, Both Teams To Score, and First Goal. Every one resolves from a single number in TxLINE's data, so every one is provable."

📝 **on-screen:** `8 provable prop markets` · `Goals · Corners · Cards · 1st‑Half · BTTS · First Scorer`

### گام ۴ — یک stake بزن + تغییرِ نظر
- روی یک outcome (مثلاً OVER در Total Corners) کلیک کن — stake از vault کم می‌شود، تگِ طلاییِ **You** می‌آید.
- روی یک outcome دیگرِ همان کارت کلیک کن.

🎙 **SAY:**
> "I stake instantly from my game vault — no signature per bet, because I signed once at deposit. If I change my mind, the app **refunds the old stake and moves it** — one pick per market, never a double charge. My own orders are tagged in the live **Order Flow** on the right."

📝 **on-screen:** `Instant vault stake · no per‑bet signing` · `Change pick = refund + move` · `Live Order Flow`

### گام ۵ — تسویهٔ خودکار در پایانِ بازی
- منتظر بمان تا بازی به full‑time برسد (یا زودتر گرفته باشی). کارت‌ها به **Settled** می‌روند و رسید stamp می‌خورد.
- روی سه‌نقطهٔ یک کارتِ settled یا دکمهٔ رسید کلیک کن تا **Verifiable Resolution receipt** باز شود.

🎙 **SAY:**
> "At full time, every market settles **automatically** — no button, no operator. Open a receipt and you see exactly what decided it: the TxLINE stat key and value, the **Merkle root**, the proof path, and the `validate_stat` transaction. The outcome needs no trusted oracle — you can check the math yourself."

📝 **on-screen:** `Auto‑settle at full time` · `Verifiable Resolution receipt` · `Stat key · Merkle root · proof path · validate_stat`

### گام ۶ — «Verify a real result» (مهم‌ترین لحظه)
- اسکرول پایین به بخشِ **How settlement works** → کارتِ **Verify a real result**.
- بگذار خودش لود شود (یک بازیِ واقعیِ تمام‌شدهٔ TxLINE).

🎙 **SAY:**
> "This is the strongest part. The demo receipts are simulated — but here we do the **real thing**. We pull a real, finished World Cup fixture's TxLINE **Merkle proof**, and re‑fold it right here in the browser to reproduce **TxLINE's own committed root**. Green check — the result is proven against real cryptography, live, with no oracle and nothing bundled."

📝 **on-screen:** `Real TxLINE Merkle proof` · `Re‑folded in your browser` · `Reproduces TxLINE's committed root` · `Trustless — no oracle`

### گام ۷ — اثباتِ on-chain
- روی نوارِ **On‑chain · Solana devnet** بایست (دو برنامهٔ دیپلوی‌شده با لینکِ explorer).

🎙 **SAY:**
> "And it's real on devnet: our parimutuel + USDC‑escrow program and the TxLINE `validate_stat` verifier are both deployed and executable — one click opens them on Solana Explorer."

📝 **on-screen:** `Live on Solana devnet` · `Parimutuel + USDC escrow` · `TxLINE validate_stat verifier`

### گام ۸ — My Predictions (اختیاری، سریع)
- از منوی **More → My Predictions** برو.

🎙 **SAY:**
> "Every stake lands in the player's on‑chain record — pick, market, stake, result, and payout, with the settlement anchored on devnet."

📝 **on-screen:** `Your record · graded from proofs`

---

## بخش ۳ — نقشِ TxLINE

🎙 **SAY:**
> "TxLINE is the entire backbone of settlement. We take TxLINE's normalized match data — goals, corners, and cards — and settle each market from the exact `Stats` key that decides it, proven at the `game_finalised` record under period 100. For the trustless proof, we fetch TxLINE's `stat-validation` **Merkle proof** and either re‑fold it in the browser or pass it into our on‑chain `validate_stat` CPI. First‑half markets use the same base keys under TxLINE's H1 period prefix. Because the winning number comes from TxLINE's own signed commitment — not from us — the whole market is trustless by construction."

**TxLINE endpoints used (بگو یا روی صفحه بیاور):**
`/api/fixtures/snapshot` · `/api/scores/snapshot` (final goals/corners/cards) · `/api/scores/stat-validation` (Merkle proof for validate_stat) · `game_finalised` record, period 100.
