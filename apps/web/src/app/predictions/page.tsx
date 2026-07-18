'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModal } from '@/components/ui/WalletModal';
import { Flag } from '@/components/ui/Flag';
import { IconWallet, IconBall, IconTarget, IconShield, IconChain, IconClock } from '@/components/ui/Icons';

type Prediction = {
  id: string;
  match_id: string;
  outcome: string;             // HOME/DRAW/AWAY OR a prop outcome (OVER/UNDER/YES/NO/…)
  amount_usdc: number;
  placed_at: string;
  escrow_tx: string;
  status: string;              // ACTIVE | WON | LOST
  payout_amount: number | null;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  match_status: string;
  market_label?: string | null; // prop-market name, e.g. "Total Corners 9.5"
  market_kind?: string | null;
};

const OUTCOME: Record<string, { label: string; color: string }> = {
  HOME: { label: 'Home Win', color: 'var(--green)' },
  DRAW: { label: 'Draw',     color: '#94a3b8' },
  AWAY: { label: 'Away Win', color: 'var(--blue)' },
};

/**
 * Resilient outcome meta — predictions include PROP markets (OVER/UNDER/YES/NO/
 * scorer names), not just 1X2. An unmapped outcome used to crash the whole page
 * on `o.color`. Fall back to a semantic colour + a humanised label.
 */
function outcomeMeta(outcome: string): { label: string; color: string } {
  if (OUTCOME[outcome]) return OUTCOME[outcome];
  const color = /^(OVER|YES)$/i.test(outcome) ? 'var(--green)'
    : /^(UNDER|NO)$/i.test(outcome) ? 'var(--blue)'
    : '#94a3b8';
  const label = outcome.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { label, color };
}

const usdc = (micro: number) => (micro / 1_000_000).toFixed(1);
const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';

export default function PredictionsPage() {
  const { publicKey, connected } = useWallet();
  const [walletOpen, setWalletOpen] = useState(false);
  const [preds, setPreds] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) { setPreds(null); return; }
    setLoading(true);
    fetch(`/api/predictions?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => setPreds(Array.isArray(d) ? d : []))
      .catch(() => setPreds([]))
      .finally(() => setLoading(false));
  }, [publicKey]);

  // ── summary maths ──
  const settled = (preds ?? []).filter(p => p.status === 'WON' || p.status === 'LOST');
  const won = settled.filter(p => p.status === 'WON');
  const totalStaked = (preds ?? []).reduce((s, p) => s + p.amount_usdc, 0);
  const activeCount = (preds ?? []).filter(p => p.status === 'ACTIVE').length;
  const winRate = settled.length > 0 ? Math.round((won.length / settled.length) * 100) : null;
  const netMicro = settled.reduce((s, p) => s + ((p.payout_amount ?? 0) - p.amount_usdc), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="My Predictions" accent="var(--green)"
        count={preds?.length || undefined}
        subtitle="Every stake, settled on-chain — your record and P&L" />

      {/* ── Not connected — one mature hero card, no filler blocks ── */}
      {!connected ? (
        <div className="glass fx-rise relative overflow-hidden"
             style={{ borderColor: 'rgba(59,130,246,0.3)', boxShadow: '0 0 30px rgba(59,130,246,0.10)' }}>
          <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,var(--blue),transparent)' }} />
          <div className="relative p-6 md:p-8 text-center">
            <span className="relative inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
              <IconWallet size={28} />
            </span>
            <h2 className="font-display text-xl md:text-2xl font-black">Your on-chain record starts here</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
              Connect a Solana wallet and every stake you place signs a <span className="font-bold text-gray-300">real devnet
              transaction</span> — this page becomes your P&amp;L, graded from TxLINE proofs.
            </p>

            {/* the journey, inline — not four tall cards */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-[11px]">
              {[
                { icon: <IconWallet size={12} />, t: 'Connect' },
                { icon: <IconBall size={12} />,   t: 'Pick a market' },
                { icon: <IconTarget size={12} />, t: 'Sign the stake (devnet tx)' },
                { icon: <IconShield size={12} />, t: 'Settled from TxLINE proof' },
              ].map((s, i, arr) => (
                <span key={s.t} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-semibold text-gray-300"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ color: 'var(--blue)' }}>{s.icon}</span>{s.t}
                  </span>
                  {i < arr.length - 1 && (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button onClick={() => setWalletOpen(true)} className="btn-accent">
                <IconWallet size={16} /> Connect Wallet
              </button>
              <Link href="/markets" className="btn-ghost">Browse Prop Markets</Link>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600 mt-4">
              <IconChain size={11} />
              Parimutuel pools · 2% fee · payouts split pro-rata at full time · devnet only, no real funds
            </p>
          </div>
        </div>
      ) : (
        /* ── Connected ── */
        <>
          {/* Summary — the same live-banner pattern as Markets/Agent */}
          {preds && preds.length > 0 && (() => {
            const accent = netMicro > 0 ? 'var(--green)' : netMicro < 0 ? 'var(--red)' : 'var(--blue)';
            return (
              <div className="glass fx-rise relative overflow-hidden"
                   style={{ borderColor: `${accent}44`, boxShadow: `0 0 30px ${accent}1c` }}>
                <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
                <div className="relative p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Total staked', value: usdc(totalStaked), color: 'var(--blue)' },
                    { label: 'Active', value: String(activeCount), color: 'var(--amber)' },
                    { label: 'Win rate', value: winRate !== null ? `${winRate}%` : '—', color: winRate !== null && winRate >= 50 ? 'var(--green)' : winRate !== null ? 'var(--red)' : '#9ca3af' },
                    { label: 'Net P&L', value: `${netMicro >= 0 ? '+' : ''}${usdc(netMicro)}`, color: netMicro > 0 ? 'var(--green)' : netMicro < 0 ? 'var(--red)' : '#e2e8f0' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="font-display text-3xl md:text-4xl font-black tabular-nums" style={{ color }}>{value}</p>
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="relative text-[11px] text-gray-500 text-center pb-4 -mt-1">
                  Every settled pick was graded from a TxLINE stat proof — payouts split the parimutuel pool pro-rata.
                </p>
              </div>
            );
          })()}

          {/* List / states */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                   style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'var(--blue)' }} />
            </div>
          ) : !preds || preds.length === 0 ? (
            <div className="glass py-16 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-gray-500"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                <IconTarget size={26} />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-gray-200 mb-1">No predictions yet</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Run a match from the <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left),
                  then stake USDC on any prop market — every pick lands here with its settlement.
                </p>
              </div>
              <Link href="/markets" className="btn-accent mx-auto">Open Prop Markets</Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="section-label">History — {preds.length}</p>
              {preds.map(p => {
                const o = outcomeMeta(p.outcome);
                const st = p.status === 'WON'
                  ? { label: 'Won', color: 'var(--green)', cls: 'chip-green' }
                  : p.status === 'LOST'
                  ? { label: 'Lost', color: 'var(--red)', cls: 'chip-red' }
                  : { label: 'Active', color: 'var(--amber)', cls: 'chip-amber' };
                const settledMatch = p.match_status === 'FINISHED' || p.status !== 'ACTIVE';
                return (
                  <Link key={p.id} href={`/match/${p.match_id}`} className="group block">
                    <div className="poster-card glass-hover p-4">
                      <div className="flex items-center justify-between gap-3">
                        {/* match + pick */}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-semibold truncate">
                            <Flag team={p.home_team} size="xs" /> {p.home_team}
                            <span className="text-gray-600 font-normal mx-0.5">v</span>
                            {p.away_team} <Flag team={p.away_team} size="xs" />
                            {settledMatch && (
                              <span className="ml-1.5 font-mono text-gray-500">{p.home_score}–{p.away_score}</span>
                            )}
                          </p>
                          <p className="text-[11px] mt-1">
                            <span style={{ color: o.color }} className="font-semibold">{o.label}</span>
                            {p.market_label && <span className="text-gray-600"> · {p.market_label}</span>}
                            <span className="text-gray-600"> · staked </span>
                            <span className="text-gray-400 font-mono">{usdc(p.amount_usdc)} USDC</span>
                          </p>
                        </div>
                        {/* status + payout */}
                        <div className="text-right flex-shrink-0">
                          <span className={`chip-glass ${st.cls}`}>{st.label}</span>
                          {p.status === 'WON' && p.payout_amount != null && (
                            <p className="text-xs font-bold mt-1.5" style={{ color: 'var(--green)' }}>
                              +{usdc(p.payout_amount)} USDC
                            </p>
                          )}
                        </div>
                      </div>
                      {/* footer: time + tx */}
                      <div className="flex items-center justify-between mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <IconClock size={11} />
                          {new Date(p.placed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <a href={`https://explorer.solana.com/tx/${p.escrow_tx}?cluster=${network}`}
                           target="_blank" rel="noopener noreferrer"
                           onClick={e => e.stopPropagation()}
                           className="text-[10px] font-mono text-gray-500 hover:text-blue-300 transition-colors">
                          {p.escrow_tx.slice(0, 8)}… ↗
                        </a>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  );
}
