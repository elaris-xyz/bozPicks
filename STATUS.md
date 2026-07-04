# STATUS — «الان کجاییم»

> فایل زنده‌ی وضعیت. PLAN.md = استراتژی بزرگ · این فایل = «resume here».
> **قانون:** آخر هر session این فایل رو آپدیت کن (۲ دقیقه). تاریخ رو عوض کن.

**آخرین آپدیت:** 2026-07-03 (My Predictions واقعی + fix crash سرور)

---

## 🎯 الان کجاییم (یک خط)

UI/UX کامل + صفر emoji + **My Predictions واقعی** (تاریخچه‌ی wallet + P&L) + یه **باگ crash سرور** حل شد (SSE controller). محصول از نظر ساخت آماده‌ست؛ **مرحله‌ی بعدی deployment و demo video است** — ولی هنوز روی git نرفتیم (به‌خواست کاربر، همه local).

---

## ✅ آخرین کاری که تموم شد

**سری کامل طراحی UI/UX + بازبینی کیفی (July 2–3):**
- کارت پوستری، آیکن فلت، منوی نئون، ticker سرتاسری
- تایم‌لاین دوطرفه، odds کلیک‌پذیر → Bet Slip
- toggle چگالی (پوستر↔لیست)، نشانگر odds ▲▼
- همه‌ی صفحه‌ها + مودال‌ها یکدست
- reskin مودال wallet-adapter، skeleton، reduced-motion
- **بازبینی کیفی (۲ دور):** آخرین emoji/نمادها (🧠 AI، 🚨 signals، ✅❌، 📼 replay، 🏟️، ⚠ config، error page) حذف → صفر نماد سرگردان
- **گروه‌بندی روز** در لیست Upcoming (Today / Friday 26 June + شمارش) — کار می‌کنه در هر دو view (لیگ نداریم توی feed، فقط تاریخ)
- **✅ production build تأیید شد** — `next build` بدون خطا، همه‌ی ۸ صفحه static + همه route ها ساخته شد. **deploy از نظر build de-risk شد.** (dir موقت `.next-build` — gitignore شده)
- ۴ باگ حل شد (ECONNRESET، async params، demo تکراری، fonts)

جزئیات کامل → PLAN.md بخش چهار.

---

## ✅ روی GitHub رفت (July 4)

مخزن: **github.com/elaris-xyz/bozPicks** · branch `main` · commit `4ac80fd`
- history با orphan branch تازه‌سازی شد → **صفر secret** در history/remote (verified)
- keypair + پسورد Neon **قبل از push پاک شدن، هیچ‌وقت لو نرفتن → rotate لازم نیست**
- `check-db.js` حالا `DATABASE_URL` رو از env می‌خونه (پسورد hardcode حذف شد)
- `.gitignore` کامل شد؛ `.txline-keypair.json` هنوز local روی دیسک هست (gitignore) برای dev

## 🔴 کار بعدی (به ترتیب اولویت)

1. **Deploy** — Vercel (web) + Railway (ingest/agent/keeper). سه subdomain. env vars روی prod ست بشه (DATABASE_URL، REDIS_URL، TXLINE_API_KEY، ANTHROPIC_API_KEY، SETTLEMENT_KEEPER_KEYPAIR، BOZPICKS_PROGRAM_ID).
2. **Smoke test روی prod** — health، SSE، wallet connect، demo.
3. **Demo video × 3** (≤5 دقیقه هرکدوم) — بدون این disqualify.
4. **Submit × 3** — سه لینک جدا.

---

## 🔧 چطور resume کنیم (dev)

```bash
# وب — پورت 3100 (پورت 3000 روی این ویندوز رزرو شده)
pnpm --dir apps/web dev --port 3100
# یا از طریق preview: launch config «bozpicks-web» در .claude/launch.json پروژه‌ی WP-news-collector

# ingest (داده‌ی زنده TxLINE) و agent (sharp detector)
pnpm ingest
pnpm agent
```

**نکات محیط:**
- `NEXT_DIST_DIR=.next-dev` در `apps/web/.env.local` — دور زدن قفل `.next/trace` روی ویندوز
- **اگه preview_screenshot پشت‌سرهم timeout داد** (صفحه سالمه ولی عکس گیر می‌کنه): یه `preview_resize` بزن (مثلاً tablet بعد desktop) — compositor مرورگر رو reset می‌کنه و عکس دوباره کار می‌کنه. eval همیشه کار می‌کنه پس برای تأیید از DOM هم می‌شه استفاده کرد.
- type-check: `cd apps/web && pnpm exec tsc --noEmit`
- demo زنده: دکمه‌ی «Run Demo» یا `POST /api/demo` (فقط یک demo در هر لحظه)
- تست فلش odds به‌صورت دستی: publish یه `ODDS_UPDATE` به کانال `boz:global` روی Redis

**آدرس‌های کلیدی:**
- Program ID: `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh` (devnet)
- Explorer: `https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet`

---

## 🧵 threadهای باز / گزینه‌های کاری

اگه کاربر بگه «ادامه بده» و مسیر مشخصی نگفت، این‌ها روی میزن:
- **بازبینی کیفی agent + stats + landing ها** — دور بعدی sweep (match page شد)
- **گروه‌بندی لیگ** در لیست upcoming (نیمه‌کاره؛ schedule گروه‌بندی روز داره، home نداره)
- ~~My Predictions واقعی~~ ✅ شد — حالت connected با wallet واقعی هنوز چشمی تست نشده (type-safe و API آماده)
- **light mode** — عمداً به بعد از هکاتون موکول شد (تصمیم ثابت)
- برگشت به مسیر submission (git/deploy/video) هر وقت کاربر آماده بود

---

## ⚠️ یادآوری‌های حیاتی

- **keypair در git history** — تا وقتی پاک نشده، **repo رو public نکن / push نزن**.
- همه‌چیز فقط local و فقط ۲ commit قدیمی؛ **بک‌آپ خارج از git نداریم** — مراقب باش.
- تم فقط dark؛ light mode درخواست نشه.
- LIVE همیشه **سبز** (نه قرمز) — تصمیم طراحی ثابت.

---

*این فایل رو مختصر نگه دار. جزئیات تاریخی → PLAN.md.*
