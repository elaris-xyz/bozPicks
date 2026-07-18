'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, PropMarket } from '@bozpicks/shared';
import { usdcToDisplay } from '@bozpicks/shared';
import { CountUp } from './CountUp';
import { Flag } from './Flag';

/**
 * The live centrepiece of /markets (mirrors the Play scoreboard). Shows the
 * total USDC pool and open/settled counts, plus the match those markets belong
 * to — a green "settling" state while live, a "settled from proof" state at full
 * time, and an invite to the Command Bridge when nothing is open yet.
 */
export function MarketsBanner() {
  const [markets, setMarkets] = useState<PropMarket[]>([]);
  const live = useLiveMatch();

  useEffect(() => {
    fetch('/api/markets', { cache: 'no-store' })
      .then(r => r.json())
      .then(m => { if (Array.isArray(m)) setMarkets(m); })
      .catch(() => {});
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'market_update' || !msg.data) return;
      const m = msg.data as PropMarket;
      setMarkets(prev => {
        if (prev.length && prev[0].matchId !== m.matchId) return [m]; // new match resets the set
        const i = prev.findIndex(x => x.id === m.id);
        if (i === -1) return [...prev, m];
        const n = [...prev]; n[i] = m; return n;
      });
    },
  });

  const total = markets.reduce((s, m) => s + m.totalPool, 0);
  const open = markets.filter(m => m.status === 'OPEN').length;
  const settled = markets.filter(m => m.status === 'SETTLED').length;
  const allSettled = markets.length > 0 && settled === markets.length;
  const accent = allSettled ? 'var(--green)' : open > 0 ? 'var(--blue)' : '#64748b';

  if (markets.length === 0) {
    return (
      <div className="glass fx-rise relative overflow-hidden p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
             style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" />
          </svg>
        </div>
        <p className="font-display text-lg font-bold text-gray-200">No markets open yet</p>
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          Tap the{' '}
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full align-middle mx-0.5" style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)' }}>
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
          </span>{' '}
          <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left) to run a match —
          eight prop markets open instantly and settle from a TxLINE proof at full time.
        </p>
      </div>
    );
  }

  return (
    <div className="glass fx-rise relative overflow-hidden"
         style={{ borderColor: `${accent}47`, boxShadow: `0 0 30px ${accent}1f` }}>
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
      <div className="relative p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <span className="chip-glass" style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}55` }}>
            {allSettled
              ? <><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>Settled from proof</>
              : <><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />{open} markets open</>}
          </span>
          {live?.homeTeam && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400 min-w-0">
              <Flag team={live.homeTeam} size="xs" />
              <span className="truncate">{live.homeTeam} {live.homeScore}–{live.awayScore} {live.awayTeam}</span>
              <Flag team={live.awayTeam} size="xs" />
              {live.live && <span className="text-[var(--green)] font-bold flex-shrink-0">{live.minute}&rsquo;</span>}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-3xl md:text-4xl font-black tabular-nums" style={{ color: 'var(--green)' }}>
              <CountUp value={Number(usdcToDisplay(total))} duration={700} />
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Pool USDC</p>
          </div>
          <div>
            <p className="font-display text-3xl md:text-4xl font-black tabular-nums" style={{ color: 'var(--blue)' }}>{open}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Open</p>
          </div>
          <div>
            <p className="font-display text-3xl md:text-4xl font-black tabular-nums" style={{ color: allSettled ? 'var(--green)' : '#e2e8f0' }}>{settled}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Settled</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
          {allSettled
            ? 'Every market resolved trustlessly from the TxLINE stat proof — payouts split the pool pro-rata.'
            : 'Stake on any outcome. At full time each market settles from a TxLINE Merkle proof — no trusted oracle.'}
        </p>
      </div>
    </div>
  );
}
