'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, PropMarket } from '@bozpicks/shared';
import { usdcToDisplay, displayToUsdc } from '@bozpicks/shared';
import { poolOdds, impliedFromPool, payoutFor } from '@/lib/markets';
import { playSfx } from '@/lib/sfx';
import { useVault } from '@/contexts/VaultContext';
import { WalletModal } from './WalletModal';
import { fireToast } from './Toast';

/**
 * Live parametric prop markets + trustless settlement. Each market shows its
 * parimutuel pool and, once the match ends, the on-chain-style Verifiable
 * Resolution receipt — the TxLINE stat value, Merkle root/proof, and validate_stat
 * tx that settled it, so the outcome needs no trusted oracle.
 */

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
/** Same mapping as an RGB triplet, for rgba() gradients/glows — matches the
    premium treatment already used on the match page's odds selector. */
const outcomeRgb = (o: string) =>
  /HOME|OVER|YES/.test(o) ? '16,185,129' : /AWAY|UNDER|NO/.test(o) ? '59,130,246' : '148,163,184';

function Receipt({ m, stamp, onOpen }: { m: PropMarket; stamp?: boolean; onOpen: (m: PropMarket) => void }) {
  const r = m.receipt;
  if (!r) return null;
  const onchain = r.source === 'TXLINE_ONCHAIN';
  const rgb = onchain ? '16,185,129' : '245,158,11';
  const c = onchain ? 'var(--green)' : 'var(--amber)';

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid rgba(${rgb},0.3)`, background: `rgba(${rgb},0.05)` }}>
      <button onClick={() => onOpen(m)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:brightness-110 transition-all">
        {/* seal — stamps in when the market settles */}
        <span className={`relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${stamp ? 'boz-stampin' : ''}`}
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
        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

/**
 * The full Verifiable Resolution receipt, centre-stage. Opened from a
 * market's Receipt button OR from an Order Flow settle entry's "…" — same
 * modal either way, so there's one place a judge learns to read a proof.
 * Every field the inline version truncated is shown in full here, plus a
 * plain-language line under each one explaining what it actually proves.
 */
function ReceiptModal({ m, onClose }: { m: PropMarket; onClose: () => void }) {
  const r = m.receipt;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  if (!r) return null;
  const onchain = r.source === 'TXLINE_ONCHAIN';
  const rgb = onchain ? '16,185,129' : '245,158,11';
  const c = onchain ? 'var(--green)' : 'var(--amber)';

  const Row = ({ label, value, explain, mono = true }: { label: string; value: string; explain: string; mono?: boolean }) => (
    <div className="py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`text-[13px] text-gray-100 break-all mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-1 leading-snug">{explain}</p>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4"
         style={{ background: 'rgba(3,6,16,0.78)', backdropFilter: 'blur(8px)' }}
         onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden anim-in max-h-[88vh] flex flex-col"
           style={{ background: 'linear-gradient(180deg, #0e1626, #080c18)', border: `1px solid rgba(${rgb},0.35)`, boxShadow: `0 24px 70px rgba(0,0,0,0.65), 0 0 60px rgba(${rgb},0.08)` }}
           onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />

        <div className="flex items-center gap-3 px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `rgba(${rgb},0.14)`, border: `1px solid rgba(${rgb},0.5)`, color: c }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black" style={{ color: c }}>{onchain ? 'On-Chain Verified' : 'Verifiable Resolution'}</p>
            <p className="text-[11px] text-gray-500 truncate">{m.label}</p>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                style={{ color: c, border: `1px solid ${c}`, background: 'rgba(6,12,20,0.6)' }}>{onchain ? 'Verified' : 'Simulated'}</span>
          <button onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="px-5 py-2 overflow-y-auto rail-scroll flex-1 min-h-0">
          <div className="rounded-xl px-3 py-2.5 mb-1 mt-1" style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.25)` }}>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              The winning outcome was decided by ONE number from TxLINE's own data — not by us. Every field below lets you
              check that for yourself, from the raw stat to the on-chain call that confirmed it.
            </p>
          </div>

          <Row label="Resolving stat" value={`${r.statKey} = ${r.statValue}`}
               explain="The exact TxLINE field and value that decided the winning outcome for this market." />

          {r.txlineStatKeys?.length > 0 && (
            <Row label="TxLINE stat keys" value={r.txlineStatKeys.join(', ')} mono
                 explain="The numeric Stats-map keys TxLINE assigns these fields (e.g. goals, corners) — proved on-chain via validateStatV2, not a code we made up." />
          )}

          <Row label="Fixture" value={r.fixtureId}
               explain="The TxLINE fixture ID this market settled against." />

          <Row label="TxLINE record" value={r.txlineRecordId}
               explain="The specific TxLINE event record the resolving stat was read from." />

          <Row label="Merkle root" value={r.merkleRoot}
               explain="A single hash that commits to the resolving stat. If the stat value were different, this root would be different — that's what makes it checkable." />

          <div className="py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Merkle proof path ({r.merkleProof.length} node{r.merkleProof.length === 1 ? '' : 's'})</p>
            <div className="mt-1 space-y-1">
              {r.merkleProof.map((node, i) => (
                <p key={i} className="text-[12px] text-gray-200 font-mono break-all">{i + 1}. {node}</p>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">
              The sibling hashes you re-combine with the resolving stat to rebuild the root above — the actual proof of inclusion.
            </p>
          </div>

          <div className="py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">validate_stat</p>
            {onchain ? (
              <a href={`https://explorer.solana.com/tx/${r.validateTx}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 text-[13px] font-mono break-all mt-0.5 hover:brightness-125 transition-all" style={{ color: 'var(--blue)' }}>
                {r.validateTx}
                <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                </svg>
              </a>
            ) : (
              <p className="text-[13px] text-gray-100 font-mono break-all mt-0.5">{r.validateTx}</p>
            )}
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">
              {onchain
                ? 'The Solana devnet transaction where our program CPI\'d into TxLINE\'s validate_stat, checked this proof on-chain, and released the payout — tap to open it on Explorer.'
                : 'A locally-derived stand-in for the on-chain call, used because this fixture is a replay, not a live TxLINE result. The keeper runs the real CPI the moment a genuine fixture finishes.'}
            </p>
          </div>

          <div className="py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Verified at</p>
            <p className="text-[13px] text-gray-100 mt-0.5">{new Date(r.verifiedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>

          {!onchain && (
            <p className="text-[10px] text-gray-600 pb-3 leading-snug">
              This fixture is upcoming or replayed, so the proof above is SIMULATED — internally consistent, but not backed by a
              real TxLINE Merkle proof or on-chain CPI. On a genuine finished fixture, the keeper runs the real proof fetch +{' '}
              <span className="font-mono">validate_stat</span> CPI and this badge turns green.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MarketCard({ m, onBet, betting, pendingOutcome, mine, onOpenReceipt }: { m: PropMarket; onBet: (id: string, outcome: string) => void; betting: string | null; pendingOutcome?: string | null; mine?: string; onOpenReceipt: (m: PropMarket) => void }) {
  const settled = m.status === 'SETTLED';
  const k = KIND[m.kind] ?? KIND.MATCH_WINNER;
  const busy = betting === m.id;

  // one-shot "proof stamp" the moment this market settles
  const wasSettled = useRef(settled);
  const [justSettled, setJustSettled] = useState(false);
  useEffect(() => {
    if (settled && !wasSettled.current) {
      setJustSettled(true);
      const t = setTimeout(() => setJustSettled(false), 1200);
      wasSettled.current = settled;
      return () => clearTimeout(t);
    }
    wasSettled.current = settled;
  }, [settled]);

  // floating "+USDC" chip whenever the pool takes a live stake
  const prevPools = useRef(m.pools);
  const prevTotal = useRef(m.totalPool);
  const [chip, setChip] = useState<{ o: string; amt: number } | null>(null);
  useEffect(() => {
    if (!settled && m.totalPool > prevTotal.current) {
      let o = '', d = 0;
      for (const x of m.outcomes) { const g = (m.pools[x] ?? 0) - (prevPools.current[x] ?? 0); if (g > d) { d = g; o = x; } }
      prevPools.current = m.pools; prevTotal.current = m.totalPool;
      if (o) { setChip({ o, amt: d }); const t = setTimeout(() => setChip(null), 1300); return () => clearTimeout(t); }
    }
    prevPools.current = m.pools; prevTotal.current = m.totalPool;
  }, [m.totalPool, m.pools, m.outcomes, settled]);

  return (
    <div className={`glass sheen p-4 relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 ${justSettled ? 'boz-settle-ring' : ''}`}
         style={{ borderColor: justSettled ? 'rgba(16,185,129,0.5)' : undefined, boxShadow: settled ? undefined : '0 0 0 1px rgba(255,255,255,0.02)' }}>
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

      {/* live pool composition bar + a floating chip on each incoming stake */}
      <div className="relative mb-3">
        {chip && (
          <span className="boz-stakechip absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: `${outcomeColor(chip.o)}22`, color: outcomeColor(chip.o), border: `1px solid ${outcomeColor(chip.o)}66` }}>
            +{usdcToDisplay(chip.amt)} → {chip.o}
          </span>
        )}
        <div className="relative flex h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {m.outcomes.map(o => {
            const share = m.totalPool ? (m.pools[o] ?? 0) / m.totalPool : 1 / m.outcomes.length;
            const col = settled ? (m.winningOutcome === o ? outcomeColor(o) : '#334155') : outcomeColor(o);
            return <div key={o} style={{ width: `${share * 100}%`, background: col, opacity: m.totalPool || settled ? 0.9 : 0.3, transition: 'width .5s ease' }} />;
          })}
        </div>
      </div>

      {/* outcome buttons — same premium recipe as the match page's odds
          selector (gradient fill, glowing top edge, radial glow behind the
          number, shine sweep on hover) so a betting card reads at the same
          level as the rest of the app, not a flatter, simpler cousin of it */}
      <div className={`relative grid gap-2 ${m.outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {m.outcomes.map(o => {
          const win = settled && m.winningOutcome === o;
          const lose = settled && m.winningOutcome !== o;
          const picked = mine === o;
          const pending = busy && pendingOutcome === o;
          const odds = poolOdds(m, o);
          const pct = Math.round(impliedFromPool(m, o) * 100);
          const col = outcomeColor(o);
          const rgb = outcomeRgb(o);
          return (
            <button key={o} disabled={settled || busy}
              onClick={() => onBet(m.id, o)}
              className={`odds-btn card-shine group relative rounded-xl px-2 pt-2.5 pb-3 text-center overflow-hidden transition-all duration-200 disabled:cursor-default ${win ? 'fx-win-glow' : ''} ${!settled && !busy ? 'hover:-translate-y-0.5' : ''}`}
              style={win
                ? { background: `linear-gradient(160deg, rgba(${rgb},0.22), rgba(${rgb},0.06))`, border: '1px solid var(--green)', boxShadow: '0 0 16px rgba(16,185,129,0.35)' }
                : lose
                ? { background: 'rgba(255,255,255,0.015)', border: '1px solid var(--glass-border)', opacity: 0.45 }
                : { background: `linear-gradient(160deg, rgba(${rgb},0.14), rgba(255,255,255,0.02) 65%)`, border: `1px solid rgba(${rgb},0.3)` }}>
              {/* glowing top edge — the same accent every premium button in
                  the app uses, absent here before */}
              {!lose && (
                <span className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},${win ? 0.9 : 0.55}), transparent)` }} />
              )}
              {/* soft radial glow behind the number */}
              {!lose && (
                <span className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(ellipse 70% 55% at 50% 42%, rgba(${rgb},0.12), transparent 70%)` }} />
              )}
              {picked && (
                /* pre-settlement: neutral gold "YOU" (a pick, not a verdict yet).
                   Once settled, the badge itself tells you whether it hit —
                   green WON / red LOST — instead of relying on the outcome
                   box's own green fill, which reads as "this was right" even
                   when it's simply the market's winning side, not your pick. */
                <span className="boz-youpin absolute top-1 right-1 z-10 flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                      style={!settled
                        ? { background: 'linear-gradient(135deg,#fde68a,#f59e0b)', color: '#3a1e02', boxShadow: '0 0 10px rgba(245,158,11,0.7), 0 0 0 1px rgba(255,255,255,0.5) inset' }
                        : win
                        ? { background: 'linear-gradient(135deg,#86efac,#16a34a)', color: '#022c14', boxShadow: '0 0 10px rgba(34,197,94,0.75), 0 0 0 1px rgba(255,255,255,0.5) inset' }
                        : { background: 'linear-gradient(135deg,#fca5a5,#dc2626)', color: '#450a0a', boxShadow: '0 0 10px rgba(239,68,68,0.75), 0 0 0 1px rgba(255,255,255,0.5) inset' }}>
                  {!settled ? (
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M12 2.5l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.6l-5.6 3 1.4-6.3-4.8-4.3 6.4-.6z" /></svg>
                  ) : win ? (
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  )}
                  {!settled ? 'YOU' : win ? 'WON' : 'LOST'}
                </span>
              )}
              <p className="relative text-[11px] font-bold uppercase tracking-wide" style={{ color: win ? 'var(--green)' : '#e2e8f0' }}>{o}</p>
              {pending ? (
                <span className="relative flex items-center justify-center h-[21px] mt-0.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: `rgba(${rgb},0.25)`, borderTopColor: col }} />
                </span>
              ) : (
                <p className="relative text-[17px] font-black tabular-nums leading-tight mt-0.5" style={{ color: win ? 'var(--green)' : col, filter: `drop-shadow(0 0 8px rgba(${rgb},0.3))` }}>{odds.toFixed(2)}</p>
              )}
              <p className="relative text-[9px] text-gray-500 tabular-nums">{pending ? 'staking…' : `${pct}%`}</p>
              {/* implied-probability fill along the bottom edge */}
              <span className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${pct}%`, background: win ? 'var(--green)' : col, opacity: 0.55, transition: 'width .5s' }} />
            </button>
          );
        })}
      </div>

      {settled ? <Receipt m={m} stamp={justSettled} onOpen={onOpenReceipt} /> : mine ? (
        /* staked from the game vault — instant, no per-bet signing */
        <div className="relative flex items-center justify-center gap-1.5 mt-3 text-[10px] font-bold" style={{ color: '#a78bfa' }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" />
          </svg>
          Staked from your vault · 5 USDC on {mine}
        </div>
      ) : (
        <div className="relative flex items-center justify-center gap-1.5 mt-3 text-[10px] text-gray-500">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 8v8M8 12h8" strokeLinecap="round" /></svg>
          Tap an outcome — 5 USDC from your vault, instant
        </div>
      )}
    </div>
  );
}

type Activity = { id: string; kind: 'stake' | 'settle'; label: string; outcome: string; amt?: number; source?: string; ts: number; marketId?: string; mine?: boolean; replaced?: boolean };

// Cap the order flow, but NEVER evict the player's own rows — a settled demo
// floods the feed with bot stakes + settlements, and losing your own "You"
// records to that flood is exactly what made 2 of 4 picks disappear. Keep every
// `mine` row, trim only the oldest anonymous ones.
const ACTIVITY_CAP = 30;
function trimActivity(list: Activity[]): Activity[] {
  if (list.length <= ACTIVITY_CAP) return list;
  const out = [...list];
  for (let i = out.length - 1; i >= 0 && out.length > ACTIVITY_CAP; i--) {
    if (!out[i].mine) out.splice(i, 1);
  }
  return out;
}

/** A small gold "you" tag pinned to the end of the player's own order-flow
    rows — the same gold identity the market cards use for the YOU pick. Dimmed
    to a plain gray chip when the row is a superseded (refunded) pick. */
function MineTag({ dim }: { dim?: boolean }) {
  if (dim) {
    return (
      <span title="Your order — changed" aria-label="Your order, changed"
        className="flex-shrink-0 flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 1.8c-3.3 0-6.5 1.7-6.5 4.2V20h13v-2c0-2.5-3.2-4.2-6.5-4.2z" /></svg>
        You
      </span>
    );
  }
  return (
    <span title="Your order" aria-label="Your order"
      className="flex-shrink-0 flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded"
      style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)', color: '#3a1e02', boxShadow: '0 0 8px rgba(245,158,11,0.55)' }}>
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 1.8c-3.3 0-6.5 1.7-6.5 4.2V20h13v-2c0-2.5-3.2-4.2-6.5-4.2z" /></svg>
      You
    </span>
  );
}

/** Live order flow — stakes trickling into pools + settlements as they resolve.
    h-full + an internal scroll makes the rail exactly as tall as the 6-card
    grid beside it (items-stretch on the parent), never taller or shorter. */
function ActivityFeed({ items, getMarket, onOpenReceipt }: { items: Activity[]; getMarket: (id: string) => PropMarket | undefined; onOpenReceipt: (m: PropMarket) => void }) {
  return (
    <div className="glass p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <span className="w-2 h-2 rounded-full badge-live" style={{ background: 'var(--green)' }} />
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Order flow</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-8 leading-relaxed">Stakes and settlements<br />stream in here live.</p>
      ) : (
        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto rail-scroll pr-1">
          {items.map(a => {
            const oc = outcomeColor(a.outcome);
            const orgb = outcomeRgb(a.outcome);
            if (a.kind === 'settle') {
              const onchain = a.source === 'TXLINE_ONCHAIN';
              const c = onchain ? 'var(--green)' : 'var(--amber)';
              const crgb = onchain ? '16,185,129' : '245,158,11';
              const mkt = a.marketId ? getMarket(a.marketId) : undefined;
              return (
                <div key={a.id} className="anim-in relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 overflow-hidden"
                     style={{ background: `linear-gradient(90deg, rgba(${crgb},0.1), rgba(${crgb},0.02))`, border: `1px solid rgba(${crgb},0.3)` }}>
                  <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: c }} />
                  <span className="relative w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `rgba(${crgb},0.18)`, color: c }}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="text-[11px] text-gray-300 truncate flex-1 min-w-0">{a.label} → <span className="font-bold" style={{ color: oc }}>{a.outcome}</span></span>
                  {a.mine && <MineTag />}
                  <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded flex-shrink-0" style={{ color: c, border: `1px solid ${c}` }}>{onchain ? '✓' : 'sim'}</span>
                  {/* opens the SAME full-detail receipt modal as the market card's
                      "Verifiable resolution" button — bigger hit target and a
                      visibly-brighter icon than a plain "…" so it doesn't read
                      as decorative */}
                  {mkt && (
                    /* quiet secondary action — plain gray dots that match the
                       row text (brighten on hover) so it doesn't read as a loud
                       "click me, a box opens" control */
                    <button onClick={() => onOpenReceipt(mkt)} title="View full receipt" aria-label="View full receipt"
                      className="relative flex-shrink-0 w-5 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                    </button>
                  )}
                </div>
              );
            }
            // a superseded (refunded) pick — grayed and inactive, not a live stake
            const dim = a.replaced;
            return (
              <div key={a.id} className="anim-in relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 overflow-hidden"
                   style={dim
                     ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', opacity: 0.65 }
                     : { background: `linear-gradient(90deg, rgba(${orgb},0.09), rgba(255,255,255,0.02))`, border: `1px solid rgba(${orgb},0.28)` }}>
                <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: dim ? '#3f4654' : oc }} />
                <span className="relative w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: dim ? 'rgba(255,255,255,0.04)' : `rgba(${orgb},0.18)`, color: dim ? '#64748b' : oc }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
                </span>
                <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: dim ? '#64748b' : oc, textDecoration: dim ? 'line-through' : undefined }}>+{usdcToDisplay(a.amt ?? 0)}</span>
                <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: dim ? '#64748b' : '#9ca3af' }}>→ {a.outcome} · <span style={{ color: dim ? '#576070' : '#6b7280' }}>{a.label}</span></span>
                {dim && <span className="text-[8px] font-bold uppercase tracking-wide text-gray-600 flex-shrink-0">changed</span>}
                {a.mine && <MineTag dim={dim} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarketsPanel() {
  const { publicKey, connected } = useWallet();
  const { balance, refresh: refreshVault, open: openVault } = useVault();
  const [markets, setMarkets] = useState<PropMarket[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [betting, setBetting] = useState<string | null>(null);
  // WHICH outcome is in flight, not just which card — a busy card alone can't
  // tell the player their exact tap registered when several outcomes look
  // similar; this drives the instant per-button spinner
  const [pendingOutcome, setPendingOutcome] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [userBets, setUserBets] = useState<Record<string, { outcome: string; stake: number }>>({});
  const [activity, setActivity] = useState<Activity[]>([]);
  const [receiptFor, setReceiptFor] = useState<PropMarket | null>(null);
  const prevSettled = useRef(0);
  const marketsMap = useRef<Record<string, PropMarket>>({}); // last-seen market per id, for diffing
  // the player's OWN just-placed stakes — lets the SSE echo of a stake be
  // marked "mine" (icon in the order flow) instead of appearing as an
  // anonymous duplicate of the entry we already added optimistically
  const ownStakes = useRef<{ key: string; ts: number }[]>([]);
  // live mirror of userBets so the SSE closure can tag a settlement as mine
  const userBetsRef = useRef(userBets);
  userBetsRef.current = userBets;

  const fetchMarkets = useCallback(async (mid?: string | null) => {
    const url = mid ? `/api/markets?matchId=${mid}` : '/api/markets';
    const r = await fetch(url, { cache: 'no-store' }).then(res => res.json()).catch(() => []);
    if (Array.isArray(r) && r.length) {
      setMarkets(r);
      marketsMap.current = Object.fromEntries((r as PropMarket[]).map(m => [m.id, m]));
      if (!mid && r[0]?.matchId) setMatchId(r[0].matchId);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Reconcile with the DB while any market is still open. SSE publishes are the
  // fast path, but a dropped publish (e.g. Redis over quota) must not leave a
  // market stuck "open" when it has actually settled — the DB is the truth, so
  // we re-fetch every few seconds until the whole board is settled. This is
  // what guarantees the UI reaches 6/6, not 4/6.
  const anyOpen = markets.length > 0 && markets.some(m => m.status === 'OPEN');
  const anySettled = markets.some(m => m.status === 'SETTLED');
  useEffect(() => {
    if (!anyOpen) return;
    const t = setInterval(() => fetchMarkets(matchId), 4000);
    return () => clearInterval(t);
  }, [anyOpen, matchId, fetchMarkets]);

  // Self-heal a stalled settlement: a board with BOTH open AND settled markets
  // means full time was reached but some markets didn't finish settling (the
  // 4/6 case). Kick the settle-sweep once per match to close them out.
  const sweptFor = useRef<string | null>(null);
  useEffect(() => {
    if (!(anyOpen && anySettled) || !matchId || sweptFor.current === matchId) return;
    sweptFor.current = matchId;
    fetch('/api/markets/settle-sweep', { method: 'POST' })
      .then(() => setTimeout(() => fetchMarkets(matchId), 600))
      .catch(() => {});
  }, [anyOpen, anySettled, matchId, fetchMarkets]);

  // Live market updates arrive over SSE (created / pool change / settled) — no
  // polling. Diff against the last-seen market to build the order-flow feed.
  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'market_update' || !msg.data) return;
      const m = msg.data as PropMarket;
      setMatchId(m.matchId);

      const prevMap = marketsMap.current;
      const existing = Object.values(prevMap);
      if (existing.length > 0 && existing[0].matchId !== m.matchId) {
        // a new match — reset the diff map + activity feed
        marketsMap.current = { [m.id]: m };
        setActivity([]);
      } else {
        const prevM = prevMap[m.id];
        if (m.status === 'SETTLED' && prevM && prevM.status !== 'SETTLED' && m.winningOutcome) {
          const mine = !!userBetsRef.current[m.id];
          const entry: Activity = { id: `${m.id}-settle`, kind: 'settle', label: m.label, outcome: m.winningOutcome, source: m.receipt?.source, ts: Date.now(), marketId: m.id, mine };
          setActivity(a => trimActivity([entry, ...a]));
        } else if (prevM && m.totalPool > prevM.totalPool) {
          let o = '', d = 0;
          for (const x of m.outcomes) { const g = (m.pools[x] ?? 0) - (prevM.pools[x] ?? 0); if (g > d) { d = g; o = x; } }
          if (o) {
            // if this is the echo of the player's OWN just-placed stake, we
            // already added a "mine" entry optimistically in bet() — consume
            // the signature and skip the duplicate; otherwise it's a bot/sim stake
            const key = `${m.id}|${o}|${d}`;
            const now = Date.now();
            const idx = ownStakes.current.findIndex(s => s.key === key && now - s.ts < 6000);
            if (idx !== -1) {
              ownStakes.current.splice(idx, 1);
            } else {
              const entry: Activity = { id: `${m.id}-${now}`, kind: 'stake', label: m.label, outcome: o, amt: d, ts: now };
              setActivity(a => trimActivity([entry, ...a]));
            }
          }
        }
        marketsMap.current = { ...prevMap, [m.id]: m };
      }

      setMarkets(prev => {
        if (prev.length && prev[0].matchId !== m.matchId) return [m];
        const i = prev.findIndex(x => x.id === m.id);
        if (i === -1) return [...prev, m];
        const next = [...prev]; next[i] = m; return next;
      });
    },
  });

  // Vault-first staking: no wallet → connect; empty vault → cashier; otherwise
  // the stake debits the game balance INSTANTLY (no per-bet signing — you signed
  // once at deposit). Winnings credit back to the vault at settlement.
  const STAKE = 5;
  const bet = async (id: string, outcome: string) => {
    if (!connected || !publicKey) { setWalletOpen(true); return; }
    if (balance < displayToUsdc(STAKE)) {
      fireToast({ kind: 'warn', title: 'Top up your vault', body: `You need ${STAKE} USDC to stake — deposit takes one signature.` });
      openVault('deposit');
      return;
    }
    setBetting(id);
    setPendingOutcome(outcome);
    try {
      const res = await fetch(`/api/markets/${id}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, amountUsdc: STAKE, wallet: publicKey.toBase58() }),
      });
      if (res.status === 402) {
        fireToast({ kind: 'warn', title: 'Not enough in your vault', body: 'Deposit to keep playing — one signature.' });
        openVault('deposit');
        return;
      }
      const data = await res.json();
      if (data.market) setMarkets(ms => ms.map(m => m.id === id ? data.market : m));

      // already this exact pick → the server changed nothing, so don't
      // re-charge or add a duplicate order-flow entry
      if (data.unchanged) {
        fireToast({ kind: 'info', title: 'Already your pick', body: `${outcome} is already your stake on this market.` });
        return;
      }

      const micro = displayToUsdc(STAKE);
      setUserBets(b => ({ ...b, [id]: { outcome, stake: micro } }));

      // mark this as MY stake in the order flow; the signature lets the SSE echo
      // of a fresh stake be skipped so it isn't listed twice (a replace keeps
      // the total flat, so it never echoes — no signature needed there)
      const label = (data.market as PropMarket | undefined)?.label ?? '';
      if (!data.replacedFrom) ownStakes.current.push({ key: `${id}|${outcome}|${micro}`, ts: Date.now() });
      const mineEntry: Activity = { id: `mine-${id}-${Date.now()}`, kind: 'stake', label, outcome, amt: micro, ts: Date.now(), marketId: id, mine: true };
      // a switch supersedes the earlier pick on this market — gray it out
      // (its stake was refunded) instead of leaving it looking active
      setActivity(a => {
        const marked = data.replacedFrom
          ? a.map(x => (x.mine && x.kind === 'stake' && x.marketId === id && !x.replaced) ? { ...x, replaced: true } : x)
          : a;
        return trimActivity([mineEntry, ...marked]);
      });

      refreshVault();
      playSfx('tick');
      if (data.replacedFrom && data.replacedFrom !== outcome) {
        fireToast({ kind: 'info', title: `Switched to ${outcome}`, body: `Moved your pick from ${data.replacedFrom} — old stake refunded.` });
      } else {
        fireToast({ kind: 'info', title: `Staked ${STAKE} USDC from your vault`, body: `${outcome} · instant · no signing` });
      }
    } catch {
      fireToast({ kind: 'warn', title: 'Stake not placed', body: 'Please try again.' });
    } finally { setBetting(null); setPendingOutcome(null); }
  };

  // detect settlement transition → sound + pull the vault (winnings just landed)
  const settledCount = markets.filter(m => m.status === 'SETTLED').length;
  const anySimulated = markets.some(m => m.receipt?.source === 'SIMULATED');
  useEffect(() => {
    if (settledCount > prevSettled.current) {
      if (prevSettled.current === 0) playSfx('settle');
      // reconcile first (heals any double-credit from overlapping settle passes),
      // then pull the corrected balance
      if (publicKey) {
        fetch('/api/vault/reconcile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: publicKey.toBase58() }),
        }).then(() => refreshVault()).catch(() => refreshVault());
      }
    }
    prevSettled.current = settledCount;
  }, [settledCount, refreshVault, publicKey]);

  // ── Cinematic first reveal: when a match's markets first land, the board is
  // remounted (keyed on matchId) so the cards drop in staggered, each with a
  // soft placement tick, and the order-flow rail enters last. ────────────────
  const revealedFor = useRef<string | null>(null);
  useEffect(() => {
    const mid = matchId ?? (markets[0]?.matchId ?? null);
    if (!mid || markets.length === 0 || revealedFor.current === mid) return;
    revealedFor.current = mid;
    const n = Math.min(markets.length, 6);
    for (let i = 0; i < n; i++) setTimeout(() => playSfx('tick'), 120 + i * 80);
  }, [matchId, markets]);

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
        <div className="fx-rise glass overflow-hidden"
             style={{ borderColor: 'rgba(16,185,129,0.35)', boxShadow: '0 0 30px rgba(16,185,129,0.12)' }}>
          {/* the banner is a button when the player has resolved picks — click to
              see exactly which markets paid out and how */}
          <button
            onClick={() => myResolved.length > 0 && setBreakdownOpen(o => !o)}
            className={`w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left ${myResolved.length > 0 ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default'} transition-colors`}>
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
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <p className="text-lg font-black tabular-nums" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {net >= 0 ? '+' : ''}{usdcToDisplay(Math.abs(net) === 0 ? 0 : net)} USDC
                  </p>
                  <p className="text-[10px] text-gray-500">won {wonCount}/{myResolved.length} · tap for the breakdown</p>
                </div>
                <svg viewBox="0 0 24 24" className={`w-4 h-4 text-gray-500 transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </div>
            )}
          </button>

          {/* per-market receipt: what you picked, whether it hit, and the delta */}
          {breakdownOpen && myResolved.length > 0 && (
            <div className="anim-in border-t px-4 py-3 space-y-1.5" style={{ borderColor: 'var(--glass-border)', background: 'rgba(0,0,0,0.15)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">How your {usdcToDisplay(staked)} USDC played out</p>
              {myResolved.map(m => {
                const b = userBets[m.id];
                const won = m.winningOutcome === b.outcome;
                const ret = won ? payoutFor(b.stake, m.pools[b.outcome] ?? 0, m.totalPool, m.feeBps) : 0;
                const delta = ret - b.stake;
                const src = m.receipt?.source === 'TXLINE_ONCHAIN' ? 'on-chain proof' : 'simulated proof';
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                       style={{ background: won ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)', border: `1px solid ${won ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}` }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                            style={won ? { color: 'var(--green)', background: 'var(--green-dim)' } : { color: 'var(--red)', background: 'rgba(239,68,68,0.12)' }}>
                        {won ? 'WON' : 'LOST'}
                      </span>
                      <span className="text-[11px] text-gray-300 truncate">{m.label}</span>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">· you picked <span style={{ color: outcomeColor(b.outcome) }} className="font-bold">{b.outcome}</span> · {src}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-shrink-0">
                      {/* stake → gross payout, spelled out — so the net delta
                          isn't the only number on screen (that's what made the
                          previous "+3.67" per line impossible to verify against
                          "staked $30 total") */}
                      <span className="text-[10px] text-gray-600 tabular-nums">
                        {usdcToDisplay(b.stake)} {won ? `→ ${usdcToDisplay(ret)}` : '→ 0'}
                      </span>
                      <span className="text-[11px] font-black tabular-nums" style={{ color: won ? 'var(--green)' : 'var(--red)' }}>
                        ({delta >= 0 ? '+' : '−'}{usdcToDisplay(Math.abs(delta))})
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1.5 px-1">
                <span className="text-[11px] font-bold text-gray-400">
                  Staked {usdcToDisplay(staked)} → returned {usdcToDisplay(returned)}
                </span>
                <span className="text-[13px] font-black tabular-nums" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  net {net >= 0 ? '+' : '−'}{usdcToDisplay(Math.abs(net))} USDC
                </span>
              </div>
              <p className="text-[10px] text-gray-600 pt-0.5">Stakes were already debited when placed; winnings were credited to your game vault at settlement — full history in the vault ledger & My Predictions.</p>
            </div>
          )}
        </div>
      )}
      {/* Order flow only takes a column once there IS flow — no empty shell.
          items-stretch lets the rail match the exact height of the card grid. */}
      <div className={`grid gap-4 items-stretch ${activity.length > 0 ? 'lg:grid-cols-[1fr_296px]' : ''}`}>
        {/* keyed on matchId so a new match remounts the board → cinematic drop-in */}
        <div key={matchId ?? 'board'} className={`grid gap-3 sm:grid-cols-2 min-w-0 content-start items-start ${activity.length === 0 ? 'xl:grid-cols-3' : ''}`}>
          {markets.map((m, i) => (
            <div key={m.id} className="boz-card-in" style={{ animationDelay: `${i * 80}ms` }}>
              <MarketCard m={m} onBet={bet} betting={betting} pendingOutcome={betting === m.id ? pendingOutcome : null} mine={userBets[m.id]?.outcome} onOpenReceipt={setReceiptFor} />
            </div>
          ))}
        </div>
        {activity.length > 0 && (
          /* The rail enters last. On lg its content is absolutely positioned so
             it contributes NO intrinsic height to the grid row — the row height
             is set by the cards, and items-stretch sizes the rail to match it
             exactly (it scrolls internally instead of overshooting). */
          <aside className="boz-card-in relative min-h-[16rem] lg:min-h-0" style={{ animationDelay: `${Math.min(markets.length, 6) * 80 + 120}ms` }}>
            <div className="lg:absolute lg:inset-0">
              <ActivityFeed items={activity} getMarket={id => marketsMap.current[id] ?? markets.find(m => m.id === id)} onOpenReceipt={setReceiptFor} />
            </div>
          </aside>
        )}
      </div>
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
      {receiptFor && <ReceiptModal m={receiptFor} onClose={() => setReceiptFor(null)} />}
    </div>
  );
}
