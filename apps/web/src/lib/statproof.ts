import { createHash } from 'crypto';

/**
 * TxLINE score Merkle-proof verifier — the team-confirmed spec (World Cup
 * hackathon channel, Jul 2026), reproduced against real devnet proof bundles by
 * the community:
 *
 *   leaf = sha256( u32_le(key) || i32_le(value) || i32_le(period) )
 *   for node in proof:
 *     hash = node.isRightSibling ? sha256(hash || node.hash)
 *                                : sha256(node.hash || hash)
 *
 * Raw Borsh field encoding in IDL order, SHA-256, no discriminator/domain
 * prefix. Server-only (node crypto). The keeper uses the on-chain validateStatV2
 * CPI for the authoritative check; this lets us verify a real TxLINE proof
 * locally too (e.g. before submitting), instead of trusting the feed.
 */

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

/** SHA-256 leaf hash for a ScoreStat { key, value, period }. */
export function hashStatLeaf(key: number, value: number, period: number): Buffer {
  const buf = Buffer.alloc(12);
  buf.writeUInt32LE(key >>> 0, 0);
  buf.writeInt32LE(value | 0, 4);
  buf.writeInt32LE(period | 0, 8);
  return sha256(buf);
}

export interface ProofNode { hash: Buffer | string; isRightSibling: boolean }

/** Fold a Merkle proof to its root, honoring is_right_sibling concat order. */
export function foldStatProof(leaf: Buffer, proof: ProofNode[]): Buffer {
  let h = leaf;
  for (const node of proof) {
    const sib = Buffer.isBuffer(node.hash) ? node.hash : Buffer.from(node.hash, 'hex');
    h = sha256(node.isRightSibling ? Buffer.concat([h, sib]) : Buffer.concat([sib, h]));
  }
  return h;
}

/** True if the ScoreStat leaf + proof reproduces the expected on-chain root. */
export function verifyStatProof(
  stat: { key: number; value: number; period: number },
  proof: ProofNode[],
  expectedRoot: Buffer | string,
): boolean {
  const root = foldStatProof(hashStatLeaf(stat.key, stat.value, stat.period), proof);
  const exp = Buffer.isBuffer(expectedRoot) ? expectedRoot : Buffer.from(expectedRoot, 'hex');
  return root.length === exp.length && root.equals(exp);
}
