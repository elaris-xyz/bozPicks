import { NextRequest, NextResponse } from 'next/server';
import { resetVault } from '@/lib/vault';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/reset  { wallet }
 * Wipes the game vault (ledger + balance + active stakes) back to zero — a
 * clean slate for demo recording. Devnet game money only.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  if (!body.wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  try {
    await resetVault(body.wallet);
    return NextResponse.json({ ok: true, balance: 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
