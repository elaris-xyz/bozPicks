'use client';

import {
  createContext, useContext, useCallback, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';

/**
 * bozVault — the in-game economy. The player signs ONE Solana devnet tx to
 * deposit; after that, stakes debit this balance instantly with no signing, and
 * winnings credit back to it. A withdraw signs once to cash out to the wallet.
 * This context is the single client source of truth for the balance + ledger;
 * the balance chip, the vault modal, and the markets betting all read it.
 */

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface LedgerEntry {
  id: string; kind: 'DEPOSIT' | 'STAKE' | 'WIN' | 'REFUND' | 'WITHDRAW';
  amount: number; balanceAfter: number; ref: string | null; txSig: string | null; at: string;
}
type ModalMode = 'deposit' | 'withdraw' | null;

interface VaultValue {
  connected: boolean;
  balance: number;   // micro
  deposited: number;
  won: number;
  ledger: LedgerEntry[];
  busy: boolean;
  refresh: () => void;
  deposit: (amountUsdc: number) => Promise<boolean>;
  withdraw: (amountUsdc: number) => Promise<boolean>;
  /** open the vault modal (optionally straight to deposit/withdraw) */
  open: (mode?: ModalMode) => void;
  close: () => void;
  modal: ModalMode | 'menu' | null;
}

const VaultContext = createContext<VaultValue>({
  connected: false, balance: 0, deposited: 0, won: 0, ledger: [], busy: false,
  refresh: () => {}, deposit: async () => false, withdraw: async () => false,
  open: () => {}, close: () => {}, modal: null,
});

export function VaultProvider({ children }: { children: ReactNode }) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);
  const [deposited, setDeposited] = useState(0);
  const [won, setWon] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalMode | 'menu' | null>(null);
  const wallet = publicKey?.toBase58() ?? null;

  const refresh = useCallback(() => {
    if (!wallet) { setBalance(0); setDeposited(0); setWon(0); setLedger([]); return; }
    fetch(`/api/vault?wallet=${wallet}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (typeof d.balance === 'number') setBalance(d.balance);
        if (typeof d.deposited === 'number') setDeposited(d.deposited);
        if (typeof d.won === 'number') setWon(d.won);
        if (Array.isArray(d.ledger)) setLedger(d.ledger);
      })
      .catch(() => {});
  }, [wallet]);

  // load on connect / clear on disconnect; light poll so settlement credits show
  useEffect(() => {
    refresh();
    if (!wallet) return;
    const t = setInterval(refresh, 12_000);
    return () => clearInterval(t);
  }, [wallet, refresh]);

  // sign a single devnet memo tx that anchors a vault movement
  const signAnchor = useCallback(async (memo: object): Promise<string> => {
    if (!publicKey) throw new Error('Connect a wallet first');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const ix = new TransactionInstruction({
      keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM,
      data: Buffer.from(JSON.stringify(memo), 'utf-8'),
    });
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey;
    const sig = await sendTransaction(tx, connection);
    void connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }).catch(() => {});
    return sig;
  }, [publicKey, connection, sendTransaction]);

  const deposit = useCallback(async (amountUsdc: number): Promise<boolean> => {
    if (!wallet) return false;
    setBusy(true);
    try {
      const txSig = await signAnchor({ bozVault: 'deposit', amountUsdc });
      const r = await fetch('/api/vault/deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, amountUsdc, txSig }),
      }).then(res => res.json());
      if (typeof r.balance === 'number') setBalance(r.balance);
      refresh();
      return r.ok === true;
    } catch { return false; }
    finally { setBusy(false); }
  }, [wallet, signAnchor, refresh]);

  const withdraw = useCallback(async (amountUsdc: number): Promise<boolean> => {
    if (!wallet) return false;
    setBusy(true);
    try {
      const txSig = await signAnchor({ bozVault: 'withdraw', amountUsdc });
      const res = await fetch('/api/vault/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, amountUsdc, txSig }),
      });
      const r = await res.json();
      if (typeof r.balance === 'number') setBalance(r.balance);
      refresh();
      return res.ok;
    } catch { return false; }
    finally { setBusy(false); }
  }, [wallet, signAnchor, refresh]);

  const open = useCallback((mode: ModalMode = null) => setModal(mode ?? 'menu'), []);
  const close = useCallback(() => setModal(null), []);

  return (
    <VaultContext.Provider value={{
      connected, balance, deposited, won, ledger, busy,
      refresh, deposit, withdraw, open, close, modal,
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() { return useContext(VaultContext); }
