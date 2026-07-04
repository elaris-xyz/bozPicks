'use client';

import type { BozEvent } from '@bozpicks/shared';
import {
  IconBall, IconCard, IconSub, IconKickoff, IconFlagEnd, IconPause,
} from './Icons';

/**
 * Match timeline as a two-sided commentary spine:
 *   • Home team events branch LEFT of the center line, away events RIGHT
 *     — you read "who did what" at a glance.
 *   • Neutral moments (kickoff, half-time, full-time) are full-width dividers.
 *   • Odds updates — the noise in a 15-event feed — collapse to a thin
 *     centered tick with a direction arrow, instead of a full card.
 *
 * This is an information-hierarchy fix: signal (goals/cards/subs) is loud,
 * noise (odds ticks) is quiet, and the vertical length drops by roughly half.
 */

type TeamCfg = { color: string; bg: string; border: string; label: string; icon: React.ReactNode };

const TEAM_EVENT: Record<string, TeamCfg> = {
  GOAL:         { color: 'var(--green)',  bg: 'var(--green-dim)',       border: 'rgba(16,185,129,0.35)', label: 'Goal',         icon: <IconBall size={13} /> },
  RED_CARD:     { color: 'var(--red)',    bg: 'var(--red-dim)',         border: 'rgba(239,68,68,0.35)',  label: 'Red Card',     icon: <IconCard size={12} /> },
  YELLOW_CARD:  { color: 'var(--amber)',  bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', label: 'Yellow Card',  icon: <IconCard size={12} /> },
  SUBSTITUTION: { color: 'var(--purple)', bg: 'var(--purple-dim)',      border: 'rgba(167,139,250,0.3)', label: 'Substitution', icon: <IconSub size={12} /> },
};

const NEUTRAL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  MATCH_START: { label: 'Kick-off',   color: 'var(--green)', icon: <IconKickoff size={12} /> },
  HALFTIME:    { label: 'Half-time',  color: 'var(--amber)', icon: <IconPause size={11} /> },
  MATCH_END:   { label: 'Full-time',  color: '#94a3b8',      icon: <IconFlagEnd size={12} /> },
};

const isTeamEvent = (t: string) => t in TEAM_EVENT;
const isNeutral   = (t: string) => t in NEUTRAL;

export function TwoSidedTimeline({
  events, homeTeam, awayTeam,
}: {
  events: BozEvent[]; homeTeam: string; awayTeam: string;
}) {
  // Precompute odds direction by tracking the running home price.
  // Odds shortening (price ↓) = home more likely → green ▲.
  let prevHome: number | null = null;
  const rows = events.map(e => {
    let oddsUp: boolean | null = null; // probability direction (▲ = home favoured)
    if (e.type === 'ODDS_UPDATE' && e.odds) {
      if (prevHome !== null && e.odds.homeWin !== prevHome) oddsUp = e.odds.homeWin < prevHome;
      prevHome = e.odds.homeWin;
    }
    return { e, oddsUp };
  });

  return (
    <div className="relative py-1">
      {/* center spine */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-px"
           style={{ background: 'linear-gradient(to bottom, transparent, var(--glass-border) 12%, var(--glass-border) 88%, transparent)' }} />

      <div className="space-y-1.5">
        {rows.map(({ e, oddsUp }, idx) => {
          // ── Odds tick: thin, centered, quiet ──
          if (e.type === 'ODDS_UPDATE') {
            const dirColor = oddsUp == null ? '#64748b' : oddsUp ? 'var(--green)' : 'var(--red)';
            return (
              <div key={e.id ?? idx} className="relative flex items-center justify-center py-0.5">
                <span className="relative z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono"
                      style={{ background: 'var(--bg-deep)', color: '#64748b', border: '1px solid var(--glass-border)' }}>
                  <span className="text-gray-600">{e.matchMinute}'</span>
                  <span className="uppercase tracking-wider text-[9px] text-gray-600">Odds</span>
                  {oddsUp != null && (
                    <span style={{ color: dirColor }}>
                      {oddsUp ? '▲' : '▼'} {e.odds?.homeWin.toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            );
          }

          // ── Neutral divider: full width ──
          if (isNeutral(e.type)) {
            const n = NEUTRAL[e.type];
            return (
              <div key={e.id ?? idx} className="relative flex items-center gap-3 py-1.5">
                <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
                <span className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                      style={{ background: 'var(--bg-deep)', color: n.color, border: `1px solid ${n.color}44` }}>
                  <span style={{ color: n.color }}>{n.icon}</span>
                  {n.label}
                  <span className="font-mono text-gray-600">{e.matchMinute}'</span>
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
              </div>
            );
          }

          // ── Team event: chip on its own side ──
          if (isTeamEvent(e.type)) {
            const cfg = TEAM_EVENT[e.type];
            const isHome = e.team ? e.team === homeTeam : true;

            const chip = (
              <div className="rounded-xl px-3 py-2 anim-in max-w-[85%]"
                   style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className={`flex items-center gap-1.5 ${isHome ? 'flex-row-reverse' : ''}`}>
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  {e.score && (
                    <span className="text-[11px] font-bold font-mono tabular-nums text-white">
                      {e.score.home}–{e.score.away}
                    </span>
                  )}
                </div>
                {(e.player || e.team) && (
                  <p className={`text-[11px] text-gray-400 mt-0.5 truncate ${isHome ? 'text-right' : 'text-left'}`}>
                    {e.player ?? e.team}
                  </p>
                )}
              </div>
            );

            return (
              <div key={e.id ?? idx} className="relative flex items-center min-h-[46px]">
                {/* left half — home */}
                <div className="w-1/2 pr-5 flex justify-end">{isHome && chip}</div>
                {/* right half — away */}
                <div className="w-1/2 pl-5 flex justify-start">{!isHome && chip}</div>
                {/* dot on the spine — dark ring masks the line, glow adds depth */}
                <div className="absolute left-1/2 -translate-x-1/2 z-10">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                       style={{ background: cfg.color, boxShadow: `0 0 0 4px var(--bg-deep), 0 0 10px ${cfg.color}66` }}>
                    {cfg.icon}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
