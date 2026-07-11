import { NextRequest, NextResponse } from 'next/server';
import { getVault, getLedger } from '@/lib/vault';

export const dynamic = 'force-dynamic';

/** GET /api/vault?wallet=X → current game balance + recent ledger. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  try {
    const [state, ledger] = await Promise.all([getVault(wallet), getLedger(wallet)]);
    return NextResponse.json({ ...state, ledger });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
