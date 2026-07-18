import type Redis from 'ioredis';
import type { BozEvent, OddsSnapshot, Outcome } from '@bozpicks/shared';
import { initMM, mmStep, mmPnl, mmExposure, mmSpreadPct, type MMState } from '@bozpicks/shared';

/**
 * Headless In-Play Market Maker — the third autonomous Track 3 agent. It runs on
 * the same live TxLINE event stream (Redis pub/sub) as the detector and arena,
 * quotes a two-sided market on every 1X2 outcome, books fills as the price
 * crosses its quotes, and realises the book at full time. Career stats persist in
 * Redis and a compact snapshot is published on `boz:mm` for any UI/API to read.
 * No browser, no human input — a standalone deployable maker.
 */

const MM_CHANNEL = 'boz:mm';
const MM_CAREER_KEY = 'boz:mm:career';

interface MMBook { mm: MMState; lastOdds: OddsSnapshot | null; settled: boolean }
interface MMCareer { pnl: number; fills: number; volume: number; edge: number; matches: number }
const zeroCareer = (): MMCareer => ({ pnl: 0, fills: 0, volume: 0, edge: 0, matches: 0 });

export class MarketMaker {
  private books = new Map<string, MMBook>();
  private career: MMCareer = zeroCareer();
  private ready = false;

  constructor(private redis: Redis) {}

  async init(): Promise<void> {
    try {
      const raw = await this.redis.get(MM_CAREER_KEY);
      if (raw) this.career = { ...zeroCareer(), ...JSON.parse(raw) };
    } catch { /* first run */ }
    this.ready = true;
    console.log('[boz-mm] ready | career:', JSON.stringify(this.career));
  }

  private book(matchId: string): MMBook {
    let b = this.books.get(matchId);
    if (!b) { b = { mm: initMM(), lastOdds: null, settled: false }; this.books.set(matchId, b); }
    return b;
  }

  async onEvent(e: BozEvent): Promise<void> {
    if (!this.ready) return;

    if (e.type === 'MATCH_START') {
      this.books.set(e.matchId, { mm: initMM(), lastOdds: null, settled: false });
      return;
    }

    const b = this.book(e.matchId);

    if (e.type === 'ODDS_UPDATE' && e.odds) {
      b.mm = mmStep(b.mm, e.odds);
      b.lastOdds = e.odds;
      await this.publish(e.matchId, b, false);
    }

    if (e.type === 'MATCH_END' && b.lastOdds && !b.settled) {
      b.settled = true;
      // realise the book: mark inventory to the closing fair
      this.career.pnl += mmPnl(b.mm, b.lastOdds);
      this.career.fills += b.mm.fills;
      this.career.volume += b.mm.volume;
      this.career.edge += b.mm.edgeCaptured;
      this.career.matches += 1;
      await this.redis.set(MM_CAREER_KEY, JSON.stringify(this.career)).catch(() => {});
      console.log(`[boz-mm] SETTLED ${e.matchId} | fills=${b.mm.fills} vol=${b.mm.volume} ` +
        `pnl=${mmPnl(b.mm, b.lastOdds).toFixed(2)} edge=${b.mm.edgeCaptured.toFixed(2)} | career pnl=${this.career.pnl.toFixed(1)}`);
      await this.publish(e.matchId, b, true);
    }
  }

  private async publish(matchId: string, b: MMBook, settled: boolean): Promise<void> {
    const odds = b.lastOdds;
    if (!odds) return;
    const quotes = (b.mm.quotes ?? []).map(q => ({
      outcome: q.outcome as Outcome,
      fair: Number((q.fair * 100).toFixed(1)),
      bid: Number((q.bid * 100).toFixed(1)),
      ask: Number((q.ask * 100).toFixed(1)),
      inventory: q.inventory,
    }));
    const payload = {
      matchId, settled,
      pnl: Number(mmPnl(b.mm, odds).toFixed(2)),
      edge: Number(b.mm.edgeCaptured.toFixed(2)),
      fills: b.mm.fills,
      volume: b.mm.volume,
      exposure: mmExposure(b.mm),
      spreadPct: Number(mmSpreadPct(b.mm).toFixed(2)),
      quotes,
      career: this.career,
      ts: new Date().toISOString(),
    };
    await this.redis.publish(MM_CHANNEL, JSON.stringify(payload)).catch(() => {});
    await this.redis.set('boz:mm:last', JSON.stringify(payload), 'EX', 7200).catch(() => {});
  }
}
