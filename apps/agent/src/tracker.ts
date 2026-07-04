import { Pool } from 'pg';
import type { AgentSignal } from '@bozpicks/shared';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function saveSignal(signal: AgentSignal): Promise<void> {
  await db.query(
    `INSERT INTO boz_signals
       (id, match_id, type, detected_at, odds_before, odds_after,
        delta_percent, affected_outcome, confidence, context,
        correlated_event_id, outcome_verified, verification_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      signal.id, signal.matchId, signal.type, signal.detectedAt,
      JSON.stringify(signal.oddsBefore), JSON.stringify(signal.oddsAfter),
      signal.deltaPercent, signal.affectedOutcome, signal.confidence,
      signal.context, signal.correlatedEventId ?? null,
      signal.outcomeVerified, signal.verificationSource,
    ]
  );
}

export async function verifySignals(
  matchId: string,
  winner: 'HOME' | 'DRAW' | 'AWAY'
): Promise<void> {
  // fetch all unverified signals for this match
  const { rows } = await db.query<{ id: string; affected_outcome: string; delta_percent: number }>(
    `SELECT id, affected_outcome, delta_percent FROM boz_signals
     WHERE match_id = $1 AND outcome_verified = false`,
    [matchId]
  );

  for (const row of rows) {
    const signalWasLong = row.delta_percent > 0; // positive delta = outcome gaining prob
    const signalOutcome = row.affected_outcome as 'HOME' | 'DRAW' | 'AWAY';
    // accurate if the signal backed the winner (or faded the loser)
    const wasAccurate = signalWasLong
      ? signalOutcome === winner
      : signalOutcome !== winner;

    await db.query(
      `UPDATE boz_signals
       SET outcome_verified = true, was_accurate = $2,
           verified_at = NOW(), verification_source = 'TXLINE_FINAL'
       WHERE id = $1`,
      [row.id, wasAccurate]
    );
  }
}
