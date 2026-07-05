'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent, PropMarket } from '@bozpicks/shared';
import { usdcToDisplay } from '@bozpicks/shared';
import { poolOdds, impliedFromPool } from '@/lib/markets';

/**
 * Live parametric prop markets + trustless settlement. Each market shows its
 * parimutuel pool and, once the match ends, the on-chain-style Verifiable
 * Resolution receipt — the TxLINE stat value, Merkle root/proof, and validate_stat
 * tx that settled it, so the outcome needs no trusted oracle.
 */

function short(s: string, n = 6) {
  return s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
}

function Receipt({ m }: { m: PropMarket }) {
  const r = m.receipt;
  if (!r) return null;
  return (
    <div className="mt-3 rounded-xl p-3 text-[11px] relative"
         style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
      <span className="fx-stamp absolute -top-2.5 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ color: 'var(--green)', border: '2px solid var(--green)', background: 'rgba(6,20,14,0.9)' }}>
        Verified ✓
      </span>
      <div className="flex items-center gap-1.5 mb-2 font-bold uppercase tracking-widest text-[10px]" style={{ color: 'var(--green)' }}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verifiable Resolution
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-gray-400 font-mono">
        <dt className="text-gray-600">stat</dt><dd className="text-gray-200">{r.statKey} = <span className="font-bold text-white">{r.statValue}</span></dd>
        <dt className="text-gray-600">fixture</dt><dd>{r.fixtureId}</dd>
        <dt className="text-gray-600">record</dt><dd>{short(r.txlineRecordId, 8)}</dd>
        <dt className="text-gray-600">root</dt><dd className="truncate" title={r.merkleRoot}>{short(r.merkleRoot, 8)}</dd>
        <dt className="text-gray-600">proof</dt><dd>{r.merkleProof.length} node(s)</dd>
        <dt className="text-gray-600">validate_stat</dt><dd className="truncate" title={r.validateTx} style={{ color: 'var(--blue)' }}>{short(r.validateTx, 8)}</dd>
      </dl>
    </div>
  );
}

function MarketCard({ m, onBet, betting }: { m: PropMarket; onBet: (id: string, outcome: string) => void; betting: string | null }) {
  const settled = m.status === 'SETTLED';
  return (
    <div className="glass sheen p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-100">{m.label}</p>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={settled
                ? { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }
                : { background: 'var(--green-dim)', color: 'var(--green)' }}>
          {settled ? 'Settled' : `${usdcToDisplay(m.totalPool)} USDC`}
        </span>
      </div>

      <div className={`grid gap-2 ${m.outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {m.outcomes.map(o => {
          const win = settled && m.winningOutcome === o;
          const lose = settled && m.winningOutcome !== o;
          const odds = poolOdds(m, o);
          const pct = Math.round(impliedFromPool(m, o) * 100);
          return (
            <button key={o} disabled={settled || betting === m.id}
              onClick={() => onBet(m.id, o)}
              className={`rounded-xl px-2 py-2 text-center transition-all disabled:cursor-default ${win ? 'fx-win-glow' : ''}`}
              style={win
                ? { background: 'var(--green-dim)', border: '1px solid var(--green)', boxShadow: '0 0 14px rgba(16,185,129,0.3)' }
                : lose
                ? { background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', opacity: 0.5 }
                : { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-xs font-bold" style={{ color: win ? 'var(--green)' : '#e2e8f0' }}>{o}</p>
              <p className="text-[15px] font-black tabular-nums" style={{ color: win ? 'var(--green)' : 'var(--blue)' }}>{odds.toFixed(2)}</p>
              <p className="text-[9px] text-gray-600">{pct}%</p>
            </button>
          );
        })}
      </div>

      {settled ? <Receipt m={m} /> : (
        <p className="text-[10px] text-gray-600 mt-2 text-center">Tap an outcome to stake 5 USDC (devnet parimutuel)</p>
      )}
    </div>
  );
}

export function MarketsPanel() {
  const { publicKey } = useWallet();
  const [markets, setMarkets] = useState<PropMarket[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [betting, setBetting] = useState<string | null>(null);
  const lastFetch = useRef(0);

  const fetchMarkets = useCallback(async (mid?: string | null) => {
    const url = mid ? `/api/markets?matchId=${mid}` : '/api/markets';
    const r = await fetch(url).then(res => res.json()).catch(() => []);
    if (Array.isArray(r) && r.length) {
      setMarkets(r);
      if (!mid && r[0]?.matchId) setMatchId(r[0].matchId);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (e.matchId && e.matchId !== matchId) setMatchId(e.matchId);
      const now = Date.now();
      // refetch on end (to catch settlement) or throttled during play
      if (e.type === 'MATCH_END' || now - lastFetch.current > 4000) {
        lastFetch.current = now;
        setTimeout(() => fetchMarkets(e.matchId ?? matchId), e.type === 'MATCH_END' ? 800 : 0);
      }
    },
  });

  const bet = async (id: string, outcome: string) => {
    setBetting(id);
    try {
      const res = await fetch(`/api/markets/${id}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, amountUsdc: 5, wallet: publicKey?.toBase58() ?? 'demo-wallet' }),
      }).then(r => r.json());
      if (res.market) setMarkets(ms => ms.map(m => m.id === id ? res.market : m));
    } finally { setBetting(null); }
  };

  if (markets.length === 0) {
    return (
      <div className="glass p-8 text-center text-gray-600 text-sm">
        No markets yet — run a live match to open parametric prop markets.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {markets.map(m => <MarketCard key={m.id} m={m} onBet={bet} betting={betting} />)}
    </div>
  );
}
