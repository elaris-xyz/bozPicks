import { authHeaders, txlineRest } from '@bozpicks/txline-client';
import { hashStatLeaf, foldStatProof } from './statproof';

/**
 * Live real-proof verification. Fetches a fixture's TxLINE Merkle proof for its
 * goal stats and re-folds it locally to reproduce TxLINE's own `eventStatRoot`
 * — proving the result trustlessly against TxLINE's cryptographic commitment,
 * not our say-so. Nothing is bundled or stored: the proof is fetched from
 * TxLINE at request time (stays within licence §7.1 "use", not redistribution)
 * and discarded after verification.
 *
 * Works on BOTH a finished fixture (proves the final score at the
 * `game_finalised` record, period 100) AND a match that is in play right now
 * (proves the CURRENT score at the latest committed seq — TxLINE commits an
 * eventStatRoot on every tick, verified live at period 5). This is the honest
 * counterpart to the demo's SIMULATED receipts: for a real fixture we show a
 * REAL proof verifying, no synthetic root.
 */

const TXLINE_BASE = 'https://txline.txodds.com'; // our activated token is mainnet

// An evergreen finished fixture that always has a verifiable game_finalised
// proof — the guaranteed fallback so the card never shows "nothing to verify".
export const SHOWCASE_FIXTURE = { fixtureId: '18241006', home: 'England', away: 'Argentina' };

// GameState codes that mean the ball is in play (so a live, in-play proof is
// available) vs. the match having ended.
const LIVE_STATES = new Set(['A', 'HT', 'ET1', 'ET2', 'P', 'PE', 'FET']);

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
  mode: 'FINAL' | 'LIVE';    // final result vs. a live in-play snapshot
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

const recSeq = (r: Record<string, unknown>) => Number(r.Seq ?? r.seq ?? 0);
const recAction = (r: Record<string, unknown>) => String(r.Action ?? r.action ?? '');
const recState = (r: Record<string, unknown>) => String(r.GameState ?? r.gameState ?? '');
const isFinalRec = (r: Record<string, unknown>) =>
  recAction(r) === 'game_finalised' || r.StatusId === 100 || r.statusId === 100;

interface FixtureState {
  mode: 'FINAL' | 'LIVE' | 'SCHEDULED';
  seq: number;
  participant1IsHome: boolean;
}

/** Classify a fixture from its scores snapshot: finished, in-play, or not started. */
async function classify(fixtureId: string, headers: Record<string, string>): Promise<FixtureState | null> {
  const res = await fetch(`${TXLINE_BASE}/api/scores/snapshot/${fixtureId}`, { headers });
  if (!res.ok) return null;
  const snaps = await res.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(snaps) || snaps.length === 0) return null;

  const isHome1 = snaps.some(r => r.Participant1IsHome !== false); // default true unless explicitly false
  const finalRec = snaps.find(isFinalRec);
  if (finalRec) return { mode: 'FINAL', seq: recSeq(finalRec), participant1IsHome: isHome1 };

  // in play if the latest record carries a live game-state and a real seq
  const latest = [...snaps].sort((a, b) => recSeq(b) - recSeq(a))[0];
  if (latest && recSeq(latest) > 0 && LIVE_STATES.has(recState(latest))) {
    return { mode: 'LIVE', seq: recSeq(latest), participant1IsHome: isHome1 };
  }
  return { mode: 'SCHEDULED', seq: recSeq(latest ?? {}), participant1IsHome: isHome1 };
}

/** Prove goal stats (key 1 = P1 goals, 2 = P2 goals) at a given seq. */
async function proveGoals(
  fixtureId: string, seq: number, headers: Record<string, string>,
): Promise<VerifiedStat[]> {
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
  return verified;
}

/** Fetch + locally verify the goal-stat proofs for a fixture (finished or live). */
export async function verifyRealFixture(fixtureId: string): Promise<RealProofResult | null> {
  const headers = await authHeaders();

  const state = await classify(fixtureId, headers);
  if (!state || state.mode === 'SCHEDULED') return null; // nothing committed to prove yet

  const verified = await proveGoals(fixtureId, state.seq, headers);
  if (verified.length === 0) return null;

  // the proven stat VALUES are the goals — key 1 = P1, key 2 = P2 (map to home/away)
  const g1 = verified.find(s => s.key === 1)?.value ?? 0;
  const g2 = verified.find(s => s.key === 2)?.value ?? 0;
  const isHome1 = state.participant1IsHome;

  const result: RealProofResult = {
    fixtureId,
    seq: state.seq,
    mode: state.mode,
    home: '', away: '',                        // filled from fixtures metadata below
    homeScore: isHome1 ? g1 : g2,
    awayScore: isHome1 ? g2 : g1,
    participant1IsHome: isHome1,
    stats: verified,
    verifiedAt: new Date().toISOString(),
    source: 'TXLINE_LIVE',
  };

  // resolve real team names (public fixture metadata) — best-effort
  try {
    const fixtures = await txlineRest.fixtures();
    const f = fixtures.find(x => String(x.FixtureId) === fixtureId);
    if (f) {
      result.home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      result.away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    }
  } catch { /* names are best-effort */ }

  return result;
}

/**
 * Auto-pick the most compelling real fixture to verify: a match in play RIGHT
 * NOW beats a recently-finished one, which beats the evergreen showcase. Keeps
 * the "Verify a real result" card live and relevant during a real match day
 * without any hardcoded fixture — falls back to the showcase so it always has a
 * verifiable result to show.
 */
export async function pickBestRealFixture(): Promise<string> {
  try {
    const headers = await authHeaders();
    const fixtures = await txlineRest.fixtures();
    const now = Date.now();
    // only fixtures that have kicked off, most recent first, capped so we never
    // fan out into a slow scan
    const started = fixtures
      .filter(f => f.StartTime <= now + 5 * 60_000)
      .sort((a, b) => b.StartTime - a.StartTime)
      .slice(0, 5);

    let firstFinished: string | null = null;
    for (const f of started) {
      const id = String(f.FixtureId);
      const st = await classify(id, headers).catch(() => null);
      if (st?.mode === 'LIVE') return id;              // in-play wins outright
      if (st?.mode === 'FINAL' && !firstFinished) firstFinished = id;
    }
    if (firstFinished) return firstFinished;
  } catch { /* fall through to the evergreen showcase */ }
  return SHOWCASE_FIXTURE.fixtureId;
}
