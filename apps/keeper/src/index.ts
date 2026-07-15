/**
 * bozSettle Keeper Bot
 *
 * Listens for MATCH_END events via Redis pub/sub.
 * When a match ends:
 *   1. Fetch final score from TxLINE REST API
 *   2. Determine winning outcome (HOME / DRAW / AWAY)
 *   3. Call settle_pool instruction on Solana devnet
 *   4. Update DB (boz_pools.winning_outcome, status = SETTLED)
 */

import Redis from 'ioredis';
import { Pool } from 'pg';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import type { BozEvent } from '@bozpicks/shared';
import { fetchStatValidation, buildValidateStatIx } from './txline-validator';

// ── Config ──────────────────────────────────────────────────────────────────

const REDIS_URL    = process.env.REDIS_URL    ?? 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const RPC_URL      = process.env.SOLANA_RPC   ?? 'https://api.devnet.solana.com';
const PROGRAM_ID   = new PublicKey(process.env.BOZPICKS_PROGRAM_ID ?? '11111111111111111111111111111111');

function loadKeypair(): Keypair {
  const raw = process.env.SETTLEMENT_KEEPER_KEYPAIR ?? '[]';
  const bytes = JSON.parse(raw) as number[];
  if (bytes.length === 64) return Keypair.fromSecretKey(Uint8Array.from(bytes));
  // Fallback: generate ephemeral (won't work in prod, but avoids crash in dev)
  console.warn('[keeper] No keypair configured — using ephemeral key (devnet only)');
  return Keypair.generate();
}

// ── Setup ───────────────────────────────────────────────────────────────────

const sub    = new Redis(REDIS_URL);
const redis  = new Redis(REDIS_URL);
const db     = new Pool({ connectionString: DATABASE_URL });
const conn   = new Connection(RPC_URL, 'confirmed');
const keeper = loadKeypair();
const wallet  = new anchor.Wallet(keeper);
const provider = new anchor.AnchorProvider(conn, wallet, { commitment: 'confirmed' });

sub.on('error', () => {});
redis.on('error', () => {});

console.log('[keeper] starting bozSettle keeper bot');
console.log(`[keeper] authority: ${keeper.publicKey.toBase58()}`);
console.log(`[keeper] program:   ${PROGRAM_ID.toBase58()}`);
console.log(`[keeper] rpc:       ${RPC_URL}`);

// ── Helpers ─────────────────────────────────────────────────────────────────

function outcomeIndex(homeScore: number, awayScore: number): number {
  if (homeScore > awayScore) return 0; // HOME
  if (awayScore > homeScore) return 2; // AWAY
  return 1;                             // DRAW
}

function outcomeLabel(idx: number): string {
  return ['HOME', 'DRAW', 'AWAY'][idx] ?? 'UNKNOWN';
}

async function getFinalScore(matchId: string): Promise<{ home: number; away: number } | null> {
  // Try Redis state first (fastest)
  const state = await redis.hgetall(`boz:match:${matchId}:state`);
  if (state.homeScore !== undefined && state.awayScore !== undefined) {
    return { home: Number(state.homeScore), away: Number(state.awayScore) };
  }
  // Fallback: DB
  const { rows } = await db.query(
    'SELECT home_score, away_score FROM boz_matches WHERE id = $1',
    [matchId]
  );
  if (rows[0]) return { home: rows[0].home_score, away: rows[0].away_score };
  return null;
}

async function derivePoolPda(matchId: string): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), Buffer.from(matchId)],
    PROGRAM_ID
  );
}

async function settleOnChain(
  matchId: string,
  winningOutcome: number,
  fixtureId: string,
  lastSeq: number,
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const idl = require('../../../target/idl/settlement.json');
    const program = new anchor.Program(idl, provider);
    const [poolPda] = await derivePoolPda(matchId);

    // Build settle_pool instruction
    const settleIx = await (program.methods as any)
      .settlePool(winningOutcome)
      .accounts({ authority: keeper.publicKey, pool: poolPda })
      .instruction();

    // Try to fetch TxLINE stat validation proof
    const validationArgs = await fetchStatValidation(fixtureId, lastSeq);

    const tx = new Transaction();

    if (validationArgs) {
      // Prepend validate_stat — atomic: both pass or both fail
      console.log('[keeper] TxLINE proof fetched — bundling validate_stat + settle_pool');
      tx.add(buildValidateStatIx(validationArgs));
    } else {
      console.warn('[keeper] No TxLINE proof — settling without on-chain verification');
    }

    tx.add(settleIx);

    const sig = await sendAndConfirmTransaction(conn, tx, [keeper], { commitment: 'confirmed' });
    return sig;
  } catch (e) {
    console.error('[keeper] on-chain settle failed:', (e as Error).message);
    return null;
  }
}

async function settleMatch(matchId: string): Promise<void> {
  // Check if pool exists + open
  const { rows } = await db.query(
    `SELECT status, winning_outcome FROM boz_pools WHERE match_id = $1`,
    [matchId]
  );
  if (!rows[0]) { console.log(`[keeper] no pool for ${matchId}`); return; }
  if (rows[0].status !== 'OPEN') { console.log(`[keeper] pool ${matchId} already ${rows[0].status}`); return; }

  const score = await getFinalScore(matchId);
  if (!score) { console.error(`[keeper] could not get score for ${matchId}`); return; }

  const outcome = outcomeIndex(score.home, score.away);
  console.log(`[keeper] settling ${matchId} → ${outcomeLabel(outcome)} (${score.home}–${score.away})`);

  // Get last event seq for TxLINE proof (stored in Redis by ingest)
  const lastSeqRaw = await redis.get(`boz:match:${matchId}:lastSeq`);
  const lastSeq = lastSeqRaw ? Number(lastSeqRaw) : 1;

  // On-chain settle (with optional TxLINE validate_stat CPI)
  const txSig = await settleOnChain(matchId, outcome, matchId, lastSeq);
  if (txSig) {
    console.log(`[keeper] ✅ on-chain TX: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
  }

  // Always update DB regardless of on-chain status
  await db.query(
    `UPDATE boz_pools
     SET status = 'SETTLED', winning_outcome = $1, settled_at = NOW(), settlement_tx = $2
     WHERE match_id = $3`,
    [outcomeLabel(outcome), txSig ?? null, matchId]
  );

  // Update predictions — ONLY the legacy 1X2 pool bets (market_id IS NULL).
  // Prop-market predictions are graded AND paid by the web's settleMarketRow;
  // blanket-flipping them here marks rows WON/LOST before the payer sees them
  // (it only pays rows it grades itself), so winners never get credited.
  await db.query(
    `UPDATE boz_predictions
     SET status = CASE WHEN outcome = $1 THEN 'WON' ELSE 'LOST' END
     WHERE match_id = $2 AND market_id IS NULL AND status = 'ACTIVE'`,
    [outcomeLabel(outcome), matchId]
  );

  console.log(`[keeper] DB settled — match ${matchId} → ${outcomeLabel(outcome)}`);
}

// ── Subscribe ────────────────────────────────────────────────────────────────

sub.psubscribe('boz:events:*', (err) => {
  if (err) { console.error('[keeper] subscribe error:', err); process.exit(1); }
  console.log('[keeper] subscribed to boz:events:*');
});

sub.on('pmessage', async (_pat, _ch, msg) => {
  try {
    const event = JSON.parse(msg) as BozEvent;
    if (event.type === 'MATCH_END') {
      console.log(`[keeper] MATCH_END received for ${event.matchId}`);
      await settleMatch(event.matchId);
    }
  } catch (e) {
    console.error('[keeper] parse error:', e);
  }
});

// ── Heartbeat ────────────────────────────────────────────────────────────────

setInterval(() => {
  const upMin = Math.floor(process.uptime() / 60);
  console.log(`[keeper] heartbeat | uptime: ${upMin}m | authority: ${keeper.publicKey.toBase58().slice(0, 8)}…`);
}, 5 * 60 * 1_000);

process.on('SIGTERM', () => { sub.disconnect(); redis.disconnect(); db.end(); process.exit(0); });
process.on('SIGINT',  () => { sub.disconnect(); redis.disconnect(); db.end(); process.exit(0); });
