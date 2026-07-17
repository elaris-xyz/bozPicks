import { connectOddsStream, connectScoresStream, txlineRest, buildPlayerMap } from '@bozpicks/txline-client';
import type { TxOddsPayload, TxScores, TxFixture, ResolvedPlayer } from '@bozpicks/txline-client';
import { oddsEventToBozEvent, scoresEventToBozEvent } from './normalizer';
import { publish, redis } from './publisher';
import { record, db } from './recorder';
import { pollDemoJobs } from './demoRunner';

console.log('[boz-ingest] starting...');

// ─── Load fixtures and start streams ────────────────────────────────────────

async function start() {
  // Get World Cup fixtures
  const fixtures = await txlineRest.fixtures();
  console.log(`[boz-ingest] ${fixtures.length} fixtures loaded`);

  // Publish match list to Redis + Postgres
  for (const f of fixtures) {
    const homeTeam = f.Participant1IsHome ? f.Participant1 : f.Participant2;
    const awayTeam = f.Participant1IsHome ? f.Participant2 : f.Participant1;
    const kickoffTime = new Date(f.StartTime).toISOString();

    // Redis
    await redis.hset(`boz:fixture:${f.FixtureId}`, {
      id: String(f.FixtureId), homeTeam, awayTeam,
      homeScore: 0, awayScore: 0, status: 'SCHEDULED',
      currentMinute: 0, kickoffTime,
    });

    // Postgres boz_matches
    await db.query(
      `INSERT INTO boz_matches (id, home_team, away_team, home_score, away_score, status, current_minute, kickoff_time, competition, competition_id)
       VALUES ($1,$2,$3,0,0,'SCHEDULED',0,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET home_team=$2, away_team=$3, kickoff_time=$4, competition=$5, competition_id=$6`,
      [String(f.FixtureId), homeTeam, awayTeam, kickoffTime, f.Competition ?? null, f.CompetitionId ?? null]
    );

    // Auto-create prediction pool
    await db.query(
      `INSERT INTO boz_pools (match_id, status, pool_home, pool_draw, pool_away, total_pool, fee_bps)
       VALUES ($1,'OPEN',0,0,0,0,200)
       ON CONFLICT (match_id) DO NOTHING`,
      [String(f.FixtureId)]
    );
  }
  await redis.set('boz:fixtures', JSON.stringify(fixtures), 'EX', 3600);
  console.log(`[boz-ingest] ${fixtures.length} fixtures synced to DB`);

  // team-name lookup per fixture — lets the normalizer attribute an event
  // (Participant 1|2) to the right side by name
  const fixtureNames: Record<string, { home: string; away: string }> = {};
  for (const f of fixtures) {
    fixtureNames[String(f.FixtureId)] = {
      home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
      away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
    };
  }

  // Per-fixture PlayerId → name/number map, built lazily from the fixture's
  // lineup records (which arrive in the scores snapshot). Resolving a goal/card/
  // sub's numeric PlayerId to "Mbappé · #10" needs these; without them the
  // normalizer falls back to "Player #<id>". Cached per fixture, refreshed at
  // most every 5 min while the match window is open (lineups can amend).
  const fixturePlayers: Record<string, Map<number, ResolvedPlayer>> = {};
  const playersFetchedAt: Record<string, number> = {};
  async function ensurePlayers(fixtureId: string): Promise<Map<number, ResolvedPlayer> | undefined> {
    const now = Date.now();
    if (fixturePlayers[fixtureId] && now - (playersFetchedAt[fixtureId] ?? 0) < 300_000) {
      return fixturePlayers[fixtureId];
    }
    try {
      const snaps = await txlineRest.scoresSnapshot(Number(fixtureId));
      const map = buildPlayerMap(Array.isArray(snaps) ? snaps : []);
      if (map.size > 0) { fixturePlayers[fixtureId] = map; playersFetchedAt[fixtureId] = now; }
      return fixturePlayers[fixtureId];
    } catch { return fixturePlayers[fixtureId]; }
  }

  // ── Scores SSE (global — all fixtures) ──────────────────────────────────
  const stopScores = connectScoresStream(undefined, {
    onMessage: async (scores: TxScores) => {
      const fid = String((scores as unknown as { FixtureId?: number }).FixtureId);
      const event = scoresEventToBozEvent(scores, fixtureNames[fid], await ensurePlayers(fid));
      if (!event) return;
      await Promise.all([publish(event), record(event)]);
      if (process.env.LOG_EVENTS === 'true') {
        console.log(`[SCORE] ${event.type} match=${event.matchId} min=${event.matchMinute}`);
      }
    },
    onHeartbeat: () => { /* silent */ },
    onError: (err) => console.error('[boz-ingest] scores SSE error:', err),
    onReconnect: (n) => console.warn(`[boz-ingest] scores reconnecting... attempt ${n}`),
  });

  // ── Odds SSE (global — all fixtures) ────────────────────────────────────
  const stopOdds = connectOddsStream(undefined, {
    onMessage: async (odds: TxOddsPayload) => {
      const event = oddsEventToBozEvent(odds);
      if (!event) return;
      await Promise.all([publish(event), record(event)]);
      if (process.env.LOG_EVENTS === 'true') {
        console.log(`[ODDS] match=${event.matchId}`);
      }
    },
    onHeartbeat: () => { /* silent */ },
    onError: (err) => console.error('[boz-ingest] odds SSE error:', err),
    onReconnect: (n) => console.warn(`[boz-ingest] odds reconnecting... attempt ${n}`),
  });

  console.log('[boz-ingest] connected to TxLINE scores + odds streams');

  // Command Bridge demo playback — runs here (not in the Vercel route) so a
  // multi-minute demo can genuinely take that long without a function timeout.
  void pollDemoJobs().catch(e => console.error('[boz-ingest] demo runner crashed:', e.message));

  // ── REST snapshot poller (belt-and-suspenders for the SSE stream) ────────
  // The global /api/scores/stream can sit connected-but-silent (heartbeats,
  // no data) even while a match is genuinely in play — seen both here and in
  // the TxLINE community chat. So we ALSO poll the per-fixture scores snapshot
  // over plain REST (the auth path we know works — it loaded the fixtures) for
  // any match whose kickoff has passed and isn't finished, and feed the new
  // records through the same normalizer/publisher. Dedupe by highest seq.
  const lastSeqByFixture: Record<string, number> = {};
  const kickoffMs: Record<string, number> = {};
  for (const f of fixtures) kickoffMs[String(f.FixtureId)] = new Date(f.StartTime).getTime();

  async function pollSnapshots() {
    const now = Date.now();
    for (const f of fixtures) {
      const id = String(f.FixtureId);
      const ko = kickoffMs[id];
      // window: kicked off, within 12h (so a recently-finished match backfills
      // once), and we haven't already recorded a final
      if (!ko || now < ko - 60_000 || now > ko + 12 * 3600_000) continue;
      const { rows } = await db.query(`SELECT status FROM boz_matches WHERE id=$1`, [id]).catch(() => ({ rows: [] }));
      if (rows[0]?.status === 'FINISHED') continue;
      try {
        const snaps = await txlineRest.scoresSnapshot(f.FixtureId);
        if (!Array.isArray(snaps) || snaps.length === 0) continue;
        // process in Seq order so the final (game_finalised) record lands last
        // and the match settles to FINISHED, not a mid-match tick
        snaps.sort((x, y) => ((x as unknown as { Seq?: number }).Seq ?? 0) - ((y as unknown as { Seq?: number }).Seq ?? 0));
        const seen = lastSeqByFixture[id] ?? 0;
        let maxSeq = seen;
        // this snapshot already contains the fixture's lineup records — build the
        // PlayerId→name map straight from it (no extra fetch) so goal/card/sub
        // events in the same batch resolve to real names
        const pmap = buildPlayerMap(snaps);
        if (pmap.size > 0) { fixturePlayers[id] = pmap; playersFetchedAt[id] = Date.now(); }
        // records are PascalCase — read Seq
        for (const s of snaps) {
          const seq = (s as unknown as { Seq?: number }).Seq ?? 0;
          if (seq <= seen) continue;
          maxSeq = Math.max(maxSeq, seq);
          const event = scoresEventToBozEvent(s, fixtureNames[id], fixturePlayers[id]);
          if (event) await Promise.all([publish(event), record(event)]);
        }
        lastSeqByFixture[id] = maxSeq;
        if (maxSeq > seen && process.env.LOG_EVENTS === 'true') {
          console.log(`[SNAPSHOT] ${id} caught up to seq=${maxSeq}`);
        }
      } catch (e) {
        console.error(`[boz-ingest] snapshot poll ${id}:`, (e as Error).message);
      }
    }
  }
  await pollSnapshots().catch(() => {});
  const snapTimer = setInterval(() => { void pollSnapshots(); }, 20_000);

  // ── Fixture-scoped scores streams (the real fix) ─────────────────────────
  // TxLINE confirmed: the GLOBAL /api/scores/stream stays connected but sends
  // no data for a given match — you must subscribe per fixture with
  // ?fixtureId=. (SL1 is 60s-delayed, SL12 real-time; scores are on both.) So
  // for every match inside its live window we open a dedicated scores stream
  // and tear it down when the window closes, keeping open connections to a
  // handful at most.
  const fixtureStreams: Record<string, () => void> = {};
  const fixtureOddsStreams: Record<string, () => void> = {};
  function manageFixtureStreams() {
    const now = Date.now();
    for (const f of fixtures) {
      const id = String(f.FixtureId);
      const ko = kickoffMs[id];
      const inWindow = !!ko && now >= ko - 5 * 60_000 && now <= ko + 3 * 3600_000;
      if (inWindow && !fixtureStreams[id]) {
        fixtureStreams[id] = connectScoresStream(f.FixtureId, {
          onMessage: async (scores: TxScores) => {
            const event = scoresEventToBozEvent(scores, fixtureNames[id], await ensurePlayers(id));
            if (!event) return;
            await Promise.all([publish(event), record(event)]);
            if (process.env.LOG_EVENTS === 'true') console.log(`[SCORE:${id}] ${event.type} min=${event.matchMinute}`);
          },
          onHeartbeat: () => { /* silent */ },
          onError: () => { /* watchdog/backoff in sse.ts handles it */ },
        });
        console.log(`[boz-ingest] opened fixture-scoped scores stream for ${id}`);
      } else if (!inWindow && fixtureStreams[id]) {
        fixtureStreams[id]();
        delete fixtureStreams[id];
        console.log(`[boz-ingest] closed fixture-scoped scores stream for ${id}`);
      }
      // odds have the same global-stream-goes-silent behaviour as scores — and
      // without in-play ODDS_UPDATEs the agent arena / sharp detector sit idle
      // during a real match. Same per-fixture subscription, same live window.
      if (inWindow && !fixtureOddsStreams[id]) {
        fixtureOddsStreams[id] = connectOddsStream(f.FixtureId, {
          onMessage: async (odds: TxOddsPayload) => {
            const event = oddsEventToBozEvent(odds);
            if (!event) return;
            await Promise.all([publish(event), record(event)]);
            if (process.env.LOG_EVENTS === 'true') console.log(`[ODDS:${id}] in-play tick`);
          },
          onHeartbeat: () => { /* silent */ },
          onError: () => { /* watchdog/backoff in sse.ts handles it */ },
        });
        console.log(`[boz-ingest] opened fixture-scoped odds stream for ${id}`);
      } else if (!inWindow && fixtureOddsStreams[id]) {
        fixtureOddsStreams[id]();
        delete fixtureOddsStreams[id];
        console.log(`[boz-ingest] closed fixture-scoped odds stream for ${id}`);
      }
    }
  }
  manageFixtureStreams();
  const fixtureMgrTimer = setInterval(manageFixtureStreams, 60_000);

  const shutdown = () => {
    stopScores(); stopOdds();
    clearInterval(snapTimer); clearInterval(fixtureMgrTimer);
    Object.values(fixtureStreams).forEach(stop => stop());
    Object.values(fixtureOddsStreams).forEach(stop => stop());
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

start().catch((err) => {
  console.error('[boz-ingest] startup error:', err.message);
  process.exit(1);
});
