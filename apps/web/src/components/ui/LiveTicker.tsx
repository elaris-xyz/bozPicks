'use client';

import Link from 'next/link';
import type { MatchState } from '@bozpicks/shared';
import { Flag } from './Flag';
import { compBadge } from './MatchCard';

/**
 * Full-bleed scoreboard ticker — like the bottom-line strip on a sports
 * broadcast. Live matches show a pulsing dot + score + minute; upcoming
 * ones show kickoff time. A fixed status label anchors the left edge while
 * content scrolls out from behind it; the right edge fades into the page.
 *
 * The base sequence is repeated until it comfortably overflows the widest
 * viewport, then duplicated once more so the −50% loop is seamless
 * regardless of how many matches exist (even just one).
 */
export function LiveTicker({ matches }: { matches: MatchState[] }) {
  if (matches.length === 0) return null;

  const liveCount = matches.filter(m => m.status === 'LIVE' || m.status === 'HALFTIME').length;

  const MIN_SEGMENTS = 14;
  const reps = Math.max(1, Math.ceil(MIN_SEGMENTS / matches.length));
  const base = Array.from({ length: reps }, () => matches).flat();
  const items = [...base, ...base]; // duplicate for the seamless −50% loop

  // Scroll speed must stay constant regardless of how many matches there are.
  // The CSS animation always travels −50% of the (variable) track width, so a
  // fixed duration would race when there are many matches. Scale the duration
  // with the segment count to hold a calm, readable pace (~one item / 2.4s).
  const durationS = Math.max(30, Math.round(base.length * 2.4));

  return (
    <div
      className="relative overflow-hidden select-none fx-scan"
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        background: 'linear-gradient(180deg, rgba(11,16,32,0.92), rgba(11,16,32,0.7))',
        borderTop: '1px solid var(--glass-border)',
        borderBottom: '1px solid var(--glass-border)',
      }}
    >
      {/* neon hairline along the top edge */}
      <div className="absolute top-0 inset-x-0 h-px z-10"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5) 30%, rgba(59,130,246,0.5) 70%, transparent)' }} />

      {/* anchored status label — content scrolls out from behind it */}
      <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pl-4 md:pl-6 pr-10"
           style={{ background: 'linear-gradient(90deg, var(--bg-deep) 60%, transparent)' }}>
        <span className={`chip-glass ${liveCount > 0 ? 'chip-green' : 'chip-blue'}`}>
          {liveCount > 0 && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />}
          {liveCount > 0 ? `LIVE · ${liveCount}` : 'MATCHES'}
        </span>
      </div>

      {/* right edge fade */}
      <div className="absolute right-0 top-0 bottom-0 z-10 w-20 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent, var(--bg-deep))' }} />

      {/* scrolling track */}
      <div className="flex items-center animate-ticker py-2.5" style={{ width: 'max-content', animationDuration: `${durationS}s` }}>
        {items.map((m, i) => {
          const live = m.status === 'LIVE' || m.status === 'HALFTIME';
          const comp = compBadge(m.competition);
          return (
            <Link
              key={`${m.id}-${i}`}
              href={`/match/${m.id}`}
              className="flex items-center gap-2 px-5 shrink-0 border-r transition-colors hover:bg-white/[0.04]"
              style={{ borderColor: 'var(--glass-border)' }}
            >
              {live && (
                <span className="w-1.5 h-1.5 rounded-full badge-live flex-shrink-0" style={{ background: 'var(--green)' }} />
              )}
              <Flag team={m.homeTeam} size="xs" />
              <span className="text-xs font-semibold text-gray-200 whitespace-nowrap">{m.homeTeam}</span>

              {live ? (
                <span className="text-sm font-black tabular-nums px-1 whitespace-nowrap" style={{ color: 'var(--green)' }}>
                  {m.homeScore}<span className="text-gray-600 mx-0.5">–</span>{m.awayScore}
                </span>
              ) : (
                /* upcoming: show the DATE (not just time) so two fixtures with
                   the same teams — e.g. Australia v Brazil on 25 & 29 Sep —
                   don't read as a duplicate */
                <span className="text-[10px] font-mono px-1.5 whitespace-nowrap flex items-center gap-1" style={{ color: 'var(--blue)' }}>
                  {m.kickoffTime ? (
                    <>
                      <span className="font-bold">{new Date(m.kickoffTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-500">{new Date(m.kickoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </>
                  ) : 'vs'}
                </span>
              )}

              <span className="text-xs font-semibold text-gray-200 whitespace-nowrap">{m.awayTeam}</span>
              <Flag team={m.awayTeam} size="xs" />

              {/* friendlies must say so — this is a World Cup product */}
              {comp && !comp.wc && (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-0.5 whitespace-nowrap"
                      style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.22)' }}>
                  {comp.text}
                </span>
              )}

              {live && m.status === 'HALFTIME' ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-0.5"
                      style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' }}>HT</span>
              ) : live && m.currentMinute > 0 ? (
                <span className="text-[10px] font-mono text-gray-500 ml-0.5">{m.currentMinute}&rsquo;</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
