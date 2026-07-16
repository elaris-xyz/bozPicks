import { NextRequest, NextResponse } from 'next/server';
import { txlineRest } from '@bozpicks/txline-client';
import { verifyRealFixture } from '@/lib/realproof';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/proof/real?fixtureId=<id>
 * Fetches a FINISHED fixture's real TxLINE Merkle proof for its deciding goal
 * stats and re-folds it locally to reproduce TxLINE's own eventStatRoot — a
 * live, trustless verification of the result against TxLINE's commitment (not a
 * simulated receipt). Team names are resolved from the fixtures snapshot.
 *
 * Requires TXLINE_API_KEY in the environment (our activated mainnet token).
 */
export async function GET(req: NextRequest) {
  const fixtureId = req.nextUrl.searchParams.get('fixtureId');
  if (!fixtureId) return NextResponse.json({ error: 'fixtureId required' }, { status: 400 });

  try {
    const result = await verifyRealFixture(fixtureId);
    if (!result) return NextResponse.json({ error: 'no finalised proof for this fixture' }, { status: 404 });

    // resolve real team names (public fixture metadata)
    try {
      const fixtures = await txlineRest.fixtures();
      const f = fixtures.find(x => String(x.FixtureId) === fixtureId);
      if (f) {
        result.home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
        result.away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
      }
    } catch { /* names are best-effort */ }

    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    // a missing/invalid token is the most likely failure in a fresh deploy
    const tokenIssue = /TXLINE_API_KEY|401|403|token/i.test(msg);
    return NextResponse.json(
      { error: tokenIssue ? 'TxLINE token unavailable — set TXLINE_API_KEY' : msg },
      { status: tokenIssue ? 503 : 500 },
    );
  }
}
