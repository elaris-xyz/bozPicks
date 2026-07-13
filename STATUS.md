# STATUS — «الان کجاییم»

> فایل زنده‌ی وضعیت. PLAN.md = استراتژی بزرگ · این فایل = «resume here».
> **قانون:** آخر هر session این فایل رو آپدیت کن (۲ دقیقه). تاریخ رو عوض کن.

**آخرین آپدیت:** 2026-07-13 (بازبینی جامع آمادگی + Match Momentum نهایی شد)

---

## 🎯 الان کجاییم (یک خط)

**محصول از نظر ساخت تمومه و judge-ready ست** — هر سه تراک hero کامل دارن، ۳۵ تست سبز، build سبز، ~۱۰۰ کامیت روی `github.com/elaris-xyz/bozPicks`. **تنها چیزی که مونده سه شرط اجباری submission ست: Deploy + دمو ویدیو ×۳ + Submit ×۳.** ‏۶ روز مانده (deadline: Jul 19 · 23:59 UTC).

---

## ✅ چی از July 4 به بعد اضافه شد (خلاصه‌ی ~۱۰۰ کامیت)

- **J1–J6 credibility hardening**: رسیدهای صادقانه SIMULATED/VERIFIED، تست‌های قطعی، ایجنت headless واقعی، Hi-Lo روی stat واقعی، مسیر settlement آنچین واقعی.
- **UI بلوغ کامل**: Command Bridge حرفه‌ای، PlayHero/MarketsHero/AgentHero سینمایی، LiveScoreboard broadcast، Live Feed حرفه‌ای، مودال wallet اختصاصی.
- **Vault economy**: deposit یک‌بار / stake فوری / cash-out (devnet SOL)، ledger روی Postgres + reconcile آنچین، چیپ موجودی در nav.
- **AI Pundit v2**: صدای عصبی مرد (Groq Orpheus)، انتخاب گزارشگر (۶ صدا)، کنترل انرژی ۳سطحی، صف گفتار بدون قطع‌شدن، متن‌های broadcaster با Claude.
- **Match Momentum**: منحنی فشار دوطرفه‌ی broadcast از دیتای واقعی TxLINE (possession/danger/events) — تک‌منحنی نرم با color-split استاندارد.
- **statproof.ts**: تأیید Merkle proof با spec تأییدشده (`sha256(u32_le(key)‖i32_le(value)‖i32_le(period))`).
- **کلیدهای stat واقعی** در settlement (`TXLINE_STAT_KEYS`) + رسید شامل `txlineStatKeys`.
- Play page سه‌ستونه (Pundit | Hi-Lo | Win Prob) + Momentum تمام‌عرض.

## 🔴 کار بعدی — سه شرط اجباری submission (به ترتیب)

1. **Deploy (امروز/فردا)** — Vercel (web) + Railway (ingest/agent/keeper)، سه subdomain. قبلش: `REDIS_URL` تازه + کلید Groq جدید (کلید قبلی توی چت به اشتراک گذاشته شد → revoke). env های prod: DATABASE_URL، REDIS_URL، TXLINE_API_KEY، ANTHROPIC_API_KEY، GROQ_API_KEY، SETTLEMENT_KEEPER_KEYPAIR، NEXT_PUBLIC_RPC_URL.
2. **Smoke test روی prod** — health، SSE، wallet (با Solflare — باگ Phantom devnet RPC)، Command Bridge، vault.
3. **دمو ویدیو ×۳ (Jul 14–15، هم‌زمان با نیمه‌نهایی‌ها)** — تیم TxLINE تأیید کرد نیمه‌نهایی/فینال پوشش داده می‌شن. ویدیو با دیتای *زنده‌ی واقعی* > replay. ‏Command Bridge پشتیبانه. Track 1: حتماً TX روی Explorer نشون بده. ≤۵ دقیقه، بدونش disqualify.
4. **Submit ×۳ (Jul 16–17، نه روز آخر)** — Superteam Earn، سه لینک جدا؛ X-verification گاهی گیر می‌کنه، زود اقدام کن. لینک‌های `<deploy>` توی `docs/submissions/*.md` رو پر کن.

---

## 🔧 چطور resume کنیم (dev)

```bash
# وب — پورت 3100 (پورت 3000 روی این ویندوز رزرو شده)
pnpm --dir apps/web dev --port 3100

# ingest (داده‌ی زنده TxLINE) و agent (sharp detector + arena)
pnpm ingest
pnpm agent

# تست‌ها (۳۵ تست قطعی)
pnpm --filter=web test
```

**نکات محیط:**
- `NEXT_DIST_DIR=.next-dev` در `apps/web/.env.local` — دور زدن قفل `.next/trace` روی ویندوز
- type-check: `pnpm --filter=web type-check`
- دمو: Command Bridge (⚡ پایین-چپ) یا `POST /api/demo`

**آدرس‌های کلیدی:**
- Program ID: `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh` (devnet)
- Explorer: `https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet`
- TxLINE devnet: `txline-dev.txodds.com` · program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- مرجع کامل TxLINE: `docs/TXLINE-REFERENCE.md`

---

## ⚠️ یادآوری‌های حیاتی

- **قبل از deploy**: کلید Groq share شده رو revoke کن + `REDIS_URL` تازه بگیر.
- **لایسنس §7.1 TxLINE**: دیتای خام TxLINE رو توی repo/باندل عمومی commit نکن (الان نمی‌کنیم — replay از API زنده می‌کشه). توی ویدیو هم ادعای bundle نکن.
- **Phantom devnet RPC باگ داره** (تأیید جمعی در تلگرام) — دمو با Solflare یا `NEXT_PUBLIC_RPC_URL` اختصاصی.
- تم فقط dark · LIVE همیشه سبز — تصمیمات ثابت طراحی.

---

*این فایل رو مختصر نگه دار. جزئیات تاریخی → PLAN.md.*
