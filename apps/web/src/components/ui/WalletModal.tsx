'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import { IconWallet } from './Icons';

/**
 * The ONLY wallet UI in the app — connect, account and disconnect in one
 * solid, perfectly-centred modal. We deliberately bypass the third-party
 * wallet-adapter modal (it positioned itself off-screen and fought our theme):
 * wallets are listed straight from the adapter context and selected inline,
 * with connect errors surfaced in place.
 */

const PANEL_BG = 'linear-gradient(180deg, #101a30, #0a0f1e)';

export function WalletModal({ onClose }: { onClose: () => void }) {
  const { publicKey, disconnect, connected, connecting, wallet, wallets, select } = useWallet();
  const [pending, setPending] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // Portal target — mounting via document.body keeps position:fixed anchored
  // to the real viewport. Rendered in place (e.g. inside the nav, which has a
  // backdrop-filter), fixed positioning would anchor to the nav instead and
  // the modal opened half off-screen at the top.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Connection is triggered directly from the click (see pick) so the wallet's
  // approval popup opens inside the user gesture. A deferred connect() in an
  // effect (which also raced autoConnect's `connecting` flag) was why Phantom
  // showed "Ready" but never opened.

  // Auto-close ONLY when the connection happened inside this modal session
  // (fresh connect → brief success beat → close). Opening the modal while
  // already connected is the ACCOUNT view — it must stay open so the user can
  // reach Copy / Explorer / Disconnect.
  const wasConnectedOnMount = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnectedOnMount.current && pending === null && !confirmDisconnect) {
      const t = setTimeout(onClose, 900);
      return () => clearTimeout(t);
    }
  }, [connected, pending, confirmDisconnect, onClose]);

  const addr = publicKey?.toBase58() ?? '';
  const shortAddr = addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '';

  const pick = async (name: WalletName) => {
    setError(null);
    const w = wallets.find(x => x.adapter.name === name);
    if (!w) return;
    const a = w.adapter;
    setPending(name);
    // Never let the spinner (which disables every wallet button) get stuck if the
    // adapter's connect promise never settles — a dismissed extension popup can
    // leave it pending forever. Releasing here doesn't cancel the connect: a late
    // approval still lands via the provider's `connect` event and closes the modal.
    const release = window.setTimeout(
      () => setPending(cur => (cur === name ? null : cur)), 45_000);
    // ── TEMP diagnostics (fresh-state connect bug) — open DevTools console ──
    console.log('[wallet] pick', name,
      '| readyState=', a.readyState,
      '| currentlySelected=', wallet?.adapter.name ?? '(none)',
      '| a.connected=', a.connected, '| a.connecting=', a.connecting);
    try {
      // select so the provider tracks this adapter, then connect the adapter
      // DIRECTLY inside the click gesture → the approval popup actually opens.
      if (wallet?.adapter.name !== name) { console.log('[wallet] select()', name); select(name); }
      // Re-picking an ALREADY-selected wallet is the trap: select() is a no-op
      // for the same name, so the only action is connect() — and if the adapter
      // is half-open (connected at the adapter level but not surfaced, or wedged
      // from a prior dismissed popup) connect() hits its internal
      // `if (connected || connecting) return` guard and silently does nothing.
      // That was the "click Solflare, nothing happens" bug — the workaround was
      // to switch wallets and back (which disconnects the adapter). Do that reset
      // here so a plain re-click always reaches a clean connect().
      if (a.connected || a.connecting) {
        console.log('[wallet] resetting half-open adapter (disconnect first)');
        await a.disconnect().catch(() => {});
      }
      console.log('[wallet] calling connect()', name);
      await a.connect();
      console.log('[wallet] connect() RESOLVED', name, '| a.connected=', a.connected, '| publicKey=', a.publicKey?.toBase58?.() ?? '(none)');
    } catch (e) {
      const err = e as Error;
      console.error('[wallet] connect() THREW', name, '| name=', err.name, '| message=', err.message);
      // The user closing/declining the approval popup isn't a failure worth a
      // red banner — only surface genuine problems.
      const benign = err.name === 'WalletWindowClosedError'
        || /reject|declin|cancel|clos|denied|user/i.test(err.message || '');
      if (!benign) {
        setError(err.name === 'WalletNotReadyError'
          ? 'Wallet not ready — is the extension unlocked?'
          : err.message || 'Connection failed — try again.');
      }
    } finally {
      window.clearTimeout(release);
      setPending(null);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };

  // ONLY truly-installed extensions count as connectable. "Loadable" wallets
  // (e.g. Solflare's web fallback) just bounce to the vendor site — showing
  // them as READY was a lie. Any installed Solana wallet auto-registers here
  // via the Wallet Standard, so real extensions always appear.
  const installed = wallets.filter(w => w.readyState === WalletReadyState.Installed);
  const notInstalled = wallets.filter(w => w.readyState !== WalletReadyState.Installed);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center fade-in" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,15,0.75)', backdropFilter: 'blur(6px)' }} />

      <div className="relative w-full md:max-w-sm anim-in rounded-t-3xl md:rounded-3xl p-5 md:p-6 space-y-4 md:mb-0 max-h-[85vh] overflow-y-auto rail-scroll"
           style={{ background: PANEL_BG, border: '1px solid rgba(99,140,255,0.28)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}
           onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff' }}>
              <IconWallet size={17} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold leading-tight">
                {connected ? 'Your wallet' : 'Connect a wallet'}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Solana · Devnet</p>
            </div>
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
          /* ── Account ─────────────────────────────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl"
                 style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--green)' }}>
                {wallet?.adapter.icon
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={wallet.adapter.icon} alt="" className="w-6 h-6 rounded-full" />
                  : <IconWallet size={18} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>{wallet?.adapter.name ?? 'Wallet'}</p>
                  <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--green)' }} />
                </div>
                <p className="text-xs font-mono text-gray-400 truncate">{shortAddr}</p>
              </div>
              <button onClick={copy} title="Copy address"
                className="flex items-center gap-1 text-[10px] font-bold px-2 h-7 rounded-full transition-all hover:brightness-125 flex-shrink-0"
                style={copied
                  ? { background: 'rgba(16,185,129,0.15)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
                {copied ? (
                  <><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>Copied</>
                ) : (
                  <><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" /></svg>Copy</>
                )}
              </button>
            </div>

            <a href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
               target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-all hover:brightness-125"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-[13px] text-gray-300 font-semibold">View on Solana Explorer</span>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            {confirmDisconnect ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmDisconnect(false)}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-125"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancel
                </button>
                <button onClick={async () => { await disconnect().catch(() => {}); onClose(); }}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}>
                  Yes, disconnect
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDisconnect(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-125"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Disconnect
              </button>
            )}
          </div>
        ) : (
          /* ── Wallet picker ───────────────────────────────────────────── */
          <div className="space-y-2.5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3 2 20h20L12 3z" strokeLinejoin="round" /><path d="M12 10v4M12 17.5v.01" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {installed.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3 leading-relaxed">
                No wallet extension detected in this browser.
                {notInstalled.length > 0 && <><br /><span className="text-[11px] text-gray-600">Install one below, then reopen this dialog.</span></>}
              </p>
            )}

            {installed.map(w => {
              const busy = pending === w.adapter.name || (connecting && wallet?.adapter.name === w.adapter.name);
              return (
                <button key={w.adapter.name} onClick={() => pick(w.adapter.name)} disabled={!!pending || connecting}
                  className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all enabled:hover:-translate-y-px enabled:hover:brightness-125 active:scale-[0.99] disabled:opacity-60"
                  style={{ background: 'rgba(245,200,107,0.06)', border: '1px solid rgba(245,200,107,0.3)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold" style={{ color: '#f5c86b' }}>{w.adapter.name}</span>
                    <span className="block text-[10px] text-gray-500">Detected in this browser</span>
                  </span>
                  {busy ? (
                    <span className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
                          style={{ borderColor: 'rgba(245,200,107,0.25)', borderTopColor: '#f5c86b' }} />
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(245,200,107,0.14)', color: '#f5c86b', border: '1px solid rgba(245,200,107,0.4)' }}>
                      Ready
                    </span>
                  )}
                </button>
              );
            })}

            {notInstalled.map(w => (
              <a key={w.adapter.name} href={w.adapter.url} target="_blank" rel="noopener noreferrer"
                 className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all hover:brightness-125"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', opacity: 0.75 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.adapter.icon} alt="" className="w-8 h-8 rounded-lg flex-shrink-0 grayscale" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-gray-300">{w.adapter.name}</span>
                  <span className="block text-[10px] text-gray-600">Not installed — get the extension</span>
                </span>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}

            <p className="text-[10px] text-center text-gray-600 pt-1">
              Devnet only — no real funds. Your keys never leave the wallet.
            </p>
            {/* Phantom's default devnet RPC often builds+signs but never lands a
                tx; Solflare is reliable there. Honest heads-up for the demo. */}
            <p className="text-[10px] text-center text-gray-600">
              On devnet, <span className="text-gray-400 font-semibold">Solflare</span> lands transactions most reliably.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
