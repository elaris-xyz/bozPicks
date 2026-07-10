import { db } from '@/lib/db';
import { txlineRest } from '@bozpicks/txline-client';

/**
 * Self-healing fixtures sync. The match list/ticker read boz_matches, which the
 * ingest worker seeds from TxLINE — but if that worker isn't running the
 * snapshot freezes (we shipped a list showing "SOON · 26 June" two weeks after
 * the 26th). Pages call maybeSyncFixtures() before reading: when the stored
 * snapshot is stale it re-pulls the LIVE TxLINE fixtures snapshot, upserts
 * kickoffs/teams, and removes scheduled ghosts that TxLINE no longer lists.
 * Cheap when fresh (one aggregate query), never throws into the page.
 */

let inflight: Promise<void> | null = null;

export async function maybeSyncFixtures(): Promise<void> {
  if (inflight) return inflight; // collapse concurrent page renders
  inflight = (async () => {
    try {
      const { rows } = await db.query(`
        SELECT
          COALESCE(MAX(last_updated), 'epoch'::timestamptz) AS newest,
          COUNT(*) FILTER (WHERE status = 'SCHEDULED' AND kickoff_time < NOW() - interval '3 hours') AS stale_scheduled
        FROM boz_matches WHERE id NOT LIKE 'demo-%'
      `);
      const newest = new Date(rows[0]?.newest ?? 0).getTime();
      const staleScheduled = Number(rows[0]?.stale_scheduled ?? 0);
      const fresh = Date.now() - newest < 6 * 3600_000 && staleScheduled === 0;
      if (fresh) return;

      // pull the live snapshot (bounded — never stall a page render for long)
      const fixtures = await Promise.race([
        txlineRest.fixtures(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('fixtures timeout')), 8000)),
      ]);
      if (!Array.isArray(fixtures) || fixtures.length === 0) return;

      const ids: string[] = [];
      for (const f of fixtures) {
        const id = String(f.FixtureId);
        ids.push(id);
        const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
        const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
        await db.query(
          `INSERT INTO boz_matches
             (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time, competition, competition_id, last_updated)
           VALUES ($1,$2,$3,0,0,'SCHEDULED',0,$4,$5,$6,NOW())
           ON CONFLICT (id) DO UPDATE SET
             home_team = EXCLUDED.home_team,
             away_team = EXCLUDED.away_team,
             kickoff_time = EXCLUDED.kickoff_time,
             competition = EXCLUDED.competition,
             competition_id = EXCLUDED.competition_id,
             last_updated = NOW()
           WHERE boz_matches.status = 'SCHEDULED'`, // never clobber a live/finished match
          [id, home, away, f.StartTime, f.Competition ?? null, f.CompetitionId ?? null]
        ).catch(() => {});
      }

      // scheduled ghosts TxLINE no longer lists (old snapshot leftovers) → out
      await db.query(
        `DELETE FROM boz_matches
         WHERE id NOT LIKE 'demo-%' AND status = 'SCHEDULED' AND NOT (id = ANY($1::text[]))`,
        [ids]
      ).catch(() => {});

      console.log(`[fixtures-sync] refreshed ${ids.length} fixtures from TxLINE`);
    } catch (e) {
      console.warn('[fixtures-sync] skipped:', (e as Error).message);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
