/**
 * One-off backfill: re-ingest a FINISHED fixture's full event history with the
 * current normalizer + lineup resolver, so stored events get real player names
 * (goalscorer/card/sub). Past fixtures were ingested before player-name
 * resolution existed, leaving their timelines nameless. This fetches the TxLINE
 * scores snapshot, builds the PlayerId→name map from the lineup records, and
 * REPLACES the fixture's boz_events + boz_replay_events with a clean, complete,
 * named set (in Seq order, with synthetic playback delays for replay).
 *
 * Usage:  pnpm --dir apps/ingest tsx src/backfill.ts <fixtureId> [<fixtureId> …]
 */
import { Pool } from 'pg';
import Redis from 'ioredis';
import { txlineRest, buildPlayerMap } from '@bozpicks/txline-client';
import type { TxScores, TxOddsPayload } from '@bozpicks/txline-client';
import { scoresEventToBozEvent, oddsEventToBozEvent, statDeltaEvents, type SideCounts } from './normalizer';
import type { BozEvent } from '@bozpicks/shared';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 2 });
// swallow connection errors — Redis only backs the optional odds-list write at
// the very end; an unreachable Redis must never crash the run or wipe the DB
// commit (which lands before it). Without a listener ioredis' 'error' throws.
redis.on('error', () => {});

/**
 * The fixture's real in-play odds history, normalised to ODDS_UPDATE events.
 * Without these a real match's page is missing everything odds-derived that the
 * demo shows: the Match Odds panel, Odds Movement, and Turning Points (which
 * pairs each big implied-probability swing with the pitch event that caused
 * it). TxLINE returns ~60k odds records per fixture across every bookmaker and
 * market, so we keep only in-play 1X2 (what oddsEventToBozEvent accepts) and
 * then thin to at most one tick per minute — enough to draw an honest curve
 * without burying the timeline in thousands of near-identical rows.
 */
async function fetchOddsEvents(fixtureId: string, kickoffMs: number): Promise<BozEvent[]> {
  let raw: TxOddsPayload[] = [];
  try { raw = await txlineRest.oddsUpdates(Number(fixtureId)); } catch { return []; }
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const events: BozEvent[] = [];
  const seenMinute = new Set<number>();
  const sorted = [...raw].sort((a, b) => (a.Ts ?? 0) - (b.Ts ?? 0));
  for (const o of sorted) {
    const e = oddsEventToBozEvent(o, kickoffMs);  // filters to in-play 1X2 for us
    if (!e) continue;
    if (seenMinute.has(e.matchMinute)) continue;  // one tick a minute
    seenMinute.add(e.matchMinute);
    events.push(e);
  }
  console.log(`[backfill] ${fixtureId}: ${raw.length} odds records -> ${events.length} in-play 1X2 ticks`);
  return events;
}

async function backfillFixture(fixtureId: string): Promise<void> {
  console.log(`\n[backfill] ${fixtureId} …`);

  // team names for event attribution — try the fixtures feed first, then fall
  // back to our own boz_matches (a past fixture won't be in the current
  // fixtures snapshot, but we ingested its name when it was live)
  let names: { home: string; away: string } | undefined;
  try {
    const fixtures = await txlineRest.fixtures();
    const f = fixtures.find(x => String(x.FixtureId) === fixtureId);
    if (f) names = {
      home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
      away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
    };
  } catch { /* fall through to the DB */ }
  if (!names) {
    const { rows } = await db.query<{ home_team: string; away_team: string }>(
      `SELECT home_team, away_team FROM boz_matches WHERE id=$1`, [fixtureId]);
    if (rows[0]) names = { home: rows[0].home_team, away: rows[0].away_team };
  }

  // kickoff anchors the odds ticks to a match minute (they carry no clock)
  const { rows: koRows } = await db.query<{ ko: Date }>(
    `SELECT kickoff_time AS ko FROM boz_matches WHERE id=$1`, [fixtureId]);
  const kickoffMs = koRows[0]?.ko ? new Date(koRows[0].ko).getTime() : 0;

  // THE COMPLETE match history via the SSE updates endpoint (~900+ records) —
  // snapshot only returns the last ~40, which misses earlier goals (England's
  // 54' + Argentina's 84' were absent, leaving a timeline with one goal for a
  // 1-2 result). The lineup records live in the snapshot, so fetch both and
  // build the player map from whichever has them.
  let records: TxScores[] = [];
  try { records = await txlineRest.scoresUpdatesFull(Number(fixtureId)); } catch { /* fall back below */ }
  const snap = await txlineRest.scoresSnapshot(Number(fixtureId)).catch(() => [] as TxScores[]);
  if (!Array.isArray(records) || records.length < (Array.isArray(snap) ? snap.length : 0)) {
    records = Array.isArray(snap) ? snap : [];
  }
  if (records.length === 0) { console.warn(`[backfill] ${fixtureId}: no records`); return; }

  // lineups arrive in the snapshot; the updates stream may also carry them
  const players = buildPlayerMap([...(Array.isArray(snap) ? snap : []), ...records]);
  console.log(`[backfill] ${fixtureId}: ${records.length} records · ${players.size} player ids mapped`);

  // normalize in Seq order so the timeline + score progression are monotonic
  const sorted = [...records].sort((a, b) =>
    ((a as unknown as { Seq?: number }).Seq ?? 0) - ((b as unknown as { Seq?: number }).Seq ?? 0));

  const raw = sorted
    .map(r => scoresEventToBozEvent(r, names, players))
    .filter((e): e is NonNullable<typeof e> => !!e);

  // TxLINE emits several records per real goal (pre-increment lag, the
  // increment, then a duplicate) — the full history has 9 "goal" records for 3
  // actual goals. Collapse them: keep one GOAL per time the total score
  // actually advances, preferring the copy that carries a resolved player name.
  const goalDeduped: typeof raw = [];
  let lastGoalTotal = 0; // pre-match; a lag record showing 0-0 must not emit
  for (const e of raw) {
    if (e.type !== 'GOAL') { goalDeduped.push(e); continue; }
    const total = (e.score?.home ?? 0) + (e.score?.away ?? 0);
    const prev = goalDeduped[goalDeduped.length - 1];
    if (total > lastGoalTotal) {
      goalDeduped.push(e); lastGoalTotal = total;
    } else if (prev?.type === 'GOAL' && total === lastGoalTotal && total > 0) {
      // same goal, another copy — upgrade to the one with a real player name
      const hasName = (x?: { player?: string }) => !!x?.player && !x.player.startsWith('Player #');
      if (hasName(e) && !hasName(prev)) goalDeduped[goalDeduped.length - 1] = e;
    }
  }

  // Keep only meaningful moments — drop routine possession/danger ticks
  // (SCORE_UPDATE) and low-signal chatter, so the timeline reads like the demo:
  // goals, cards, subs, penalties, VAR, corners, shots, offsides, kickoff/HT/FT.
  const KEEP = new Set(['GOAL', 'PENALTY', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION',
    'VAR', 'CORNER', 'SHOT', 'OFFSIDE', 'MATCH_START', 'HALFTIME', 'MATCH_END']);

  // Corners + cards come from cumulative-stat increments, not the sparse action
  // records (which classifyReal no longer maps). Fold statDeltaEvents over the
  // same Seq-ordered records so every corner/card the final stats claim appears
  // on the timeline, at the minute its total advanced.
  let statCounts: SideCounts | undefined;
  const statEvents: BozEvent[] = [];
  for (const rec of sorted) {
    const res = statDeltaEvents(statCounts, rec, names, players);
    statCounts = res.counts;
    statEvents.push(...res.events);
  }

  const scoreEvents = [...goalDeduped.filter(e => KEEP.has(e.type)), ...statEvents];

  // Merge in the real in-play odds ticks, interleaved by minute. These are what
  // the Match Odds panel, Odds Movement and Turning Points all read — a real
  // fixture had none of them without this.
  const oddsEvents = kickoffMs ? await fetchOddsEvents(fixtureId, kickoffMs) : [];
  const meaningful = [...scoreEvents, ...oddsEvents].sort((a, b) => {
    const d = (a.matchMinute || 0) - (b.matchMinute || 0);
    if (d !== 0) return d;
    // within a minute: odds tick after the pitch event that moved it, so
    // Turning Points can attribute the swing to the goal/card that caused it
    return (a.type === 'ODDS_UPDATE' ? 1 : 0) - (b.type === 'ODDS_UPDATE' ? 1 : 0);
  });

  // Anchor the timeline at kick-off: the snapshot rarely includes a 1st-half
  // kickoff record, so the earliest event is often mid-match (a 19' penalty).
  // Prepend a synthetic MATCH_START at 0' (0-0) so the timeline + momentum span
  // the whole match from the start, and ensure a MATCH_END closes it.
  const events = [...meaningful];
  if (!events.some(e => e.type === 'MATCH_START')) {
    const first = events[0];
    events.unshift({
      id: `${fixtureId}-synth-kickoff`,
      matchId: fixtureId,
      type: 'MATCH_START',
      timestamp: first?.timestamp ?? new Date().toISOString(),
      matchMinute: 0,
      score: { home: 0, away: 0 },
      seq: -1,
      stats: first?.stats,
      rawPayload: { synthetic: 'kickoff' },
    } as NonNullable<typeof first>);
  }

  // de-dupe by event id (the full history can carry repeated record Ids; a
  // batched INSERT ... ON CONFLICT can't touch the same id twice) — keep the
  // last occurrence, which has the most up-to-date payload
  const byId = new Map<string, (typeof events)[number]>();
  for (const e of events) byId.set(String((e as unknown as { id: string }).id), e);
  const deduped = [...byId.values()];

  // Clamp every event's score to the FINAL — in soccer the score only ever
  // increases, so the final is the max, and any in-play value above it is
  // TxLINE noise (the few records right after a VAR overturn transiently show
  // the disallowed goal, e.g. France v Spain seq 641-644 flash 0-3 before
  // settling to 0-2). This guarantees no event ever shows a score above the
  // real result.
  const end = deduped.find(e => e.type === 'MATCH_END');
  const finalH = end?.score?.home ?? Math.max(0, ...deduped.map(e => e.score?.home ?? 0));
  const finalA = end?.score?.away ?? Math.max(0, ...deduped.map(e => e.score?.away ?? 0));
  for (const e of deduped) {
    if (e.score) e.score = { home: Math.min(e.score.home, finalH), away: Math.min(e.score.away, finalA) };
  }

  let named = 0;
  for (const e of deduped) if (e.player && !e.player.startsWith('Player #') && !e.player.includes('?')) named++;
  console.log(`[backfill] ${fixtureId}: ${deduped.length} events (${raw.length - meaningful.length} routine ticks dropped) · ${named} named`);

  // Play back in Seq order (= the order we normalized in), NOT by matchMinute:
  // a late-Seq finalisation record or a clock glitch can carry a high minute
  // with an early/low running score, so minute-based delays would replay the
  // score out of order. Seq order keeps the score progression correct.
  const span = 90_000;
  const denom = Math.max(1, deduped.length - 1);

  // Batched multi-row inserts — per-event round-trips to Neon (2 × N queries)
  // were slow enough to time the backfill out; one INSERT per table is ~50×
  // fewer round-trips.
  const evCols: unknown[] = [], evPlace: string[] = [];
  const rpCols: unknown[] = [], rpPlace: string[] = [];
  deduped.forEach((e, i) => {
    const delayMs = Math.round((i / denom) * span);
    const j = e as unknown as { id: string; type: string; matchMinute: number; timestamp: string };
    const b = evCols.length;
    evPlace.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
    evCols.push(j.id, fixtureId, j.type, j.matchMinute, j.timestamp, JSON.stringify(e));
    const c = rpCols.length;
    rpPlace.push(`($${c + 1},$${c + 2},NOW(),$${c + 3},$${c + 4})`);
    rpCols.push(j.id, fixtureId, delayMs, JSON.stringify(e));
  });

  // Safety: never let an empty fetch (fixture aged out of TxLINE, transient API
  // hiccup) wipe a match's existing timeline. Only replace when we actually
  // rebuilt something.
  if (deduped.length === 0) {
    console.warn(`[backfill] ${fixtureId}: 0 events rebuilt — leaving existing events untouched`);
    return;
  }

  await db.query('BEGIN');
  try {
    await db.query(`DELETE FROM boz_events        WHERE match_id=$1`, [fixtureId]);
    await db.query(`DELETE FROM boz_replay_events WHERE match_id=$1`, [fixtureId]);
    if (evPlace.length) {
      await db.query(
        `INSERT INTO boz_events (id, match_id, type, match_minute, timestamp, payload) VALUES ${evPlace.join(',')}
         ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, match_minute=EXCLUDED.match_minute`, evCols);
      await db.query(
        `INSERT INTO boz_replay_events (id, match_id, recorded_at, delay_ms, payload) VALUES ${rpPlace.join(',')}
         ON CONFLICT (id) DO UPDATE SET delay_ms=EXCLUDED.delay_ms, payload=EXCLUDED.payload`, rpCols);
    }
    await db.query('COMMIT');

    // The Match Odds panel and the Odds Movement sparklines don't read
    // boz_events — they read the Redis odds list (/api/matches/[id]/odds and
    // the page's own lindex). Without this the odds are in the timeline but
    // those two panels stay empty. Newest-first, matching what the live
    // publisher writes; capped like the live path.
    if (oddsEvents.length) {
      const key = `boz:match:${fixtureId}:odds`;
      const snaps = oddsEvents.map(e => JSON.stringify(e.odds));
      await redis.del(key).catch(() => {});
      await redis.rpush(key, ...snaps.reverse()).catch(() => {});  // index 0 = latest
      await redis.ltrim(key, 0, 199).catch(() => {});
      await redis.expire(key, 60 * 60 * 24 * 30).catch(() => {});
      console.log(`[backfill] ${fixtureId}: ${snaps.length} odds snapshots cached for the odds panels`);
    }

    // Sharp signals — the SAME detector math the live agent runs (relative
    // implied-prob shift vs a ~2-minute-earlier baseline, threshold 10%,
    // HIGH ≥20% / MEDIUM ≥15%), just run over the recorded odds series: an
    // honest backtest. During these fixtures' live windows the agent received
    // no per-fixture odds (that ingest fix landed later), so their pages had
    // no signals at all while every demo did. Each signal is graded against
    // the REAL final result immediately — which also feeds the /agent accuracy
    // stats with genuine match data instead of only demo runs.
    if (oddsEvents.length >= 3) {
      const winner = finalH > finalA ? 'HOME' : finalA > finalH ? 'AWAY' : 'DRAW';
      const THRESH = 0.10;
      const keys = [['home', 'HOME'], ['draw', 'DRAW'], ['away', 'AWAY']] as const;
      type Sig = { minute: number; outcome: string; delta: number; conf: string; accurate: boolean; before: unknown; after: unknown; ts: string };
      const sigs: Sig[] = [];
      const lastFired: Record<string, number> = {};
      for (let i = 2; i < oddsEvents.length; i++) {
        const cur = oddsEvents[i], base = oddsEvents[i - 2]; // ticks are 1/min → ~2-min window
        if (!cur.odds || !base.odds) continue;
        for (const [k, label] of keys) {
          const before = base.odds.impliedProb[k], after = cur.odds.impliedProb[k];
          if (!before) continue;
          const delta = (after - before) / before;
          if (Math.abs(delta) < THRESH) continue;
          const dirKey = `${label}:${delta > 0 ? '+' : '-'}`;
          if (cur.matchMinute - (lastFired[dirKey] ?? -10) < 3) continue; // 3-min cooldown per stance
          lastFired[dirKey] = cur.matchMinute;
          const accurate = delta > 0 ? label === winner : label !== winner;
          sigs.push({
            minute: cur.matchMinute, outcome: label, delta: delta * 100,
            conf: Math.abs(delta) >= 0.20 ? 'HIGH' : Math.abs(delta) >= 0.15 ? 'MEDIUM' : 'LOW',
            accurate, before: base.odds, after: cur.odds, ts: cur.timestamp,
          });
          break; // one signal per tick, like the live detector
        }
      }
      await db.query(`DELETE FROM boz_signals WHERE match_id=$1`, [fixtureId]).catch(() => {});
      for (const s of sigs) {
        await db.query(
          `INSERT INTO boz_signals (id, match_id, type, detected_at, odds_before, odds_after,
             delta_percent, affected_outcome, confidence, context, outcome_verified, was_accurate,
             verified_at, verification_source)
           VALUES (gen_random_uuid(), $1, 'SHARP_MOVE', $2, $3, $4, $5, $6, $7, $8, true, $9, NOW(), 'TXLINE_FINAL')`,
          [fixtureId, s.ts, JSON.stringify(s.before), JSON.stringify(s.after),
           s.delta, s.outcome, s.conf, `Backtest · recorded TxLINE odds · min ${s.minute}'`, s.accurate]
        ).catch(e => console.warn(`[backfill] signal insert: ${(e as Error).message}`));
      }
      const acc = sigs.length ? Math.round(sigs.filter(s => s.accurate).length / sigs.length * 100) : 0;
      console.log(`[backfill] ${fixtureId}: ${sigs.length} sharp signals (backtest) · ${acc}% accurate vs real result`);
    }
    console.log(`[backfill] ${fixtureId}: DONE ✓`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(`[backfill] ${fixtureId}: FAILED —`, (err as Error).message);
  }
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) { console.error('usage: tsx src/backfill.ts <fixtureId> …'); process.exit(1); }
  for (const id of ids) await backfillFixture(id);
  await redis.quit().catch(() => {});
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
