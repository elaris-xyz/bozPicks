import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { MatchList } from '@/components/ui/MatchList';
import { LiveEventFeed } from '@/components/ui/LiveEventFeed';
import { LiveTicker } from '@/components/ui/LiveTicker';
import { DemoButton } from '@/components/ui/DemoButton';
import type { MatchState, OddsSnapshot } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

async function getMatches(): Promise<MatchState[]> {
  try {
    const { rows } = await db.query(
      `SELECT id, home_team, away_team, home_score, away_score,
              status, current_minute, kickoff_time, last_updated,
              competition, competition_id, stats
       FROM boz_matches ORDER BY kickoff_time ASC`
    );
    const oddsRaw = await Promise.all(
      rows.map(r => redis.lindex(`boz:match:${r.id}:odds`, 0))
    );
    return rows.map((r, i) => ({
      id: r.id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score ?? 0,
      awayScore: r.away_score ?? 0,
      status: r.status,
      currentMinute: r.current_minute ?? 0,
      kickoffTime: r.kickoff_time,
      lastUpdated: r.last_updated ?? new Date().toISOString(),
      currentOdds: oddsRaw[i] ? (JSON.parse(oddsRaw[i]!) as OddsSnapshot) : undefined,
      competition: r.competition ?? undefined,
      competitionId: r.competition_id ?? undefined,
      stats: r.stats ?? undefined,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const matches = await getMatches();
  const live = matches.filter(m => m.status === 'LIVE' || m.status === 'HALFTIME');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED');
  // live first, then upcoming — so the ticker is always full and useful
  const tickerMatches = [...live, ...upcoming];

  return (
    <div className="space-y-6">
      <div className="-mt-4 md:-mt-8">
        <LiveTicker matches={tickerMatches} />
      </div>
      <MatchList initialMatches={matches} />
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label">Recent Events</p>
          <DemoButton />
        </div>
        <LiveEventFeed />
      </section>
    </div>
  );
}
