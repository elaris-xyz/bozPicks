import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/mm — public read of the In-Play Market Maker's latest state,
 * as published by the headless maker (apps/agent). A B2B/judge-facing endpoint:
 * live quotes (bid/fair/ask per outcome), inventory, mark-to-market P&L, spread,
 * fills/volume, and career totals. Returns an idle shell when no match is live.
 */
export async function GET() {
  try {
    const raw = await redis.get('boz:mm:last');
    if (raw) return NextResponse.json(JSON.parse(raw));
  } catch { /* fall through to idle shell */ }
  return NextResponse.json({
    matchId: null, settled: false, pnl: 0, edge: 0, fills: 0, volume: 0,
    exposure: 0, spreadPct: 0, quotes: [], career: null,
    note: 'no live market — the maker quotes when a fixture is in play',
  });
}
