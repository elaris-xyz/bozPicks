import type { BozEvent } from '@bozpicks/shared';

/**
 * Live "AI Pundit" line generator. Turns a TxLINE event into a punchy,
 * contextual commentary line — what happened and what the market now thinks.
 * Local + instant so it keeps pace with the live stream (an LLM upgrade can
 * swap in via /api later without changing the UI).
 */

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function punditLine(e: BozEvent, home?: string, away?: string): string | null {
  const min = e.matchMinute;
  const team = e.team ?? 'The side';
  const sc = e.score ? `${e.score.home}–${e.score.away}` : '';

  switch (e.type) {
    case 'GOAL':
      return pick([
        `⚽ ${team} strike at ${min}'! ${sc} now — expect the market to pile in and their price to tumble.`,
        `GOAL, ${team}! ${sc} at ${min}'. Momentum's flipped; live traders are already repricing this.`,
        `${team} find the net (${min}'). ${sc}. That's a 15–30% swing in win probability right there.`,
      ]);
    case 'RED_CARD':
      return pick([
        `🟥 Red card — ${team} down to ten at ${min}'! Draw and opposition odds are about to shorten hard.`,
        `${team} lose a man (${min}'). Numbers matter now; the model favours their opponents from here.`,
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
    default:
      return null;
  }
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
  switch (e.type) {
    case 'GOAL':
      return { text: `Goal! ${team}.${score ? ` It's ${score}.` : ''}`, priority: 'high' };
    case 'PENALTY':
      return { text: `Penalty, ${team}!`, priority: 'high' };
    case 'RED_CARD':
      return { text: `Red card! ${team} down to ten.`, priority: 'high' };
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
