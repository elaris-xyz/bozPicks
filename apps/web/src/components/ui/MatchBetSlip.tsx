'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { usePrediction } from '@/hooks/usePrediction';
import { estimatePayout } from '@bozpicks/shared';
import type { OddsSnapshot, ParimutuelPool, Outcome } from '@bozpicks/shared';

/**
 * Wallet-dependent bet slip, split out of the match page and loaded on demand
 * (next/dynamic) only once an outcome is picked — this keeps the Solana wallet
 * adapter + web3.js out of the match page's initial bundle.
 */
export function MatchBetSlip({
  matchId, prediction, currentOdds, pool, homeTeam, awayTeam, onClear,
}: {
  matchId: string;
  prediction: Outcome;
  currentOdds: OddsSnapshot | null;
  pool: ParimutuelPool;
  homeTeam: string;
  awayTeam: string;
  onClear: () => void;
}) {
  const [betAmount, setBetAmount] = useState('10');
  const { publicKey, connected: walletConnected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { placePrediction, status: txStatus, error: txError, result: txResult, reset: resetTx } = usePrediction();

  const sel = {
    HOME: { label: 'Home Win', odds: currentOdds?.homeWin, c: 'var(--green)', t: '16,185,129' },
    DRAW: { label: 'Draw',     odds: currentOdds?.draw,    c: '#94a3b8',      t: '148,163,184' },
    AWAY: { label: 'Away Win', odds: currentOdds?.awayWin, c: 'var(--blue)',  t: '59,130,246' },
  }[prediction];

  const amtMicro = Math.floor(parseFloat(betAmount) * 1_000_000) || 0;
  const payout = amtMicro > 0 ? estimatePayout(amtMicro, prediction, pool) / 1_000_000 : 0;
  const roi = payout > 0 && parseFloat(betAmount) > 0 ? (payout / parseFloat(betAmount) - 1) * 100 : 0;
  const belowMin = amtMicro > 0 && amtMicro < 1_000_000;

  return (
    <div className="glass p-5 space-y-4 anim-in" style={{ borderColor: `rgba(${sel.t},0.35)` }}>
      <div className="flex items-center justify-between">
        <h2 className="section-label">Bet Slip</h2>
        <button onClick={() => { onClear(); resetTx(); }}
          className="text-[10px] font-semibold text-gray-600 hover:text-gray-300 transition-colors">Clear</button>
      </div>

      <div className="flex items-center justify-between rounded-xl p-3.5"
           style={{ background: `rgba(${sel.t},0.1)`, border: `1px solid rgba(${sel.t},0.3)` }}>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 truncate">{homeTeam} v {awayTeam}</p>
          <p className="text-sm font-bold" style={{ color: sel.c }}>{sel.label}</p>
        </div>
        <p className="stat-display text-xl flex-shrink-0 ml-3" style={{ color: sel.c }}>{sel.odds?.toFixed(2) ?? '—'}</p>
      </div>

      {txResult ? (
        <div className="tx-success relative overflow-hidden rounded-xl p-4 space-y-2"
             style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.4)' }}>
          <div className="flex items-center gap-2.5">
            <span className="tx-check w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--green)', boxShadow: '0 0 18px rgba(16,185,129,0.6)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Prediction confirmed on-chain</p>
              <p className="text-[10px] text-gray-500">Settled trustlessly on Solana devnet</p>
            </div>
          </div>
          <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 hover:text-green-300 transition-colors break-all pl-0.5">
            {txResult.txSignature.slice(0, 24)}…<span className="whitespace-nowrap">↗ Explorer</span>
          </a>
          <button onClick={resetTx} className="text-[10px] font-semibold text-gray-600 hover:text-gray-300 transition-colors">Place another →</button>
        </div>
      ) : txStatus === 'error' && txError ? (
        <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs text-red-400">{txError}</p>
          <button onClick={resetTx} className="text-[10px] text-gray-600 mt-1 hover:text-gray-400">Try again</button>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2 rounded-xl p-3"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
              <span className="text-xs text-gray-500">Stake</span>
              <input type="number" min="1" value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold outline-none text-right tabular-nums"
                style={{ color: '#e2e8f0' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--blue)' }}>USDC</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[5, 10, 25, 50].map(v => {
                const on = parseFloat(betAmount) === v;
                return (
                  <button key={v} onClick={() => setBetAmount(String(v))}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                    style={on
                      ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }
                      : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 px-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Est. payout</span>
              <span className="font-bold tabular-nums" style={{ color: 'var(--green)' }}>{payout.toFixed(2)} USDC</span>
            </div>
            {roi !== 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Potential ROI</span>
                <span className={`tabular-nums ${roi > 0 ? 'text-green-400' : 'text-red-400'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {walletConnected ? (
            <button
              onClick={async () => {
                if (amtMicro < 1_000_000) return;
                await placePrediction(matchId, prediction, amtMicro);
              }}
              disabled={txStatus === 'signing' || txStatus === 'confirming' || belowMin || amtMicro === 0}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--blue)', color: '#fff' }}>
              {txStatus === 'signing' && <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Waiting for signature…</>}
              {txStatus === 'confirming' && <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Confirming on-chain…</>}
              {txStatus === 'idle' && (belowMin ? 'Minimum 1 USDC' : `Confirm — ${betAmount || 0} USDC`)}
            </button>
          ) : (
            <button onClick={() => openWalletModal(true)}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'var(--blue)', color: '#fff' }}>
              Connect Wallet to Predict
            </button>
          )}
        </>
      )}
    </div>
  );
}
