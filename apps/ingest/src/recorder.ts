import { Pool } from 'pg';
import type { BozEvent } from '@bozpicks/shared';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

let matchStartTimes: Record<string, number> = {};

export async function record(event: BozEvent): Promise<void> {
  // a replay row without a real match id can never be played back
  if (!event.matchId || event.matchId === 'undefined') return;
  if (event.type === 'MATCH_START') {
    matchStartTimes[event.matchId] = Date.now();
  }

  const startTime = matchStartTimes[event.matchId] ?? Date.now();
  const delayMs = Date.now() - startTime;

  await db.query(
    `INSERT INTO boz_replay_events (id, match_id, recorded_at, delay_ms, payload)
     VALUES ($1, $2, NOW(), $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.matchId, delayMs, JSON.stringify(event)]
  );

  // also record to event log
  await db.query(
    `INSERT INTO boz_events (id, match_id, type, match_minute, timestamp, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.matchId, event.type, event.matchMinute, event.timestamp, JSON.stringify(event)]
  );
}

export { db };
