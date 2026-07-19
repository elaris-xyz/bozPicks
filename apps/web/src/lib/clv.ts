/**
 * Closing-Line-Value backtesting (Track 3 — bozAgent).
 *
 * CLV is the sharpest single measure of whether an agent's bets are actually
 * +EV: did it consistently take a BETTER price than where the market closed?
 * Over enough bets, beating the closing line correlates with long-run profit
 * far more reliably than a short-run win/loss record. All odds here are DECIMAL
 * (e.g. 2.00 = even money); everything is pure + deterministic.
 */

export interface ClvBet {
  /** decimal odds the agent actually got when it staked */
  entryOdds: number;
  /** decimal odds at market close (the reference "true" price) */
  closingOdds: number;
  stake: number;
  /** settled result, if known — enables realized ROI */
  won?: boolean;
}

/** Implied probability of decimal odds (before de-vigging). */
export function impliedProb(decimalOdds: number): number {
  return 1 / decimalOdds;
}

/** Fraction by which the entry price beat the close. >0 = took a better price. */
export function clvPct(entryOdds: number, closingOdds: number): number {
  return entryOdds / closingOdds - 1;
}

/** Did the agent beat the closing line (get longer odds than it closed at)? */
export function beatClose(entryOdds: number, closingOdds: number): boolean {
  return entryOdds > closingOdds;
}

/**
 * Expected value per unit stake if the CLOSING line is the true price:
 * p_close · entryOdds − 1. Positive means the entry price was +EV against the
 * close. (Pass de-vigged closing odds for a fair-value estimate.)
 */
export function edgeVsClose(entryOdds: number, closingOdds: number): number {
  return impliedProb(closingOdds) * entryOdds - 1;
}

/**
 * Remove the bookmaker's margin from a two-way market, returning the fair
 * decimal odds for each side. e.g. 1.90 / 1.90 (≈5.3% vig) → ~2.00 / 2.00.
 */
export function devigTwoWay(oddsA: number, oddsB: number): [number, number] {
  const pa = impliedProb(oddsA);
  const pb = impliedProb(oddsB);
  const sum = pa + pb;
  return [sum / pa, sum / pb]; // fair odds = 1 / (p / sum)
}

export interface ClvReport {
  bets: number;            // valid bets counted
  skipped: number;         // bets dropped for invalid odds
  totalStake: number;
  beatCloseCount: number;
  beatCloseRate: number;   // 0..1
  avgClvPct: number;       // stake-weighted mean clvPct
  expectedRoi: number;     // stake-weighted mean edgeVsClose (EV vs the close)
  realizedRoi: number | null; // null unless every counted bet has `won` set
}

function validOdds(o: number): boolean {
  return Number.isFinite(o) && o > 1;
}

/**
 * Aggregate CLV over a set of bets. Bets with non-decimal / invalid odds
 * (≤ 1, NaN) or non-positive stake are skipped and reported in `skipped`.
 */
export function backtestClv(bets: ClvBet[]): ClvReport {
  let totalStake = 0;
  let beatCloseCount = 0;
  let clvWeighted = 0;
  let edgeWeighted = 0;
  let profit = 0;
  let counted = 0;
  let skipped = 0;
  let allSettled = true;

  for (const b of bets) {
    if (!validOdds(b.entryOdds) || !validOdds(b.closingOdds) || !(b.stake > 0)) {
      skipped++;
      continue;
    }
    counted++;
    totalStake += b.stake;
    if (beatClose(b.entryOdds, b.closingOdds)) beatCloseCount++;
    clvWeighted += clvPct(b.entryOdds, b.closingOdds) * b.stake;
    edgeWeighted += edgeVsClose(b.entryOdds, b.closingOdds) * b.stake;
    if (b.won === undefined) allSettled = false;
    else profit += b.won ? b.stake * (b.entryOdds - 1) : -b.stake;
  }

  return {
    bets: counted,
    skipped,
    totalStake,
    beatCloseCount,
    beatCloseRate: counted ? beatCloseCount / counted : 0,
    avgClvPct: totalStake ? clvWeighted / totalStake : 0,
    expectedRoi: totalStake ? edgeWeighted / totalStake : 0,
    realizedRoi: counted && allSettled && totalStake ? profit / totalStake : null,
  };
}
