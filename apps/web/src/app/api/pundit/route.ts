import { NextRequest, NextResponse } from 'next/server';
import type { BozEvent } from '@bozpicks/shared';
import { punditLine } from '@/lib/pundit';

export const dynamic = 'force-dynamic';

/**
 * AI Pundit line. Uses Claude Haiku when ANTHROPIC_API_KEY is configured,
 * otherwise falls back to a fast contextual template so the rail never stalls.
 * Called only for the big moments (goal / red card) to keep it snappy.
 */
async function withClaude(e: BozEvent, home?: string, away?: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 90,
        messages: [{
          role: 'user',
          content: `You are a punchy live football pundit. In ONE vivid sentence (max 22 words), react to this event and what the betting market now thinks. No preamble.
Event: ${e.type.replace(/_/g, ' ')} at minute ${e.matchMinute}
${e.team ? `Team: ${e.team}` : ''}
${e.score ? `Score: ${e.score.home}-${e.score.away}` : ''}
Match: ${home ?? 'Home'} vs ${away ?? 'Away'}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    return typeof text === 'string' && text.length ? text : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { event?: BozEvent; home?: string; away?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }
  const e = body.event;
  if (!e) return NextResponse.json({ error: 'event required' }, { status: 400 });

  const ai = await withClaude(e, body.home, body.away);
  return NextResponse.json({ line: ai ?? punditLine(e, body.home, body.away) ?? '', ai: !!ai });
}
