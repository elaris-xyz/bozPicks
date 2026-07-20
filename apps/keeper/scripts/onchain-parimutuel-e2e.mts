/**
 * Real on-chain parimutuel proof (Track 1 — bozSettle).
 *
 * Runs the deployed settlement program through a FULL cycle on Solana devnet
 * with real SPL-token escrow — create_pool → two players stake USDC →
 * settle_pool → the winner claims a real payout — and asserts the payout math
 * (winner gets stake/winning_total × total_pool minus the 2% fee). Every step
 * lands a real transaction you can open on the explorer. This is the runnable
 * counterpart to the settlement receipts: the escrow + payout are REAL, not
 * simulated.
 *
 * Run:  pnpm --filter=keeper onchain:e2e
 * Needs a funded devnet keypair (acts as pool authority + faucet for the two
 * throwaway players). Provide it via ONE of:
 *   TREASURY_SECRET_KEY = "[.. 64 bytes ..]"   (env, JSON byte array)
 *   --keypair <path>                            (path to a keypair json)
 * RPC override: SOLANA_RPC (defaults to api.devnet.solana.com).
 */
import { createHash } from 'crypto';
import fs from 'fs';
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.BOZPICKS_PROGRAM_ID ?? 'GxH4pi5NY8qKd9vNuYqYT6UWW7jTsjaCFFy233KFTNYh');
const conn = new Connection(RPC, 'confirmed');

function loadPayer(): Keypair {
  const argIdx = process.argv.indexOf('--keypair');
  const raw = argIdx >= 0
    ? fs.readFileSync(process.argv[argIdx + 1], 'utf8')
    : process.env.TREASURY_SECRET_KEY;
  if (!raw) {
    throw new Error('No funded keypair. Set TREASURY_SECRET_KEY or pass --keypair <path>. ' +
      'Fund it on devnet first (https://faucet.solana.com).');
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

// ── anchor-compatible instruction encoders (no IDL needed) ──
const disc = (n: string) => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8);
const u8 = (n: number) => Buffer.from([n]);
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const str = (s: string) => { const sb = Buffer.from(s, 'utf8'); const l = Buffer.alloc(4); l.writeUInt32LE(sb.length); return Buffer.concat([l, sb]); };
const key = (pk: PublicKey, s: boolean, w: boolean) => ({ pubkey: pk, isSigner: s, isWritable: w });
const usdc = (n: number) => (n / 1_000_000).toFixed(2) + ' USDC';
const ex = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

async function main() {
  const payer = loadPayer();
  const bal = await conn.getBalance(payer.publicKey);
  console.log('authority/faucet:', payer.publicKey.toBase58(), '| balance', bal / LAMPORTS_PER_SOL, 'SOL');
  if (bal < 0.15 * LAMPORTS_PER_SOL) throw new Error('Keypair underfunded (need ~0.15 SOL on devnet).');

  const matchId = 'sc' + Date.now().toString().slice(-9);
  const [poolPda] = PublicKey.findProgramAddressSync([Buffer.from('pool'), Buffer.from(matchId)], PROGRAM_ID);
  const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), Buffer.from(matchId)], PROGRAM_ID);
  const predPda = (u: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('prediction'), poolPda.toBuffer(), u.toBuffer()], PROGRAM_ID)[0];
  const tokBal = async (a: PublicKey) => { try { return Number((await getAccount(conn, a)).amount); } catch { return 0; } };
  console.log('matchId:', matchId, '| pool', poolPda.toBase58());

  // two throwaway players, funded for rent/fees from the authority
  const A = Keypair.generate(), B = Keypair.generate();
  for (const p of [A, B]) {
    await sendAndConfirmTransaction(conn,
      new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: p.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })),
      [payer], { commitment: 'confirmed' });
  }

  // a USDC-like mint (6dp), authority = payer
  const mint = await createMint(conn, payer, payer.publicKey, null, 6);
  const aA = (await getOrCreateAssociatedTokenAccount(conn, payer, mint, A.publicKey)).address;
  const aB = (await getOrCreateAssociatedTokenAccount(conn, payer, mint, B.publicKey)).address;
  await mintTo(conn, payer, mint, aA, payer, 10_000_000);
  await mintTo(conn, payer, mint, aB, payer, 10_000_000);
  console.log('mint:', mint.toBase58(), '— minted 10 USDC to each player');

  // 1) create_pool
  const ixCreate = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [key(payer.publicKey, true, true), key(poolPda, false, true), key(escrowPda, false, true), key(mint, false, false),
      key(SystemProgram.programId, false, false), key(TOKEN_PROGRAM_ID, false, false), key(SYSVAR_RENT_PUBKEY, false, false)],
    data: Buffer.concat([disc('create_pool'), str(matchId), i64(Math.floor(Date.now() / 1000))]),
  });
  console.log('\n[1] create_pool:', ex(await sendAndConfirmTransaction(conn, new Transaction().add(ixCreate), [payer], { commitment: 'confirmed' })));

  // 2) place_prediction — A HOME(0) 5 USDC, B AWAY(2) 3 USDC
  const place = (P: Keypair, ataP: PublicKey, outcome: number, amount: number) => {
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [key(P.publicKey, true, true), key(poolPda, false, true), key(escrowPda, false, true), key(predPda(P.publicKey), false, true),
        key(ataP, false, true), key(SystemProgram.programId, false, false), key(TOKEN_PROGRAM_ID, false, false)],
      data: Buffer.concat([disc('place_prediction'), u8(outcome), u64(amount)]),
    });
    return sendAndConfirmTransaction(conn, new Transaction().add(ix), [P], { commitment: 'confirmed' });
  };
  console.log('[2] A stakes 5 USDC HOME:', ex(await place(A, aA, 0, 5_000_000)));
  console.log('    B stakes 3 USDC AWAY:', ex(await place(B, aB, 2, 3_000_000)));
  const escrow = await tokBal(escrowPda);
  console.log('    escrow holds', usdc(escrow));
  if (escrow !== 8_000_000) throw new Error('escrow != 8 USDC');

  // 3) settle_pool(HOME)
  const ixSettle = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [key(payer.publicKey, true, false), key(poolPda, false, true)],
    data: Buffer.concat([disc('settle_pool'), u8(0)]),
  });
  console.log('[3] settle_pool HOME:', ex(await sendAndConfirmTransaction(conn, new Transaction().add(ixSettle), [payer], { commitment: 'confirmed' })));

  // 4) claim_payout — winner A
  const claim = (P: Keypair, ataP: PublicKey) => {
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [key(P.publicKey, true, false), key(poolPda, false, false), key(predPda(P.publicKey), false, true),
        key(escrowPda, false, true), key(ataP, false, true), key(TOKEN_PROGRAM_ID, false, false)],
      data: disc('claim_payout'),
    });
    return sendAndConfirmTransaction(conn, new Transaction().add(ix), [P], { commitment: 'confirmed' });
  };
  const beforeA = await tokBal(aA);
  console.log('\n[4] A claims:', ex(await claim(A, aA)));
  const gained = (await tokBal(aA)) - beforeA;
  console.log('    A gained', usdc(gained), '(expect 7.84 = 8 − 2% fee)');
  if (gained !== 7_840_000) throw new Error('payout != 7.84 USDC (got ' + usdc(gained) + ')');

  // 5) loser B must be rejected
  let rejected = false;
  try { await claim(B, aB); } catch { rejected = true; }
  console.log('[5] loser B claim rejected:', rejected ? '✅' : '❌ (unexpected success)');
  if (!rejected) throw new Error('loser claim should have failed');

  console.log('    escrow residual (2% fee):', usdc(await tokBal(escrowPda)));
  console.log('\n✅ DONE — real on-chain parimutuel cycle verified on devnet.');
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  if (e.logs) console.error(e.logs.join('\n'));
  process.exit(1);
});
