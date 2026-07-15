'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVault, type LedgerEntry } from '@/contexts/VaultContext';
import { usdcToDisplay } from '@bozpicks/shared';
import { fireToast } from './Toast';

/**
 * bozVault modal — the game's cashier. Shows the balance, deposits from the
 * wallet (one signature), stakes debit it silently elsewhere, and cash-out
 * returns funds to the wallet. Portalled to body so fixed positioning anchors
 * to the viewport (same reason as WalletModal). Devnet, simulated USDC.
 */

const PANEL_BG = 'linear-gradient(180deg, #101a30, #0a0f1e)';
const QUICK = [10, 25, 50, 100];

const KIND_META: Record<LedgerEntry['kind'], { label: string; color: string; sign: string }> = {
  DEPOSIT:  { label: 'Deposit',  color: '#3b82f6', sign: '+' },
  WIN:      { label: 'Won',      color: '#22c55e', sign: '+' },
  REFUND:   { label: 'Refund',   color: '#2dd4bf', sign: '+' },
  STAKE:    { label: 'Staked',   color: '#f59e0b', sign: '' },
  WITHDRAW: { label: 'Cash out', color: '#a78bfa', sign: '' },
};

export function VaultModal() {
  const { modal, close, balance, deposited, won, ledger, busy, deposit, withdraw, reset } = useVault();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState(25);
  const [flash, setFlash] = useState<'deposit' | 'withdraw' | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // opening straight into deposit/withdraw picks the matching tab
  useEffect(() => {
    if (modal === 'deposit' || modal === 'withdraw') setMode(modal);
  }, [modal]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [close]);

  if (!mounted || modal === null) return null;

  const bal = usdcToDisplay(balance);
  const canWithdraw = balance > 0;
  const overdraw = mode === 'withdraw' && amount > Number(bal);

  const celebrate = (kind: 'deposit' | 'withdraw') => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 1100);
  };

  const run = async () => {
    if (amount <= 0 || overdraw) return;
    if (mode === 'deposit') {
      const ok = await deposit(amount);
      if (ok) celebrate('deposit');
      fireToast(ok
        ? { kind: 'info', title: `Deposited ${amount} USDC to your vault`, body: 'Signed on Solana devnet · balance topped up' }
        : { kind: 'warn', title: 'Deposit not completed', body: 'The transaction was rejected or cancelled' });
    } else {
      const ok = await withdraw(amount);
      if (ok) celebrate('withdraw');
      fireToast(ok
        ? { kind: 'info', title: `Cashed out ${amount} USDC`, body: 'Vault balance reduced · devnet is simulated (no real transfer)' }
        : { kind: 'warn', title: 'Cash-out not completed', body: 'Rejected, cancelled, or over balance' });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
         style={{ background: 'rgba(3,6,16,0.72)', backdropFilter: 'blur(6px)' }}
         onClick={close}>
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden anim-in"
           style={{ background: PANEL_BG, border: '1px solid rgba(99,140,255,0.3)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}
           onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#3b82f6,#a78bfa,transparent)' }} />

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', boxShadow: '0 0 18px rgba(59,130,246,0.45)' }}>
              <VaultIcon />
            </span>
            <div>
              <p className="font-display font-black text-[15px] leading-none">Game Vault</p>
              <p className="text-[10px] text-gray-500 mt-1">Solana devnet · simulated USDC</p>
            </div>
          </div>
          <button onClick={close} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* balance */}
        <div className="px-5 pt-4">
          <div className="relative rounded-2xl p-4 overflow-hidden transition-shadow duration-300"
               style={{
                 background: 'radial-gradient(120% 140% at 0% 0%, rgba(59,130,246,0.14), rgba(10,15,30,0.4))',
                 border: `1px solid ${flash === 'deposit' ? 'rgba(16,185,129,0.6)' : flash === 'withdraw' ? 'rgba(167,139,250,0.6)' : 'rgba(99,140,255,0.22)'}`,
                 boxShadow: flash ? `0 0 26px ${flash === 'deposit' ? 'rgba(16,185,129,0.35)' : 'rgba(167,139,250,0.35)'}` : undefined,
               }}>
            {/* rising coins on a successful deposit */}
            {flash === 'deposit' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} className="boz-coin absolute text-sm" style={{ left: `${12 + i * 19}%`, bottom: 0, animationDelay: `${i * 60}ms` }}>🪙</span>
                ))}
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spendable balance</p>
            <p className={`font-display text-3xl font-black tabular-nums mt-1 ${flash ? 'boz-vault-pop' : ''}`} style={{ color: '#f8fafc' }}>
              {bal} <span className="text-sm font-bold text-gray-500">USDC</span>
            </p>
            <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
              <span>Deposited <strong className="text-gray-300 tabular-nums">{usdcToDisplay(deposited)}</strong></span>
              <span>Won <strong className="tabular-nums" style={{ color: 'var(--green)' }}>{usdcToDisplay(won)}</strong></span>
            </div>
          </div>
        </div>

        {/* mode toggle */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['deposit', 'withdraw'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="h-9 rounded-lg text-xs font-bold capitalize transition-all"
                style={mode === m
                  ? { background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', color: '#fff', boxShadow: '0 0 14px rgba(59,130,246,0.3)' }
                  : { color: '#94a3b8' }}>
                {m === 'deposit' ? 'Deposit' : 'Cash out'}
              </button>
            ))}
          </div>
        </div>

        {/* amount */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map(q => (
              <button key={q} onClick={() => setAmount(q)}
                className="h-9 rounded-lg text-xs font-bold tabular-nums transition-all"
                style={amount === q
                  ? { background: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.5)' }
                  : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid var(--glass-border)' }}>
                {q}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 px-3 h-11 rounded-xl"
               style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${overdraw ? 'rgba(239,68,68,0.5)' : 'var(--glass-border)'}` }}>
            <input type="number" min={1} value={amount}
              onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
              className="flex-1 bg-transparent outline-none text-sm font-bold tabular-nums text-gray-100" />
            <span className="text-xs font-bold text-gray-500">USDC</span>
            {mode === 'withdraw' && (
              <button onClick={() => setAmount(Number(bal))} className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd' }}>MAX</button>
            )}
          </div>
          {overdraw && <p className="text-[10px] mt-1.5" style={{ color: 'var(--red)' }}>More than your balance ({bal} USDC).</p>}
        </div>

        {/* action */}
        <div className="px-5 pt-4">
          <button onClick={run} disabled={busy || amount <= 0 || overdraw || (mode === 'withdraw' && !canWithdraw)}
            className="w-full h-11 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', boxShadow: '0 0 18px rgba(59,130,246,0.35)' }}>
            {busy ? 'Signing on devnet…'
              : mode === 'deposit' ? `Deposit ${amount} USDC` : `Cash out ${amount} USDC`}
          </button>
          <p className="text-[10px] text-gray-500 text-center mt-2">
            {mode === 'deposit'
              ? 'One signature funds your vault — then stakes are instant, no more pop-ups.'
              : 'Returns funds to your connected wallet. One signature.'}
          </p>
        </div>

        {/* ledger */}
        <div className="px-5 py-4 mt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Recent activity</p>
          {ledger.length === 0 ? (
            <p className="text-xs text-gray-600 py-3 text-center">No movements yet — deposit to start.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto rail-scroll pr-1">
              {ledger.slice(0, 12).map(e => {
                const meta = KIND_META[e.kind];
                const credit = e.amount >= 0;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg"
                       style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                      {e.ref && <span className="text-[10px] text-gray-600 truncate">· {e.ref}</span>}
                    </div>
                    <span className="text-xs font-bold tabular-nums flex-shrink-0"
                          style={{ color: credit ? 'var(--green)' : '#e2e8f0' }}>
                      {credit ? '+' : '−'}{usdcToDisplay(Math.abs(e.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* clean-slate reset — for a fresh demo recording */}
          <button
            onClick={() => { if (confirm('Wipe this vault to zero for a clean demo? (devnet game money)')) void reset(); }}
            disabled={busy}
            className="w-full mt-3 h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#6b7280' }}>
            Reset vault (demo)
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.2" /><path d="M12 4v2M12 18v2" />
    </svg>
  );
}
