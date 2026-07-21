'use client';

import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
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

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      {/* No WalletModalProvider — the in-house WalletModal handles select/
          connect/disconnect itself (the third-party modal positioned itself
          off-screen and clashed with the theme).

          autoConnect is deliberately OFF. With it ON, selecting a wallet made
          the provider fire its OWN adapter.connect() in the background, which
          raced the manual connect() in the click: the adapter wedged at
          connecting=true, the manual connect hit its internal `if (connecting)
          return` guard and did nothing, and no popup opened — the recurring
          "click Phantom/Solflare, brief spinner, nothing happens" bug. The
          in-house modal owns the single connect path inside the click gesture.
          (Trade-off: no silent reconnect after a page refresh — a reconnect
          click is needed, which is the reliable behaviour.) */}
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
