import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import Link from 'next/link';
import type { MatchState, OddsSnapshot } from '@bozpicks/shared';
import { Flag } from '@/components/ui/Flag';
import { IconBolt, IconSparkles, IconChain, IconData } from '@/components/ui/Icons';
import { Marquee } from '@/components/ui/Marquee';

export const dynamic = 'force-dynamic';

async function getLiveMatches(): Promise<MatchState[]> {
  try {
    const { rows } = await db.query(`
      SELECT id, home_team, away_team, home_score, away_score,
             status, current_minute, kickoff_time
      FROM boz_matches
      WHERE status IN ('LIVE','HALFTIME')
      ORDER BY kickoff_time ASC
      LIMIT 6
    `);
    // odds are an optional Redis cache — a Redis outage must not wipe out the
    // match list that Postgres already returned (see page.tsx for the same fix)
    const oddsRaw: (string | null)[] = await Promise.all(
      rows.map(r => redis.lindex(`boz:match:${r.id}:odds`, 0).catch(() => null))
    ).catch(() => rows.map(() => null));
    return rows.map((r, i) => ({
      id: r.id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score ?? 0,
      awayScore: r.away_score ?? 0,
      status: r.status,
      currentMinute: r.current_minute ?? 0,
      kickoffTime: r.kickoff_time,
      lastUpdated: new Date().toISOString(),
      currentOdds: oddsRaw[i] ? (JSON.parse(oddsRaw[i]!) as OddsSnapshot) : undefined,
    }));
  } catch { return []; }
}

async function getCounts() {
  try {
    const [matches, signals] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM boz_matches`),
      db.query(`SELECT COUNT(*) FROM boz_signals`),
    ]);
    return {
      matches: Number(matches.rows[0].count),
      signals: Number(signals.rows[0].count),
    };
  } catch { return { matches: 0, signals: 0 }; }
}

export default async function PicksPage() {
  const [liveMatches, counts] = await Promise.all([getLiveMatches(), getCounts()]);

  return (
    <div className="theme-picks space-y-8">

      {/* ── Hero ── */}
      <div className="glass hero-glow relative overflow-hidden p-8 md:p-12 text-center">
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'linear-gradient(90deg,transparent,rgb(var(--accent)),transparent)' }} />

        <div className="relative inline-flex mb-4">
          <span className="chip-glass uppercase">Track 2 — Consumer &amp; Fan Experiences</span>
        </div>

        <h1 className="font-display relative text-3xl md:text-5xl font-bold tracking-tight mb-3">
          Pick smart.<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--blue), #7dd3fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Watch live.</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
          Real-time World Cup intelligence powered by TxLINE — live scores, shifting odds,
          AI analysis, and on-chain predictions.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 relative">
          <Link href="/" className="btn-accent justify-center">Watch Live Matches →</Link>
          <Link href="/leaderboard" className="btn-ghost justify-center">View Leaderboard</Link>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-center gap-8 mt-10 pt-6"
             style={{ borderTop: '1px solid var(--glass-border)' }}>
          {[
            { value: counts.matches, label: 'World Cup Matches', color: 'var(--blue)' },
            { value: counts.signals, label: 'Sharp Signals', color: 'var(--amber)' },
            { value: liveMatches.length, label: 'Live Now', color: 'var(--green)' },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-center">
              <p className="stat-display text-2xl md:text-3xl" style={{ color }}>{value}</p>
              <p className="section-label mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* brand strip */}
      <Marquee items={[
        'Live World Cup Odds', 'AI Event Analysis', 'On-Chain Predictions',
        'TxLINE Data Feed', 'Sub-Second Latency', 'Solana Devnet',
      ]} />

      {/* ── Live now ── */}
      {liveMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full badge-live" style={{ background: 'var(--green)' }} />
            <p className="section-label" style={{ color: 'var(--green)' }}>
              Live Now — {liveMatches.length} match{liveMatches.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {liveMatches.map(m => (
              <Link key={m.id} href={`/match/${m.id}`}
                className="glass p-4 rounded-2xl hover:border-blue-500/40 transition-all hover:scale-[1.01] block"
                style={{ borderColor: 'var(--glass-border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <p className="font-bold text-sm truncate">{m.homeTeam}</p>
                    <Flag team={m.homeTeam} size="sm" className="flex-shrink-0" />
                  </div>
                  <div className="text-center px-3">
                    <p className="text-xl font-black tabular-nums">
                      {m.homeScore}
                      <span className="text-gray-600 mx-1.5">–</span>
                      {m.awayScore}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="w-1 h-1 rounded-full badge-live" style={{ background: 'var(--green)' }} />
                      <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--green)' }}>
                        {m.status === 'HALFTIME' ? 'HT' : `${m.currentMinute}'`}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-start gap-2">
                    <Flag team={m.awayTeam} size="sm" className="flex-shrink-0" />
                    <p className="font-bold text-sm truncate">{m.awayTeam}</p>
                  </div>
                </div>
                {m.currentOdds && (
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3"
                       style={{ borderTop: '1px solid var(--glass-border)' }}>
                    {[
                      { label: '1', val: m.currentOdds.homeWin, color: 'var(--green)' },
                      { label: 'X', val: m.currentOdds.draw,    color: '#9ca3af' },
                      { label: '2', val: m.currentOdds.awayWin, color: 'var(--blue)' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center">
                        <p className="text-[9px] text-gray-600">{label}</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color }}>{val.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Feature grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: <IconBolt size={20} />,
            title: 'Real-Time Feed',
            desc: 'Goals, cards, odds shifts — streamed live from TxLINE with sub-second latency via SSE.',
            color: 'var(--amber)',
          },
          {
            icon: <IconSparkles size={20} />,
            title: 'AI Analysis',
            desc: 'Claude Haiku explains every significant event and its market impact in plain language.',
            color: 'var(--blue)',
          },
          {
            icon: <IconChain size={20} />,
            title: 'On-Chain Predictions',
            desc: 'Parimutuel pools on Solana devnet. Connect Phantom, pick your outcome, verify on Explorer.',
            color: 'var(--green)',
          },
        ].map(({ icon, title, desc, color }) => (
          <div key={title} className="glass glass-hover p-5 rounded-2xl space-y-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
              {icon}
            </div>
            <h3 className="font-bold text-sm" style={{ color }}>{title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── TxLINE badge ── */}
      <div className="glass p-5 flex items-center gap-4 rounded-2xl">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
          <IconData size={20} />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-200">Powered by TxLINE</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Live World Cup odds &amp; scores via TxLINE SSE stream — cryptographically anchored on Solana.
          </p>
        </div>
        <div className="ml-auto flex-shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
            LIVE
          </span>
        </div>
      </div>

    </div>
  );
}
