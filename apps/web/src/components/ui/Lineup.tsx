'use client';

import { useEffect, useState } from 'react';
import { Flag } from './Flag';
import { POS_ORDER, type MatchLineup, type TeamLineup, type LineupPlayer, type PlayerPos } from '@/lib/lineup';

/**
 * Starting Lineups — a broadcast-style pitch graphic built from TxLINE's real
 * `lineups` record. Away XI attacks down from the top half, home XI up from the
 * bottom, each laid out in its true formation (GK→DEF→MID→FWD). Self-fetches and
 * renders NOTHING unless a real lineup exists for this fixture (so it never
 * shows for a demo or a match whose XI hasn't been published yet).
 */

const HOME_RGB = '16,185,129'; // green
const AWAY_RGB = '59,130,246'; // blue

// position accent — a quick colour cue on the roster labels
const POS_COLOR: Record<PlayerPos, string> = {
  GK: '#f59e0b', DEF: '#3b82f6', MID: '#10b981', FWD: '#ef4444',
};

export function Lineup({ fixtureId, home, away }: { fixtureId: string; home: string; away: string }) {
  const [data, setData] = useState<MatchLineup | null>(null);

  useEffect(() => {
    // demo ids and empty names can't have a real lineup — don't even ask
    if (!/^\d+$/.test(fixtureId)) return;
    let live = true;
    const q = new URLSearchParams({ home, away });
    fetch(`/api/lineup/${fixtureId}?${q}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d && d.home && d.away) setData(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [fixtureId, home, away]);

  if (!data) return null;

  return (
    <div className="glass relative overflow-hidden p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
          <h2 className="section-label">Starting Lineups</h2>
        </div>
        <span className="text-[10px] text-gray-500 hidden sm:block">confirmed XI — from TxLINE</span>
      </div>

      {/* team headers */}
      <div className="flex items-center justify-between mb-3">
        <TeamHead team={data.home} rgb={HOME_RGB} align="left" />
        <TeamHead team={data.away} rgb={AWAY_RGB} align="right" />
      </div>

      <Pitch home={data.home} away={data.away} />

      {/* substitutes */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <SubList team={data.home} rgb={HOME_RGB} />
        <SubList team={data.away} rgb={AWAY_RGB} />
      </div>
    </div>
  );
}

function TeamHead({ team, rgb, align }: { team: TeamLineup; rgb: string; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <Flag team={team.team} size="sm" className="rounded-sm" />
      <div className={align === 'right' ? 'text-right' : ''}>
        <p className="text-[13px] font-bold text-gray-100 leading-tight">{team.team}</p>
        {team.formation && (
          <p className="text-[10px] font-black tabular-nums tracking-wider" style={{ color: `rgb(${rgb})` }}>{team.formation}</p>
        )}
      </div>
    </div>
  );
}

/** the two-sided pitch */
function Pitch({ home, away }: { home: TeamLineup; away: TeamLineup }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden"
         style={{
           minHeight: 420,
           // grass: alternating mown bands + a soft top sheen for depth
           backgroundImage:
             'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 45%),' +
             'repeating-linear-gradient(180deg, #103c25 0, #103c25 42px, #0e3721 42px, #0e3721 84px)',
           border: '1px solid rgba(255,255,255,0.08)',
         }}>
      {/* pitch markings */}
      <PitchMarkings />

      {/* away XI — top half, GK at the very top, attacking downward */}
      <div className="absolute inset-x-0 top-0 h-1/2 flex flex-col justify-between py-3">
        {POS_ORDER.map(pos => <PlayerRow key={pos} players={lineFor(away, pos)} rgb={AWAY_RGB} />)}
      </div>

      {/* home XI — bottom half, GK at the very bottom, attacking upward */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 flex flex-col justify-between py-3">
        {[...POS_ORDER].reverse().map(pos => <PlayerRow key={pos} players={lineFor(home, pos)} rgb={HOME_RGB} />)}
      </div>
    </div>
  );
}

function PitchMarkings() {
  const line = 'rgba(255,255,255,0.16)';
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* halfway line */}
      <div className="absolute left-0 right-0 top-1/2" style={{ height: 1, background: line }} />
      {/* centre circle + spot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
           style={{ width: '32%', paddingBottom: '24%', height: 0, border: `1px solid ${line}` }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 4, height: 4, background: line }} />
      {/* penalty boxes (top + bottom) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0" style={{ width: '46%', height: '15%', borderLeft: `1px solid ${line}`, borderRight: `1px solid ${line}`, borderBottom: `1px solid ${line}` }} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0" style={{ width: '46%', height: '15%', borderLeft: `1px solid ${line}`, borderRight: `1px solid ${line}`, borderTop: `1px solid ${line}` }} />
      {/* six-yard boxes */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0" style={{ width: '22%', height: '6%', borderLeft: `1px solid ${line}`, borderRight: `1px solid ${line}`, borderBottom: `1px solid ${line}` }} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0" style={{ width: '22%', height: '6%', borderLeft: `1px solid ${line}`, borderRight: `1px solid ${line}`, borderTop: `1px solid ${line}` }} />
      {/* outer touchline inset */}
      <div className="absolute inset-2 rounded-lg" style={{ border: `1px solid ${line}` }} />
    </div>
  );
}

function PlayerRow({ players, rgb }: { players: LineupPlayer[]; rgb: string }) {
  if (players.length === 0) return <div />;
  return (
    <div className="flex items-center justify-around px-3">
      {players.map((p, i) => <PlayerChip key={`${p.number}-${i}`} p={p} rgb={rgb} />)}
    </div>
  );
}

function PlayerChip({ p, rgb }: { p: LineupPlayer; rgb: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16 min-w-0">
      <span className="relative flex items-center justify-center rounded-full font-black text-[13px] flex-shrink-0"
            style={{
              width: 34, height: 34, color: '#fff',
              background: `radial-gradient(circle at 35% 30%, rgba(${rgb},0.95), rgba(${rgb},0.55))`,
              border: '1.5px solid rgba(255,255,255,0.55)',
              boxShadow: `0 3px 10px rgba(0,0,0,0.45), 0 0 12px rgba(${rgb},0.35)`,
            }}>
        {p.number || '–'}
        {p.captain && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[7px] font-black"
                style={{ width: 13, height: 13, background: 'linear-gradient(135deg,#fde68a,#f59e0b)', color: '#3a1e02', border: '1px solid rgba(0,0,0,0.2)' }}>C</span>
        )}
      </span>
      <span className="text-[9px] font-bold text-white text-center leading-tight truncate w-full"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}>{p.last}</span>
    </div>
  );
}

function SubList({ team, rgb }: { team: TeamLineup; rgb: string }) {
  if (team.subs.length === 0) return <div />;
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: `rgb(${rgb})` }}>
        Subs · {team.team}
      </p>
      <div className="space-y-1">
        {team.subs.map((p, i) => (
          <div key={`${p.number}-${i}`} className="flex items-center gap-1.5 text-[11px]">
            <span className="flex items-center justify-center rounded font-bold tabular-nums flex-shrink-0"
                  style={{ width: 18, height: 18, fontSize: 9, background: `rgba(${rgb},0.12)`, color: `rgb(${rgb})`, border: `1px solid rgba(${rgb},0.25)` }}>
              {p.number || '–'}
            </span>
            <span className="flex items-center justify-center rounded text-[7px] font-black uppercase tracking-wide flex-shrink-0"
                  style={{ width: 24, height: 14, background: `${POS_COLOR[p.pos]}22`, color: POS_COLOR[p.pos], border: `1px solid ${POS_COLOR[p.pos]}44` }}>
              {p.pos}
            </span>
            <span className="text-gray-300 truncate">{p.last}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function lineFor(team: TeamLineup, pos: PlayerPos): LineupPlayer[] {
  return team.starters.filter(p => p.pos === pos);
}
