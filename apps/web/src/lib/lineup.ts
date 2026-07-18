/**
 * Parse a TxLINE `lineups` score record into a displayable match lineup.
 *
 * TxLINE publishes the full squad for both teams as a score action
 * `action: "lineups"` (confirmed live). Each player carries a `positionId`
 * (34 GK · 35 DEF · 36 MID · 37 FWD), a `starter` flag (exactly 11 true per
 * side), a shirt `rosterNumber`, and `player.preferredName` ("Lastname,
 * Firstname"). The record survives in the snapshot even for a finished match,
 * so one fast `/scores/snapshot` fetch yields both starting XIs + a formation.
 * Lineups arrive ~1h before kickoff — an upcoming fixture simply has no such
 * record yet, which is how the UI knows to stay hidden.
 */

import { SQUADS } from './squads';

export type PlayerPos = 'GK' | 'DEF' | 'MID' | 'FWD';

const POS_MAP: Record<number, PlayerPos> = { 34: 'GK', 35: 'DEF', 36: 'MID', 37: 'FWD' };
export const POS_ORDER: PlayerPos[] = ['GK', 'DEF', 'MID', 'FWD'];

export interface LineupPlayer {
  number: string;
  name: string;   // "Firstname Lastname"
  last: string;   // "Lastname" — for the pitch chip
  pos: PlayerPos;
  captain: boolean;
}
export interface TeamLineup {
  team: string;
  formation: string;              // e.g. "4-4-2"
  starters: LineupPlayer[];       // GK → DEF → MID → FWD
  subs: LineupPlayer[];
}
export interface MatchLineup { home: TeamLineup; away: TeamLineup }

interface RawPlayer {
  rosterNumber?: string; starter?: boolean; positionId?: number; starred?: boolean;
  player?: { preferredName?: string };
}
interface RawTeam { preferredName?: string; lineups?: RawPlayer[] }

/** "Bellingham, Jude" → { name: "Jude Bellingham", last: "Bellingham" }. */
function splitName(preferred?: string): { name: string; last: string } {
  const raw = (preferred ?? '').trim();
  if (!raw) return { name: '', last: '' };
  const strip = (s: string) => s.replace(/\s*\(.*?\)\s*$/, '').trim(); // drop "(1999)" disambiguators
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const last = strip(parts[0]);
    const first = strip(parts[1]);
    return { name: [first, last].filter(Boolean).join(' ') || raw, last: last || raw };
  }
  const clean = strip(raw);
  return { name: clean, last: clean.split(' ').pop() ?? clean };
}

function toPlayer(p: RawPlayer): LineupPlayer {
  const { name, last } = splitName(p.player?.preferredName);
  return {
    number: String(p.rosterNumber ?? ''),
    name, last,
    pos: POS_MAP[p.positionId ?? -1] ?? 'MID',
    captain: p.starred === true,
  };
}

function buildTeam(t: RawTeam): TeamLineup {
  const roster = t.lineups ?? [];
  const starters = roster.filter(p => p.starter).map(toPlayer)
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));
  const subs = roster.filter(p => !p.starter).map(toPlayer);
  const line = (pos: PlayerPos) => starters.filter(p => p.pos === pos).length;
  const formation = [line('DEF'), line('MID'), line('FWD')].filter(n => n > 0).join('-');
  return { team: t.preferredName ?? '', formation, starters, subs };
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Extract the match lineup from a fixture's raw score records. `homeName` /
 * `awayName` map the two lineup blocks to the right side (they come from the
 * same TxLINE source, so an exact name match is reliable). Returns null when no
 * lineup record is present (upcoming fixture) or the teams can't be matched.
 */
export function buildMatchLineup(
  records: unknown[], homeName: string, awayName: string,
): MatchLineup | null {
  const recs = records as Array<Record<string, unknown>>;
  const teamsOf = (r: Record<string, unknown>) => (r.lineups ?? r.Lineups) as RawTeam[] | undefined;
  const rec = [...recs].reverse().find(r => Array.isArray(teamsOf(r)) && (teamsOf(r) as RawTeam[]).length);
  if (!rec) return null;

  const teams = (teamsOf(rec) as RawTeam[]).map(buildTeam).filter(t => t.starters.length > 0);
  if (teams.length < 2) return null;

  const home = teams.find(t => norm(t.team) === norm(homeName));
  const away = teams.find(t => norm(t.team) === norm(awayName));
  if (home && away && home !== away) return { home, away };

  // names didn't line up — don't guess which side is which (a swap would be
  // worse than showing nothing)
  return null;
}

/**
 * Build a lineup for a DEMO match from the replay squads — so a live demo shows
 * a starting XI just like a real fixture does (the demo mirror of TxLINE's
 * lineup record). Returns null if either team isn't in the squad table.
 */
export function buildDemoLineup(homeName: string, awayName: string): MatchLineup | null {
  const h = SQUADS[homeName];
  const a = SQUADS[awayName];
  if (!h || !a) return null;
  const team = (name: string, squad: typeof h): TeamLineup => {
    const starters: LineupPlayer[] = squad
      .map(p => ({ number: String(p.num), name: p.name, last: p.name, pos: p.pos, captain: false }))
      .sort((x, y) => POS_ORDER.indexOf(x.pos) - POS_ORDER.indexOf(y.pos));
    const line = (pos: PlayerPos) => starters.filter(p => p.pos === pos).length;
    return { team: name, formation: [line('DEF'), line('MID'), line('FWD')].filter(n => n > 0).join('-'), starters, subs: [] };
  };
  return { home: team(homeName, h), away: team(awayName, a) };
}
