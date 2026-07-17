import { randomUUID } from 'crypto';
import type { BozEvent, PropMarket } from '@bozpicks/shared';
import { publish, redis } from './publisher';
import { record, db } from './recorder';

/**
 * Always-on demo playback worker — the real-time twin of the old runReplay()
 * loop that used to live inside the Vercel /api/demo route. A serverless
 * function can't safely sleep for minutes (it gets killed at maxDuration),
 * which is why a "3 minute" demo used to rush through its last two minutes
 * the instant the function ran out of budget — full-time would suddenly
 * fire, stats would reset, and stray fire-and-forget writes could land after
 * MATCH_END and briefly revive the momentum panel. Running the timed loop
 * here instead (Railway, no request timeout) means a 10-minute demo really
 * does take 10 real minutes, paced exactly like the schedule says, with no
 * rush and no out-of-order writes.
 */

const LOCK = 'boz:demo:lock';
const JOBS_QUEUE = 'boz:demo:jobs';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://boz-picks.vercel.app';

// BRPOP blocks the connection it runs on — for up to 5s at a time, forever,
// in a tight loop. Sharing `redis` (used for every real-match publish/get)
// would stall the whole TxLINE pipeline behind this wait. A dedicated
// connection keeps the blocking poll off the hot path entirely.
const brpopConn = redis.duplicate();

/** Named paper-trading bots — their stakes fill the pools AND the leaderboard. */
const DEMO_BOTS = [
  'bot.striker9', 'bot.tikitaka', 'bot.catenaccio', 'bot.parkedbus',
  'bot.falsenine', 'bot.gegenpress', 'bot.longball', 'bot.golazo',
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface DemoJob {
  id: string;
  awayTeam: string;
  steps: { delayMs: number; event: BozEvent }[];
  final: { homeScore: number; awayScore: number };
  markets: PropMarket[];
}

/** Blocks on the job queue forever; call once and let it run alongside the
 *  TxLINE streams. Never throws — a bad job is logged and skipped. */
export async function pollDemoJobs(): Promise<never> {
  for (;;) {
    let popped: [string, string] | null = null;
    try {
      popped = await brpopConn.brpop(JOBS_QUEUE, 5) as [string, string] | null;
    } catch (e) {
      console.error('[demo-runner] brpop failed:', (e as Error).message);
      await sleep(2000);
      continue;
    }
    if (!popped) continue; // timed out waiting — loop and block again
    const id = popped[1];
    try {
      await runJob(id);
    } catch (e) {
      console.error(`[demo-runner] job ${id} failed:`, (e as Error).message);
    }
  }
}

async function runJob(id: string): Promise<void> {
  const raw = await redis.get(`boz:demo:job:${id}`);
  if (!raw) { console.warn(`[demo-runner] ${id} job payload missing/expired — skipping`); return; }
  const job = JSON.parse(raw) as DemoJob;

  // cancelled before we even picked it up (Stop button, or a newer run took
  // the lock) — discard without publishing a single event
  if ((await redis.get(LOCK)) !== id) {
    console.log(`[demo-runner] ${id} already superseded — skipping`);
    return;
  }

  const markets = job.markets;
  let prev = 0;
  let redCardSeen = false;
  let stepNo = 0;

  for (const step of job.steps) {
    // cheap ownership check every few steps — the Command Bridge's Stop
    // (DELETE /api/demo) must be able to cut a run short
    if (stepNo % 4 === 0) {
      const owner = await redis.get(LOCK).catch(() => id);
      if (owner !== id) { console.log(`[demo-runner] ${id} superseded/purged — stopping early`); return; }
    }
    stepNo++;

    await sleep(Math.max(0, step.delayMs - prev));
    prev = step.delayMs;

    const event: BozEvent = { ...step.event, timestamp: new Date().toISOString() };
    // same functions the real TxLINE pipeline uses for every live match —
    // awaited in order, so (unlike the old fire-and-forget loop) writes can
    // never land out of order and revive a match after MATCH_END
    await Promise.all([publish(event), record(event)]);

    // simulated live order flow — named demo bots stake into the pools so
    // the market cards move AND the leaderboard fills
    if (event.type !== 'MATCH_START' && event.type !== 'MATCH_END' && event.type !== 'HALFTIME'
        && markets.length && Math.random() < 0.6) {
      const mk = markets[Math.floor(Math.random() * markets.length)];
      const o = mk.outcomes[Math.floor(Math.random() * mk.outcomes.length)];
      const stake = (1 + Math.floor(Math.random() * 5)) * 1_000_000; // 1-5 USDC
      const bot = DEMO_BOTS[Math.floor(Math.random() * DEMO_BOTS.length)];
      mk.pools[o] = (mk.pools[o] ?? 0) + stake;
      mk.totalPool += stake;
      await db.query(`UPDATE boz_markets SET pools=$1, total_pool=$2 WHERE id=$3`,
        [JSON.stringify(mk.pools), mk.totalPool, mk.id]).catch(() => {});
      await db.query(
        `INSERT INTO boz_predictions (id, match_id, market_id, wallet_address, outcome, amount_usdc, escrow_tx, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')`,
        [randomUUID(), id, mk.id, bot, o, stake, `sim-flow-${event.seq ?? 0}`]
      ).catch(() => {});
      await redis.publish('boz:markets', JSON.stringify(mk)).catch(() => {});
    }

    // emit a sharp-move signal right after the red card swings the market
    if (event.type === 'RED_CARD' && !redCardSeen) {
      redCardSeen = true;
      const signal = {
        id: randomUUID(), matchId: id, type: 'SHARP_MOVE',
        detectedAt: new Date().toISOString(),
        oddsBefore: { homeWin: 2.60, draw: 3.10, awayWin: 2.60 },
        oddsAfter: { homeWin: 1.80, draw: 3.50, awayWin: 4.20 },
        deltaPercent: -30.8, affectedOutcome: 'HOME', confidence: 'HIGH',
        context: `RED CARD min ${event.matchMinute} (${job.awayTeam}) → home shortens`,
        outcomeVerified: false, verificationSource: 'PENDING',
      };
      await redis.publish('boz:signals', JSON.stringify(signal)).catch(() => {});
    }
  }

  console.log(`[demo-runner] ${id} finished ${job.final.homeScore}-${job.final.awayScore}`);

  // auto-settle every prop market — reuse the exact endpoint (and settlement
  // code) real matches rely on, rather than duplicating that logic here
  try {
    const res = await fetch(`${WEB_APP_URL}/api/markets/settle-sweep`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    console.log(`[demo-runner] ${id} settle-sweep:`, JSON.stringify(d));
  } catch (e) {
    console.error(`[demo-runner] ${id} settle-sweep failed:`, (e as Error).message);
  }

  const stillOwner = await redis.get(LOCK).catch(() => null);
  if (stillOwner === id) await redis.del(LOCK).catch(() => {});
}
