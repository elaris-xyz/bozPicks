import type { BozEvent } from '@bozpicks/shared';

/**
 * Live "AI Pundit" line generator. Turns a TxLINE event into a punchy,
 * contextual commentary line — what happened and what the market now thinks.
 * Local + instant so it keeps pace with the live stream (an LLM upgrade can
 * swap in via /api later without changing the UI).
 */

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** "Mbappé · #10" → "Mbappé"; "France · #7" fallback → "" (no real name). */
function scorerName(e: BozEvent): string {
  const raw = (e.player ?? '').split(' · ')[0].trim();
  if (!raw || raw === e.team) return '';
  return raw;
}

export function punditLine(e: BozEvent, home?: string, away?: string): string | null {
  const min = e.matchMinute;
  const team = e.team ?? 'The side';
  const sc = e.score ? `${e.score.home}–${e.score.away}` : '';
  const who = scorerName(e);

  switch (e.type) {
    case 'GOAL':
      return who
        ? pick([
            `${who} scores for ${team} at ${min}'! It's ${sc}, and you can feel the momentum swinging their way.`,
            `Oh, what a finish from ${who}! ${sc} at ${min}', and the whole complexion of this match has just changed.`,
            `${who} breaks through at ${min}' — ${sc} now for ${team}, and the market's reacting fast, their price tumbling.`,
          ])
        : pick([
            `And there it is — ${team} find the net at ${min}'! It's ${sc}, and you can feel the momentum swinging their way.`,
            `Oh, what a moment — ${team} strike! ${sc} at ${min}', and the whole complexion of this match has just changed.`,
            `${team} break through at ${min}'! ${sc} now — the market's reacting fast, and their price is tumbling.`,
          ]);
    case 'PENALTY':
      return pick([
        `Penalty to ${team} at ${min}'! The whole ground holds its breath — and the market with it.`,
        `It's a penalty for ${team} (${min}')! Taker against keeper, everything on the line.`,
      ]);
    case 'RED_CARD':
      return who
        ? pick([
            `Red card for ${who}! ${team} down to ten at ${min}' — a mountain to climb from here, and the odds know it.`,
            `Off goes ${who} — ${team} lose a man at ${min}'. That changes everything; their opponents are firm favourites now.`,
          ])
        : pick([
            `Red card — ${team} are down to ten at ${min}'! A mountain to climb from here, and the odds know it.`,
            `Off he goes — ${team} lose a man at ${min}'. That changes everything; their opponents are firm favourites now.`,
          ]);
    case 'YELLOW_CARD':
      return `Yellow for ${team} at ${min}' — tread carefully, a second booking changes everything.`;
    case 'CORNER':
      return pick([
        `Corner, ${team} (${min}') — set-piece danger. Anyone on corners over is smiling.`,
        `${team} win a corner at ${min}'. Pressure building; the danger meter is ticking up.`,
      ]);
    case 'SUBSTITUTION':
      return `${team} make a change at ${min}' — watch if it's a shore-up or a push for more.`;
    case 'SHOT': {
      const o = e.shotOutcome;
      if (o === 'OnTarget') return `${team} force a save at ${min}' — that's a real chance, danger's rising.`;
      if (o === 'Woodwork') return `Off the woodwork, ${team}! (${min}') Inches from a swing in the market.`;
      if (o === 'Blocked') return `${team} get a shot away at ${min}' but it's blocked — pressure without payoff.`;
      return `${team} fire it wide at ${min}'. Half-chance; the price barely flickers.`;
    }
    case 'VAR':
      return e.varOutcome === 'Overturned'
        ? `🟥 VAR overturns it (${min}')! ${e.varType ?? 'Decision'} reversed — expect a sharp repricing.`
        : `VAR checking ${e.varType ?? 'the play'} at ${min}'… ${e.varOutcome === 'Stands' ? 'decision stands — markets exhale.' : 'markets hold their breath.'}`;
    case 'OFFSIDE':
      return `Flag's up — ${team} caught offside at ${min}'. Chance gone; momentum resets.`;
    case 'HALFTIME':
      return `Half-time. Books reopen with fresh lines — a good moment to reassess ${sc}.`;
    case 'MATCH_START':
      return `Kick-off! In-play markets are live and updating in real time. Let's read the game.`;
    case 'MATCH_END':
      return `Full time, ${sc}. Markets settle now — every prediction resolves against the TxLINE result.`;
    case 'ODDS_UPDATE': {
      const ip = e.odds?.impliedProb;
      if (!ip) return null;
      const fav = ip.home > ip.away ? (home ?? 'the home side') : (away ?? 'the away side');
      return `Odds tick at ${min}': the market now leans ${fav}. Sharp money on the move.`;
    }
    case 'SCORE_UPDATE': {
      // routine stat tick — the real feed's heartbeat. Read the run of play
      // (danger, then possession, then corners) so the booth stays alive
      // between big moments; the caller throttles how often these land.
      const st = e.stats;
      if (!st) return null;
      const h = home ?? 'the home side';
      const a = away ?? 'the away side';
      if (st.danger?.home === 'HIGH_DANGER')
        return pick([
          `${min}' — ${h} pouring forward, this is a big chance brewing…`,
          `Danger! ${h} are right on top of the box at ${min}'.`,
        ]);
      if (st.danger?.away === 'HIGH_DANGER')
        return pick([
          `${min}' — ${a} pouring forward, this is a big chance brewing…`,
          `Danger! ${a} are right on top of the box at ${min}'.`,
        ]);
      if (typeof st.possession === 'number') {
        const p = Math.round(st.possession);
        const leader = p >= 50 ? h : a;
        const share = p >= 50 ? p : 100 - p;
        if (share >= 58) return pick([
          `${min}' — ${leader} bossing it: ${share}% of the ball and patiently probing.`,
          `${leader} control the tempo at ${min}' — ${share}% possession, the pressure is building.`,
        ]);
        return pick([
          `${min}' — a proper contest: possession ${p}–${100 - p}${sc ? `, still ${sc}` : ''}.`,
          `Even game at ${min}' — neither side letting the other settle${sc ? ` (${sc})` : ''}.`,
        ]);
      }
      const ct = (st.cornersHome ?? 0) + (st.cornersAway ?? 0);
      if (ct > 0) return `${min}' — ${ct} corner${ct > 1 ? 's' : ''} so far; set-piece backers are watching closely.`;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Clean a display line for the VOICE: drop emoji/symbols the reader would
 * otherwise sound out, normalise the score dash to "to", and tidy spacing — so
 * a rich on-screen line reads as natural spoken commentary.
 */
export function forSpeech(line: string): string {
  return line
    .replace(/[\p{Extended_Pictographic}☀-➿️]/gu, ' ') // emoji/symbols
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2')                       // 2–1 → "2 to 1"
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Which events are worth a line, and how often odds ticks may speak (ms). */
export const PUNDIT_ALWAYS = new Set(['GOAL', 'RED_CARD', 'VAR', 'HALFTIME', 'MATCH_START', 'MATCH_END', 'SUBSTITUTION']);

/**
 * A SHORT, punchy line to actually *speak* — deliberately terser than the line
 * shown on screen so the voice keeps pace and doesn't clip against the next
 * event. Returns null for routine events that shouldn't be voiced at all (so
 * the booth only talks over the moments that matter). `high` priority barges in.
 */
export function spokenFor(e: BozEvent, _home?: string, _away?: string): { text: string; priority: 'high' | 'low' } | null {
  const team = e.team ?? 'them';
  const score = e.score ? `${e.score.home}, ${e.score.away}` : '';
  const who = scorerName(e);
  switch (e.type) {
    case 'GOAL':
      return { text: who ? `Goal! ${who}, ${team}.${score ? ` It's ${score}.` : ''}` : `Goal! ${team}.${score ? ` It's ${score}.` : ''}`, priority: 'high' };
    case 'PENALTY':
      return { text: `Penalty, ${team}!`, priority: 'high' };
    case 'RED_CARD':
      return { text: who ? `Red card! ${who} sent off.` : `Red card! ${team} down to ten.`, priority: 'high' };
    case 'VAR':
      return { text: `V.A.R. check.`, priority: 'high' };
    case 'MATCH_START':
      return { text: `Kick off. We're underway.`, priority: 'low' };
    case 'HALFTIME':
      return { text: `Half time.${score ? ` ${score}.` : ''}`, priority: 'low' };
    case 'MATCH_END':
      return { text: `Full time.${score ? ` ${score}.` : ''}`, priority: 'high' };
    default:
      return null; // corners, cards, subs, odds — shown on screen, not spoken
  }
}
