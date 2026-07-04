import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
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
