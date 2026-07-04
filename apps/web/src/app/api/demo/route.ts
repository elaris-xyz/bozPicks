import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';
import type { OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function makeOdds(home: number, draw: number, away: number): OddsSnapshot {
  const invHome = 1 / home;
  const invDraw = 1 / draw;
  const invAway = 1 / away;
  const total = invHome + invDraw + invAway;
  return {
    timestamp: new Date().toISOString(),
    homeWin: home,
    draw,
    awayWin: away,
    impliedProb: {
      home: invHome / total,
      draw: invDraw / total,
      away: invAway / total,
    },
  };
}

type ScriptStep =
  | { type: 'ODDS_UPDATE'; minute: number; odds: OddsSnapshot }
  | { type: 'MATCH_START' | 'HALFTIME'; minute: number; extra: Record<string, unknown> }
  | { type: 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION'; minute: number; extra: { team: string; player: string } }
  | { type: 'GOAL'; minute: number; extra: { team: string; player: string; score: { home: number; away: number } } };

const SCRIPT: ScriptStep[] = [
  { type: 'MATCH_START',  minute: 1,  extra: {} },
  { type: 'ODDS_UPDATE',  minute: 2,  odds: makeOdds(2.10, 3.20, 3.50) },
  { type: 'YELLOW_CARD',  minute: 15, extra: { team: 'Brazil', player: 'Casemiro' } },
  { type: 'ODDS_UPDATE',  minute: 23, odds: makeOdds(2.40, 3.10, 2.90) },
  { type: 'GOAL',         minute: 23, extra: { team: 'Argentina', player: 'L. Messi', score: { home: 0, away: 1 } } },
  { type: 'ODDS_UPDATE',  minute: 24, odds: makeOdds(3.20, 2.80, 2.10) },
  { type: 'GOAL',         minute: 39, extra: { team: 'Brazil', player: 'Vinicius Jr', score: { home: 1, away: 1 } } },
  { type: 'ODDS_UPDATE',  minute: 40, odds: makeOdds(2.50, 3.00, 2.70) },
  { type: 'HALFTIME',     minute: 45, extra: {} },
  { type: 'ODDS_UPDATE',  minute: 46, odds: makeOdds(2.60, 3.10, 2.60) },
  { type: 'SUBSTITUTION', minute: 58, extra: { team: 'Brazil', player: 'Richarlison → Pedro' } },
  { type: 'RED_CARD',     minute: 67, extra: { team: 'Argentina', player: 'N. Di María' } },
  { type: 'ODDS_UPDATE',  minute: 67, odds: makeOdds(1.80, 3.50, 4.20) },
  { type: 'GOAL',         minute: 78, extra: { team: 'Brazil', player: 'Pedro', score: { home: 2, away: 1 } } },
  { type: 'ODDS_UPDATE',  minute: 79, odds: makeOdds(1.35, 4.50, 7.00) },
];

/** Remove every artifact of previous demo runs (DB rows + Redis keys). */
async function purgeDemoMatches() {
  const { rows } = await db
    .query(`SELECT id FROM boz_matches WHERE id LIKE 'demo-%'`)
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of rows) {
    await redis.del(
      `boz:match:${row.id}:state`,
      `boz:match:${row.id}:odds`,
      `boz:match:${row.id}:lastEvent`
    );
  }
  await db.query(`DELETE FROM boz_events      WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_predictions WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_pools       WHERE match_id LIKE 'demo-%'`).catch(() => {});
  await db.query(`DELETE FROM boz_matches     WHERE id       LIKE 'demo-%'`).catch(() => {});
}

export async function POST() {
  const cooldownKey = 'boz:demo:cooldown';
  const locked = await redis.get(cooldownKey);
  if (locked) {
    return NextResponse.json({ error: 'Demo cooling down, try again shortly' }, { status: 429 });
  }
  await redis.set(cooldownKey, '1', 'EX', 30);

  // only one demo match may exist at a time — a rerun replaces the old one
  await purgeDemoMatches();

  const id = `demo-${Date.now()}`;
  const homeTeam = 'Brazil';
  const awayTeam = 'Argentina';
  const now = new Date();

  // ── PostgreSQL: match + pool ────────────────────────────────────────────────
  await db.query(
    `INSERT INTO boz_matches
       (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time, last_updated)
     VALUES ($1,$2,$3,0,0,'LIVE',1,NOW() - INTERVAL '1 minute',NOW())
     ON CONFLICT (id) DO NOTHING`,
    [id, homeTeam, awayTeam]
  ).catch(() => {});

  await db.query(
    `INSERT INTO boz_pools (match_id, status, pool_home, pool_draw, pool_away, total_pool, fee_bps)
     VALUES ($1,'OPEN',42500000,18750000,15000000,76250000,200)
     ON CONFLICT (match_id) DO NOTHING`,
    [id]
  ).catch(() => {});

  // ── Redis: live state hash so /api/matches/[id] finds team names ────────────
  await redis.hset(`boz:match:${id}:state`, {
    homeTeam,
    awayTeam,
    homeScore: '0',
    awayScore: '0',
    status: 'LIVE',
    currentMinute: '1',
    kickoffTime: now.toISOString(),
    lastUpdated: now.toISOString(),
  });
  await redis.expire(`boz:match:${id}:state`, 7200);

  // ── Build & publish events ──────────────────────────────────────────────────
  let latestScore = { home: 0, away: 0 };

  for (const step of SCRIPT) {
    const extra = 'extra' in step ? step.extra : {};
    const odds  = 'odds'  in step ? step.odds  : undefined;

    const event: Record<string, unknown> = {
      id: randomUUID(),
      matchId: id,
      type: step.type,
      timestamp: new Date().toISOString(),
      matchMinute: step.minute,
      rawPayload: {},
      ...extra,
      ...(odds ? { odds } : {}),
    };

    if (step.type === 'GOAL' && 'extra' in step && step.extra.score) {
      latestScore = step.extra.score;
    }

    const payload = JSON.stringify(event);

    // Store to boz_events table
    await db.query(
      `INSERT INTO boz_events (id, match_id, type, match_minute, payload)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [event.id, id, event.type, event.matchMinute, event]
    ).catch(() => {});

    // Redis: odds history for sparklines
    if (odds) {
      const oddsKey = `boz:match:${id}:odds`;
      await redis.lpush(oddsKey, JSON.stringify(odds));
      await redis.expire(oddsKey, 7200);
    }

    // Redis: pub/sub broadcast + global history
    await redis.lpush('boz:global:history', payload);
    await redis.publish(`boz:events:${id}`, payload);
    await redis.publish('boz:global', payload);
  }

  await redis.ltrim('boz:global:history', 0, 49);

  // Update final live state
  await redis.hset(`boz:match:${id}:state`, {
    homeScore: String(latestScore.home),
    awayScore: String(latestScore.away),
    currentMinute: '79',
  });

  await db.query(
    `UPDATE boz_matches SET home_score=$1, away_score=$2, current_minute=79, last_updated=NOW() WHERE id=$3`,
    [latestScore.home, latestScore.away, id]
  ).catch(() => {});

  // Fake sharp signal
  const signal = {
    id: randomUUID(),
    matchId: id,
    type: 'SHARP_MOVE',
    detectedAt: new Date().toISOString(),
    oddsBefore: makeOdds(2.10, 3.20, 3.50),
    oddsAfter:  makeOdds(3.20, 2.80, 2.10),
    deltaPercent: -34.2,
    affectedOutcome: 'HOME',
    confidence: 'HIGH',
    context: `GOAL min 23 (${awayTeam})`,
    outcomeVerified: false,
    verificationSource: 'PENDING',
  };
  await redis.publish('boz:signals', JSON.stringify(signal));

  return NextResponse.json({ ok: true, matchId: id, homeTeam, awayTeam, eventsPublished: SCRIPT.length });
}

export async function DELETE() {
  await purgeDemoMatches();
  return NextResponse.json({ ok: true });
}
