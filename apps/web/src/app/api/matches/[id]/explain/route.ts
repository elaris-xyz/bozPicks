import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { BozEvent } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

const IMPACT_MAP: Record<string, string> = {
  GOAL:         'Significant market mover — expect odds to shift 15–30%',
  RED_CARD:     'High impact — team down to 10 men, draw/away odds will shorten',
  YELLOW_CARD:  'Minor impact unless key player — watch for second yellow risk',
  HALFTIME:     'Markets may reopen with adjusted half-time lines',
  MATCH_START:  'In-play markets now active — live odds updating every 30s',
  MATCH_END:    'Markets settled — final result confirmed',
  SUBSTITUTION: 'Tactical change — monitor if offensive or defensive intent',
  ODDS_UPDATE:  'Sharp money detected — significant odds movement in last 2 minutes',
};

const IMPORTANCE_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  GOAL:         'CRITICAL',
  RED_CARD:     'HIGH',
  YELLOW_CARD:  'LOW',
  HALFTIME:     'MEDIUM',
  MATCH_START:  'MEDIUM',
  MATCH_END:    'HIGH',
  SUBSTITUTION: 'LOW',
  ODDS_UPDATE:  'HIGH',
};

async function generateWithClaude(event: BozEvent, matchContext: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `You are a sharp football betting analyst. In 2 sentences, explain the market impact of this event for live bettors. Be concise and data-driven.

Event: ${event.type.replace(/_/g, ' ')} — Minute ${event.matchMinute}
${event.team ? `Team: ${event.team}` : ''}
${event.player ? `Player: ${event.player}` : ''}
${event.score ? `Score: ${event.score.home}–${event.score.away}` : ''}
Match context: ${matchContext}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const body = await req.json();
  const event = body.event as BozEvent;
  if (!event) return NextResponse.json({ error: 'event required' }, { status: 400 });

  // Check if explanation already exists
  const existing = await db.query(
    `SELECT * FROM boz_explanations WHERE event_id = $1`,
    [event.id]
  );
  if (existing.rows[0]) return NextResponse.json(existing.rows[0]);

  const matchCtx = `Match ${matchId} — ${body.homeTeam ?? 'Home'} vs ${body.awayTeam ?? 'Away'}`;

  const aiBody = await generateWithClaude(event, matchCtx);
  const headline = event.team
    ? `${event.type.replace(/_/g, ' ')} — ${event.team} (${event.matchMinute}')`
    : `${event.type.replace(/_/g, ' ')} at ${event.matchMinute}'`;

  const explanation = {
    id: `exp-${event.id}`,
    matchId,
    eventId: event.id,
    generatedAt: new Date().toISOString(),
    headline,
    body: aiBody ?? `${headline}. ${IMPACT_MAP[event.type] ?? 'Monitor market reaction over next 5 minutes.'}`,
    marketImpact: IMPACT_MAP[event.type] ?? 'Monitor market closely',
    importance: IMPORTANCE_MAP[event.type] ?? 'LOW',
  };

  // Persist
  await db.query(
    `INSERT INTO boz_explanations (id, match_id, event_id, generated_at, headline, body, market_impact, importance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (event_id) DO NOTHING`,
    [explanation.id, explanation.matchId, explanation.eventId, explanation.generatedAt,
     explanation.headline, explanation.body, explanation.marketImpact, explanation.importance]
  ).catch(() => {});

  return NextResponse.json(explanation);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { rows } = await db.query(
    `SELECT * FROM boz_explanations WHERE match_id = $1 ORDER BY generated_at DESC LIMIT 20`,
    [id]
  );
  return NextResponse.json(rows);
}
