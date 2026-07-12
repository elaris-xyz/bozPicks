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
          off-screen and clashed with the theme). */}
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
