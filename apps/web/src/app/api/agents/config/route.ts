import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * Live-tunable sharp-move detector config. The headless agent (Railway)
 * polls this Redis key every ~5s and applies it immediately — no redeploy,
 * no env var change. Lets the /agent page's sliders be a REAL control
 * instead of a decorative one: threshold as a 0–1 fraction (UI shows %),
 * windowMs as milliseconds (UI shows minutes).
 */
const CONFIG_KEY = 'boz:agent:config';
const DEFAULT_THRESHOLD = parseFloat(process.env.SHARP_THRESHOLD ?? '0.10');
const DEFAULT_WINDOW_MS = parseInt(process.env.SHARP_WINDOW_MS ?? '120000', 10);

export async function GET() {
  try {
    const raw = await redis.get(CONFIG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return NextResponse.json({
      threshold: typeof cfg.threshold === 'number' ? cfg.threshold : DEFAULT_THRESHOLD,
      windowMs: typeof cfg.windowMs === 'number' ? cfg.windowMs : DEFAULT_WINDOW_MS,
    });
  } catch {
    return NextResponse.json({ threshold: DEFAULT_THRESHOLD, windowMs: DEFAULT_WINDOW_MS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const threshold = Number(body.threshold);
    const windowMs = Number(body.windowMs);
    if (!(threshold > 0 && threshold <= 1)) return NextResponse.json({ error: 'threshold must be in (0, 1]' }, { status: 400 });
    if (!(windowMs >= 30_000 && windowMs <= 600_000)) return NextResponse.json({ error: 'windowMs must be 30000–600000' }, { status: 400 });
    await redis.set(CONFIG_KEY, JSON.stringify({ threshold, windowMs }));
    return NextResponse.json({ ok: true, threshold, windowMs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
