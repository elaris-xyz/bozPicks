import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { generateMatchReplay, SCENARIOS, type ReplayScenario } from '@/lib/replay';
import { buildMarketsForMatch } from '@/lib/markets';
import { moveVault } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// one running replay at a time — the value is the owning matchId. The timed
// playback itself runs on the always-on ingest worker (see apps/ingest/src/
// demoRunner.ts), which checks this same key before every step — so this
// function only ever does fast, synchronous setup work.
const LOCK = 'boz:demo:lock';
const JOBS_QUEUE = 'boz:demo:jobs';

/** Remove every artifact of previous demo runs (DB rows + Redis keys). */
async function purgeDemoMatches() {
  const { rows } = await db
    .query(`SELECT id FROM boz_matches WHERE id LIKE 'demo-%'`)
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of rows) {
    await redis.del(
      `boz:match:${row.id}:state`, `boz:match:${row.id}:odds`,
      `boz:match:${row.id}:lastEvent`, `boz:match:${row.id}:stats`,
    );
  }
  // Stakes are debited from the vault the moment they're placed — so before
  // deleting a purged run's ACTIVE predictions, refund the human ones. Without
  // this, re-running the demo mid-match silently ate the player's stakes
  // (debited, then the row that could ever pay them out was deleted).
  try {
    const { rows: act } = await db.query(
      `SELECT p.id, p.wallet_address, p.amount_usdc, COALESCE(mk.label, 'Match Result pool') AS label
       FROM boz_predictions p LEFT JOIN boz_markets mk ON mk.id = p.market_id
       WHERE p.match_id LIKE 'demo-%' AND p.status='ACTIVE'`
    );
    for (const p of act) {
      const w = String(p.wallet_address);
      if (w === 'demo-wallet' || w.startsWith('bot.')) continue;
      await moveVault({
        wallet: w, delta: Number(p.amount_usdc), kind: 'REFUND',
        ref: `${p.label} — match replaced before settling`, requireExisting: true,
      }).catch(() => {});
    }
  } catch { /* best-effort refunds */ }
  // One statement, one round-trip. These ran as 7 sequential DELETEs, each a
  // separate trip to Neon — ~20s of the run's budget before a ball was kicked
  // (and long enough that the demo lock could expire before the loop even
  // started). Children first, parent last, so the FKs stay satisfied.
  // boz_replay_events is in here because demos now record themselves for
  // playback; without it every replaced run left its replay behind forever.
  // boz_signals too: agent signals from a replaced run are never useful, and
  // left uncleaned they piled up (permanently unverified) and skewed /agent.
  await db.query(`
    WITH e  AS (DELETE FROM boz_events        WHERE match_id LIKE 'demo-%'),
         r  AS (DELETE FROM boz_replay_events WHERE match_id LIKE 'demo-%'),
         mk AS (DELETE FROM boz_markets       WHERE match_id LIKE 'demo-%'),
         p  AS (DELETE FROM boz_predictions   WHERE match_id LIKE 'demo-%'),
         pl AS (DELETE FROM boz_pools         WHERE match_id LIKE 'demo-%'),
         s  AS (DELETE FROM boz_signals       WHERE match_id LIKE 'demo-%')
    DELETE FROM boz_matches WHERE id LIKE 'demo-%'
  `).catch(async () => {
    // fall back to the sequential path if the CTE form ever trips on FK order
    for (const q of [
      `DELETE FROM boz_events        WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_replay_events WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_markets       WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_predictions   WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_pools         WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_signals       WHERE match_id LIKE 'demo-%'`,
      `DELETE FROM boz_matches       WHERE id       LIKE 'demo-%'`,
    ]) await db.query(q).catch(() => {});
  });
}

/**
 * Starts a live replay. The request ACKs in well under a second (202 +
 * matchId); setup (purge + inserts + market seeding) continues via after(),
 * then hands the timed playback off to the ingest worker so it can run for
 * its full real duration without this function's timeout. One replay at a
 * time via a Redis lock; a second Run gets an honest 409 (with the running
 * matchId) instead of the old silent cooldown 429.
 */
export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  // Playback length in SECONDS — real minutes: 1/2/3/5/10 (matches the
  // Command Bridge's buttons). The legacy `speed` multiplier still works for
  // old callers: 42/speed seconds. The timed loop runs on the ingest worker,
  // not this function, so a 10-minute demo genuinely takes 10 real minutes.
  const speed = Math.max(1, Math.min(90, Number(p.get('speed')) || 4));
  const runSecs = Math.max(5, Math.min(600, Number(p.get('runSecs')) || Math.round(42 / speed)));
  const scenarioKey = p.get('scenario') ?? 'home-win';
  const scenario = SCENARIOS[scenarioKey] ?? SCENARIOS['home-win'];
  const homeTeam = (p.get('home') || 'Brazil').slice(0, 40);
  const awayTeam = (p.get('away') || 'Argentina').slice(0, 40);
  const competition = (p.get('competition') || 'FIFA World Cup').slice(0, 60);
  const id = `demo-${Date.now()}`;

  // lock TTL covers queue wait + the full playback + settlement grace
  const lockTtl = runSecs + 120;
  let acquired: string | null;
  try {
    acquired = await redis.set(LOCK, id, 'EX', lockTtl, 'NX');
  } catch (e) {
    // Redis itself is down / over quota — the whole live pipeline depends on
    // it, so tell the client honestly instead of a mystery 500.
    console.error('[demo] redis unavailable:', (e as Error).message);
    return NextResponse.json({ error: 'realtime-unavailable' }, { status: 503 });
  }
  if (!acquired) {
    const runningId = await redis.get(LOCK).catch(() => null);
    return NextResponse.json({ error: 'already-running', matchId: runningId }, { status: 409 });
  }

  after(async () => {
    try {
      await setupAndEnqueue(id, runSecs, scenario, homeTeam, awayTeam, competition);
    } catch (e) {
      console.error('[demo] setup failed:', (e as Error).message);
      // setup itself failed before handing off to ingest — nothing is going
      // to finish this run and release the lock, so do it here. (Once the
      // job is successfully enqueued, ingest owns the lock's lifecycle.)
      const stillOwner = await redis.get(LOCK).catch(() => null);
      if (stillOwner === id) await redis.del(LOCK).catch(() => {});
    }
  });

  return NextResponse.json(
    { ok: true, matchId: id, homeTeam, awayTeam, scenario: scenario.key, runSecs },
    { status: 202 },
  );
}

/**
 * Fast setup only — runs after the ACK has been sent, and finishes in a few
 * DB round-trips. The timed playback (the part that can take up to 10 real
 * minutes) is handed off to the always-on ingest worker via a Redis job;
 * see apps/ingest/src/demoRunner.ts for the loop and settlement.
 */
async function setupAndEnqueue(
  id: string, runSecs: number, scenario: ReplayScenario,
  homeTeam: string, awayTeam: string, competition: string,
) {
  await purgeDemoMatches();
  const now = new Date();

  await db.query(
    `INSERT INTO boz_matches
       (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time, competition, last_updated)
     VALUES ($1,$2,$3,0,0,'LIVE',0,NOW(),$4,NOW())
     ON CONFLICT (id) DO NOTHING`,
    [id, homeTeam, awayTeam, competition]
  ).catch(() => {});

  await db.query(
    `INSERT INTO boz_pools (match_id, status, pool_home, pool_draw, pool_away, total_pool, fee_bps)
     VALUES ($1,'OPEN',42500000,18750000,15000000,76250000,200)
     ON CONFLICT (match_id) DO NOTHING`,
    [id]
  ).catch(() => {});

  await redis.hset(`boz:match:${id}:state`, {
    homeTeam, awayTeam, homeScore: '0', awayScore: '0',
    status: 'LIVE', currentMinute: '0',
    kickoffTime: now.toISOString(), lastUpdated: now.toISOString(),
  });
  await redis.expire(`boz:match:${id}:state`, 7200);

  // ── Prop markets for this match (Total Corners/Goals/Cards, BTTS, …) ─────────
  const markets = buildMarketsForMatch(id, homeTeam, awayTeam, `escrow-${id.slice(-8)}`);
  for (const mk of markets) {
    await db.query(
      `INSERT INTO boz_markets (id, match_id, kind, label, stat_key, line, outcomes, pools, total_pool, fee_bps, status, escrow_pda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,'OPEN',$10) ON CONFLICT (id) DO NOTHING`,
      [mk.id, mk.matchId, mk.kind, mk.label, mk.statKey, mk.line ?? null,
       JSON.stringify(mk.outcomes), JSON.stringify(mk.pools), mk.feeBps, mk.escrowPda]
    ).catch(() => {});
  }
  // seed a little liquidity so the demo shows live odds, and announce each
  // market so the panel can render them live (no polling needed)
  for (const mk of markets) {
    const seeded = Object.fromEntries(mk.outcomes.map((o, i) => [o, (i === 0 ? 8 : 5) * 1_000_000]));
    const total = Object.values(seeded).reduce((a, b) => a + b, 0);
    mk.pools = seeded as Record<string, number>;
    mk.totalPool = total;
    await db.query(`UPDATE boz_markets SET pools=$1, total_pool=$2 WHERE id=$3`,
      [JSON.stringify(seeded), total, mk.id]).catch(() => {});
    await redis.publish('boz:markets', JSON.stringify(mk)).catch(() => {});
  }

  // ── Generate the schedule, hand it to the ingest worker to play out ─────────
  const { steps, final } = generateMatchReplay(id, homeTeam, awayTeam, { durationMs: runSecs * 1000, scenario });

  // Re-arm the lock now that setup (purge + inserts + market seeding) is done,
  // so its TTL only has to cover queue wait + the real playback + settlement.
  await redis.expire(LOCK, runSecs + 90).catch(() => {});

  await redis.set(
    `boz:demo:job:${id}`,
    JSON.stringify({ id, awayTeam, steps, final, markets }),
    'EX', runSecs + 300,
  );
  await redis.lpush(JOBS_QUEUE, id);
  console.log(`[demo] ${id} enqueued — ${steps.length} steps over ${runSecs}s, ingest worker will play it out`);
}

export async function DELETE() {
  // release the lock FIRST — an in-flight replay checks ownership before
  // every step and stops as soon as it sees the lock is gone, instead of
  // running its full remaining schedule after being "cancelled"
  await redis.del(LOCK).catch(() => {});
  await purgeDemoMatches();
  return NextResponse.json({ ok: true });
}
