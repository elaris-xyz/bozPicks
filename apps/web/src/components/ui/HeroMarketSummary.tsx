'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, PropMarket } from '@bozpicks/shared';
import { usdcToDisplay } from '@bozpicks/shared';

/** Right-column hero panel for /markets — live pool + open/settled counts. */
export function HeroMarketSummary() {
  const [markets, setMarkets] = useState<PropMarket[]>([]);

  useEffect(() => {
    fetch('/api/markets').then(r => r.json()).then(m => { if (Array.isArray(m)) setMarkets(m); }).catch(() => {});
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'market_update' || !msg.data) return;
      const m = msg.data as PropMarket;
      setMarkets(prev => {
        if (prev.length && prev[0].matchId !== m.matchId) return [m];
        const i = prev.findIndex(x => x.id === m.id);
        if (i === -1) return [...prev, m];
        const n = [...prev]; n[i] = m; return n;
      });
    },
  });

  const total = markets.reduce((s, m) => s + m.totalPool, 0);
  const open = markets.filter(m => m.status === 'OPEN').length;
  const settled = markets.filter(m => m.status === 'SETTLED').length;

  const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div>
      <p className="font-display text-2xl font-black tabular-nums" style={{ color: color ?? '#e2e8f0' }}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="glass rounded-2xl px-5 py-4 grid grid-cols-3 gap-2 text-center"
         style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
      <Stat label="Pool USDC" value={usdcToDisplay(total)} color="var(--green)" />
      <Stat label="Open" value={open} color="var(--blue)" />
      <Stat label="Settled" value={settled} />
    </div>
  );
}
