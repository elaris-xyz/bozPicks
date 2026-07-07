import { NextResponse } from 'next/server';
import { txlineRest } from '@bozpicks/txline-client';

export const dynamic = 'force-dynamic';

/**
 * Live proof of the TxLINE integration: calls the real TxLINE REST API
 * (guest JWT + activated X-Api-Token) and returns the current fixtures.
 * Powers the Command Bridge "TxLINE connected" status and the real-fixture
 * picker. World Cup 2026 matches are still upcoming, so odds/scores snapshots
 * are empty until kickoff — the fixtures themselves are real and live.
 */
export async function GET() {
  const started = Date.now();
  try {
    const fixtures = await txlineRest.fixtures();
    const competitions = [...new Set(fixtures.map(f => f.Competition))];
    return NextResponse.json({
      ok: true,
      source: 'txline.txodds.com',
      latencyMs: Date.now() - started,
      count: fixtures.length,
      competitions,
      fixtures: fixtures.map(f => ({
        fixtureId: String(f.FixtureId),
        competition: f.Competition,
        competitionId: f.CompetitionId,
        startTime: f.StartTime,
        home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
        away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, source: 'txline.txodds.com', error: (e as Error).message },
      { status: 502 },
    );
  }
}
