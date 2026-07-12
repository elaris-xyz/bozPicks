/**
 * Verifies the TxLINE stat-proof algorithm: the SHA-256 leaf preimage
 * (u32_le key || i32_le value || i32_le period) and the is_right_sibling
 * concat order, per the team-confirmed spec. We build a tiny self-consistent
 * tree so the fold + verify logic is checked without a live proof bundle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashStatLeaf, foldStatProof, verifyStatProof } from './statproof';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

test('hashStatLeaf encodes key/value/period as little-endian and SHA-256s it', () => {
  // total goals (key 1) value 3, period 0 (Total)
  const buf = Buffer.alloc(12);
  buf.writeUInt32LE(1, 0); buf.writeInt32LE(3, 4); buf.writeInt32LE(0, 8);
  assert.deepEqual(hashStatLeaf(1, 3, 0), sha256(buf));
});

test('foldStatProof honors is_right_sibling ordering', () => {
  const leaf = hashStatLeaf(7, 11, 0);          // corners key 7, value 11
  const sib = sha256(Buffer.from('sibling'));
  // sibling on the right → sha256(leaf || sib)
  assert.deepEqual(foldStatProof(leaf, [{ hash: sib, isRightSibling: true }]), sha256(Buffer.concat([leaf, sib])));
  // sibling on the left → sha256(sib || leaf)
  assert.deepEqual(foldStatProof(leaf, [{ hash: sib, isRightSibling: false }]), sha256(Buffer.concat([sib, leaf])));
});

test('verifyStatProof accepts a matching root and rejects a tampered value', () => {
  const stat = { key: 2, value: 1, period: 0 };  // participant-2 goals = 1
  const sib = sha256(Buffer.from('x'));
  const proof = [{ hash: sib, isRightSibling: true }];
  const root = foldStatProof(hashStatLeaf(stat.key, stat.value, stat.period), proof);

  assert.equal(verifyStatProof(stat, proof, root), true);
  assert.equal(verifyStatProof({ ...stat, value: 2 }, proof, root), false); // wrong score → fails
});
