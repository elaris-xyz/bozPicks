import type { OddsSnapshot, AgentSignal, Outcome, Confidence } from '@bozpicks/shared';
import { randomUUID } from 'crypto';

const SHARP_MOVE_THRESHOLD = parseFloat(process.env.SHARP_THRESHOLD ?? '0.10');
const WINDOW_MS = parseInt(process.env.SHARP_WINDOW_MS ?? '120000', 10);

export function detectSharpMove(
  matchId: string,
  currentOdds: OddsSnapshot,
  oddsHistory: OddsSnapshot[],
  context: string,
  correlatedEventId?: string
): AgentSignal | null {
  const windowStart = Date.now() - WINDOW_MS;
  const recent = oddsHistory.filter(
    (o) => new Date(o.timestamp).getTime() > windowStart
  );

  if (recent.length === 0) return null;

  const baseline = recent[recent.length - 1]; // oldest in window

  const outcomes: { key: 'home' | 'draw' | 'away'; label: Outcome }[] = [
    { key: 'home', label: 'HOME' },
    { key: 'draw', label: 'DRAW' },
    { key: 'away', label: 'AWAY' },
  ];

  for (const { key, label } of outcomes) {
    const before = baseline.impliedProb[key];
    const after = currentOdds.impliedProb[key];
    if (before === 0) continue;

    const delta = (after - before) / before;

    if (Math.abs(delta) >= SHARP_MOVE_THRESHOLD) {
      const confidence: Confidence =
        Math.abs(delta) >= 0.20 ? 'HIGH' :
        Math.abs(delta) >= 0.15 ? 'MEDIUM' : 'LOW';

      return {
        id: randomUUID(),
        matchId,
        type: 'SHARP_MOVE',
        detectedAt: new Date().toISOString(),
        oddsBefore: baseline,
        oddsAfter: currentOdds,
        deltaPercent: delta * 100,
        affectedOutcome: label,
        confidence,
        context,
        correlatedEventId,
        outcomeVerified: false,
        verificationSource: 'PENDING',
      };
    }
  }

  return null;
}
