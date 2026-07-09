import { db } from '@/lib/db';
import Link from 'next/link';
import { Countdown } from '@/components/ui/Countdown';
import { Flag } from '@/components/ui/Flag';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconClock } from '@/components/ui/Icons';
import type { MatchState } from '@bozpicks/shared';

export const dynamic = 'force-dynamic';

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

function groupByDate(matches: MatchState[]): Map<string, MatchState[]> {
  const map = new Map<string, MatchState[]>();
  for (const m of matches) {
    const key = new Date(m.kickoffTime).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return map;
}

const STATUS_CFG = {
  LIVE:      { label: 'LIVE',  color: 'var(--green)',  bg: 'rgba(16,185,129,0.12)' },
  HALFTIME:  { label: 'HT',    color: 'var(--amber)',  bg: 'rgba(245,158,11,0.12)' },
  SCHEDULED: { label: 'SOON',  color: '#94a3b8',       bg: 'rgba(148,163,184,0.1)' },
  FINISHED:  { label: 'FT',    color: '#64748b',       bg: 'rgba(100,116,139,0.1)' },
};

export default async function SchedulePage() {
  const matches = await getSchedule();
  const grouped = groupByDate(matches);

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" count={matches.length} subtitle="Every fixture from the TxLINE feed · all times local" />

      {matches.length === 0 && (
        <div className="glass fx-rise text-center py-16 px-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <IconClock size={26} />
          </div>
          <p className="font-display text-lg font-bold text-gray-200">No fixtures loaded yet</p>
          <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            The schedule fills from the TxLINE fixtures snapshot — run the ingest, or start a
            match from the <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left).
          </p>
        </div>
      )}

      {[...grouped.entries()].map(([date, dayMatches]) => {
        const isToday = date === new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <section key={date} className="space-y-2">
            {/* prominent day header — same calendar-chip style as the home list */}
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isToday ? 'var(--blue-dim)' : 'rgba(148,163,184,0.1)',
                             color: isToday ? 'var(--blue)' : '#94a3b8',
                             border: `1px solid ${isToday ? 'rgba(59,130,246,0.4)' : 'rgba(148,163,184,0.2)'}`,
                             boxShadow: isToday ? '0 0 12px rgba(59,130,246,0.25)' : 'none' }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" />
                </svg>
              </span>
              <span className="text-[13px] font-bold tracking-tight" style={{ color: isToday ? 'var(--blue)' : '#e2e8f0' }}>
                {isToday ? 'Today' : date}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{dayMatches.length}</span>
            </div>

            <div className="space-y-2">
              {dayMatches.map(m => {
                const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.SCHEDULED;
                const isLive = m.status === 'LIVE' || m.status === 'HALFTIME';
                return (
                  <Link key={m.id} href={`/match/${m.id}`}>
                    <div className="glass glass-hover flex items-center gap-4 p-4">
                      {/* Time */}
                      <div className="text-center w-14 flex-shrink-0">
                        {m.status === 'SCHEDULED' ? (
                          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--blue)' }}>
                            {new Date(m.kickoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ) : (
                          <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full"
                               style={{ background: cfg.bg }}>
                            {isLive && <span className="w-1 h-1 rounded-full badge-live" style={{ background: cfg.color }} />}
                            <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                              {cfg.label}{isLive ? ` ${m.currentMinute}'` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Teams */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="flex items-center gap-2 text-sm font-semibold truncate">
                              <Flag team={m.homeTeam} size="xs" /> {m.homeTeam}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-semibold truncate">
                              <Flag team={m.awayTeam} size="xs" /> {m.awayTeam}
                            </p>
                          </div>
                          {(isLive || m.status === 'FINISHED') && (
                            <div className="text-center flex-shrink-0">
                              <p className="font-display text-xl font-bold tabular-nums"
                                 style={{ color: isLive ? '#fff' : '#cbd5e1' }}>
                                {m.homeScore}<span className="text-gray-600 mx-1">–</span>{m.awayScore}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Countdown for scheduled */}
                      {m.status === 'SCHEDULED' && (
                        <div className="flex-shrink-0">
                          <Countdown kickoffTime={m.kickoffTime} />
                        </div>
                      )}

                      <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
