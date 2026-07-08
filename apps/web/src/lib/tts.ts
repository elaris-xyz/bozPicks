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
let listener: ((onAir: boolean) => void) | null = null;

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

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

function drain() {
  if (active || queue.length === 0 || !supported()) return;
  const text = queue.shift()!;
  const u = new SpeechSynthesisUtterance(clean(text));
  if (voice) u.voice = voice;
  // a warm pundit read: near-natural pace, slightly lowered pitch, tiny
  // per-line variation so consecutive lines don't sound identical/robotic.
  u.rate = 1.0;
  u.pitch = 0.92 + Math.random() * 0.1;
  u.volume = 1;
  active = true;
  listener?.(true);
  const done = () => { active = false; listener?.(false); drain(); };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}

/**
 * Queue a line for speech.
 *  - priority 'high' (goals/reds/penalties): barge in — clear the queue, stop
 *    the current line, and speak this immediately.
 *  - priority 'low': only speak if nothing else is talking; otherwise drop it,
 *    so routine chatter never piles up or clips a big moment.
 */
export function say(text: string, priority: 'high' | 'low' = 'low') {
  if (!supported() || !text) return;
  if (priority === 'high') {
    queue = [text];
    if (active) { window.speechSynthesis.cancel(); active = false; }
    drain();
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
  if (supported()) window.speechSynthesis.cancel();
  listener?.(false);
}
