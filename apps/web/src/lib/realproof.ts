import { authHeaders } from '@bozpicks/txline-client';
import { hashStatLeaf, foldStatProof } from './statproof';

/**
 * Live real-proof verification. Fetches a FINISHED fixture's TxLINE Merkle proof
 * for its deciding goal stats and re-folds it locally to reproduce TxLINE's own
 * `eventStatRoot` — proving the result trustlessly against TxLINE's cryptographic
 * commitment, not our say-so. Nothing is bundled or stored: the proof is fetched
 * from TxLINE at request time (stays within licence §7.1 "use", not
 * redistribution) and discarded after verification.
 *
 * This is the honest counterpart to the demo's SIMULATED receipts: for a real
 * played fixture we can show a REAL proof verifying, no synthetic root.
 */

const TXLINE_BASE = 'https://txline.txodds.com'; // our activated token is mainnet

interface RawProofNode { hash: number[]; isRightSibling: boolean }
interface RawStatValidation {
  ts: number;
  statToProve: { key: number; value: number; period: number };
  eventStatRoot: number[];
  statProof: RawProofNode[];
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
}

export interface VerifiedStat {
  key: number;
  value: number;
  period: number;
  verified: boolean;         // our local fold == TxLINE's eventStatRoot
  eventStatRoot: string;     // hex, TxLINE's own committed root
  proofNodes: number;
  meaning: string;           // "Participant 1 goals" etc.
}

export interface RealProofResult {
  fixtureId: string;
  seq: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  participant1IsHome: boolean;
  stats: VerifiedStat[];
  verifiedAt: string;
  source: 'TXLINE_LIVE';
}

const bytesToHex = (a: number[]) => Buffer.from(a).toString('hex');
const STAT_MEANING: Record<number, string> = {
  1: 'Participant 1 total goals', 2: 'Participant 2 total goals',
  3: 'Participant 1 yellow cards', 4: 'Participant 2 yellow cards',
  5: 'Participant 1 red cards', 6: 'Participant 2 red cards',
  7: 'Participant 1 corners', 8: 'Participant 2 corners',
};

/** Fetch + locally verify the deciding goal-stat proofs for a finished fixture. */
export async function verifyRealFixture(fixtureId: string): Promise<RealProofResult | null> {
  const headers = await authHeaders();

  // 1) snapshot → the game_finalised record (Seq + final goals + team orientation)
  const snapRes = await fetch(`${TXLINE_BASE}/api/scores/snapshot/${fixtureId}`, { headers });
  if (!snapRes.ok) return null;
  const snaps = await snapRes.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(snaps) || snaps.length === 0) return null;

  const finalRec = snaps.find(r => (r.Action ?? r.action) === 'game_finalised' || r.StatusId === 100 || r.statusId === 100);
  if (!finalRec) return null;
  const seq = Number(finalRec.Seq ?? finalRec.seq ?? 0);
  const stats = (finalRec.Stats ?? finalRec.stats ?? {}) as Record<string, number>;
  const g1 = Number(stats['1'] ?? 0), g2 = Number(stats['2'] ?? 0);
  const isHome1 = finalRec.Participant1IsHome !== false;

  // 2) prove BOTH goal stats (1 = P1 goals, 2 = P2 goals) — together these
  // decide the winner. Verify each against TxLINE's own eventStatRoot.
  const verified: VerifiedStat[] = [];
  for (const key of [1, 2]) {
    try {
      const r = await fetch(`${TXLINE_BASE}/api/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKey=${key}`, { headers });
      if (!r.ok) continue;
      const j = await r.json() as RawStatValidation;
      const { key: k, value, period } = j.statToProve;
      const root = foldStatProof(
        hashStatLeaf(k, value, period),
        j.statProof.map(n => ({ hash: Buffer.from(n.hash), isRightSibling: n.isRightSibling })),
      );
      const expected = Buffer.from(j.eventStatRoot);
      verified.push({
        key: k, value, period,
        verified: root.length === expected.length && root.equals(expected),
        eventStatRoot: bytesToHex(j.eventStatRoot),
        proofNodes: j.statProof.length,
        meaning: STAT_MEANING[k] ?? `stat ${k}`,
      });
    } catch { /* skip this stat */ }
  }
  if (verified.length === 0) return null;

  return {
    fixtureId,
    seq,
    home: '', away: '',                       // filled by the route from fixtures snapshot
    homeScore: isHome1 ? g1 : g2,
    awayScore: isHome1 ? g2 : g1,
    participant1IsHome: isHome1,
    stats: verified,
    verifiedAt: new Date().toISOString(),
    source: 'TXLINE_LIVE',
  };
}
