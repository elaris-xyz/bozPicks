'use client';

/**
 * Tiny WebAudio sound + haptics engine — no audio assets, just synthesised
 * tones. Gesture-gated (browsers block audio until the first interaction) and
 * user-toggleable (persisted). Purely additive: silent until unlocked.
 */

let ctx: AudioContext | null = null;
let enabled = true;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function initSfx() {
  if (typeof window === 'undefined') return;
  enabled = localStorage.getItem('boz_sfx') !== 'off';
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  if (typeof window !== 'undefined') localStorage.setItem('boz_sfx', on ? 'on' : 'off');
}
export function isSfxEnabled() { return enabled; }

function vibrate(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch { /* unsupported */ }
}

function tone(freqs: number[], dur: number, type: OscillatorType = 'sine', gain = 0.06) {
  const c = getCtx();
  if (!c || !enabled || !unlocked) return;
  const t = c.currentTime;
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    const start = t + i * 0.045;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  });
}

export type SfxKind = 'goal' | 'red' | 'win' | 'lose' | 'settle' | 'tick' | 'end' | 'deposit' | 'cashout';

export function playSfx(kind: SfxKind) {
  if (!enabled) return;
  switch (kind) {
    case 'goal':    tone([523, 659, 784, 1046], 0.5, 'triangle', 0.07); vibrate([40, 30, 70]); break;
    case 'red':     tone([150, 110], 0.5, 'sawtooth', 0.05); vibrate(120); break;
    case 'win':     tone([784, 1046], 0.25, 'sine', 0.06); vibrate(25); break;
    case 'lose':    tone([320, 200], 0.28, 'sine', 0.05); break;
    case 'settle':  tone([659, 988], 0.4, 'triangle', 0.05); vibrate([20, 20, 20]); break;
    case 'end':     tone([523, 659, 784], 0.7, 'sine', 0.05); break;
    case 'tick':    tone([880], 0.05, 'square', 0.03); break;
    // coins landing in the vault — bright ascending shimmer
    case 'deposit': tone([659, 880, 1175, 1568], 0.42, 'triangle', 0.06); vibrate([15, 25, 40]); break;
    // cash-out — a warm confirming descent
    case 'cashout': tone([1175, 784, 523], 0.4, 'sine', 0.06); vibrate([25, 20]); break;
  }
}
