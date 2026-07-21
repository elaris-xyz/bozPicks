'use client';

import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import type { Adapter } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// devnet endpoint — mainnet-beta when ready. The default cluster RPC is rate-
// limited and flaky on devnet (Phantom in particular often builds+signs but the
// tx never lands, while Solflare works — a wallet/RPC issue, not ours). Point
// NEXT_PUBLIC_RPC_URL at a dedicated devnet RPC (Helius/QuickNode/Alchemy) so
// signatures land reliably during the demo.
const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta';
const ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(NETWORK);

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  // NO explicit adapters. Phantom, Solflare, etc. register themselves via the
  // Wallet Standard, so the provider already lists them. Passing
  // PhantomWalletAdapter/SolflareWalletAdapter too DOUBLE-registered each wallet
  // (the console warned "can be removed from your app") — the duplicate Phantom
  // entry is what threw "WalletConnectionError: Unexpected error" and drove a
  // render loop. Empty array = one Standard-registered entry per wallet.
  const wallets = useMemo<Adapter[]>(() => [], []);

  // autoConnect ONLY silently reconnects the wallet remembered at page load, and
  // only once. A wallet the user picks in the modal is connected there via the
  // context connect() (a FULL connect). We must NOT let autoConnect fire on a
  // manual select: it calls adapter.autoConnect() = connect({onlyIfTrusted}),
  // which shows no popup and, for Phantom on a not-yet-trusted site, throws
  // "WalletConnectionError: Unexpected error".
  const restored = useRef(false);
  const autoConnect = useCallback(async (adapter: Adapter) => {
    if (restored.current) return false;
    let remembered: string | null = null;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('walletName') : null;
      remembered = raw ? (JSON.parse(raw) as string) : null;
    } catch { remembered = null; }
    if (remembered && adapter.name === remembered) { restored.current = true; return true; }
    return false;
  }, []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      {/* No WalletModalProvider — the in-house WalletModal owns select + the
          full connect() (the third-party modal positioned itself off-screen and
          clashed with the theme). autoConnect is the guarded reconnect above. */}
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
