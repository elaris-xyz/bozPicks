'use client';

import { useState, useEffect, useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { MatchCard, type OddsTrend } from './MatchCard';
import { MatchRow } from './MatchRow';
import { useFavorites } from '@/hooks/useFavorites';
import { useOddsFormat, type OddsFormat } from '@/hooks/useOddsFormat';
import type { MatchState, BozEvent, AgentSignal, SSEMessage, OddsSnapshot } from '@bozpicks/shared';
import { MatchListSkeleton } from './Skeleton';

const SCORE_EVENTS = new Set(['GOAL', 'SCORE_UPDATE', 'MATCH_START', 'MATCH_END', 'HALFTIME']);
type Tab = 'all' | 'live' | 'upcoming' | 'finished' | 'starred';

const FMT_LABELS: Record<OddsFormat, string> = { decimal: 'Dec', fractional: 'Frac', american: 'US' };

/** Group matches by kickoff day (chronological — input is already sorted). */
function groupByDay(list: MatchState[]): { label: string; count: number; matches: MatchState[] }[] {
  const dayKey = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date TBD';
  const todayKey = dayKey(new Date().toISOString());
  const map = new Map<string, MatchState[]>();
  for (const m of list) {
    const k = dayKey(m.kickoffTime);
    (map.get(k) ?? map.set(k, []).get(k)!).push(m);
  }
  return [...map.entries()].map(([key, matches]) => ({
    label: key === todayKey ? 'Today' : key,
    count: matches.length,
    matches,
  }));
}

export function MatchList({ initialMatches }: { initialMatches: MatchState[] }) {
  const [hydrated, setHydrated] = useState(false);
  const [matches, setMatches] = useState<MatchState[]>(initialMatches);

  useEffect(() => { setHydrated(true); }, []);
  const [signalCounts, setSignalCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const { favorites, toggle: toggleFav, isFav } = useFavorites();
  const { format: oddsFormat, setFormat: setOddsFormat } = useOddsFormat();

  // view density: cinematic poster grid vs compact scan list
  const [view, setView] = useState<'poster' | 'list'>('poster');
  useEffect(() => {
    const saved = localStorage.getItem('match_view');
    if (saved === 'list' || saved === 'poster') setView(saved);
  }, []);
  const chooseView = (v: 'poster' | 'list') => { setView(v); localStorage.setItem('match_view', v); };

  // transient odds-movement direction per match (flashes ▲▼, then clears)
  const [trends, setTrends] = useState<Record<string, OddsTrend>>({});
  const prevOdds = useRef<Record<string, OddsSnapshot>>({});
  const trendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const init: Record<string, OddsSnapshot> = {};
    initialMatches.forEach(m => { if (m.currentOdds) init[m.id] = m.currentOdds; });
    prevOdds.current = init;
    const timers = trendTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, [initialMatches]);

  useEffect(() => {
    fetch('/api/agents/signals')
      .then(r => r.json())
      .then((signals: AgentSignal[]) => {
        const counts: Record<string, number> = {};
        signals.filter(s => !s.outcomeVerified).forEach(s => {
          counts[s.matchId] = (counts[s.matchId] ?? 0) + 1;
        });
        setSignalCounts(counts);
      })
      .catch(() => {});
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;

        // Odds movement → compute ▲▼ direction vs the last known odds
        if (e.type === 'ODDS_UPDATE' && e.odds) {
          const old = prevOdds.current[e.matchId];
          if (old) {
            const dir = (a: number, b: number): 'up' | 'down' | undefined =>
              a < b ? 'up' : a > b ? 'down' : undefined; // price down = probability up = ▲
            const t: OddsTrend = {
              home: dir(e.odds.homeWin, old.homeWin),
              draw: dir(e.odds.draw, old.draw),
              away: dir(e.odds.awayWin, old.awayWin),
            };
            if (t.home || t.draw || t.away) {
              setTrends(prev => ({ ...prev, [e.matchId]: t }));
              clearTimeout(trendTimers.current[e.matchId]);
              trendTimers.current[e.matchId] = setTimeout(() => {
                setTrends(prev => { const n = { ...prev }; delete n[e.matchId]; return n; });
              }, 2600);
            }
          }
          prevOdds.current[e.matchId] = e.odds;
        }

        setMatches(prev => prev.map(m => {
          if (m.id !== e.matchId) return m;
          const u = { ...m };
          if (SCORE_EVENTS.has(e.type)) {
            if (e.score) { u.homeScore = e.score.home; u.awayScore = e.score.away; }
            if (e.matchMinute) u.currentMinute = e.matchMinute;
            if (e.type === 'MATCH_END')   u.status = 'FINISHED';
            else if (e.type === 'HALFTIME')   u.status = 'HALFTIME';
            else if (e.type === 'MATCH_START') u.status = 'LIVE';
          }
          if (e.type === 'ODDS_UPDATE' && e.odds) u.currentOdds = e.odds;
          return u;
        }));
      }
      if (msg.type === 'signal' && msg.data) {
        const s = msg.data as AgentSignal;
        setSignalCounts(prev => ({ ...prev, [s.matchId]: (prev[s.matchId] ?? 0) + 1 }));
      }
    },
  });

  const liveCount     = matches.filter(m => m.status === 'LIVE' || m.status === 'HALFTIME').length;
  const upcomingCount = matches.filter(m => m.status === 'SCHEDULED').length;
  const finishedCount = matches.filter(m => m.status === 'FINISHED').length;
  const starredCount  = matches.filter(m => isFav(m.id)).length;

  const tabDefs: { key: Tab; label: string; count: number }[] = [
    { key: 'all',      label: 'All',      count: matches.length },
    { key: 'live',     label: 'Live',     count: liveCount },
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { key: 'finished', label: 'Finished', count: finishedCount },
    { key: 'starred',  label: '★',        count: starredCount },
  ];

  const q = query.toLowerCase();
  const visible = matches.filter(m => {
    const matchesQuery = !q || m.homeTeam.toLowerCase().includes(q) || m.awayTeam.toLowerCase().includes(q);
    const matchesTab =
      tab === 'all'      ? true :
      tab === 'live'     ? (m.status === 'LIVE' || m.status === 'HALFTIME') :
      tab === 'upcoming' ? m.status === 'SCHEDULED' :
      tab === 'starred'  ? isFav(m.id) :
                           m.status === 'FINISHED';
    return matchesQuery && matchesTab;
  });

  const visLive     = visible.filter(m => m.status === 'LIVE' || m.status === 'HALFTIME');
  const visUpcoming = visible.filter(m => m.status === 'SCHEDULED');
  const visFinished = visible.filter(m => m.status === 'FINISHED');

  if (!hydrated) return <MatchListSkeleton />;

  const renderMatches = (list: MatchState[]) =>
    view === 'list' ? (
      <div className="space-y-2">
        {list.map(m => (
          <MatchRow key={m.id} match={m} trend={trends[m.id]}
            activeSignals={signalCounts[m.id] ?? 0} isFav={isFav(m.id)}
            onToggleFav={toggleFav} oddsFormat={oddsFormat} />
        ))}
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m, i) => (
          <MatchCard key={m.id} index={i} match={m} trend={trends[m.id]}
            activeSignals={signalCounts[m.id] ?? 0} isFav={isFav(m.id)}
            onToggleFav={toggleFav} oddsFormat={oddsFormat} />
        ))}
      </div>
    );

  /**
   * Horizontal rail: one day's fixtures in a single row that scrolls sideways,
   * with compact cards. Keeps each day to one line instead of a tall grid, so
   * the whole schedule reads as a timeline of days stacked top-to-bottom.
   * In list view we fall back to the vertical rows (scanning is better there).
   */
  const renderRail = (list: MatchState[]) =>
    view === 'list' ? (
      <div className="space-y-2">
        {list.map(m => (
          <MatchRow key={m.id} match={m} trend={trends[m.id]}
            activeSignals={signalCounts[m.id] ?? 0} isFav={isFav(m.id)}
            onToggleFav={toggleFav} oddsFormat={oddsFormat} />
        ))}
      </div>
    ) : (
      <div className="flex gap-3 overflow-x-auto pb-2 rail-scroll snap-x">
        {list.map((m, i) => (
          <div key={m.id} className="flex-shrink-0 w-[180px] sm:w-[210px] snap-start">
            <MatchCard index={i} match={m} trend={trends[m.id]}
              activeSignals={signalCounts[m.id] ?? 0} isFav={isFav(m.id)}
              onToggleFav={toggleFav} oddsFormat={oddsFormat} compact />
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-5">

      {/* Search bar */}
      <div className="relative group/search">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors group-focus-within/search:text-[var(--blue)]"
             fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input type="text" placeholder="Search teams…" value={query}
          onChange={e => setQuery(e.target.value)}
          className="search-input w-full pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: '#e2e8f0' }} />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs + Odds format toggle */}
      <div className="flex items-center gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1" style={{ scrollbarWidth: 'none' }}>
        {tabDefs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 h-8 rounded-xl text-xs font-semibold transition-all"
            style={tab === t.key
              ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.4)', boxShadow: '0 0 12px rgba(59,130,246,0.15)' }
              : { background: 'var(--glass-bg)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
            {t.label}
            {t.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: tab === t.key ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.06)' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

        {/* View density toggle */}
        <div className="flex flex-shrink-0 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--glass-border)' }}>
          {([
            { v: 'poster' as const, label: 'Poster', icon: (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" />
              </svg>
            ) },
            { v: 'list' as const, label: 'List', icon: (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
              </svg>
            ) },
          ]).map(({ v, label, icon }) => (
            <button key={v} onClick={() => chooseView(v)} title={`${label} view`}
              className="px-2.5 h-8 flex items-center justify-center transition-all"
              style={view === v
                ? { background: 'var(--blue-dim)', color: 'var(--blue)' }
                : { background: 'transparent', color: '#4b5563' }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Odds format toggle */}
        <div className="flex flex-shrink-0 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--glass-border)' }}>
          {(['decimal', 'fractional', 'american'] as const).map(f => (
            <button key={f} onClick={() => setOddsFormat(f)}
              className="px-2 h-8 text-[10px] font-bold transition-all"
              style={oddsFormat === f
                ? { background: 'var(--blue-dim)', color: 'var(--blue)' }
                : { background: 'transparent', color: '#4b5563' }}>
              {FMT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* No results */}
      {visible.length === 0 && (
        <div className="glass py-14 text-center text-gray-600 rounded-2xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center text-gray-500"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm">{matches.length === 0 ? 'No matches yet' : 'No matches found'}</p>
        </div>
      )}

      {/* Live */}
      {visLive.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full badge-live" style={{ background: 'var(--green)' }} />
            <h2 className="section-label" style={{ color: 'var(--green)' }}>
              Live · {visLive.length}
            </h2>
          </div>
          {renderMatches(visLive)}
        </section>
      )}

      {/* Upcoming — a vertical timeline of days; each day is a horizontal rail */}
      {visUpcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">Upcoming · {visUpcoming.length}</h2>
          <div className={view === 'poster' ? 'relative pl-5' : ''}>
            {/* the spine connecting the day nodes (poster view only) */}
            {view === 'poster' && (
              <div className="absolute left-[3px] top-2 bottom-2 w-px"
                   style={{ background: 'linear-gradient(to bottom, var(--glass-border), transparent)' }} />
            )}
            <div className="space-y-4">
              {groupByDay(visUpcoming).map(g => {
                const isToday = g.label === 'Today';
                return (
                  <div key={g.label} className="space-y-2 relative">
                    {/* day node on the spine (poster view) */}
                    {view === 'poster' && (
                      <span className="absolute -left-5 top-1.5 w-[7px] h-[7px] rounded-full"
                            style={{
                              background: isToday ? 'var(--blue)' : '#475569',
                              boxShadow: isToday ? '0 0 0 3px var(--bg-deep), 0 0 10px rgba(59,130,246,0.5)' : '0 0 0 3px var(--bg-deep)',
                            }} />
                    )}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: isToday ? 'var(--blue)' : '#64748b' }}>{g.label}</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
                      <span className="text-[10px] text-gray-700 tabular-nums">{g.count}</span>
                    </div>
                    {renderRail(g.matches)}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Finished */}
      {visFinished.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">Finished</h2>
          {renderMatches(visFinished)}
        </section>
      )}
    </div>
  );
}
