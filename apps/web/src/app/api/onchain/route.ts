import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Live proof of the on-chain footprint (Track 1). Queries Solana devnet for the
 * two deployed programs and reports whether they are live + executable, with
 * explorer links a judge can click. This is the honest counterpart to the
 * settlement receipts: the parimutuel escrow + validate_stat verifier are REAL,
 * deployed programs — demo prop markets settle in the DB with SIMULATED receipts
 * only because the World Cup fixtures are still upcoming (no final stat to prove).
 */

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';

const PROGRAMS = [
  { key: 'settlement', label: 'bozPicks parimutuel + USDC escrow', id: process.env.BOZPICKS_PROGRAM_ID ?? 'GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh' },
  { key: 'txline', label: 'TxLINE stat verifier (validate_stat)', id: process.env.TXLINE_PROGRAM_ID ?? '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J' },
];

async function accountInfo(id: string): Promise<{ executable: boolean; owner: string; lamports: number } | null> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [id, { encoding: 'base64' }] }),
    cache: 'no-store',
  });
  const j = await res.json();
  const v = j?.result?.value;
  return v ? { executable: v.executable, owner: v.owner, lamports: v.lamports } : null;
}

export async function GET() {
  const started = Date.now();
  try {
    const programs = await Promise.all(PROGRAMS.map(async p => {
      const info = await accountInfo(p.id);
      return {
        ...p,
        deployed: !!info?.executable,
        owner: info?.owner ?? null,
        explorer: `https://explorer.solana.com/address/${p.id}?cluster=devnet`,
      };
    }));
    return NextResponse.json({
      ok: programs.every(p => p.deployed),
      cluster: 'devnet',
      rpc: RPC,
      latencyMs: Date.now() - started,
      programs,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, cluster: 'devnet', error: (e as Error).message },
      { status: 502 },
    );
  }
}
