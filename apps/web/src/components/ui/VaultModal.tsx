'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVault, type LedgerEntry } from '@/contexts/VaultContext';
import { usdcToDisplay } from '@bozpicks/shared';
import { fireToast } from './Toast';
import { IconTrophy, IconTarget } from './Icons';

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

/**
 * Turn a raw ledger row into a plain-English line. STAKE/WIN refs are
 * `"OUTCOME · Market Label"` (set server-side in predict/settle) — split
 * that into "Staked on OVER" + "Total Corners 9.5" instead of showing the
 * generic kind label next to a run-on ref string.
 */
function describeEntry(e: LedgerEntry): { headline: string; detail?: string } {
  const meta = KIND_META[e.kind];
  if ((e.kind === 'STAKE' || e.kind === 'WIN') && e.ref?.includes(' · ')) {
    const [outcome, ...rest] = e.ref.split(' · ');
    return { headline: `${e.kind === 'STAKE' ? 'Staked on' : 'Won on'} ${outcome}`, detail: rest.join(' · ') };
  }
  return { headline: meta.label, detail: e.ref ?? undefined };
}

/** `HH:MM · D Mon` — compact, always shows an absolute time (never "3h ago",
    which goes stale the instant a judge pauses the video). */
function stamp(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${time} · ${date}`;
}

export function VaultModal() {
  const { modal, close, balance, deposited, won, staked, withdrawn, activeStake, activeCount, ledger, busy, deposit, withdraw, reset } = useVault();
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
      <div className="relative w-full max-w-md rounded-2xl anim-in max-h-[92vh] overflow-y-auto overflow-x-hidden overscroll-contain rail-scroll"
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

            {/* the money that's NOT lost, just waiting — this is the single
                biggest source of "where did my balance go?" confusion: a
                fresh round of stakes debits instantly, before any result is
                known, and reads exactly like a loss unless it's called out */}
            {activeCount > 0 && (
              <div className="relative mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
                   style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>
                  <IconTarget size={13} />
                </span>
                <p className="text-[11px] text-amber-200 leading-snug">
                  <b className="font-bold">{usdcToDisplay(activeStake)} USDC</b> is in {activeCount} open bet{activeCount > 1 ? 's' : ''} right now — not lost, just waiting on the result.
                </p>
              </div>
            )}

            {/* what makes up the balance, as labeled tiles instead of a
                run-on equation — each movement type gets its own icon, color,
                and plain word, then a one-line summary in real sentences */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2.5">How this adds up</p>
              <div className="grid grid-cols-2 gap-2">
                <FlowTile icon={<IconDeposit />} label="Put in" amount={deposited} color="#3b82f6" sign="+" />
                <FlowTile icon={<IconTarget size={14} />} label="Bet so far" amount={staked} color="#f59e0b" sign="−" />
                <FlowTile icon={<IconTrophy size={14} />} label="Won back" amount={won} color="#22c55e" sign="+" />
                <FlowTile icon={<IconCashOut />} label="Taken out" amount={withdrawn} color="#a78bfa" sign="−" />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-3">
                You put in <b className="text-gray-300">{usdcToDisplay(deposited)}</b>, bet{' '}
                <b className="text-gray-300">{usdcToDisplay(staked)}</b> across your games, won back{' '}
                <b style={{ color: 'var(--green)' }}>{usdcToDisplay(won)}</b>, and cashed out{' '}
                <b className="text-gray-300">{usdcToDisplay(withdrawn)}</b> — leaving{' '}
                <b className="text-gray-100">{bal} USDC</b> to play with.
              </p>
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
                const { headline, detail } = describeEntry(e);
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg"
                       style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                        <span className="text-xs font-semibold truncate" style={{ color: meta.color }}>{headline}</span>
                      </div>
                      {/* market/context on its own line so long labels never
                          get clipped against the headline, and WHEN this
                          happened — without a timestamp, a viewer can't tell
                          which of many similar rows a given number came from */}
                      {detail && <span className="text-[10px] text-gray-500 truncate pl-3.5">{detail}</span>}
                      {/* the on-chain memo, spelled out right here — Explorer's
                          Summary tab doesn't parse custom memo data, so a judge
                          would otherwise have to dig into Programs & Logs to
                          find the amount. Quoting the exact bytes we wrote
                          on-chain means the connection to the tx below isn't a
                          claim to take on faith — it's right there to compare. */}
                      {(e.kind === 'DEPOSIT' || e.kind === 'WITHDRAW') && (
                        <span className="text-[9px] text-gray-600 font-mono truncate pl-3.5">
                          on-chain: {`{"bozVault":"${e.kind === 'DEPOSIT' ? 'deposit' : 'withdraw'}","amountUsdc":${usdcToDisplay(Math.abs(e.amount))}}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 pl-3.5">
                        <span className="text-[9px] text-gray-600">{stamp(e.at)}</span>
                        {/* deposit/cash-out are anchored by a real signed devnet
                            tx (a memo instruction) — link straight to it so
                            "one signature" is independently checkable, not a
                            claim you have to take on faith */}
                        {e.txSig && (
                          <a href={`https://explorer.solana.com/tx/${e.txSig}?cluster=devnet`}
                             target="_blank" rel="noopener noreferrer"
                             onClick={ev => ev.stopPropagation()}
                             title="Opens on Solana Explorer — find this same memo under the &quot;Programs & Logs&quot; tab, Memo Instruction, Data (UTF-8)."
                             className="flex items-center gap-0.5 text-[9px] font-semibold hover:brightness-125 transition-all"
                             style={{ color: '#93c5fd' }}>
                            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                            </svg>
                            devnet tx
                          </a>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-xs font-bold tabular-nums"
                            style={{ color: credit ? 'var(--green)' : '#e2e8f0' }}>
                        {credit ? '+' : '−'}{usdcToDisplay(Math.abs(e.amount))}
                      </span>
                      <span className="text-[9px] text-gray-600 tabular-nums">bal {usdcToDisplay(e.balanceAfter)}</span>
                    </div>
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

/** One labeled movement in the balance breakdown — icon badge + plain word +
    amount, so the number reads on its own without needing the sentence below. */
function FlowTile({ icon, label, amount, color, sign }: { icon: React.ReactNode; label: string; amount: number; color: string; sign: '+' | '−' }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
         style={{ background: `${color}0f`, border: `1px solid ${color}30` }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22`, color }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 leading-none">{label}</p>
        <p className="text-sm font-black tabular-nums mt-1" style={{ color }}>{sign}{usdcToDisplay(amount)}</p>
      </div>
    </div>
  );
}

const IconDeposit = () => (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v11m0 0l-4-4m4 4l4-4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);
const IconCashOut = () => (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21V10m0 0l-4 4m4-4l4 4" /><path d="M4 8V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
  </svg>
);
