import Redis from 'ioredis';
import type { BozEvent, OddsSnapshot } from '@bozpicks/shared';
import { detectSharpMove, DEFAULT_THRESHOLD, DEFAULT_WINDOW_MS } from './detector';
import { saveSignal, verifySignals } from './tracker';
import { Arena } from './arena';
import { MarketMaker } from './marketmaker';
import { txlineRest } from '@bozpicks/txline-client';

const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const arena = new Arena(redis);
const maker = new MarketMaker(redis);
const startTime = Date.now();
let signalCount = 0;

// Live-tunable detector config — the /agent page's sliders write here (via
// /api/agents/config) so a judge can actually move the knob and see it take
// effect within a few seconds, no redeploy. Falls back to the env defaults.
const CONFIG_KEY = 'boz:agent:config';
let liveThreshold = DEFAULT_THRESHOLD;
let liveWindowMs = DEFAULT_WINDOW_MS;
async function pollConfig(): Promise<void> {
  try {
    const raw = await redis.get(CONFIG_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw) as { threshold?: number; windowMs?: number };
    if (typeof cfg.threshold === 'number' && cfg.threshold > 0 && cfg.threshold <= 1) liveThreshold = cfg.threshold;
    if (typeof cfg.windowMs === 'number' && cfg.windowMs >= 30_000 && cfg.windowMs <= 600_000) liveWindowMs = cfg.windowMs;
  } catch { /* keep last known-good config */ }
}

console.log('[boz-agent] starting event-driven sharp move detector + arena + market maker...');
void arena.init();
void maker.init();
void pollConfig();
setInterval(() => { void pollConfig(); }, 5_000);

sub.psubscribe('boz:events:*', (err) => {
  if (err) { console.error('[boz-agent] subscribe error:', err); process.exit(1); }
  console.log('[boz-agent] subscribed to boz:events:*');
});

sub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
  const event = JSON.parse(message) as BozEvent;
  const matchId = event.matchId;

  // the two arena agents paper-trade every event autonomously
  await arena.onEvent(event);
  // the market maker quotes + books fills off the same feed (isolated so a
  // maker error can never take down the detector/arena)
  await maker.onEvent(event).catch(err => console.error('[boz-mm] event error:', (err as Error).message));

  if (event.type === 'ODDS_UPDATE' && event.odds) {
    await handleOddsUpdate(matchId, event);
  }

  if (event.type === 'MATCH_END') {
    await handleMatchEnd(matchId, event.score);
  }
});

// Cooldown per stance (match + outcome + direction). Without it the detector
// re-fires on EVERY odds tick while the delta stays above threshold, so one move
// produces thousands of near-duplicate signals (a real fixture logged 4,686,
// milliseconds apart). Mirrors the backfill's 3-minute per-stance cooldown.
const SHARP_COOLDOWN_MS = parseInt(process.env.SHARP_COOLDOWN_MS ?? '180000', 10);
const lastFired = new Map<string, number>();

async function handleOddsUpdate(matchId: string, event: BozEvent): Promise<void> {
  const current = event.odds!;

  // get odds history from Redis
  const raw = await redis.lrange(`boz:match:${matchId}:odds`, 0, 49);
  const history: OddsSnapshot[] = raw.map((r) => JSON.parse(r) as OddsSnapshot);

  // get match context (last event for correlated reason)
  const lastEventRaw = await redis.get(`boz:match:${matchId}:lastEvent`);
  const lastEvent = lastEventRaw ? JSON.parse(lastEventRaw) as BozEvent : null;
  const context = lastEvent
    ? `${lastEvent.type} min ${lastEvent.matchMinute}${lastEvent.team ? ` (${lastEvent.team})` : ''}`
    : 'Odds shift detected';

  const signal = detectSharpMove(matchId, current, history, context, lastEvent?.id, liveThreshold, liveWindowMs);
  if (!signal) return;

  // de-flood: one signal per stance per cooldown window
  const stance = `${matchId}:${signal.affectedOutcome}:${signal.deltaPercent >= 0 ? '+' : '-'}`;
  const now = Date.now();
  if (now - (lastFired.get(stance) ?? -Infinity) < SHARP_COOLDOWN_MS) return;
  lastFired.set(stance, now);

  signalCount++;
  console.log(`[boz-agent] SIGNAL #${signalCount} | ${signal.affectedOutcome} ${signal.deltaPercent.toFixed(1)}% | ${signal.confidence}`);

  await saveSignal(signal);

  // push to UI via Redis pub/sub
  await redis.publish('boz:signals', JSON.stringify(signal));
}

async function handleMatchEnd(matchId: string, finalScore?: { home: number; away: number }): Promise<void> {
  try {
    let homeScore: number, awayScore: number;
    if (matchId.startsWith('demo-')) {
      // demo matches aren't real TxLINE fixtures — the REST score lookup
      // below 404s for them every time, which silently skipped
      // verifySignals for every demo signal forever (outcome_verified stuck
      // false, accuracy permanently "—"). The MATCH_END event already
      // carries the final score from our own replay engine — use it.
      if (!finalScore) return;
      homeScore = finalScore.home; awayScore = finalScore.away;
    } else {
      const score = await txlineRest.score(matchId);
      homeScore = score.homeScore; awayScore = score.awayScore;
    }
    const winner =
      homeScore > awayScore ? 'HOME' :
      awayScore > homeScore ? 'AWAY' : 'DRAW';
    await verifySignals(matchId, winner);
    console.log(`[boz-agent] signals verified for match ${matchId} — winner: ${winner}`);
  } catch (err) {
    console.error(`[boz-agent] could not verify signals for ${matchId}:`, err);
  }
}

// heartbeat / sanity check every 5 minutes
setInterval(() => {
  const uptimeMin = Math.floor((Date.now() - startTime) / 60_000);
  console.log(`[boz-agent] heartbeat | uptime: ${uptimeMin}m | signals: ${signalCount}`);
}, 5 * 60 * 1000);

process.on('SIGTERM', () => { sub.disconnect(); redis.disconnect(); process.exit(0); });
process.on('SIGINT', () => { sub.disconnect(); redis.disconnect(); process.exit(0); });
