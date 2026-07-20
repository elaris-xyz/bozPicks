import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';

/**
 * Server-side devnet money rail for the bozVault. The vault ledger denominates
 * in USDC *display* dollars (micro = 1e6). On devnet we settle real value in
 * native SOL, so we peg $1 → a small lamport amount that keeps a $100 deposit
 * comfortably inside a faucet airdrop (~1–2 SOL).
 *
 * Everything here is DORMANT until a treasury is configured:
 *   - deposits are verified on-chain only when a treasury ADDRESS is known
 *     (`TREASURY_SECRET_KEY` or `NEXT_PUBLIC_TREASURY_ADDRESS`);
 *   - withdrawals push a real transfer only when the treasury SIGNER
 *     (`TREASURY_SECRET_KEY`) is present.
 * With neither set the vault keeps its memo-anchored devnet flow (no value
 * moves), so the live demo is unchanged until someone funds a treasury.
 */

const RPC_URL =
  process.env.SOLANA_RPC ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  clusterApiUrl('devnet');

// $1 → lamports. 0.001 SOL per dollar by default (a $100 deposit = 0.1 SOL).
// Parsed defensively: a blank/garbled env value must fall back to the default,
// never become NaN — an NaN peg made microUsdcToLamports return NaN, which blew
// up cash-out with "NaN cannot be converted to a BigInt" when building the
// transfer (and silently let deposit verification pass vacuously).
function parsePeg(v: string | undefined, fallback = 1_000_000): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
export const LAMPORTS_PER_USD = parsePeg(process.env.TREASURY_LAMPORTS_PER_USD);

/** USDC micro-units (1e6 = $1) → lamports (integer ≥ 0), using the devnet peg. */
export function microUsdcToLamports(micro: number): number {
  const lamports = Math.round((micro / 1_000_000) * LAMPORTS_PER_USD);
  return Number.isFinite(lamports) && lamports >= 0 ? lamports : 0;
}

let _conn: Connection | null = null;
export function getConnection(): Connection {
  if (!_conn) _conn = new Connection(RPC_URL, 'confirmed');
  return _conn;
}

// undefined = not yet resolved, null = not configured
let _treasury: Keypair | null | undefined;
export function treasuryKeypair(): Keypair | null {
  if (_treasury !== undefined) return _treasury;
  const raw = process.env.TREASURY_SECRET_KEY;
  if (!raw) { _treasury = null; return _treasury; }
  try {
    const bytes = JSON.parse(raw) as number[];
    _treasury = bytes.length === 64 ? Keypair.fromSecretKey(Uint8Array.from(bytes)) : null;
  } catch {
    _treasury = null;
  }
  return _treasury;
}

/** The treasury public key — from the signer if present, else the public env. */
export function treasuryAddress(): PublicKey | null {
  const kp = treasuryKeypair();
  if (kp) return kp.publicKey;
  const pub = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (pub) { try { return new PublicKey(pub); } catch { return null; } }
  return null;
}

/** Deposits should be verified on-chain (a treasury address is known). */
export function isRealVaultEnabled(): boolean {
  return treasuryAddress() !== null;
}

/** Withdrawals can push a real transfer (the treasury signer is present). */
export function isTreasurySignerConfigured(): boolean {
  return treasuryKeypair() !== null;
}

/**
 * Sum the lamports moved by SystemProgram `transfer` instructions from `from`
 * to `to` in a parsed transaction (top-level and inner). Pure — unit-tested
 * against constructed parsed-tx objects, no network. A failed tx contributes 0.
 */
export function transferredLamports(
  tx: ParsedTransactionWithMeta | null,
  from: string,
  to: string,
): number {
  if (!tx || !tx.meta || tx.meta.err) return 0;
  let total = 0;
  const scan = (instrs: unknown[] | undefined) => {
    for (const ix of instrs ?? []) {
      const parsed = (ix as { parsed?: { type?: string; info?: Record<string, unknown> } }).parsed;
      if (
        parsed &&
        parsed.type === 'transfer' &&
        parsed.info?.source === from &&
        parsed.info?.destination === to
      ) {
        total += Number(parsed.info.lamports) || 0;
      }
    }
  };
  scan(tx.transaction.message.instructions as unknown[]);
  for (const inner of tx.meta.innerInstructions ?? []) scan(inner.instructions as unknown[]);
  return total;
}

/**
 * Confirm a deposit landed on devnet: the signature exists, did not error, and
 * moved at least `minLamports` from `fromWallet` to the treasury. Returns the
 * verified lamport amount, or a reason it was rejected.
 */
export async function verifyDepositTx(
  txSig: string,
  fromWallet: string,
  minLamports: number,
): Promise<{ ok: boolean; lamports: number; reason?: string }> {
  const to = treasuryAddress();
  if (!to) return { ok: false, lamports: 0, reason: 'treasury not configured' };
  const tx = await getConnection().getParsedTransaction(txSig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return { ok: false, lamports: 0, reason: 'tx not found' };
  if (tx.meta?.err) return { ok: false, lamports: 0, reason: 'tx failed on-chain' };
  const lamports = transferredLamports(tx, fromWallet, to.toBase58());
  if (lamports < minLamports) {
    return { ok: false, lamports, reason: 'transfer amount below deposit' };
  }
  return { ok: true, lamports };
}

/**
 * Send a real treasury → wallet transfer (cash-out). Returns the devnet sig.
 *
 * SEND and CONFIRM are deliberately split. A throw here means the node REJECTED
 * the transaction (bad blockhash, insufficient funds) — a genuine failure the
 * caller should reverse. A slow/never confirmation does NOT throw: the tx is
 * already broadcast and will land, so we return the sig regardless. This avoids
 * two production traps on flaky devnet RPCs / short serverless timeouts: the
 * confirmation wait timing out the whole function, and — worse — reversing a
 * debit for a transfer that actually lands later (a double-credit).
 */
export async function sendFromTreasury(toWallet: string, lamports: number): Promise<string> {
  const kp = treasuryKeypair();
  if (!kp) throw new Error('treasury signer not configured');
  if (!Number.isInteger(lamports) || lamports <= 0) {
    throw new Error(`invalid lamports (${lamports}) — check the *_LAMPORTS_PER_USD peg`);
  }
  const conn = getConnection();
  const to = new PublicKey(toWallet);
  // A simple, known-good transfer from a funded treasury: skip the preflight
  // simulation (it's the step that most often errors on a rate-limited devnet
  // RPC) and retry the whole send a few times against transient RPC failures.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: to, lamports }),
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = kp.publicKey;
      tx.sign(kp);
      const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 });
      // best-effort confirmation; a timeout is not a failure (tx is broadcast)
      try {
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      } catch { /* slow devnet confirmation — the broadcast tx will still land */ }
      return sig;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('treasury transfer failed');
}
