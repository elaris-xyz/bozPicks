import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB check
  try {
    const t = Date.now();
    await db.query('SELECT 1');
    checks.db = { ok: true, latencyMs: Date.now() - t };
  } catch (e) {
    checks.db = { ok: false, error: (e as Error).message };
  }

  // Redis check
  try {
    const t = Date.now();
    await redis.ping();
    checks.redis = { ok: true, latencyMs: Date.now() - t };
  } catch (e) {
    checks.redis = { ok: false, error: (e as Error).message };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', uptimeMs: Date.now() - start, checks },
    { status: allOk ? 200 : 503 }
  );
}
