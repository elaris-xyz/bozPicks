'use client';

import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import type { Adapter } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';

// devnet endpoint — mainnet-beta when ready. The default cluster RPC is rate-
// limited and flaky on devnet (Phantom in particular often builds+signs but the
// tx never lands, while Solflare works — a wallet/RPC issue, not ours). Point
// NEXT_PUBLIC_RPC_URL at a dedicated devnet RPC (Helius/QuickNode/Alchemy) so
// signatures land reliably during the demo.
const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta';
const ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(NETWORK);

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  // Reconnect on refresh WITHOUT re-introducing the race that broke the click.
  //
  // A plain `autoConnect` connects whenever a wallet is SELECTED — including a
  // manual select inside the modal's click — so its background connect() raced
  // the modal's connect(), wedged the adapter at connecting=true, and the click
  // did nothing (the "brief spinner, nothing happens" bug). But turning it fully
  // off dropped reconnect-on-refresh.
  //
  // As a FUNCTION, autoConnect is asked per adapter whether to connect. We say
  // yes only for the wallet that was already remembered at page load, and only
  // that once — so a refresh silently reconnects, while a wallet the user picks
  // mid-session is connected solely by the modal's click (no competing connect).
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
      {/* No WalletModalProvider — the in-house WalletModal owns select/connect/
          disconnect (the third-party modal positioned itself off-screen and
          clashed with the theme). autoConnect is the guarded function above. */}
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
