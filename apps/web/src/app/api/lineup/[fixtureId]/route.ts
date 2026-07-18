import { NextRequest, NextResponse } from 'next/server';
import { txlineRest } from '@bozpicks/txline-client';
import { buildMatchLineup } from '@/lib/lineup';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/**
 * GET /api/lineup/[fixtureId]?home=<name>&away=<name>
 * Returns the confirmed starting XIs + subs + formation for a real TxLINE
 * fixture, parsed from its `lineups` score record (kept in the snapshot, so one
 * fast fetch). 404 when there's no lineup yet (an upcoming fixture publishes it
 * ~1h before kickoff) or the id isn't a real fixture — the card stays hidden.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await ctx.params;
  // demo matches (demo-…) aren't real fixtures — skip the TxLINE round-trip
  if (!/^\d+$/.test(fixtureId)) return NextResponse.json({ error: 'not a real fixture' }, { status: 404 });

  const home = req.nextUrl.searchParams.get('home') ?? '';
  const away = req.nextUrl.searchParams.get('away') ?? '';

  try {
    const snaps = await txlineRest.scoresSnapshot(Number(fixtureId));
    const lineup = buildMatchLineup(Array.isArray(snaps) ? snaps : [], home, away);
    if (!lineup) return NextResponse.json({ error: 'no lineup published yet' }, { status: 404 });
    return NextResponse.json(lineup);
  } catch (e) {
    const msg = (e as Error).message;
    const tokenIssue = /TXLINE_API_KEY|401|403|token/i.test(msg);
    return NextResponse.json(
      { error: tokenIssue ? 'TxLINE token unavailable' : msg },
      { status: tokenIssue ? 503 : 500 },
    );
  }
}
