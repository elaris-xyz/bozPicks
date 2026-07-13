# STATUS — «الان کجاییم»

> فایل زنده‌ی وضعیت. PLAN.md = استراتژی بزرگ · این فایل = «resume here».
> **قانون:** آخر هر session این فایل رو آپدیت کن (۲ دقیقه). تاریخ رو عوض کن.

**آخرین آپدیت:** 2026-07-13 شب (✅ DEPLOY کامل شد — Vercel + Railway ×۳، تست سرتاسری پاس)

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

## ✅ DEPLOY کامل شد (Jul 13 شب)

- **web** → Vercel: `https://boz-picks.vercel.app` (auto-deploy از GitHub main)
- **ingest / agent / keeper** → Railway (پروژه‌ی «attractive-heart»)، هر سه Online
- **Redis**: Upstash `equal-pheasant-153456` (rediss://) — مشترک بین Vercel و Railway
- **DB**: Neon `ep-long-shadow-as1k9txg` — مشترک، هر ۱۰ جدول
- **تست سرتاسری پاس شد**: دمو روی prod → agent روی Railway از Redis مشترک شنید → سیگنال ۸۹→۹۲ در DB مشترک → `/api/agents/stats` زنده. TTS هم روی prod سبز (audio/wav).
- نکات Railway که خوردیم (برای آینده): تشخیص Rust به‌خاطر Cargo.toml → فیکس `RAILPACK_PACKAGES=node@20 pnpm` + `railpack.json`؛ Watch Paths جلوی auto-deploy رو می‌گرفت → خالی شد؛ `REDIS_URL` باید URL خالص `rediss://` باشه نه دستور CLI؛ «Redeploy» همون کامیت قبلی رو می‌سازه، کامیت جدید فقط با push.
- **Vercel Security Checkpoint** ممکنه برای درخواست‌های API ای 403 بده (bot challenge) — اگه داورها گزارش کردن، Attack Challenge Mode رو در Vercel چک کن.

## 🔴 کار بعدی — دو شرط اجباری باقی‌مانده

1. **دمو ویدیو ×۳ (Jul 14–15، هم‌زمان با نیمه‌نهایی‌ها)** — تیم TxLINE تأیید کرد نیمه‌نهایی/فینال پوشش داده می‌شن. ویدیو با دیتای *زنده‌ی واقعی* > replay. ‏Command Bridge پشتیبانه. Track 1: حتماً TX روی Explorer نشون بده. ≤۵ دقیقه، بدونش disqualify. Wallet با Solflare (باگ Phantom devnet).
2. **Submit ×۳ (Jul 16–17، نه روز آخر)** — Superteam Earn، سه لینک: `/play` · `/markets` · `/agent` روی همین دامنه؛ X-verification گاهی گیر می‌کنه، زود اقدام کن. لینک‌های `<deploy>` توی `docs/submissions/*.md` رو پر کن.

(یادآوری: کلید Groq ای که توی چت TxLINE به اشتراک گذاشته شد هنوز revoke نشده — قبل از submit انجامش بده و کلید جدید رو در Vercel ست کن.)

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
