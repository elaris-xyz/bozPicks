import Redis from 'ioredis';
import type { BozEvent, OddsSnapshot } from '@bozpicks/shared';
import { detectSharpMove } from './detector';
import { saveSignal, verifySignals } from './tracker';
import { Arena } from './arena';
import { txlineRest } from '@bozpicks/txline-client';

const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const arena = new Arena(redis);
const startTime = Date.now();
let signalCount = 0;

console.log('[boz-agent] starting event-driven sharp move detector + arena...');
void arena.init();

sub.psubscribe('boz:events:*', (err) => {
  if (err) { console.error('[boz-agent] subscribe error:', err); process.exit(1); }
  console.log('[boz-agent] subscribed to boz:events:*');
});

sub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
  const event = JSON.parse(message) as BozEvent;
  const matchId = event.matchId;

  // the two arena agents paper-trade every event autonomously
  await arena.onEvent(event);

  if (event.type === 'ODDS_UPDATE' && event.odds) {
    await handleOddsUpdate(matchId, event);
  }

  if (event.type === 'MATCH_END') {
    await handleMatchEnd(matchId);
  }
});

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

  const signal = detectSharpMove(matchId, current, history, context, lastEvent?.id);
  if (!signal) return;

  signalCount++;
  console.log(`[boz-agent] SIGNAL #${signalCount} | ${signal.affectedOutcome} ${signal.deltaPercent.toFixed(1)}% | ${signal.confidence}`);

  await saveSignal(signal);

  // push to UI via Redis pub/sub
  await redis.publish('boz:signals', JSON.stringify(signal));
}

async function handleMatchEnd(matchId: string): Promise<void> {
  try {
    const score = await txlineRest.score(matchId);
    const winner =
      score.homeScore > score.awayScore ? 'HOME' :
      score.awayScore > score.homeScore ? 'AWAY' : 'DRAW';
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
