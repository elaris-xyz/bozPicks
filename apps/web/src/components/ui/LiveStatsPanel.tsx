'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats, OddsSnapshot, DangerLevel, MatchState } from '@bozpicks/shared';
import { CountUp } from './CountUp';

/**
 * Live win-probability gauge + match-stats readout, driven off the same TxLINE
 * event stream. Win prob comes from the consensus odds' implied probability, so
 * it swings the instant the market reacts to a goal or red card.
 */

const DANGER_COLOR: Record<DangerLevel, string> = {
  SAFE: '#475569', ATTACK: '#3b82f6', DANGER: '#f59e0b', HIGH_DANGER: '#ef4444',
};

function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away || 1;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-1">
        <span className="tabular-nums text-gray-200">{home}</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
        <span className="tabular-nums text-gray-200">{away}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ width: `${(home / total) * 100}%`, background: 'var(--green)', transition: 'width .5s' }} />
        <div style={{ width: `${(away / total) * 100}%`, background: 'var(--blue)', transition: 'width .5s' }} />
      </div>
    </div>
  );
}

export function LiveStatsPanel() {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [odds, setOdds] = useState<OddsSnapshot | null>(null);
  const live = useLiveMatch();

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (e.stats) setStats(e.stats);
      if (e.odds) setOdds(e.odds);
    },
  });

  const isLive = !!live?.live;
  // No live match → drop any stats/odds left over from a finished match so we
  // never show numbers for a game that isn't being played.
  useEffect(() => {
    if (!isLive) { setStats(null); setOdds(null); }
  }, [isLive]);

  // Seed odds + stats from the live match on mount. Without this the gauge only
  // fills on a live ODDS_UPDATE tick — and the demo emits those at intervals, so
  // landing on the page (or any gap between ticks) left "live odds appear at
  // kick-off" showing mid-match. `prev ?? …` means a live tick always wins.
  useEffect(() => {
    let alive = true;
    fetch('/api/matches', { cache: 'no-store' })
      .then(r => r.json())
      .then((list: MatchState[]) => {
        if (!alive || !Array.isArray(list)) return;
        const m = list.find(x => x.status === 'LIVE' || x.status === 'HALFTIME');
        if (!m) return;
        if (m.currentOdds) setOdds(prev => prev ?? m.currentOdds!);
        if (m.stats) setStats(prev => prev ?? m.stats!);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const ip = isLive ? odds?.impliedProb : undefined;
  const pHome = ip ? Math.round(ip.home * 100) : 0;
  const pDraw = ip ? Math.round(ip.draw * 100) : 0;
  const pAway = ip ? Math.round(ip.away * 100) : 0;
  const hasProb = !!ip;

  return (
    <div className="glass p-5 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <p className="section-label">Win Probability</p>
        {live?.live && <span className="chip-glass chip-green"><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />LIVE {live.minute}&rsquo;</span>}
      </div>

      {/* win-prob tri-bar — an empty track with a hint when no match is live,
          so we never paint a fabricated probability split */}
      <div>
        {hasProb ? (
          <div className="h-6 rounded-lg overflow-hidden flex text-[10px] font-black">
            <div className="flex items-center justify-center overflow-hidden" style={{ width: `${pHome}%`, background: 'var(--green)', color: '#04120b', transition: 'width .6s' }}><CountUp value={pHome} duration={600} suffix="%" /></div>
            <div className="flex items-center justify-center overflow-hidden" style={{ width: `${pDraw}%`, background: '#64748b', color: '#0b1020', transition: 'width .6s' }}><CountUp value={pDraw} duration={600} suffix="%" /></div>
            <div className="flex items-center justify-center overflow-hidden" style={{ width: `${pAway}%`, background: 'var(--blue)', color: '#020814', transition: 'width .6s' }}><CountUp value={pAway} duration={600} suffix="%" /></div>
          </div>
        ) : (
          <div className="h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold text-gray-600"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
            live odds appear at kick-off
          </div>
        )}
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 mt-1.5">
          <span>{live?.homeTeam ?? 'Home'}</span><span>Draw</span><span>{live?.awayTeam ?? 'Away'}</span>
        </div>
      </div>

      {/* danger meter */}
      {stats?.danger && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 w-16">Threat</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${DANGER_COLOR[stats.danger.home]}22`, color: DANGER_COLOR[stats.danger.home], border: `1px solid ${DANGER_COLOR[stats.danger.home]}66` }}>
            {stats.danger.home.replace('_', ' ')}
          </span>
          <div className="flex-1" />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${DANGER_COLOR[stats.danger.away]}22`, color: DANGER_COLOR[stats.danger.away], border: `1px solid ${DANGER_COLOR[stats.danger.away]}66` }}>
            {stats.danger.away.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* stat rows */}
      {stats ? (
        <div className="space-y-3">
          {typeof stats.possession === 'number' && (
            <StatRow label="possession %" home={stats.possession} away={100 - stats.possession} />
          )}
          <StatRow label="corners" home={stats.cornersHome} away={stats.cornersAway} />
          <StatRow label="yellow cards" home={stats.yellowHome} away={stats.yellowAway} />
          {(stats.redHome > 0 || stats.redAway > 0) && (
            <StatRow label="red cards" home={stats.redHome} away={stats.redAway} />
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center py-3">Waiting for live match stats…</p>
      )}
    </div>
  );
}
