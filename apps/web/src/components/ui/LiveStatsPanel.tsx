'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent, MatchStats, OddsSnapshot, DangerLevel } from '@bozpicks/shared';

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
  const [ctx, setCtx] = useState<{ home?: string; away?: string; hs: number; as: number; min: number; live: boolean }>({ hs: 0, as: 0, min: 0, live: false });

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (e.stats) setStats(e.stats);
      if (e.odds) setOdds(e.odds);
      if (e.score) setCtx(c => ({ ...c, hs: e.score!.home, as: e.score!.away, min: e.matchMinute, live: e.type !== 'MATCH_END' }));
      if (e.type === 'MATCH_END') setCtx(c => ({ ...c, live: false }));
    },
  });

  const ip = odds?.impliedProb;
  const pHome = ip ? Math.round(ip.home * 100) : 33;
  const pDraw = ip ? Math.round(ip.draw * 100) : 34;
  const pAway = ip ? Math.round(ip.away * 100) : 33;

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Win Probability</p>
        {ctx.live && <span className="chip-glass chip-green"><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />LIVE {ctx.min}&rsquo;</span>}
      </div>

      {/* win-prob tri-bar */}
      <div>
        <div className="h-6 rounded-lg overflow-hidden flex text-[10px] font-black">
          <div className="flex items-center justify-center" style={{ width: `${pHome}%`, background: 'var(--green)', color: '#04120b', transition: 'width .6s' }}>{pHome}%</div>
          <div className="flex items-center justify-center" style={{ width: `${pDraw}%`, background: '#64748b', color: '#0b1020', transition: 'width .6s' }}>{pDraw}%</div>
          <div className="flex items-center justify-center" style={{ width: `${pAway}%`, background: 'var(--blue)', color: '#020814', transition: 'width .6s' }}>{pAway}%</div>
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 mt-1.5">
          <span>{ctx.home ?? 'Home'}</span><span>Draw</span><span>{ctx.away ?? 'Away'}</span>
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
