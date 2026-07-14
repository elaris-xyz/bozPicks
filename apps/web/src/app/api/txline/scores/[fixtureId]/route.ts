import { NextRequest, NextResponse } from 'next/server';
import { txlineRest } from '@bozpicks/txline-client';

export const dynamic = 'force-dynamic';

/**
 * Diagnostic: does TxLINE actually have score data for a given fixture?
 * Pulls the historical sequence + the latest snapshot and returns a summary
 * (record counts, distinct actions, final score if present). Pure read — no
 * DB writes. Used to verify the real-data path end to end on a finished match
 * before relying on it for a live one.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const id = Number(fixtureId);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'bad fixtureId' }, { status: 400 });

  const started = Date.now();
  try {
    const [historical, snapshot] = await Promise.all([
      txlineRest.scoresHistorical(id).catch((e: Error) => ({ __err: e.message })),
      txlineRest.scoresSnapshot(id).catch((e: Error) => ({ __err: e.message })),
    ]);

    const summarize = (rows: unknown) => {
      if (!Array.isArray(rows)) return { error: (rows as { __err?: string })?.__err ?? 'not an array' };
      const actions: Record<string, number> = {};
      let lastState = '', lastScore = '', lastMinute = 0;
      for (const r of rows as Array<Record<string, unknown>>) {
        const a = String(r.action ?? 'unknown');
        actions[a] = (actions[a] ?? 0) + 1;
        if (r.gameState) lastState = String(r.gameState);
        const d = (r.data ?? r.dataSoccer) as { Minutes?: number } | undefined;
        if (typeof d?.Minutes === 'number') lastMinute = d.Minutes;
        const s = (r.score ?? {}) as { participant1?: { Goals?: number }; participant2?: { Goals?: number } };
        const ss = (r.scoreSoccer ?? {}) as { Participant1?: { Goals?: number }; Participant2?: { Goals?: number } };
        const h = s.participant1?.Goals ?? ss.Participant1?.Goals;
        const aw = s.participant2?.Goals ?? ss.Participant2?.Goals;
        if (typeof h === 'number' && typeof aw === 'number') lastScore = `${h}-${aw}`;
      }
      return { records: rows.length, actions, lastState, lastScore, lastMinute };
    };

    return NextResponse.json({
      ok: true,
      fixtureId: id,
      latencyMs: Date.now() - started,
      historical: summarize(historical),
      snapshot: summarize(snapshot),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
