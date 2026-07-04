'use client';

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { IconWallet } from './Icons';

export function WalletModal({ onClose }: { onClose: () => void }) {
  const { publicKey, disconnect, connected, connecting, wallet } = useWallet();
  const { setVisible } = useWalletModal();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // If just connected, close this modal
  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center fade-in"
         onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />

      <div className="relative w-full md:max-w-sm glass anim-in rounded-t-3xl md:rounded-3xl p-6 space-y-4"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold">
              {connected ? 'Wallet Connected' : 'Connect Wallet'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Solana · Devnet</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {connected && publicKey ? (
          /* ── Connected state ── */
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl"
                 style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                   style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }}>
                {wallet?.adapter.icon
                  ? <img src={wallet.adapter.icon} alt="" className="w-6 h-6 rounded-full" />
                  : <IconWallet size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>
                  {wallet?.adapter.name ?? 'Wallet'}
                </p>
                <p className="text-xs font-mono text-gray-400 truncate">{shortAddress}</p>
              </div>
              <span className="w-2 h-2 rounded-full badge-live" style={{ background: 'var(--green)' }} />
            </div>

            <a
              href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              View on Solana Explorer ↗
            </a>

            <button
              onClick={async () => { await disconnect(); onClose(); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              Disconnect
            </button>
          </div>
        ) : (
          /* ── Connect state ── */
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Connect your Solana wallet to place predictions on devnet.
            </p>

            <button
              onClick={() => { setVisible(true); onClose(); }}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'var(--blue)', color: '#fff' }}>
              {connecting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Connecting...
                </>
              ) : (
                'Select Wallet'
              )}
            </button>

            <p className="text-[10px] text-center text-gray-600">
              Phantom · Solflare · and more · Devnet only
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
