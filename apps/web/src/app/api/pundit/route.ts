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

  // ground the commentary in the state of the match so it reads like a real call
  const H = home ?? 'Home', A = away ?? 'Away';
  let situation = '';
  if (e.score) {
    const { home: h, away: a } = e.score;
    if (h === a) situation = h === 0 ? 'still goalless and level' : `all square at ${h}–${a}`;
    else {
      const lead = Math.abs(h - a);
      const leader = h > a ? H : A;
      situation = `${leader} ${lead === 1 ? 'edge ahead' : `lead by ${lead}`} — ${h}–${a}`;
    }
  }
  const beat = e.type === 'GOAL' ? `GOAL for ${e.team ?? 'the attacking side'}`
    : e.type === 'RED_CARD' ? `RED CARD, ${e.team ?? ''} down to ten men`
    : e.type.replace(/_/g, ' ').toLowerCase();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `You are a seasoned live football commentator on TV — a warm, confident male voice with personality (think a veteran play-by-play caller). Call the moment below in ONE natural spoken sentence, 16–26 words, the way it would sound on air: lead with the emotional beat, then the context — who's ahead now, the momentum, how tough the comeback looks. Conversational and vivid. No preamble, no lists, no hashtags, no stats dump.

Match: ${H} vs ${A}, ${e.matchMinute}'
Just happened: ${beat}
State now: ${situation || 'early in the match'}

Example of the tone (do not copy): "Oh, and there it is — Brazil surge two goals clear, and you have to wonder if Argentina have the legs to claw this one back."`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    return typeof text === 'string' && text.length ? text.replace(/^["']|["']$/g, '') : null;
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
