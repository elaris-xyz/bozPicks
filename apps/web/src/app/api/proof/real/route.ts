import { NextRequest, NextResponse } from 'next/server';
import { verifyRealFixture, pickBestRealFixture, SHOWCASE_FIXTURE } from '@/lib/realproof';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/proof/real[?fixtureId=<id>]
 * Fetches a fixture's real TxLINE Merkle proof for its goal stats and re-folds
 * it locally to reproduce TxLINE's own eventStatRoot — a live, trustless
 * verification against TxLINE's commitment (not a simulated receipt).
 *
 * With no `fixtureId`, auto-picks the most compelling REAL fixture: a match in
 * play right now > a recently-finished one > the evergreen showcase. So on a
 * real match day the card verifies the LIVE game; otherwise it falls back to a
 * finished fixture that always verifies.
 *
 * Requires TXLINE_API_KEY in the environment (our activated mainnet token).
 */
export async function GET(req: NextRequest) {
  const explicit = req.nextUrl.searchParams.get('fixtureId');

  try {
    const fixtureId = explicit || await pickBestRealFixture();
    let result = await verifyRealFixture(fixtureId);

    // auto-pick landed on something unprovable (e.g. a live match between
    // committed ticks) — fall back to the evergreen showcase so the card is
    // never empty
    if (!result && !explicit && fixtureId !== SHOWCASE_FIXTURE.fixtureId) {
      result = await verifyRealFixture(SHOWCASE_FIXTURE.fixtureId);
    }
    if (!result) return NextResponse.json({ error: 'no verifiable proof for this fixture' }, { status: 404 });

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
