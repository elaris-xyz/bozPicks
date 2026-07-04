import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import type { OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const raw = await redis.lrange(`boz:match:${id}:odds`, 0, 49);
  const odds: OddsSnapshot[] = raw.map(r => JSON.parse(r) as OddsSnapshot).reverse();
  return NextResponse.json(odds);
}
