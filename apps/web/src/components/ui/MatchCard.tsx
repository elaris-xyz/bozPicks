'use client';

import Link from 'next/link';
import type { MatchState } from '@bozpicks/shared';
import { Countdown } from './Countdown';
import { formatOdds, type OddsFormat } from '@/hooks/useOddsFormat';
import { FlagBleed } from './Flag';

/**
 * Glassy status badges: tinted translucent fill, stronger stroke of the
 * same hue, colored text. LIVE is green — it means "on air", not danger.
 */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow?: string }> = {
  LIVE:      { label: 'LIVE', color: '#34d399', bg: 'rgba(16,185,129,0.13)',  border: 'rgba(16,185,129,0.55)',  glow: '0 0 12px rgba(16,185,129,0.25)' },
  HALFTIME:  { label: 'HT',   color: '#fbbf24', bg: 'rgba(245,158,11,0.13)',  border: 'rgba(245,158,11,0.55)',  glow: '0 0 12px rgba(245,158,11,0.22)' },
  SCHEDULED: { label: 'SOON', color: '#cbd5e1', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)' },
  FINISHED:  { label: 'FT',   color: '#94a3b8', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.30)' },
};

export type OddsTrend = { home?: 'up' | 'down'; draw?: 'up' | 'down'; away?: 'up' | 'down' };

export function MatchCard({
  match, activeSignals = 0, isFav = false, onToggleFav, oddsFormat = 'decimal', index = 0, trend, compact = false, dateBadge,
}: {
  match: MatchState; activeSignals?: number;
  isFav?: boolean; onToggleFav?: (id: string) => void;
  oddsFormat?: OddsFormat;
  /** position in the grid — used to stagger the entrance animation */
  index?: number;
  /** transient odds-movement direction per outcome (flashes then clears) */
  trend?: OddsTrend;
  /** dense variant for horizontal rails — smaller type, shorter card */
  compact?: boolean;
  /** small date chip shown top-center (grid view — cards aren't grouped by day) */
  dateBadge?: string;
}) {
  const isLive = match.status === 'LIVE' || match.status === 'HALFTIME';
  const cfg = STATUS_CONFIG[match.status] ?? STATUS_CONFIG.SCHEDULED;

  // "SOON" is a promise, not a default — only within 24h of kickoff. Everything
  // further out shows its date instead (a badge saying SOON on a game 81 days
  // away reads as broken).
  const msToKickoff = match.kickoffTime ? new Date(match.kickoffTime).getTime() - Date.now() : Infinity;
  const isSoon = match.status === 'SCHEDULED' && msToKickoff < 24 * 3600_000 && msToKickoff > -3 * 3600_000;
  const farDate = match.status === 'SCHEDULED' && !isSoon && match.kickoffTime
    ? new Date(match.kickoffTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
    : null;

  return (
    <Link href={`/match/${match.id}`} className="block group">
      <div
        className={`poster-card card-shine relative overflow-hidden cursor-pointer anim-in
                    ${compact ? 'aspect-[16/10]' : 'aspect-[16/9] sm:aspect-[4/3]'}
                    group-hover:-translate-y-1`}
        style={{
          boxShadow: isLive ? '0 0 24px rgba(16,185,129,0.10)' : undefined,
          // staggered entrance — cards cascade in, capped so late rows don't lag
          animationDelay: `${Math.min(index, 11) * 45}ms`,
        }}>

        {/* ── Flag layers, bleeding in from both edges ── */}
        <FlagBleed team={match.homeTeam} side="home" />
        <FlagBleed team={match.awayTeam} side="away" />

        {/* readability overlay — darkens bottom for names, vignettes center */}
        <div className="absolute inset-0 pointer-events-none"
             style={{
               background: `
                 linear-gradient(to top, rgba(7,11,24,0.92) 0%, rgba(7,11,24,0.35) 34%, transparent 60%),
                 radial-gradient(ellipse 60% 90% at 50% 45%, rgba(7,11,24,0.55), transparent 100%)
               `,
             }} />

        {/* live accent edge + glow — green: "on air" */}
        {isLive && (
          <>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
                 style={{ background: 'linear-gradient(90deg, transparent, var(--green), transparent)' }} />
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(16,185,129,0.12), transparent 70%)' }} />
          </>
        )}

        {/* date chip — top-center (grid view only) */}
        {dateBadge && (
          <span className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(11,16,32,0.72)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
            {dateBadge}
          </span>
        )}

        {/* ── Corner labels ── */}
        {/* star — top-left */}
        {onToggleFav && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(match.id); }}
            className="absolute top-2.5 left-2.5 z-10 w-7 h-7 flex items-center justify-center rounded-full
                       transition-all hover:scale-110 active:scale-95"
            style={{
              color: isFav ? '#f59e0b' : 'rgba(255,255,255,0.55)',
              background: 'rgba(11,16,32,0.45)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
            aria-label="Toggle favorite">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'}
                 stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* status + signals — top-right, same 28px height as the star */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {activeSignals > 0 && (
            <span className="h-7 flex items-center gap-1 text-[10px] px-2.5 rounded-full font-bold"
                  style={{
                    background: 'rgba(249,115,22,0.13)',
                    color: '#fb923c',
                    border: '1px solid rgba(249,115,22,0.5)',
                    boxShadow: '0 0 12px rgba(249,115,22,0.2)',
                  }}>
              {/* flat bolt — sharp odds move */}
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden>
                <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
              </svg>
              {activeSignals}
            </span>
          )}
          {isSoon ? (
            /* premium SOON — kicks off within 24h */
            <span className="h-7 flex items-center gap-1.5 text-[10px] font-black tracking-widest px-2.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(16,185,129,0.14))',
                    color: '#fcd34d', border: '1px solid rgba(245,158,11,0.55)',
                    boxShadow: '0 0 14px rgba(245,158,11,0.28)',
                  }}>
              <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: '#fbbf24' }} />
              SOON
            </span>
          ) : farDate ? (
            /* future fixture — its date, not a fake "soon" */
            <span className="h-7 flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 rounded-full"
                  style={{ background: 'rgba(148,163,184,0.10)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' }}>
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" />
              </svg>
              {farDate}
            </span>
          ) : (
            <span className="h-7 flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 rounded-full"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, boxShadow: cfg.glow }}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: cfg.color }} />}
              {cfg.label}
              {isLive && ` ${match.currentMinute}'`}
            </span>
          )}
        </div>

        {/* ── Center: score / kickoff ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] pointer-events-none">
          {isLive || match.status === 'FINISHED' ? (
            <div className={`font-display flex items-baseline gap-2.5 font-bold tabular-nums tracking-tight
                            ${compact ? 'text-3xl' : 'text-4xl sm:text-5xl'}`}
                 style={{ filter: 'drop-shadow(0 2px 14px rgba(0,0,0,0.85))' }}>
              {isLive ? (
                <>
                  <span className="score-shimmer">{match.homeScore}</span>
                  <span className="text-xl text-gray-500 font-light">–</span>
                  <span className="score-shimmer">{match.awayScore}</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#cbd5e1' }}>{match.homeScore}</span>
                  <span className="text-xl text-gray-500 font-light">–</span>
                  <span style={{ color: '#cbd5e1' }}>{match.awayScore}</span>
                </>
              )}
            </div>
          ) : match.kickoffTime ? (
            <>
              <p className={`font-display font-bold tabular-nums ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}
                 style={{ color: 'var(--blue)', textShadow: '0 2px 14px rgba(0,0,0,0.8)' }}>
                {new Date(match.kickoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {!compact && (
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5"
                   style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                  {new Date(match.kickoffTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              )}
              <div className={compact ? 'mt-1' : 'mt-1.5'}>
                <Countdown kickoffTime={match.kickoffTime} />
              </div>
            </>
          ) : (
            <span className="font-display text-2xl text-gray-600 font-light">vs</span>
          )}

          {/* odds pills under the score/time — flash ▲▼ on a live odds move
              (hidden on compact rail cards to keep them clean) */}
          {match.currentOdds && !compact && (
            <div className="flex items-center gap-1.5 mt-3">
              {[
                { label: '1', val: match.currentOdds.homeWin, color: 'var(--green)', dir: trend?.home },
                { label: 'X', val: match.currentOdds.draw,    color: '#9ca3af',      dir: trend?.draw },
                { label: '2', val: match.currentOdds.awayWin, color: 'var(--blue)',  dir: trend?.away },
              ].map(({ label, val, color, dir }) => (
                <span key={`${label}-${dir ?? ''}`}
                      className={`odds-pill ${dir ? 'odds-pill-flash' : ''}`}
                      style={{
                        background: 'rgba(11,16,32,0.62)', color,
                        border: `1px solid ${dir === 'up' ? 'rgba(16,185,129,0.55)' : dir === 'down' ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.09)'}`,
                      }}>
                  <span className="opacity-50 mr-1">{label}</span>{formatOdds(val, oddsFormat)}
                  {dir && (
                    <span className="ml-1 text-[9px]" style={{ color: dir === 'up' ? 'var(--green)' : 'var(--red)' }}>
                      {dir === 'up' ? '▲' : '▼'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Bottom: team names slide in from their own flag edge ── */}
        <div className={`absolute bottom-0 inset-x-0 z-[5] flex items-center justify-between gap-2
                        ${compact ? 'px-2.5 pb-2.5' : 'px-3.5 pb-3'}`}>
          <p className={`team-name team-name-home font-display flex-1 text-left font-bold uppercase leading-tight truncate
                        ${compact ? 'text-xs' : 'text-sm sm:text-base'}`}
             style={{ textShadow: '0 1px 10px rgba(0,0,0,0.9)' }}>
            {match.homeTeam}
          </p>
          {!compact && <span className="vs-chip flex-shrink-0">VS</span>}
          <p className={`team-name team-name-away font-display flex-1 text-right font-bold uppercase leading-tight truncate
                        ${compact ? 'text-xs' : 'text-sm sm:text-base'}`}
             style={{ textShadow: '0 1px 10px rgba(0,0,0,0.9)' }}>
            {match.awayTeam}
          </p>
        </div>

        {/* live possession strip along the bottom edge — shows the rich feed */}
        {isLive && match.stats && typeof match.stats.possession === 'number' && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] flex z-[6]" title={`Possession ${match.stats.possession}%`}>
            <div style={{ width: `${match.stats.possession}%`, background: 'var(--green)', transition: 'width .6s' }} />
            <div style={{ width: `${100 - match.stats.possession}%`, background: 'var(--blue)', transition: 'width .6s' }} />
          </div>
        )}
      </div>
    </Link>
  );
}
