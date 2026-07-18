'use client';

import Link from 'next/link';
import type { MatchState } from '@bozpicks/shared';
import { formatOdds, type OddsFormat } from '@/hooks/useOddsFormat';
import { Flag } from './Flag';
import { Countdown } from './Countdown';
import { compBadge, CompGlyph, compGlyphColor, type OddsTrend } from './MatchCard';

/**
 * Compact scan row — the dense counterpart to the poster MatchCard.
 * One match per line: status/time · both teams (flag + name + score) ·
 * 1/X/2 odds buttons with live ▲▼ movement. Lets power users scan dozens
 * of matches at a glance, the way a real sportsbook list does.
 */
export function MatchRow({
  match, activeSignals = 0, isFav = false, onToggleFav, oddsFormat = 'decimal', trend, large = false,
}: {
  match: MatchState; activeSignals?: number;
  isFav?: boolean; onToggleFav?: (id: string) => void;
  oddsFormat?: OddsFormat; trend?: OddsTrend;
  /** inflated variant — bigger flags, names, scores; used for the live section */
  large?: boolean;
}) {
  const isLive = match.status === 'LIVE' || match.status === 'HALFTIME';
  const showScore = isLive || match.status === 'FINISHED';
  const comp = compBadge(match.competition, match.id);

  const oddsCells = match.currentOdds
    ? [
        { label: '1', val: match.currentOdds.homeWin, color: 'var(--green)', dir: trend?.home },
        { label: 'X', val: match.currentOdds.draw,    color: '#94a3b8',      dir: trend?.draw },
        { label: '2', val: match.currentOdds.awayWin, color: 'var(--blue)',  dir: trend?.away },
      ]
    : null;

  return (
    <Link href={`/match/${match.id}`} className="group block">
      <div className={`poster-card glass-hover flex items-center relative overflow-hidden
                      ${large ? 'gap-3.5 sm:gap-4 px-4 sm:px-5 py-4' : 'gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-2.5'}`}
           style={large && isLive ? { boxShadow: '0 0 22px rgba(16,185,129,0.10)' } : undefined}>

        {/* live accent edge on inflated live rows */}
        {large && isLive && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--green), transparent)' }} />
        )}

        {/* star */}
        {onToggleFav && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(match.id); }}
            className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md transition-all hover:scale-110"
            style={{ color: isFav ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}
            aria-label="Toggle favorite">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'}
                 stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* competition glyph beside the star — cup (WC) / globe (friendly) /
            play (demo), the same icons as the "All comps" filter; replaces the
            old inline FRIENDLY/DEMO text next to the away team */}
        {comp && (
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" title={comp.text}
                style={{ color: compGlyphColor(comp) }}>
            <CompGlyph comp={comp} className="w-3.5 h-3.5" />
          </span>
        )}

        {/* status / time — fixed column */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center ${large ? 'w-16 sm:w-20' : 'w-12 sm:w-14'}`}>
          {isLive ? (
            <>
              <span className={`rounded-full badge-live mb-1 ${large ? 'w-2 h-2' : 'w-1.5 h-1.5'}`} style={{ background: 'var(--green)' }} />
              <span className={`font-bold tabular-nums leading-none ${large ? 'text-sm' : 'text-[10px]'}`} style={{ color: 'var(--green)' }}>
                {match.status === 'HALFTIME' ? 'HT' : `${match.currentMinute}'`}
              </span>
            </>
          ) : match.status === 'FINISHED' ? (
            <span className={`font-bold text-gray-600 ${large ? 'text-xs' : 'text-[10px]'}`}>FT</span>
          ) : match.kickoffTime ? (
            <>
              <span className={`font-bold tabular-nums leading-tight ${large ? 'text-base' : 'text-xs'}`} style={{ color: 'var(--blue)' }}>
                {new Date(match.kickoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`text-gray-600 leading-tight ${large ? 'text-[10px]' : 'text-[8px]'}`}>
                {new Date(match.kickoffTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </>
          ) : null}
        </div>

        {/* teams (stacked) + score */}
        <div className={`flex-1 min-w-0 ${large ? 'space-y-1.5' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center min-w-0 font-semibold truncate ${large ? 'gap-2.5 text-base sm:text-lg' : 'gap-2 text-[13px]'}`}>
              <Flag team={match.homeTeam} size={large ? 'md' : 'xs'} /> <span className="truncate">{match.homeTeam}</span>
            </span>
            {showScore && (
              <span className={`font-display font-bold tabular-nums flex-shrink-0 ${large ? 'text-2xl sm:text-3xl' : 'text-sm'}`}
                    style={{ color: isLive ? '#fff' : '#cbd5e1' }}>{match.homeScore}</span>
            )}
          </div>
          <div className={`flex items-center justify-between gap-2 ${large ? '' : 'mt-0.5'}`}>
            <span className={`flex items-center min-w-0 font-semibold truncate ${large ? 'gap-2.5 text-base sm:text-lg' : 'gap-2 text-[13px]'}`}>
              <Flag team={match.awayTeam} size={large ? 'md' : 'xs'} /> <span className="truncate">{match.awayTeam}</span>
            </span>
            {showScore && (
              <span className={`font-display font-bold tabular-nums flex-shrink-0 ${large ? 'text-2xl sm:text-3xl' : 'text-sm'}`}
                    style={{ color: isLive ? '#fff' : '#cbd5e1' }}>{match.awayScore}</span>
            )}
          </div>
        </div>

        {/* signal badge */}
        {activeSignals > 0 && (
          <span className="signal-glow flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold"
                style={{ background: 'rgba(249,115,22,0.13)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.4)' }}>
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor" aria-hidden>
              <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
            </svg>
            {activeSignals}
          </span>
        )}

        {/* odds 1 / X / 2 — hidden on the narrowest screens */}
        {oddsCells && (
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            {oddsCells.map(({ label, val, color, dir }) => (
              <span key={`${label}-${dir ?? ''}`}
                    className={`odds-pill flex items-center ${dir ? 'odds-pill-flash' : ''}`}
                    style={{
                      background: 'rgba(255,255,255,0.03)', color,
                      border: `1px solid ${dir === 'up' ? 'rgba(16,185,129,0.55)' : dir === 'down' ? 'rgba(239,68,68,0.55)' : 'var(--glass-border)'}`,
                      minWidth: 44, justifyContent: 'center',
                    }}>
                <span className="opacity-50 mr-1">{label}</span>{formatOdds(val, oddsFormat)}
                {dir && (
                  <span className="ml-1 text-[8px]" style={{ color: dir === 'up' ? 'var(--green)' : 'var(--red)' }}>
                    {dir === 'up' ? '▲' : '▼'}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* countdown for scheduled (desktop only) */}
        {match.status === 'SCHEDULED' && match.kickoffTime && !oddsCells && (
          <div className="hidden md:block flex-shrink-0">
            <Countdown kickoffTime={match.kickoffTime} />
          </div>
        )}

        <svg className="w-4 h-4 text-gray-600 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
             fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}
