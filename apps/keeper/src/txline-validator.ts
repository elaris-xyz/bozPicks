/**
 * TxLINE on-chain stat validation helper.
 *
 * Fetches a Merkle proof from TxLINE REST API and builds the
 * validate_stat instruction for the TxLINE Solana program.
 * This instruction is bundled with settle_pool in one atomic TX.
 */

import {
  PublicKey,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { authHeaders, statKey } from '@bozpicks/txline-client';

// TxLINE devnet program + published Anchor IDL (validateStatV2 is the currently
// supported on-chain path — see the official devnet examples/IDL):
//   IDL:      https://raw.githubusercontent.com/txodds/tx-on-chain/nojira-re-adding-examples/examples/devnet/idl/txoracle.json
//   scripts:  https://github.com/txodds/tx-on-chain/tree/main/examples/devnet/scripts
const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const TXLINE_BASE       = 'https://txline-dev.txodds.com';

// Stat key to prove for settlement. NOTE: the old value 1002 was WRONG — that
// decodes to H1 participant-2 goals, not the final result. Per TxLINE guidance,
// settle the winner off the `game_finalised` record proving total goals
// (keys 1 & 2, period = Total). We anchor the record on participant-1 total
// goals here; the full winner proof uses both keys via validateStatV2.
const SCORE_STAT_KEY = statKey('GOALS', 1); // = 1 (participant-1 total goals)

// ── Types mirrored from TxLINE IDL ──────────────────────────────────────────

interface ProofNode {
  hash: number[];          // 32 bytes
  is_right_sibling: boolean;
}

interface ScoreStat {
  key:   number;
  value: number;
}

interface ScoresUpdateStats {
  min_timestamp: bigint;
  stats:         ScoreStat[];
}

interface ScoresBatchSummary {
  fixture_id:           bigint;
  update_stats:         ScoresUpdateStats;
  events_sub_tree_root: number[];  // 32 bytes
}

interface StatTerm {
  stat_to_prove:   ScoreStat;
  event_stat_root: number[];   // 32 bytes
  stat_proof:      ProofNode[];
}

export interface StatValidationArgs {
  ts:               bigint;
  fixture_summary:  ScoresBatchSummary;
  fixture_proof:    ProofNode[];
  main_tree_proof:  ProofNode[];
  predicate:        { threshold: number; comparison: { equalTo: Record<string, never> } };
  stat_a:           StatTerm;
  stat_b:           null;
  op:               null;
  daily_scores_pda: PublicKey;
}

// ── TxLINE API response ──────────────────────────────────────────────────────

interface TxStatValidationResponse {
  ts:                bigint | number;
  statToProve:       { key: number; value: number };
  eventStatRoot:     string;   // hex
  summary: {
    fixtureId:      number;
    updateStats:    { minTimestamp: number; stats: { key: number; value: number }[] };
    eventsSubTreeRoot: string; // hex
  };
  statProof:         { hash: string; isRightSibling: boolean }[];
  subTreeProof:      { hash: string; isRightSibling: boolean }[];
  mainTreeProof:     { hash: string; isRightSibling: boolean }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes; // always 32 bytes
}

function toProofNodes(
  nodes: { hash: string; isRightSibling: boolean }[]
): ProofNode[] {
  return nodes.map(n => ({
    hash: hexToBytes(n.hash),
    is_right_sibling: n.isRightSibling,
  }));
}

// ── Fetch proof from TxLINE REST ─────────────────────────────────────────────

export async function fetchStatValidation(
  fixtureId: string,
  seq: number,
): Promise<StatValidationArgs | null> {
  try {
    const headers = await authHeaders();
    const url = `${TXLINE_BASE}/api/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKey=${SCORE_STAT_KEY}`;
    const res  = await fetch(url, { headers });

    if (!res.ok) {
      console.warn(`[validator] stat-validation ${res.status} for fixture ${fixtureId}`);
      return null;
    }

    const raw = await res.json() as TxStatValidationResponse;
    const ts  = BigInt(typeof raw.ts === 'bigint' ? raw.ts : Math.round(Number(raw.ts)));

    // epochDay PDA derivation (u16 little-endian)
    const epochDay   = Math.floor(Number(ts) / 86_400_000);
    const dailyPda   = deriveDailyScoresPda(epochDay);

    const fixtureSummary: ScoresBatchSummary = {
      fixture_id: BigInt(raw.summary.fixtureId),
      update_stats: {
        min_timestamp: BigInt(raw.summary.updateStats.minTimestamp),
        stats: raw.summary.updateStats.stats.map(s => ({ key: s.key, value: s.value })),
      },
      events_sub_tree_root: hexToBytes(raw.summary.eventsSubTreeRoot),
    };

    return {
      ts,
      fixture_summary:  fixtureSummary,
      fixture_proof:    toProofNodes(raw.subTreeProof),
      main_tree_proof:  toProofNodes(raw.mainTreeProof),
      predicate: {
        threshold:  raw.statToProve.value,
        comparison: { equalTo: {} },
      },
      stat_a: {
        stat_to_prove:   { key: raw.statToProve.key, value: raw.statToProve.value },
        event_stat_root: hexToBytes(raw.eventStatRoot),
        stat_proof:      toProofNodes(raw.statProof),
      },
      stat_b: null,
      op:     null,
      daily_scores_pda: dailyPda,
    };
  } catch (e) {
    console.error('[validator] fetchStatValidation error:', (e as Error).message);
    return null;
  }
}

// ── Derive TxLINE daily_scores_merkle_roots PDA ──────────────────────────────

export function deriveDailyScoresPda(epochDay: number): PublicKey {
  const epochDayBuf = Buffer.alloc(2);
  epochDayBuf.writeUInt16LE(epochDay, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('daily_scores_roots'), epochDayBuf],
    TXLINE_PROGRAM_ID,
  );
  return pda;
}

// ── Build validate_stat TransactionInstruction ───────────────────────────────

export function buildValidateStatIx(args: StatValidationArgs): TransactionInstruction {
  // Borsh-encode args matching TxLINE IDL layout
  const data = encodeValidateStatArgs(args);

  const keys: AccountMeta[] = [
    { pubkey: args.daily_scores_pda, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: TXLINE_PROGRAM_ID,
    keys,
    data,
  });
}

// ── Manual Borsh encoding ────────────────────────────────────────────────────

function encodeValidateStatArgs(args: StatValidationArgs): Buffer {
  const writer = new BorshWriter();

  // discriminator for validate_stat (anchor sighash)
  const disc = anchor.utils.bytes.hex.decode(
    anchor.utils.sha256.hash('global:validate_stat').slice(0, 16)
  );
  writer.writeBytes(Buffer.from(disc));

  // ts: i64
  writer.writeI64(args.ts);

  // fixture_summary
  writer.writeI64(args.fixture_summary.fixture_id);
  writer.writeI64(args.fixture_summary.update_stats.min_timestamp);
  writer.writeU32(args.fixture_summary.update_stats.stats.length);
  for (const s of args.fixture_summary.update_stats.stats) {
    writer.writeU16(s.key);
    writer.writeI32(s.value);
  }
  writer.writeBytes(Buffer.from(args.fixture_summary.events_sub_tree_root));

  // fixture_proof: Vec<ProofNode>
  writer.writeProofVec(args.fixture_proof);

  // main_tree_proof: Vec<ProofNode>
  writer.writeProofVec(args.main_tree_proof);

  // predicate: TraderPredicate
  writer.writeI32(args.predicate.threshold);
  // comparison: equalTo enum variant 0
  writer.writeU8(0);

  // stat_a: StatTerm
  writer.writeStatTerm(args.stat_a);

  // stat_b: Option<StatTerm> = None
  writer.writeU8(0);

  // op: Option<BinaryExpression> = None
  writer.writeU8(0);

  return writer.toBuffer();
}

class BorshWriter {
  private buf: number[] = [];

  writeBytes(b: Buffer | number[]) {
    this.buf.push(...(Array.isArray(b) ? b : Array.from(b)));
  }
  writeU8(n: number) { this.buf.push(n & 0xff); }
  writeU16(n: number) {
    this.buf.push(n & 0xff, (n >> 8) & 0xff);
  }
  writeU32(n: number) {
    this.buf.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
  }
  writeI32(n: number) { this.writeU32(n >>> 0); }
  writeI64(n: bigint) {
    const lo = Number(n & 0xffffffffn);
    const hi = Number((n >> 32n) & 0xffffffffn);
    this.writeU32(lo);
    this.writeU32(hi);
  }
  writeProofVec(nodes: ProofNode[]) {
    this.writeU32(nodes.length);
    for (const node of nodes) {
      this.writeBytes(node.hash);
      this.writeU8(node.is_right_sibling ? 1 : 0);
    }
  }
  writeStatTerm(st: StatTerm) {
    this.writeU16(st.stat_to_prove.key);
    this.writeI32(st.stat_to_prove.value);
    this.writeBytes(st.event_stat_root);
    this.writeProofVec(st.stat_proof);
  }
  toBuffer(): Buffer { return Buffer.from(this.buf); }
}
