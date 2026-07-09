'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, PropMarket } from '@bozpicks/shared';
import { usdcToDisplay, displayToUsdc } from '@bozpicks/shared';
import { poolOdds, impliedFromPool, payoutFor } from '@/lib/markets';
import { playSfx } from '@/lib/sfx';

/**
 * Live parametric prop markets + trustless settlement. Each market shows its
 * parimutuel pool and, once the match ends, the on-chain-style Verifiable
 * Resolution receipt — the TxLINE stat value, Merkle root/proof, and validate_stat
 * tx that settled it, so the outcome needs no trusted oracle.
 */

function short(s: string, n = 6) {
  return s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
}

/** Icon + accent per market kind — gives each card an instant identity. */
const KIND: Record<string, { color: string; icon: ReactNode }> = {
  MATCH_WINNER:  { color: '#10b981', icon: <path d="M8 21h8M12 17v4M5 4h14v3a7 7 0 0 1-14 0V4zM5 6H3v1a3 3 0 0 0 3 3M19 6h2v1a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" /> },
  TOTAL_GOALS:   { color: '#3b82f6', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5l4 2.9-1.5 4.6h-5L8 10.4z" strokeLinejoin="round" /></> },
  TOTAL_CORNERS: { color: '#f59e0b', icon: <path d="M6 3v18M6 4h11l-3 3 3 3H6" strokeLinecap="round" strokeLinejoin="round" /> },
  TOTAL_CARDS:   { color: '#eab308', icon: <rect x="7" y="4" width="10" height="16" rx="1.5" /> },
  BTTS:          { color: '#a78bfa', icon: <><circle cx="8" cy="12" r="3" /><circle cx="16" cy="12" r="3" /></> },
  FIRST_SCORER:  { color: '#06b6d4', icon: <><circle cx="12" cy="12" r="9" /><path d="M11 8.5l2-1V16M10 16h4" strokeLinecap="round" strokeLinejoin="round" /></> },
};

/** Semantic colour per outcome (home/over/yes = green, away/under/no = blue). */
const outcomeColor = (o: string) =>
  /HOME|OVER|YES/.test(o) ? '#10b981' : /AWAY|UNDER|NO/.test(o) ? '#3b82f6' : '#94a3b8';

function Receipt({ m }: { m: PropMarket }) {
  const [open, setOpen] = useState(false);
  const r = m.receipt;
  if (!r) return null;
  const onchain = r.source === 'TXLINE_ONCHAIN';
  const rgb = onchain ? '16,185,129' : '245,158,11';
  const c = onchain ? 'var(--green)' : 'var(--amber)';

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid rgba(${rgb},0.3)`, background: `rgba(${rgb},0.05)` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
        {/* seal */}
        <span className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(${rgb},0.14)`, border: `1px solid rgba(${rgb},0.5)`, color: c }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold" style={{ color: c }}>{onchain ? 'On-chain verified' : 'Verifiable resolution'}</p>
          <p className="text-[10px] text-gray-500 font-mono truncate">{r.statKey} = {r.statValue} · {r.merkleProof.length}-node proof</p>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ color: c, border: `1px solid ${c}`, background: 'rgba(6,12,20,0.6)' }}>{onchain ? 'Verified' : 'Simulated'}</span>
        <svg className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0.5 anim-in" style={{ borderTop: `1px solid rgba(${rgb},0.15)` }}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-gray-400 font-mono mt-2">
            <dt className="text-gray-600">fixture</dt><dd className="truncate">{r.fixtureId}</dd>
            <dt className="text-gray-600">record</dt><dd>{short(r.txlineRecordId, 8)}</dd>
            <dt className="text-gray-600">root</dt><dd className="truncate" title={r.merkleRoot}>{short(r.merkleRoot, 8)}</dd>
            <dt className="text-gray-600">validate_stat</dt><dd className="truncate" title={r.validateTx} style={{ color: onchain ? 'var(--blue)' : '#94a3b8' }}>{short(r.validateTx, 8)}</dd>
          </dl>
          {!onchain && (
            <p className="text-[9px] text-gray-600 mt-2 leading-snug">
              Fixture is upcoming — proof simulated. The keeper runs the real TxLINE Merkle proof + <span className="font-mono">validate_stat</span> CPI the moment TxLINE publishes the final stat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MarketCard({ m, onBet, betting, mine }: { m: PropMarket; onBet: (id: string, outcome: string) => void; betting: string | null; mine?: string }) {
  const settled = m.status === 'SETTLED';
  const k = KIND[m.kind] ?? KIND.MATCH_WINNER;
  const busy = betting === m.id;

  return (
    <div className="glass sheen p-4 relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
         style={settled ? undefined : { boxShadow: '0 0 0 1px rgba(255,255,255,0.02)' }}>
      {/* soft accent glow in the corner */}
      <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${k.color}14, transparent 70%)` }} />

      {/* header */}
      <div className="relative flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${k.color}1c`, border: `1px solid ${k.color}44`, color: k.color }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.9}>{k.icon}</svg>
          </span>
          <p className="text-[13px] font-bold text-gray-100 truncate">{m.label}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
              style={settled
                ? { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }
                : { background: 'var(--green-dim)', color: 'var(--green)' }}>
          {!settled && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />}
          {settled ? 'Settled' : `${usdcToDisplay(m.totalPool)} USDC`}
        </span>
      </div>

      {/* live pool composition bar */}
      <div className="relative flex h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {m.outcomes.map(o => {
          const share = m.totalPool ? (m.pools[o] ?? 0) / m.totalPool : 1 / m.outcomes.length;
          const col = settled ? (m.winningOutcome === o ? outcomeColor(o) : '#334155') : outcomeColor(o);
          return <div key={o} style={{ width: `${share * 100}%`, background: col, opacity: m.totalPool || settled ? 0.9 : 0.3, transition: 'width .5s ease' }} />;
        })}
      </div>

      {/* outcome buttons */}
      <div className={`relative grid gap-2 ${m.outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {m.outcomes.map(o => {
          const win = settled && m.winningOutcome === o;
          const lose = settled && m.winningOutcome !== o;
          const picked = mine === o;
          const odds = poolOdds(m, o);
          const pct = Math.round(impliedFromPool(m, o) * 100);
          const col = outcomeColor(o);
          return (
            <button key={o} disabled={settled || busy}
              onClick={() => onBet(m.id, o)}
              className={`relative rounded-xl px-2 pt-2.5 pb-3 text-center overflow-hidden transition-all disabled:cursor-default enabled:hover:brightness-125 enabled:hover:-translate-y-px active:scale-[0.97] ${win ? 'fx-win-glow' : ''}`}
              style={win
                ? { background: 'var(--green-dim)', border: '1px solid var(--green)', boxShadow: '0 0 16px rgba(16,185,129,0.35)' }
                : lose
                ? { background: 'rgba(255,255,255,0.015)', border: '1px solid var(--glass-border)', opacity: 0.45 }
                : { background: `${col}0d`, border: `1px solid ${col}33` }}>
              {picked && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full z-10"
                      style={{ background: 'var(--blue)', color: '#fff', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }}>YOU</span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: win ? 'var(--green)' : '#e2e8f0' }}>{o}</p>
              <p className="text-[17px] font-black tabular-nums leading-tight mt-0.5" style={{ color: win ? 'var(--green)' : col }}>{odds.toFixed(2)}</p>
              <p className="text-[9px] text-gray-500 tabular-nums">{pct}%</p>
              {/* implied-probability fill along the bottom edge */}
              <span className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${pct}%`, background: win ? 'var(--green)' : col, opacity: 0.55, transition: 'width .5s' }} />
            </button>
          );
        })}
      </div>

      {settled ? <Receipt m={m} /> : (
        <div className="relative flex items-center justify-center gap-1.5 mt-3 text-[10px] text-gray-500">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 8v8M8 12h8" strokeLinecap="round" /></svg>
          Tap an outcome to stake 5 USDC · devnet parimutuel
        </div>
      )}
    </div>
  );
}

export function MarketsPanel() {
  const { publicKey } = useWallet();
  const [markets, setMarkets] = useState<PropMarket[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [betting, setBetting] = useState<string | null>(null);
  const [userBets, setUserBets] = useState<Record<string, { outcome: string; stake: number }>>({});
  const prevSettled = useRef(0);

  const fetchMarkets = useCallback(async (mid?: string | null) => {
    const url = mid ? `/api/markets?matchId=${mid}` : '/api/markets';
    const r = await fetch(url, { cache: 'no-store' }).then(res => res.json()).catch(() => []);
    if (Array.isArray(r) && r.length) {
      setMarkets(r);
      if (!mid && r[0]?.matchId) setMatchId(r[0].matchId);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Live market updates arrive over SSE (created / pool change / settled) — no
  // polling. Upsert by id, and switch context to the newest market's match.
  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'market_update' || !msg.data) return;
      const m = msg.data as PropMarket;
      setMatchId(m.matchId);
      setMarkets(prev => {
        // a market from a newer match replaces the whole set
        if (prev.length && prev[0].matchId !== m.matchId) return [m];
        const i = prev.findIndex(x => x.id === m.id);
        if (i === -1) return [...prev, m];
        const next = [...prev]; next[i] = m; return next;
      });
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
      setUserBets(b => ({ ...b, [id]: { outcome, stake: displayToUsdc(5) } }));
      playSfx('tick');
    } finally { setBetting(null); }
  };

  // detect settlement transition → sound
  const settledCount = markets.filter(m => m.status === 'SETTLED').length;
  const anySimulated = markets.some(m => m.receipt?.source === 'SIMULATED');
  useEffect(() => {
    if (settledCount > prevSettled.current && prevSettled.current === 0 && settledCount > 0) {
      playSfx('settle');
    }
    prevSettled.current = settledCount;
  }, [settledCount]);

  // personal result across the user's bets, once resolved
  const myResolved = markets.filter(m => userBets[m.id] && m.status === 'SETTLED');
  const staked = myResolved.reduce((s, m) => s + userBets[m.id].stake, 0);
  const returned = myResolved.reduce((s, m) => {
    const b = userBets[m.id];
    return s + (m.winningOutcome === b.outcome ? payoutFor(b.stake, m.pools[b.outcome] ?? 0, m.totalPool, m.feeBps) : 0);
  }, 0);
  const wonCount = myResolved.filter(m => m.winningOutcome === userBets[m.id].outcome).length;
  const net = returned - staked;

  if (markets.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-gray-500">Six prop markets — Match Result, Total Goals/Corners/Cards, BTTS, First Goal —</p>
        <p className="text-sm text-gray-500">open here the moment a match kicks off.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {settledCount > 0 && (
        <div className="fx-rise glass p-4 flex flex-wrap items-center justify-between gap-3"
             style={{ borderColor: 'rgba(16,185,129,0.35)', boxShadow: '0 0 30px rgba(16,185,129,0.12)' }}>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-gray-100">Full time — {settledCount}/{markets.length} markets settled</p>
              <p className="text-[11px] text-gray-500">{anySimulated
                ? 'Simulated from the scenario · real TxLINE proof + on-chain payout run at a played fixture’s final whistle'
                : 'Resolved from TxLINE Merkle proofs · USDC payouts on-chain'}</p>
            </div>
          </div>
          {myResolved.length > 0 && (
            <div className="text-right">
              <p className="text-lg font-black tabular-nums" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {net >= 0 ? '+' : ''}{usdcToDisplay(Math.abs(net) === 0 ? 0 : net)} USDC
              </p>
              <p className="text-[10px] text-gray-500">you won {wonCount}/{myResolved.length} of your picks</p>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {markets.map(m => <MarketCard key={m.id} m={m} onBet={bet} betting={betting} mine={userBets[m.id]?.outcome} />)}
      </div>
    </div>
  );
}
