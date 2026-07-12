'use client';

/**
 * Commentary speech engine (Web Speech API). Two things make the stock browser
 * TTS sound robotic and step on itself:
 *   1. it defaults to a flat, low-quality voice, and
 *   2. every line calls cancel()+speak(), so overlapping events clip each other.
 *
 * This module fixes both: it hunts down the most natural voice the platform
 * offers (Edge/Windows "Online (Natural)", Chrome/Google, Apple enhanced), and
 * it runs a small PRIORITY QUEUE — big moments (goals, reds) barge in and are
 * always spoken; minor chatter is only voiced when the booth is quiet, so lines
 * never overlap. A subscriber is notified while a line is on air (for the UI).
 */

const PREFERRED: RegExp[] = [
  /Microsoft.*Online.*\(Natural\)/i,                 // Edge/Win neural (best)
  /Microsoft (Guy|Andrew|Christopher|Eric|Ryan|Brian|Davis|Aria|Jenny|Sonia)/i,
  /Google (UK English Male|US English)/i,            // Chrome
  /(Daniel|Arthur|Oliver|Aaron|Alex).*(English|\(.*\))/i, // Apple enhanced male
  /\b(Natural|Neural|Enhanced|Premium)\b/i,
  /Microsoft Mark/i,                                 // local Windows — warmer than David
];

let voice: SpeechSynthesisVoice | null = null;
let queue: string[] = [];
let active = false;
/** commentator energy: 0 calm · 1 live · 2 hyped — affects web-speech pace/pitch. */
let excitement = 1;
let listener: ((onAir: boolean) => void) | null = null;
let audioEl: HTMLAudioElement | null = null;
/** null = untried, true = neural /api/tts works, false = no provider (204) → skip it. */
let neuralOk: boolean | null = null;
/** bumped on every barge-in / stop so a stale async drain can't clobber state. */
let gen = 0;

const hasWindow = () => typeof window !== 'undefined';
const supported = () => hasWindow() && 'speechSynthesis' in window;

function pick(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  const en = all.filter(v => /^en(-|_|$)/i.test(v.lang));
  for (const re of PREFERRED) {
    const v = en.find(v => re.test(v.name));
    if (v) return v;
  }
  return en.find(v => v.default) ?? en[0] ?? all[0] ?? null;
}

/** Load + cache the best available voice (voices arrive async in some browsers). */
export function initVoice() {
  if (!supported()) return;
  const set = () => { voice = pick(); };
  set();
  window.speechSynthesis.onvoiceschanged = set;
}

export function voiceName(): string | null {
  return voice?.name ?? null;
}

/** Set commentator energy (0 calm · 1 live · 2 hyped). */
export function setExcitement(level: number) {
  excitement = Math.max(0, Math.min(2, Math.round(level)));
}
export function getExcitement(): number {
  return excitement;
}

/** True once a neural /api/tts voice has successfully played (human voice on). */
export function neuralActive(): boolean {
  return neuralOk === true;
}

/** Notify when the booth goes on/off air (drives the equaliser + ON AIR pill). */
export function onSpeaking(cb: (onAir: boolean) => void) {
  listener = cb;
  return () => { if (listener === cb) listener = null; };
}

function clean(text: string): string {
  return text
    .replace(/[–—]/g, ', ')                 // dashes read badly
    .replace(/[^\p{L}\p{N} .,!'?]/gu, ' ')   // strip emoji/symbols
    .replace(/\s+/g, ' ')
    .trim();
}

/** Play a genuinely human voice from /api/tts. Returns false to fall back. */
async function speakNeural(text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean(text) }),
    });
    if (res.status === 204) { neuralOk = false; return false; } // no provider configured
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('audio')) return false;
    neuralOk = true;
    const url = URL.createObjectURL(await res.blob());
    await new Promise<void>(resolve => {
      const a = new Audio(url);
      audioEl = a;
      const end = () => { URL.revokeObjectURL(url); if (audioEl === a) audioEl = null; resolve(); };
      a.onended = end; a.onerror = end;
      a.play().catch(end);
    });
    return true;
  } catch { return false; }
}

/** Browser Web Speech fallback. */
function speakWeb(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!supported()) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(clean(text));
    if (voice) u.voice = voice;
    // a warm pundit read whose pace + pitch rise with the excitement setting;
    // tiny per-line variation so consecutive lines don't sound identical.
    const rate = [0.95, 1.03, 1.14][excitement] ?? 1.03;
    const pitch = [0.9, 0.98, 1.08][excitement] ?? 0.98;
    u.rate = rate + Math.random() * 0.04;
    u.pitch = pitch + Math.random() * 0.08;
    u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function drain() {
  if (active || queue.length === 0 || !hasWindow()) return;
  active = true;
  listener?.(true);
  const myGen = gen;
  const text = queue.shift()!;
  let ok = false;
  if (neuralOk !== false) ok = await speakNeural(text); // try neural unless we know there's no provider
  if (!ok) await speakWeb(text);
  if (gen !== myGen) return; // a barge-in superseded us — leave shared state to the new drain
  active = false;
  listener?.(false);
  drain();
}

function stopCurrent() {
  gen++; // invalidate any in-flight drain awaiting playback
  if (audioEl) { try { audioEl.pause(); } catch { /* ignore */ } audioEl = null; }
  if (supported()) window.speechSynthesis.cancel();
}

/**
 * Queue a line for speech.
 *  - priority 'high' (goals/reds/penalties): NEVER cuts the current line off —
 *    it lets the commentator finish, then speaks this next. The backlog is
 *    capped to the two most-recent big moments so a flurry of goals can't fall
 *    far behind (older pending lines are dropped, the current one always plays
 *    out in full).
 *  - priority 'low': only speak if nothing else is talking; otherwise drop it,
 *    so routine chatter never piles up or clips a big moment.
 */
export function say(text: string, priority: 'high' | 'low' = 'low') {
  if (!hasWindow() || !text) return;
  if (priority === 'high') {
    queue = [...queue, text].slice(-2); // finish current, then play up to 2 pending
    if (!active) drain();
  } else {
    if (active || queue.length > 0) return;
    queue.push(text);
    drain();
  }
}

/** Silence everything (voice toggled off / component unmount). */
export function stopSpeaking() {
  queue = [];
  active = false;
  stopCurrent();
  listener?.(false);
}
