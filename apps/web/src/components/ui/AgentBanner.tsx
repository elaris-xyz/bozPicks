'use client';

import { CountUp } from './CountUp';
import { Flag } from './Flag';
import type { LiveMatch } from '@/hooks/useLiveMatch';

/**
 * The live centrepiece of /agent (mirrors the Play scoreboard / Markets banner).
 * Shows the agent's headline numbers — signals, self-graded accuracy, live
 * matches, high-confidence calls — with the match context, and invites the judge
 * to the Command Bridge when there's nothing on the wire yet.
 */
export function AgentBanner({
  totalSignals, accuracy, liveMatches, highConf, live, connected,
}: {
  totalSignals: number; accuracy: number | null; liveMatches: number; highConf: number;
  live: LiveMatch | null; connected: boolean;
}) {
  const isLive = !!live?.live;
  const accent = isLive ? 'var(--green)' : connected ? 'var(--purple)' : '#64748b';
  const idle = !isLive && totalSignals === 0;

  const STATS = [
    { label: 'Signals', value: totalSignals, color: 'var(--purple)', suffix: '' },
    { label: 'Accuracy', value: accuracy ?? 0, color: accuracy != null && accuracy >= 60 ? 'var(--green)' : accuracy != null && accuracy >= 40 ? 'var(--amber)' : '#94a3b8', suffix: accuracy != null ? '%' : '', dash: accuracy == null },
    { label: 'Live matches', value: liveMatches, color: 'var(--green)', suffix: '' },
    { label: 'High conf.', value: highConf, color: 'var(--orange)', suffix: '' },
  ];

  return (
    <div className="glass fx-rise relative overflow-hidden"
         style={{ borderColor: `${accent}44`, boxShadow: `0 0 30px ${accent}1c` }}>
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
      <div className="relative p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <span className="chip-glass" style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}55` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'badge-live' : ''}`} style={{ background: 'currentColor' }} />
            {isLive ? `LIVE · ${live!.minute}′` : connected ? 'Agent online' : 'Agent offline'}
          </span>
          {live?.homeTeam && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400 min-w-0">
              <Flag team={live.homeTeam} size="xs" />
              <span className="truncate">{live.homeTeam} {live.homeScore}–{live.awayScore} {live.awayTeam}</span>
              <Flag team={live.awayTeam} size="xs" />
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="font-display text-3xl md:text-4xl font-black tabular-nums" style={{ color: s.color }}>
                {s.dash ? '—' : <><CountUp value={Number(s.value)} duration={700} />{s.suffix}</>}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
          {idle ? (
            <>Tap the{' '}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full align-middle mx-0.5" style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)' }}>
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
              </span>{' '}
              <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left) to run a match and watch the agent fire in real time.
            </>
          ) : (
            'Every signal is published the instant the odds move, then graded against the TxLINE final result.'
          )}
        </p>
      </div>
    </div>
  );
}
