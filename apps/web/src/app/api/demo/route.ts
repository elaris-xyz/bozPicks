import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { generateMatchReplay } from '@/lib/replay';
import { buildMarketsForMatch, rowToMarket } from '@/lib/markets';
import { settleMarketRow } from '@/lib/settle';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  await db.query(`DELETE FROM boz_events      WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_markets     WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_predictions WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_pools       WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_matches     WHERE id       LIKE 'demo-%'`).catch(() => {});
}

/**
 * Runs a live replay: publishes a rich, timed event stream to Redis so the whole
 * app reacts in real time. Speed is controllable (?speed=8 → 8× faster).
 */
export async function POST(req: NextRequest) {
  const cooldownKey = 'boz:demo:cooldown';
  if (await redis.get(cooldownKey)) {
    return NextResponse.json({ error: 'Demo cooling down, try again shortly' }, { status: 429 });
  }
  await redis.set(cooldownKey, '1', 'EX', 8);

  await purgeDemoMatches();

  const speed = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get('speed')) || 4));
  const id = `demo-${Date.now()}`;
  const homeTeam = 'Brazil';
  const awayTeam = 'Argentina';
  const now = new Date();

  await db.query(
    `INSERT INTO boz_matches
       (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time, competition, last_updated)
     VALUES ($1,$2,$3,0,0,'LIVE',0,NOW(),'FIFA World Cup',NOW())
     ON CONFLICT (id) DO NOTHING`,
    [id, homeTeam, awayTeam]
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
  // seed a little liquidity so the demo shows live odds
  for (const mk of markets) {
    const seeded = Object.fromEntries(mk.outcomes.map((o, i) => [o, (i === 0 ? 8 : 5) * 1_000_000]));
    const total = Object.values(seeded).reduce((a, b) => a + b, 0);
    await db.query(`UPDATE boz_markets SET pools=$1, total_pool=$2 WHERE id=$3`,
      [JSON.stringify(seeded), total, mk.id]).catch(() => {});
  }

  // ── Generate + play the replay ──────────────────────────────────────────────
  const { steps, final } = generateMatchReplay(id, homeTeam, awayTeam, { durationMs: 42_000 / speed });

  let prev = 0;
  let redCardSeen = false;
  for (const step of steps) {
    await sleep(Math.max(0, step.delayMs - prev));
    prev = step.delayMs;

    const event = { ...step.event, timestamp: new Date().toISOString() };
    const payload = JSON.stringify(event);
    const status = event.type === 'MATCH_END' ? 'FINISHED' : event.type === 'HALFTIME' ? 'HALFTIME' : 'LIVE';

    // Broadcast is what drives the live UI — await only these (parallel).
    // DB persistence is best-effort and must never stall the replay clock.
    const redisOps: Promise<unknown>[] = [
      redis.publish(`boz:events:${id}`, payload),
      redis.publish('boz:global', payload),
      redis.lpush('boz:global:history', payload),
      redis.hset(`boz:match:${id}:state`, {
        homeScore: String(event.score?.home ?? 0),
        awayScore: String(event.score?.away ?? 0),
        currentMinute: String(event.matchMinute),
        status, lastUpdated: event.timestamp,
      }),
    ];
    if (event.odds) redisOps.push(redis.lpush(`boz:match:${id}:odds`, JSON.stringify(event.odds)));
    if (event.stats) redisOps.push(redis.set(`boz:match:${id}:stats`, JSON.stringify(event.stats), 'EX', 7200));
    await Promise.all(redisOps);

    // fire-and-forget persistence
    void db.query(
      `INSERT INTO boz_events (id, match_id, type, match_minute, timestamp, payload)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [event.id, id, event.type, event.matchMinute, event.timestamp, event]
    ).catch(() => {});
    void db.query(
      `UPDATE boz_matches SET home_score=$1, away_score=$2, current_minute=$3, status=$4,
         stats=COALESCE($5,stats), last_updated=NOW() WHERE id=$6`,
      [event.score?.home ?? 0, event.score?.away ?? 0, event.matchMinute, status,
       event.stats ? JSON.stringify(event.stats) : null, id]
    ).catch(() => {});

    // emit a sharp-move signal right after the red card swings the market
    if (event.type === 'RED_CARD' && !redCardSeen) {
      redCardSeen = true;
      const signal = {
        id: randomUUID(), matchId: id, type: 'SHARP_MOVE',
        detectedAt: new Date().toISOString(),
        oddsBefore: { homeWin: 2.60, draw: 3.10, awayWin: 2.60 },
        oddsAfter: { homeWin: 1.80, draw: 3.50, awayWin: 4.20 },
        deltaPercent: -30.8, affectedOutcome: 'HOME', confidence: 'HIGH',
        context: `RED CARD min ${event.matchMinute} (${awayTeam}) → home shortens`,
        outcomeVerified: false, verificationSource: 'PENDING',
      };
      await redis.publish('boz:signals', JSON.stringify(signal));
    }
  }

  // stash the resolved stats so prop-market settlement can read them
  await redis.set(`boz:match:${id}:final`, JSON.stringify(final), 'EX', 86400);

  // ── Auto-settle every prop market trustlessly from the final stats ──────────
  const settledMarkets: { label: string; winningOutcome?: string; validateTx?: string }[] = [];
  for (const mk of markets) {
    try {
      const { rows } = await db.query(`SELECT * FROM boz_markets WHERE id=$1`, [mk.id]);
      if (!rows[0]) continue;
      const settled = await settleMarketRow(rowToMarket(rows[0]), final);
      settledMarkets.push({ label: settled.label, winningOutcome: settled.winningOutcome, validateTx: settled.settlementTx });
    } catch { /* skip */ }
  }

  return NextResponse.json({ ok: true, matchId: id, homeTeam, awayTeam, steps: steps.length, final, markets: settledMarkets });
}

export async function DELETE() {
  await purgeDemoMatches();
  return NextResponse.json({ ok: true });
}
