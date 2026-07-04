'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModal } from '@/components/ui/WalletModal';
import { Flag } from '@/components/ui/Flag';
import { CountUp } from '@/components/ui/CountUp';
import { IconWallet, IconBall, IconTarget, IconShield, IconChain, IconClock } from '@/components/ui/Icons';

type Prediction = {
  id: string;
  match_id: string;
  outcome: 'HOME' | 'DRAW' | 'AWAY';
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
};

const OUTCOME = {
  HOME: { label: 'Home Win', color: 'var(--green)' },
  DRAW: { label: 'Draw',     color: '#94a3b8' },
  AWAY: { label: 'Away Win', color: 'var(--blue)' },
};

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
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight">My Predictions</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your prediction history and P&amp;L</p>
      </div>

      {/* ── Not connected ── */}
      {!connected ? (
        <>
          <div className="glass py-16 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
                 style={{ color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <IconWallet size={30} />
            </div>
            <div>
              <p className="font-bold text-gray-200 mb-1">Wallet not connected</p>
              <p className="text-sm text-gray-500">Connect your Solana wallet to view your predictions and earnings</p>
            </div>
            <button onClick={() => setWalletOpen(true)} className="btn-accent mx-auto">
              <IconWallet size={16} /> Connect Wallet
            </button>
          </div>

          {/* How it works */}
          <div className="glass p-5 space-y-4">
            <p className="section-label">How Predictions Work</p>
            <div className="space-y-3">
              {[
                { step: '1', icon: <IconWallet size={13} />, title: 'Connect Wallet', desc: 'Connect your Phantom or Solflare wallet' },
                { step: '2', icon: <IconBall size={13} />,   title: 'Pick a Match', desc: 'Choose any live or upcoming match' },
                { step: '3', icon: <IconTarget size={13} />, title: 'Make Prediction', desc: 'Select Home/Draw/Away and stake USDC' },
                { step: '4', icon: <IconShield size={13} />, title: 'Win On-Chain', desc: 'Correct predictions settle automatically via smart contract' },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-100">
                      <span className="text-gray-600 mr-1.5 font-mono text-xs">{step}</span>{title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-4 flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <IconChain size={16} />
            </span>
            <div className="text-xs text-gray-500 space-y-1">
              <p>All predictions use a <strong className="text-gray-300">parimutuel pool</strong> — your payout depends on how many others pick the same outcome.</p>
              <p>A <strong className="text-gray-300">2% fee</strong> is deducted from each pool before settlement.</p>
              <p>Payouts are sent automatically to your wallet when the match ends.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/" className="btn-accent flex-1 justify-center">Browse Live Matches</Link>
            <Link href="/leaderboard" className="btn-ghost flex-1 justify-center">View Leaderboard</Link>
          </div>
        </>
      ) : (
        /* ── Connected ── */
        <>
          {/* Summary */}
          {preds && preds.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Staked', value: usdc(totalStaked), suffix: '', color: 'var(--blue)' },
                { label: 'Active', value: String(activeCount), suffix: '', color: 'var(--amber)' },
                { label: 'Win Rate', value: winRate !== null ? String(winRate) : '—', suffix: winRate !== null ? '%' : '', color: winRate !== null && winRate >= 50 ? 'var(--green)' : winRate !== null ? 'var(--red)' : '#9ca3af' },
                { label: 'Net P&L', value: `${netMicro >= 0 ? '+' : ''}${usdc(netMicro)}`, suffix: '', color: netMicro > 0 ? 'var(--green)' : netMicro < 0 ? 'var(--red)' : '#9ca3af' },
              ].map(({ label, value, suffix, color }) => {
                const numeric = parseFloat(value);
                return (
                  <div key={label} className="poster-card p-4 text-center">
                    <p className="stat-display text-2xl" style={{ color }}>
                      {Number.isFinite(numeric) && !value.startsWith('+') && !value.startsWith('-')
                        ? <CountUp value={numeric} suffix={suffix} />
                        : `${value}${suffix}`}
                    </p>
                    <p className="section-label mt-1.5">{label}</p>
                  </div>
                );
              })}
            </div>
          )}

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
                <p className="font-bold text-gray-200 mb-1">No predictions yet</p>
                <p className="text-sm text-gray-500">Pick a match and stake USDC to see it here</p>
              </div>
              <Link href="/" className="btn-accent mx-auto">Browse Live Matches</Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="section-label">History — {preds.length}</p>
              {preds.map(p => {
                const o = OUTCOME[p.outcome];
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
