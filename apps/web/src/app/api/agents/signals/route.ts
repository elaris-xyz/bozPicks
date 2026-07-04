import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');

  const { rows } = await db.query(
    `SELECT id, match_id, type, detected_at, delta_percent,
            affected_outcome, confidence, context,
            odds_before, odds_after, correlated_event_id,
            outcome_verified, was_accurate, verified_at, verification_source
     FROM boz_signals
     ${matchId ? 'WHERE match_id = $1' : ''}
     ORDER BY detected_at DESC
     LIMIT 50`,
    matchId ? [matchId] : []
  );

  const signals = rows.map(r => ({
    id: r.id,
    matchId: r.match_id,
    type: r.type,
    detectedAt: r.detected_at,
    deltaPercent: Number(r.delta_percent),
    affectedOutcome: r.affected_outcome,
    confidence: r.confidence,
    context: r.context,
    oddsBefore: r.odds_before ?? undefined,
    oddsAfter:  r.odds_after  ?? undefined,
    correlatedEventId: r.correlated_event_id ?? undefined,
    outcomeVerified: r.outcome_verified,
    wasAccurate: r.was_accurate,
    verifiedAt: r.verified_at,
    verificationSource: r.verification_source,
  }));

  return NextResponse.json(signals);
}
