'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import type { Outcome } from '@bozpicks/shared';

export type PredictionStatus = 'idle' | 'signing' | 'confirming' | 'done' | 'error';

export interface PredictionResult {
  txSignature: string;
  explorerUrl: string;
  predictionId: string;
}

export function usePrediction() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [status, setStatus] = useState<PredictionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const placePrediction = useCallback(async (
    matchId: string,
    outcome: Outcome,
    amountUsdc: number   // micro-units: 1 USDC = 1_000_000
  ) => {
    if (!publicKey) { setError('Connect wallet first'); return; }
    setStatus('signing');
    setError(null);
    setResult(null);

    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      // Memo instruction — encodes prediction data on-chain without Anchor program
      // When Anchor is deployed, replace with CPI instruction
      const memo = JSON.stringify({ matchId, outcome, amountUsdc });
      const memoIx = new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(memo, 'utf-8'),
      });

      const tx = new Transaction()
        .add(memoIx);

      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStatus('confirming');
      const signature = await sendTransaction(tx, connection);

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      // Record in DB
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          walletAddress: publicKey.toBase58(),
          outcome,
          amountUsdc,
          escrowTx: signature,
        }),
      });

      if (!res.ok) throw new Error('Failed to record prediction');
      const data = await res.json();

      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${network}`;

      const finalResult: PredictionResult = {
        txSignature: signature,
        explorerUrl,
        predictionId: data.id,
      };

      setResult(finalResult);
      setStatus('done');
      return finalResult;

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      setError(msg);
      setStatus('error');
    }
  }, [publicKey, connection, sendTransaction]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
  }, []);

  return { placePrediction, status, error, result, reset };
}
