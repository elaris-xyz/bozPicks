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
      {/* No WalletModalProvider — the in-house WalletModal owns select/disconnect
          (the third-party modal positioned itself off-screen and clashed with
          the theme). But CONNECTING is left to the provider via autoConnect: the
          modal only calls select(), and autoConnect connects the selected wallet
          so the React context actually tracks it. The modal used to call
          adapter.connect() itself — which connected the wallet but bypassed the
          provider's listeners, so on a fresh state the adapter reported
          connected:true with a publicKey while the context never updated and the
          UI stayed on "Ready". autoConnect=true also reconnects on refresh. */}
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
