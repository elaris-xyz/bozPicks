/**
 * Player rosters for the demo replay — maps a team to a plausible squad so
 * goals, cards and subs carry a real NAME instead of a shirt number. This is
 * the demo mirror of TxLINE's live player-level data (goal events carry
 * PlayerId / PlayerInId / PlayerOutId, resolved to a name), so the replayed
 * broadcast — feed, goalscorer lines, and the AI pundit — reads like the real
 * thing. Teams not listed fall back to "#N", so any fixture still works.
 *
 * Client-safe (no node deps): shared by the server replay engine and the UI.
 */
export interface Player { name: string; num: number; pos: 'GK' | 'DEF' | 'MID' | 'FWD' }

export const SQUADS: Record<string, Player[]> = {
  Brazil: [
    { name: 'Alisson', num: 1, pos: 'GK' }, { name: 'Danilo', num: 2, pos: 'DEF' },
    { name: 'Marquinhos', num: 4, pos: 'DEF' }, { name: 'Militão', num: 3, pos: 'DEF' },
    { name: 'Casemiro', num: 5, pos: 'MID' }, { name: 'Bruno Guimarães', num: 8, pos: 'MID' },
    { name: 'Raphinha', num: 11, pos: 'FWD' }, { name: 'Rodrygo', num: 10, pos: 'FWD' },
    { name: 'Vinícius Jr', num: 7, pos: 'FWD' }, { name: 'Endrick', num: 9, pos: 'FWD' },
    { name: 'Savinho', num: 19, pos: 'FWD' },
  ],
  Argentina: [
    { name: 'E. Martínez', num: 23, pos: 'GK' }, { name: 'Molina', num: 26, pos: 'DEF' },
    { name: 'Romero', num: 13, pos: 'DEF' }, { name: 'Otamendi', num: 19, pos: 'DEF' },
    { name: 'De Paul', num: 7, pos: 'MID' }, { name: 'Mac Allister', num: 20, pos: 'MID' },
    { name: 'E. Fernández', num: 24, pos: 'MID' }, { name: 'Di María', num: 11, pos: 'FWD' },
    { name: 'Messi', num: 10, pos: 'FWD' }, { name: 'J. Álvarez', num: 9, pos: 'FWD' },
    { name: 'Lautaro', num: 22, pos: 'FWD' },
  ],
  France: [
    { name: 'Maignan', num: 16, pos: 'GK' }, { name: 'Koundé', num: 5, pos: 'DEF' },
    { name: 'Saliba', num: 17, pos: 'DEF' }, { name: 'T. Hernández', num: 22, pos: 'DEF' },
    { name: 'Tchouaméni', num: 8, pos: 'MID' }, { name: 'Camavinga', num: 6, pos: 'MID' },
    { name: 'Griezmann', num: 7, pos: 'MID' }, { name: 'Dembélé', num: 11, pos: 'FWD' },
    { name: 'Mbappé', num: 10, pos: 'FWD' }, { name: 'Thuram', num: 9, pos: 'FWD' },
    { name: 'Kolo Muani', num: 12, pos: 'FWD' },
  ],
  Spain: [
    { name: 'Unai Simón', num: 23, pos: 'GK' }, { name: 'Carvajal', num: 2, pos: 'DEF' },
    { name: 'Le Normand', num: 3, pos: 'DEF' }, { name: 'Cucurella', num: 24, pos: 'DEF' },
    { name: 'Rodri', num: 16, pos: 'MID' }, { name: 'Pedri', num: 8, pos: 'MID' },
    { name: 'Fabián', num: 12, pos: 'MID' }, { name: 'N. Williams', num: 17, pos: 'FWD' },
    { name: 'L. Yamal', num: 19, pos: 'FWD' }, { name: 'Morata', num: 7, pos: 'FWD' },
    { name: 'Oyarzabal', num: 9, pos: 'FWD' },
  ],
  England: [
    { name: 'Pickford', num: 1, pos: 'GK' }, { name: 'Walker', num: 2, pos: 'DEF' },
    { name: 'Stones', num: 5, pos: 'DEF' }, { name: 'Trippier', num: 12, pos: 'DEF' },
    { name: 'Rice', num: 4, pos: 'MID' }, { name: 'Bellingham', num: 10, pos: 'MID' },
    { name: 'Foden', num: 11, pos: 'MID' }, { name: 'Saka', num: 7, pos: 'FWD' },
    { name: 'Kane', num: 9, pos: 'FWD' }, { name: 'Palmer', num: 24, pos: 'FWD' },
    { name: 'Rashford', num: 19, pos: 'FWD' },
  ],
};

const ATTACK = new Set<Player['pos']>(['FWD', 'MID']);

/** Deterministic index so the same seed always picks the same player. */
const at = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

/**
 * Pick a player for an event. `role` biases the selection (scorers/shooters are
 * attackers; a sub-in is a fresh attacker, a sub-out a starter). Returns a
 * display string: a real name when the squad is known, else "Team · #N".
 */
export function playerFor(team: string, role: 'scorer' | 'card' | 'subIn' | 'subOut', seed: number): string {
  const squad = SQUADS[team];
  if (!squad) return `${team} · #${4 + (Math.abs(seed) % 8)}`;
  const pool =
    role === 'scorer' ? squad.filter(p => ATTACK.has(p.pos)) :
    role === 'subIn'  ? squad.filter(p => p.pos === 'FWD' || p.pos === 'MID') :
    role === 'subOut' ? squad.filter(p => p.pos !== 'GK') :
                        squad.filter(p => p.pos !== 'GK'); // cards: outfield
  const p = at(pool.length ? pool : squad, seed);
  return `${p.name} · #${p.num}`;
}
