import type Redis from 'ioredis';
import type { BozEvent, OddsSnapshot, AgentId, AgentState } from '@bozpicks/shared';
import {
  initAgent, evaluate, settleAgent, resultFrom, markToMarket, winRate, avgClv,
} from '@bozpicks/shared';

/**
 * Headless Agent-vs-Agent Arena. This is the REAL autonomous process for
 * Track 3: it consumes the live TxLINE event stream (via Redis pub/sub, same
 * feed the UI sees), opens paper positions on every significant price move,
 * settles at full-time, and compounds career P&L in Redis — no browser needed.
 * The web Arena is a mirror of this, running the identical shared strategy core.
 */

const CAREER_KEY = 'boz:arena:career';        // durable career P&L (survives restarts)
const ARENA_CHANNEL = 'boz:arena';            // live state for any UI to subscribe

type Career = Record<AgentId, { pnl: number; bets: number; wins: number }>;
const zeroCareer = (): Career => ({
  MOMENTUM: { pnl: 0, bets: 0, wins: 0 },
  CONTRARIAN: { pnl: 0, bets: 0, wins: 0 },
});

interface MatchBook {
  agents: Record<AgentId, AgentState>;
  prevOdds: OddsSnapshot | null;
  lastOdds: OddsSnapshot | null;
  score: { home: number; away: number };
  settled: boolean;
}

export class Arena {
  private books = new Map<string, MatchBook>();
  private career: Career = zeroCareer();
  private ready = false;

  constructor(private redis: Redis) {}

  /** Load persisted career P&L so the tournament standings survive restarts. */
  async init(): Promise<void> {
    try {
      const raw = await this.redis.get(CAREER_KEY);
      if (raw) this.career = { ...zeroCareer(), ...JSON.parse(raw) };
    } catch { /* first run */ }
    this.ready = true;
    console.log('[boz-arena] ready | career:', JSON.stringify(this.career));
  }

  private book(matchId: string): MatchBook {
    let b = this.books.get(matchId);
    if (!b) {
      b = {
        agents: { MOMENTUM: initAgent('MOMENTUM'), CONTRARIAN: initAgent('CONTRARIAN') },
        prevOdds: null, lastOdds: null, score: { home: 0, away: 0 }, settled: false,
      };
      this.books.set(matchId, b);
    }
    return b;
  }

  /** Feed one event from the live stream into both agents. */
  async onEvent(e: BozEvent): Promise<void> {
    if (!this.ready) return;
    const b = this.book(e.matchId);

    if (e.type === 'MATCH_START') {
      // fresh per-match books (career persists)
      this.books.set(e.matchId, {
        agents: { MOMENTUM: initAgent('MOMENTUM'), CONTRARIAN: initAgent('CONTRARIAN') },
        prevOdds: null, lastOdds: null, score: { home: 0, away: 0 }, settled: false,
      });
      return;
    }

    if (e.score) b.score = e.score;

    if (e.type === 'ODDS_UPDATE' && e.odds) {
      const next = e.odds;
      if (b.prevOdds) {
        const d = evaluate(b.prevOdds, next, e.matchMinute);
        if (d.MOMENTUM) b.agents.MOMENTUM = { ...b.agents.MOMENTUM, open: [...b.agents.MOMENTUM.open, d.MOMENTUM] };
        if (d.CONTRARIAN) b.agents.CONTRARIAN = { ...b.agents.CONTRARIAN, open: [...b.agents.CONTRARIAN.open, d.CONTRARIAN] };
        if (d.MOMENTUM || d.CONTRARIAN) {
          console.log(`[boz-arena] ${e.matchId} min ${e.matchMinute} | ` +
            `M:${d.MOMENTUM?.outcome ?? '—'} C:${d.CONTRARIAN?.outcome ?? '—'}`);
        }
      }
      b.prevOdds = next;
      b.lastOdds = next;
      await this.publish(e.matchId, b, next);
    }

    if (e.type === 'MATCH_END' && b.lastOdds && !b.settled) {
      b.settled = true;
      const result = resultFrom(b.score.home, b.score.away);
      const closing = b.lastOdds;
      const before = { ...b.agents };
      b.agents = {
        MOMENTUM: settleAgent(before.MOMENTUM, result, closing),
        CONTRARIAN: settleAgent(before.CONTRARIAN, result, closing),
      };
      for (const id of ['MOMENTUM', 'CONTRARIAN'] as AgentId[]) {
        this.career[id].pnl += b.agents[id].realizedPnl - before[id].realizedPnl;
        this.career[id].bets += b.agents[id].settled.length - before[id].settled.length;
        this.career[id].wins += b.agents[id].settled.filter(x => x.won).length - before[id].settled.filter(x => x.won).length;
      }
      await this.redis.set(CAREER_KEY, JSON.stringify(this.career)).catch(() => {});
      console.log(`[boz-arena] SETTLED ${e.matchId} result=${result} | ` +
        `M pnl=${this.career.MOMENTUM.pnl.toFixed(1)} C pnl=${this.career.CONTRARIAN.pnl.toFixed(1)}`);
      await this.publish(e.matchId, b, closing);
    }
  }

  /** Publish a compact live snapshot any UI can subscribe to. */
  private async publish(matchId: string, b: MatchBook, odds: OddsSnapshot): Promise<void> {
    const snap = (id: AgentId) => ({
      id,
      open: b.agents[id].open.length,
      livePnl: Number(markToMarket(b.agents[id], odds).toFixed(2)),
      winRate: Number(winRate(b.agents[id]).toFixed(1)),
      clv: Number(avgClv(b.agents[id]).toFixed(2)),
      career: this.career[id],
    });
    const payload = { matchId, settled: b.settled, agents: { MOMENTUM: snap('MOMENTUM'), CONTRARIAN: snap('CONTRARIAN') }, ts: new Date().toISOString() };
    await this.redis.publish(ARENA_CHANNEL, JSON.stringify(payload)).catch(() => {});
  }
}
