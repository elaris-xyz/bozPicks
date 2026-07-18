import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Self-healing signal reconcile — runs on every stats read (idempotent, and a
 * no-op once clean). Two problems it fixes:
 *  1) STRAGGLERS: a signal whose match FINISHED but never got graded (an
 *     interrupted demo / a MATCH_END the agent missed) sat "active" forever and
 *     inflated activeSignals. Grade it here from the final score, using the SAME
 *     rule as the agent's verifySignals: accurate ⇔ (moved‑up) == (backed the
 *     winner). This keeps it in the accuracy track record.
 *  2) STALE / ORPHANS: a signal whose match is no longer live (purged, or a
 *     fixture stuck SCHEDULED after a flaky feed briefly published in-running
 *     odds) can never be graded — once it's past a short grace window, delete
 *     it. Seen live: 36 "active" signals sitting on a SCHEDULED friendly.
 * After this, the only unverified signals left belong to matches still in play.
 */
async function reconcileSignals(): Promise<void> {
  // 1) grade finished-match stragglers (was_accurate = (delta>0) == (winner==outcome))
  await db.query(`
    UPDATE boz_signals s
    SET outcome_verified = TRUE, verified_at = NOW(), verification_source = 'TXLINE_FINAL',
        was_accurate = ((s.delta_percent > 0) = (
          (CASE WHEN m.home_score > m.away_score THEN 'HOME'
                WHEN m.away_score > m.home_score THEN 'AWAY'
                ELSE 'DRAW' END) = s.affected_outcome))
    FROM boz_matches m
    WHERE s.match_id = m.id AND m.status = 'FINISHED' AND s.outcome_verified = FALSE
  `).catch(() => {});
  // 2) delete stale unverified signals whose match is no longer live (SCHEDULED-
  //    stuck, purged, or ungradeable), older than a 15-min grace window so a
  //    match mid-transition is never touched. FINISHED ones were graded above.
  await db.query(`
    DELETE FROM boz_signals s
    WHERE s.outcome_verified = FALSE
      AND s.detected_at < NOW() - interval '15 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM boz_matches m
        WHERE m.id = s.match_id AND m.status IN ('LIVE','HALFTIME')
      )
  `).catch(() => {});
}

export async function GET() {
  await reconcileSignals().catch(() => {});
  const [signalStats, matchStats] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE outcome_verified = TRUE)  AS verified,
        COUNT(*) FILTER (WHERE was_accurate = TRUE)      AS accurate,
        COUNT(*) FILTER (WHERE confidence = 'HIGH')      AS high_conf,
        COUNT(*) FILTER (WHERE confidence = 'MEDIUM')    AS med_conf,
        COUNT(*) FILTER (WHERE outcome_verified = FALSE) AS active,
        MAX(detected_at)                                  AS last_signal_at
      FROM boz_signals
    `),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'LIVE' OR status = 'HALFTIME') AS live_matches,
        COUNT(*)                                                         AS total_matches
      FROM boz_matches
    `),
  ]);

  const s = signalStats.rows[0];
  const m = matchStats.rows[0];

  const total    = Number(s.total);
  const verified = Number(s.verified);
  const accurate = Number(s.accurate);

  return NextResponse.json({
    totalSignals:        total,
    activeSignals:       Number(s.active),
    verifiedSignals:     verified,
    accurateSignals:     accurate,
    accuracyRate:        verified > 0 ? Math.round((accurate / verified) * 1000) / 10 : null,
    highConfidence:      Number(s.high_conf),
    mediumConfidence:    Number(s.med_conf),
    lastSignalAt:        s.last_signal_at ?? null,
    liveMatches:         Number(m.live_matches),
    totalMatches:        Number(m.total_matches),
    agentStatus:         'running',
    detectionThreshold:  parseFloat(process.env.SHARP_THRESHOLD ?? '0.10') * 100,
    windowMs:            parseInt(process.env.SHARP_WINDOW_MS ?? '120000'),
  });
}
