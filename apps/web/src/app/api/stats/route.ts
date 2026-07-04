import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [matches, signals, pools] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE TRUE) AS total,
        COUNT(*) FILTER (WHERE status IN ('LIVE','HALFTIME')) AS live,
        COUNT(*) FILTER (WHERE status = 'SCHEDULED') AS upcoming,
        COUNT(*) FILTER (WHERE status = 'FINISHED') AS finished
      FROM boz_matches
    `),
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE outcome_verified = true) AS verified,
        COUNT(*) FILTER (WHERE outcome_verified = true AND was_accurate = true) AS accurate,
        COUNT(*) FILTER (WHERE outcome_verified = false) AS active,
        COUNT(*) FILTER (WHERE confidence = 'HIGH') AS high_conf,
        COUNT(*) FILTER (WHERE confidence = 'MEDIUM') AS med_conf,
        COUNT(*) FILTER (WHERE confidence = 'LOW') AS low_conf
      FROM boz_signals
    `),
    db.query(`
      SELECT COALESCE(SUM(total_pool), 0) AS total_usdc
      FROM boz_pools
    `),
  ]);

  const { rows: recentSignals } = await db.query(`
    SELECT id, match_id, affected_outcome, confidence, delta_percent,
           outcome_verified, was_accurate, detected_at
    FROM boz_signals
    ORDER BY detected_at DESC
    LIMIT 10
  `);

  const { rows: topMatches } = await db.query(`
    SELECT match_id, COUNT(*) AS signal_count
    FROM boz_signals
    GROUP BY match_id
    ORDER BY signal_count DESC
    LIMIT 5
  `);

  const m = matches.rows[0];
  const s = signals.rows[0];
  const p = pools.rows[0];

  const accuracy = Number(s.verified) > 0
    ? Math.round((Number(s.accurate) / Number(s.verified)) * 100)
    : null;

  return NextResponse.json({
    matches: {
      total: Number(m.total),
      live: Number(m.live),
      upcoming: Number(m.upcoming),
      finished: Number(m.finished),
    },
    signals: {
      total: Number(s.total),
      verified: Number(s.verified),
      accurate: Number(s.accurate),
      active: Number(s.active),
      accuracy,
      byConfidence: {
        HIGH: Number(s.high_conf),
        MEDIUM: Number(s.med_conf),
        LOW: Number(s.low_conf),
      },
    },
    pool: { totalUsdc: Number(p.total_usdc) / 1_000_000 },
    recentSignals: recentSignals.map(r => ({
      id: r.id,
      matchId: r.match_id,
      outcome: r.affected_outcome,
      confidence: r.confidence,
      delta: Number(r.delta_percent),
      verified: r.outcome_verified,
      accurate: r.was_accurate,
      detectedAt: r.detected_at,
    })),
    topMatches: topMatches.map(r => ({ matchId: r.match_id, count: Number(r.signal_count) })),
  });
}
