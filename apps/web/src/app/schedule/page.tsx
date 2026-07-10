import { db } from '@/lib/db';
import { MatchList } from '@/components/ui/MatchList';
import { PageHeader } from '@/components/ui/PageHeader';
import type { MatchState } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Schedule',
  description: 'Every World Cup fixture from the TxLINE feed — poster, list and grid views.',
};

async function getSchedule(): Promise<MatchState[]> {
  try {
    const { rows } = await db.query(`
      SELECT id, home_team, away_team, home_score, away_score,
             status, current_minute, kickoff_time, last_updated
      FROM boz_matches
      ORDER BY kickoff_time ASC
    `);
    return rows.map(r => ({
      id: r.id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score ?? 0,
      awayScore: r.away_score ?? 0,
      status: r.status,
      currentMinute: r.current_minute ?? 0,
      kickoffTime: r.kickoff_time,
      lastUpdated: r.last_updated ?? new Date().toISOString(),
    }));
  } catch { return []; }
}

/**
 * The schedule IS the match browser — the exact same component the home page
 * uses (search, Live/Upcoming/Finished tabs, poster rails / 3-column list /
 * date-stamped grid, live odds ticks). One machine, one behaviour everywhere.
 */
export default async function SchedulePage() {
  const matches = await getSchedule();

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" count={matches.length}
        subtitle="Every fixture from the TxLINE feed · poster, list and grid views · all times local" />
      <MatchList initialMatches={matches} />
    </div>
  );
}
