# bozPicks — پلن اجرایی هکاتون

> **Deadline:** July 19, 2026 · 23:59 UTC
> **آخرین آپدیت:** July 3, 2026 → **16 روز مانده**
> **جایزه کل قابل برد:** تا 32,000 USDT (سه تراک)

---

## یک — سه محصول، سه تراک

| محصول | تراک | جایزه اول | شبکه |
|-------|------|-----------|------|
| **bozPicks** | Track 2 — Consumer & Fan Experiences | 10,000 USDT | devnet |
| **bozAgent** | Track 3 — Trading Tools & Agents | 10,000 USDT | devnet |
| **bozSettle** | Track 1 — Prediction Markets & Settlement | 12,000 USDT | devnet |

هکاتون "separate submissions" می‌خواد — یه monorepo، سه subdomain، سه لینک جدا.

---

## دو — معماری deployment

```
یه GitHub repo  →  یه Vercel + Railway  →  سه subdomain

picks.domain.com   → /        (Track 2 landing)
agent.domain.com   → /agent   (Track 3 landing)
settle.domain.com  → /settle  (Track 1 landing)
```

---

## سه — وضعیت دقیق الان (July 3)

### bozPicks → Track 2 | ✅ ~95% آماده

| بخش | وضعیت |
|-----|--------|
| Live match list + scores + SSE | ✅ |
| Odds display + sparklines | ✅ |
| AI analysis — Claude Haiku | ✅ |
| Mobile-first UI | ✅ |
| Leaderboard | ✅ |
| Demo mode (Brazil vs Argentina) | ✅ فقط یک demo زنده در هر لحظه |
| `/api/health` — DB + Redis latency | ✅ |
| CI/CD — GitHub Actions | ✅ |
| Env validation — `lib/env.ts` | ✅ |
| Wallet connect — Phantom devnet | ✅ sign + confirm TX |
| Predictions API + DB | ✅ |
| `/picks` landing page | ✅ |
| Subdomain routing config | ✅ |
| **UI/UX سطح production** (پایین ببین) | ✅ |
| Deploy روی Vercel | ❌ |
| Demo video | ❌ |

### bozAgent → Track 3 | ✅ ~85% آماده

| بخش | وضعیت |
|-----|--------|
| Sharp move detection — `detector.ts` | ✅ |
| Signal accuracy tracking — `tracker.ts` | ✅ |
| Redis pub/sub | ✅ |
| DB persistence — `boz_signals` | ✅ |
| `/api/agents/signals` + `/api/agents/stats` | ✅ |
| `/agent` landing — Track 3 hero + real-time stats | ✅ هویت بنفش، آیکن فلت، count-up |
| CSV export | ✅ |
| README مجزا برای Track 3 | ✅ |
| Deploy + subdomain | ❌ |
| Demo video | ❌ |

### bozSettle → Track 1 | ✅ ~80% آماده

| بخش | وضعیت |
|-----|--------|
| Pool UI در match page | ✅ |
| DB schema — boz_pools + boz_predictions | ✅ |
| Parimutuel math — `utils/parimutuel.ts` | ✅ |
| Predictions API + DB | ✅ |
| `/settle` landing page | ✅ هویت سبز، pools با پرچم |
| Anchor program — 4 instruction | ✅ |
| Keeper bot — `apps/keeper/src/index.ts` | ✅ |
| Devnet wallet | ✅ `6n42WYSHDvz7aWdF3LqWpfepdxMgT7nQp1HNdkYDqmL` |
| Deploy روی devnet | ✅ via Solana Playground |
| Program ID واقعی | ✅ `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh` |
| `declare_id!` در `lib.rs` آپدیت شد | ✅ |
| CPI به `validate_stat` TxLINE — `keeper/src/txline-validator.ts` | ✅ |
| Deploy + subdomain | ❌ |
| Demo video | ❌ |

---

## چهار — کارهای UI/UX که انجام شد (July 2–3)

> یک سری کامل «سوپر طراح»: از template به production-grade sportsbook.

### هویت بصری
- **کارت match پوستری سینمایی** — پرچم‌ها از دو لبه محو می‌شن به مرکز، اسم زیر پرچم، امتیاز شیمر، افکت hover (zoom پرچم + shine sweep + slide اسم‌ها)
- **سیستم توکن semantic** — `--accent`، تریپلت‌های RGB، کلاس‌های `.chip-glass`/`.btn-accent`/`.btn-ghost`/`.stat-display`/`.section-label`
- **هویت رنگی سه تراک** — picks آبی، agent بنفش، settle سبز (کلاس‌های `theme-*`)
- **فونت display** — Space Grotesk برای هدر/عدد (via `<link>`، نه next/font — build-time fetch بلاک بود)
- **آیکن‌ست فلت اختصاصی** — `components/ui/Icons.tsx` (۲۰ آیکن stroke)، **حذف کامل emoji** از کل اپ

### ناوبری و لایوت
- **منوی اصلی نئون** — دسکتاپ (پیل فعال با آیکن+برچسب، هاله رنگ تراک) + موبایل (تب‌های نئون)
- **نوار لغزنده سرتاسری** (`LiveTicker`) — full-bleed، ۳۸ مسابقه، live با امتیاز/upcoming با ساعت، لیبل لنگرانداخته، fade لبه‌ها
- **بکگراند اورورای نئونی** + صفحه match با بکگراند تیم‌رنگ (پرچم blur پشت هدر)
- **Marquee برند** روی landing های picks/settle

### صفحه match
- **تایم‌لاین دوطرفه** (`TwoSidedTimeline`) — میزبان چپ، مهمان راست، odds به تیک باریک جمع، divider های خنثی وسط
- **odds کلیک‌پذیر → Bet Slip واقعی** — جریان `select odds → slip → confirm`، پیک انتخابی، stake با چیپ سریع، payout/ROI، TX success glow
- **نوار دقیقه‌ی زنده** سبز→کهربایی

### بلوغ محصول (طبق brief sportsbook)
- **Toggle چگالی** — پوستر سینمایی ↔ لیست فشرده (`MatchRow`)، ذخیره در localStorage
- **نشانگر تغییر odds ▲▼** — فلش زنده روی کارت‌ها موقع تغییر odds (تست شده)
- **مودال wallet-adapter reskin** — تم نئون‌گلس به‌جای بنفشِ پیش‌فرض

### صفحه‌های دیگر (همه یک زبان)
schedule / predictions / replay / stats / insights / leaderboard — آیکن فلت، توکن، پرچم، LIVE سبز

### صیقل نهایی
- Skeleton هم‌شکل گرید پوستر (بدون پرش hydration)
- reduced-motion کامل، focus-visible، selection، scrollbar سفارشی

### باگ‌های حل‌شده
- **ECONNRESET ردیس** — handler `error` روی client های SSE (`stream/route.ts`)
- **Next 15 async params** — همه‌ی route های dynamic
- **demo تکراری** — `purgeDemoMatches` قبل هر run (فقط یک demo زنده)
- **build-time google fonts** — انتقال به `<link>` (کامپایل سریع)

---

## پنج — تایم‌لاین (آپدیت Jul 3)

```
هفته ۱  ✅ (تمام)              هفته ۲  Jul 6–12          هفته ۳  Jul 13–19
────────────────────────      ────────────────────────   ──────────────────
✅ Wallet TX                  🔴 Deploy Vercel+Railway    Demo video × 3
✅ /api/agents/stats          Subdomain routing live      Git push public (بعد پاکسازی)
✅ landing × 3                Smoke test روی prod         Submit × 3
✅ Anchor deploy devnet
✅ CPI به TxLINE
✅ UI/UX production-grade
```

### اولویت الان

| # | کار | محصول | وضعیت |
|---|-----|--------|--------|
| ✅ | UI/UX کامل production-grade | همه | انجام شد |
| ✅ | production build تأیید شد (`next build` بدون خطا) | web | انجام شد — deploy de-risk شد |
| ✅ | پاکسازی secrets + push به github.com/elaris-xyz/bozPicks | همه | history تمیز، صفر secret |
| 🔴 1 | Deploy Vercel + Railway | همه | بعدی |
| 🟢 3 | Demo video × 3 | همه | هفته ۳ |
| 🟢 4 | Submit × 3 | همه | آخر |

---

## شش — checklist submission

### همه سه محصول:
- [ ] لینک deploy زنده (subdomain)
- [ ] Public GitHub repo (**اول keypair از history پاک بشه**)
- [ ] **Demo video ≤5 دقیقه** ← بدون این disqualify
- [ ] مستندات: ایده + TxLINE endpoints
- [ ] فیدبک از TxLINE API

### bozPicks (Track 2):
- [ ] Live match از TxLINE در video
- [ ] Wallet predict روی devnet (Bet Slip → TX → Explorer)

### bozAgent (Track 3):
- [ ] Agent autonomously ران میشه
- [ ] `/api/agents/stats` live
- [ ] Signal accuracy در video

### bozSettle (Track 1):
- [x] Program deploy روی devnet ✅
- [ ] TX روی Solana Explorer در video
- [x] CPI به `validate_stat` ✅

---

## هفت — ⚠️ ریسک‌های امنیتی (قبل public کردن)

| ریسک | وضعیت | اقدام |
|------|--------|-------|
| **`.txline-keypair.json` در git history** (commit `8ac1ef5`) | 🔴 خطرناک | باید از history حذف بشه + به `.gitignore` اضافه بشه — **قبل هر push عمومی** |
| فقط ۲ commit، remote تنظیم نشده | 🟡 | همه‌چیز local؛ بک‌آپ نداریم |
| `.env` (شامل API keys) | ✅ gitignored | امنه |

---

## هشت — تصمیمات فنی ثابت

| تصمیم | دلیل |
|-------|------|
| devnet نه mainnet | هر سه تراک قبول دارن — ریسک صفر |
| یه monorepo | بدون duplication، یه pipeline |
| Redis pub/sub نه WebSocket | Vercel serverless-friendly |
| Claude Haiku نه OpenAI | ANTHROPIC_API_KEY، سریع، streaming |
| Parimutuel نه AMM | بدون LP، Anchor ساده‌تر |
| Solana Playground برای deploy | Anchor CLI روی ویندوز timeout می‌خورد |
| تم فقط dark (نه light mode) | هویت sportsbook + wow دمو؛ light mode بعد هکاتون |
| `NEXT_DIST_DIR=.next-dev` (dev) | دور زدن قفل `.next/trace` روی ویندوز |

---

## نه — اطلاعات مهم (نگه دار)

### Solana Devnet
| چیز | مقدار |
|-----|-------|
| Keeper wallet | `6n42WYSHDvz7aWdF3LqWpfepdxMgT7nQp1HNdkYDqmL` |
| Playground wallet | `AtZfuUU9qdEdBwHYb29Na9Fy6Bck8NdUF3N5eTCrnnYH` |
| Program ID | `GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh` |
| Network | Devnet |
| Explorer | `https://explorer.solana.com/address/GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh?cluster=devnet` |

### اجرای local (dev)
```bash
# وب (پورت 3100 — پورت 3000 روی ویندوز رزرو شده)
pnpm --dir apps/web dev --port 3100
# ingest + agent
pnpm ingest
pnpm agent
```

### MSYS2 — راه‌اندازی مجدد Solana
```bash
export PATH="/c/Users/Arash/.cargo/bin:$HOME/solana-release/bin:$PATH"
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/id.json
solana balance
```

---

## ده — شروع هر session

```
۱. این فایل رو باز کن
۲. جدول "وضعیت دقیق الان" رو ببین
۳. اولین 🔴 رو بردار
۴. آخر session → این فایل رو آپدیت کن
```

---

*آخرین آپدیت: 2026-07-03 | بعدی: پاکسازی keypair → Deploy Vercel + Railway → Demo video × 3*
