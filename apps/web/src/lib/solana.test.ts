/**
 * bozVault devnet money-rail helpers. Covers the pure pieces that don't touch
 * the network: the USDC↔lamports peg and the parsed-transaction transfer
 * extraction that a real deposit is verified against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { microUsdcToLamports, transferredLamports, LAMPORTS_PER_USD } from './solana';

const TREASURY = 'Trea5uryPubKey1111111111111111111111111111';
const PLAYER = 'P1ayerWa11et2222222222222222222222222222222';

test('microUsdcToLamports applies the $1 peg to micro-USDC', () => {
  // $1 = 1e6 micro → LAMPORTS_PER_USD
  assert.equal(microUsdcToLamports(1_000_000), LAMPORTS_PER_USD);
  // $100
  assert.equal(microUsdcToLamports(100_000_000), 100 * LAMPORTS_PER_USD);
  // fractional dollar rounds to nearest lamport
  assert.equal(microUsdcToLamports(500_000), Math.round(0.5 * LAMPORTS_PER_USD));
  assert.equal(microUsdcToLamports(0), 0);
});

// minimal parsed-tx shaped like what getParsedTransaction returns
function parsedTx(
  transfers: { source: string; destination: string; lamports: number }[],
  opts: { err?: unknown; inner?: boolean } = {},
): ParsedTransactionWithMeta {
  const toIx = (t: { source: string; destination: string; lamports: number }) => ({
    program: 'system',
    parsed: { type: 'transfer', info: t },
  });
  return {
    meta: {
      err: opts.err ?? null,
      innerInstructions: opts.inner ? [{ index: 0, instructions: transfers.map(toIx) }] : [],
    },
    transaction: {
      message: { instructions: opts.inner ? [] : transfers.map(toIx) },
    },
  } as unknown as ParsedTransactionWithMeta;
}

test('transferredLamports sums player→treasury transfers', () => {
  const tx = parsedTx([{ source: PLAYER, destination: TREASURY, lamports: 100_000 }]);
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 100_000);
});

test('transferredLamports ignores transfers to a different destination', () => {
  const tx = parsedTx([{ source: PLAYER, destination: 'someoneElse', lamports: 100_000 }]);
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 0);
});

test('transferredLamports ignores transfers from a different source', () => {
  const tx = parsedTx([{ source: 'notThePlayer', destination: TREASURY, lamports: 100_000 }]);
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 0);
});

test('transferredLamports counts inner instructions too', () => {
  const tx = parsedTx([{ source: PLAYER, destination: TREASURY, lamports: 42 }], { inner: true });
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 42);
});

test('transferredLamports returns 0 for a failed transaction', () => {
  const tx = parsedTx([{ source: PLAYER, destination: TREASURY, lamports: 100_000 }], { err: { InstructionError: [0, 'x'] } });
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 0);
});

test('transferredLamports returns 0 for a null transaction', () => {
  assert.equal(transferredLamports(null, PLAYER, TREASURY), 0);
});

test('transferredLamports sums multiple matching transfers', () => {
  const tx = parsedTx([
    { source: PLAYER, destination: TREASURY, lamports: 60 },
    { source: PLAYER, destination: TREASURY, lamports: 40 },
    { source: PLAYER, destination: 'other', lamports: 999 },
  ]);
  assert.equal(transferredLamports(tx, PLAYER, TREASURY), 100);
});
