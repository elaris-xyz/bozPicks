'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, BozEventType } from '@bozpicks/shared';
import { punditLine, PUNDIT_ALWAYS, spokenFor, forSpeech } from '@/lib/pundit';
import { initVoice, onSpeaking, say, stopSpeaking, voiceName, neuralActive, setExcitement, setVoicePref, clearPending } from '@/lib/tts';

// Selectable neural commentator voices (Groq/Orpheus — verified valid).
const VOICES = [
  { id: 'daniel', label: 'Daniel', sex: 'M' },
  { id: 'austin', label: 'Austin', sex: 'M' },
  { id: 'troy',   label: 'Troy',   sex: 'M' },
  { id: 'diana',  label: 'Diana',  sex: 'F' },
  { id: 'hannah', label: 'Hannah', sex: 'F' },
  { id: 'autumn', label: 'Autumn', sex: 'F' },
];

/**
 * Live AI Pundit booth. Turns the TxLINE stream into running commentary with a
 * typing effect and a natural-voice read. The voice only speaks the moments
 * that matter (goals, reds, penalties) in short punchy lines — routine chatter
 * is shown on screen but never voiced — so lines never clip over each other.
 */

const BIG = new Set<BozEventType>(['GOAL', 'RED_CARD', 'PENALTY']);
interface Line { id: string; text: string; ai?: boolean; kind: BozEventType }

export function PunditRail({ home: homeProp, away: awayProp, feedEvent }: { home?: string; away?: string; feedEvent?: BozEvent | null } = {}) {
  // The replay page always passes `feedEvent` (even as null before the first
  // tick); /play never does. That distinguishes "driven locally by replay
  // playback" from "driven by the live global stream" — without it, replay
  // would also speak commentary for whatever real match happens to be live
  // elsewhere on the site while you're scrubbing through a past one.
  const isReplay = feedEvent !== undefined;
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState('');
  const [tts, setTts] = useState(false);
  const [onAir, setOnAir] = useState(false);
  const [vName, setVName] = useState<string | null>(null);
  const [neural, setNeural] = useState(false);
  const [excite, setExcite] = useState(1); // 0 calm · 1 live · 2 hyped
  const exciteRef = useRef(excite);
  exciteRef.current = excite;
  const [pvoice, setPvoice] = useState('daniel');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const lastOdds = useRef(0);
  const lastReading = useRef(0);
  const seeded = useRef(false);
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  const scrollRef = useRef<HTMLDivElement>(null);

  // load the best available voice + track on-air state for the equaliser
  useEffect(() => {
    initVoice();
    const saved = Number(localStorage.getItem('boz_pundit_excite'));
    if (saved === 0 || saved === 1 || saved === 2) { setExcite(saved); setExcitement(saved); }
    const sv = localStorage.getItem('boz_pundit_voice');
    if (sv && VOICES.some(v => v.id === sv)) { setPvoice(sv); setVoicePref(sv); } else { setVoicePref('daniel'); }
    const t = setTimeout(() => setVName(voiceName()), 400);
    const off = onSpeaking(air => { setOnAir(air); if (!air) setNeural(neuralActive()); });
    return () => { clearTimeout(t); off(); stopSpeaking(); };
  }, []);

  const chooseExcite = (level: number) => {
    setExcite(level); setExcitement(level);
    try { localStorage.setItem('boz_pundit_excite', String(level)); } catch { /* ignore */ }
  };
  const chooseVoice = (id: string) => {
    setPvoice(id); setVoicePref(id); setVoiceOpen(false);
    try { localStorage.setItem('boz_pundit_voice', id); } catch { /* ignore */ }
  };

  // The commentary brain — shared by BOTH feeds: the live SSE stream (play /
  // match pages) and a locally-driven replay (the replay page hands each event
  // in as it plays it back via the `feedEvent` prop). Identical booth either way.
  const handleEvent = useCallback((e: BozEvent) => {
      const ex = exciteRef.current; // 0 calm · 1 live · 2 hyped
      // a REAL fixture plays at 1× — minutes between moments, so every
      // classified event deserves a line. Only fast demo replays (events
      // seconds apart) need the random thinning so the booth isn't a wall.
      const isDemo = e.matchId.startsWith('demo-');
      if (e.type === 'ODDS_UPDATE') {
        if (Date.now() - lastOdds.current < (ex >= 2 ? 8000 : 12000)) return;  // throttle ticks
        lastOdds.current = Date.now();
      } else if (e.type === 'SCORE_UPDATE') {
        // the real feed's routine stat ticks (possession/danger) — one
        // momentum read every ~20s keeps the booth talking between moments
        if (Date.now() - lastReading.current < 20_000) return;
        lastReading.current = Date.now();
      } else if (!PUNDIT_ALWAYS.has(e.type) && isDemo) {
        // routine chatter (corners/shots/yellows): let more through the higher
        // the energy so the booth never goes quiet — calm 25% · live 55% · hyped 90%
        const keep = ex >= 2 ? 0.9 : ex === 1 ? 0.55 : 0.25;
        if (Math.random() > keep) return;
      }

      const push = (text: string, ai = false) => {
        if (!text) return;
        setLines(prev => [...prev.slice(-14), { id: `${e.id}-${Date.now()}`, text, ai, kind: e.type }]);
      };

      // GOAL / RED — the commentator's moment. The goal *sound* + on-screen burst
      // fire instantly; then, a beat later, the pundit delivers the FULL human
      // line (Claude, with a template fallback) both on screen AND in the voice —
      // just like real TV, where the crowd roars first and the caller's line
      // lands a second later. That small lag is intentional, not a glitch.
      if (e.type === 'GOAL' || e.type === 'RED_CARD') {
        const deliver = (line: string, ai: boolean) => {
          if (!line) return;
          push(line, ai);
          if (ttsRef.current) say(forSpeech(line), 'high'); // rich line, spoken
        };
        fetch('/api/pundit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: e, home, away }),
        })
          .then(r => r.json())
          .then((d: { line?: string; ai?: boolean }) => deliver(d.line ?? punditLine(e, home, away) ?? '', !!d.ai))
          .catch(() => deliver(punditLine(e, home, away) ?? '', false));
      } else {
        const line = punditLine(e, home, away) ?? '';
        push(line);
        // at full time, drop any queued chatter so the pundit wraps up promptly
        // rather than talking on for several seconds after the whistle
        if (e.type === 'MATCH_END') clearPending();
        if (ttsRef.current) {
          const s = spokenFor(e, home, away);
          if (s) say(s.text, s.priority);
          // Hyped: also read the on-screen chatter (low priority — only when the
          // booth is quiet), so the pundit keeps talking between big moments.
          else if (ex >= 2 && line) say(forSpeech(line), 'low');
        }
      }
  }, [home, away]);

  // replay feed: the replay page hands us each event as it plays it back
  useEffect(() => {
    if (feedEvent) handleEvent(feedEvent);
  }, [feedEvent, handleEvent]);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (isReplay) return; // replay drives the booth via feedEvent, not the live stream
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (msg.catchup) {
        // history replay, not a live moment — but seed ONE opening read from it
        // so the booth speaks the moment you arrive mid-match instead of
        // sitting silent until the next live record (real matches can go
        // minutes between events). Catchup replays oldest→newest, so keep
        // replacing the seed while it's the only line — it converges to the
        // freshest reading in history.
        if (!e.stats) return;
        const opener = punditLine({ ...e, type: 'SCORE_UPDATE' }, home, away);
        if (!opener) return;
        seeded.current = true;
        lastReading.current = Date.now();
        setLines(prev => (prev.some(l => !l.id.endsWith('-seed'))
          ? prev
          : [{ id: `${e.id}-seed`, text: opener, kind: 'SCORE_UPDATE' }]));
        return;
      }

      handleEvent(e);
    },
  });

  const toggleTts = () => {
    setTts(t => {
      const next = !t;
      if (!next) stopSpeaking();
      else initVoice();
      return next;
    });
  };

  // typing effect for the newest line
  const latestLine = lines[lines.length - 1];
  const latest = latestLine?.text ?? '';
  useEffect(() => {
    if (!latest) return;
    setTyped('');
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      setTyped(latest.slice(0, i));
      if (i >= latest.length) clearInterval(iv);
    }, 18);
    return () => clearInterval(iv);
  }, [latest]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [typed]);

  return (
    <div className="glass p-4 relative overflow-hidden h-full flex flex-col"
         style={onAir ? { borderColor: 'rgba(167,139,250,0.4)', boxShadow: '0 0 26px rgba(167,139,250,0.14)' } : undefined}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* mic avatar — pulses on air */}
          <span className="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))', color: '#fff' }}>
            {onAir && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(167,139,250,0.45)' }} />}
            <svg viewBox="0 0 24 24" className="relative w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-100 leading-none">AI Pundit</p>
              {onAir && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.5)' }}>
                  <span className="w-1 h-1 rounded-full badge-live" style={{ background: '#f87171' }} />On air
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">
              {tts
                ? (neural ? 'Neural voice · human read' : vName ? `Voice · ${vName.replace(/Microsoft |Google |\(.*\)/g, '').trim() || vName}` : 'Browser voice')
                : 'Claude Haiku on the big moments'}
            </p>
          </div>
        </div>
        <button onClick={toggleTts} title="Commentary voice"
          className="flex-shrink-0 text-[10px] font-bold px-2.5 h-7 rounded-full transition-all flex items-center gap-1"
          style={tts ? { background: 'var(--purple-dim)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.45)' } : { background: 'var(--glass-bg)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {tts ? <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></>
                 : <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6M16 9l6 6" /></>}
          </svg>
          {tts ? 'On' : 'Voice'}
        </button>
      </div>

      {/* commentator controls — energy (how much he talks + how hyped) + voice */}
      {tts && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* energy: a polished 3-stop selector with animated signal bars */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)' }}>
            {[
              { lvl: 0, label: 'Calm', bars: 1 },
              { lvl: 1, label: 'Live', bars: 2 },
              { lvl: 2, label: 'Hyped', bars: 3 },
            ].map(o => {
              const on = excite === o.lvl;
              return (
                <button key={o.lvl} onClick={() => chooseExcite(o.lvl)} title={`${o.label} energy`}
                  className="flex items-center gap-1 px-2 h-6 rounded-lg transition-all"
                  style={on
                    ? { background: 'linear-gradient(135deg, rgb(var(--c-purple)), rgb(var(--c-blue)))', boxShadow: '0 0 12px rgba(167,139,250,0.4)' }
                    : {}}>
                  <span className="flex items-end gap-[2px] h-3.5">
                    {[0, 1, 2].map(b => (
                      <span key={b} className="w-[3px] rounded-full transition-all" style={{
                        height: `${4 + b * 4}px`,
                        background: on ? (b < o.bars ? '#fff' : 'rgba(255,255,255,0.35)') : (b < o.bars ? 'rgba(167,139,250,0.7)' : 'rgba(255,255,255,0.15)'),
                      }} />
                    ))}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: on ? '#fff' : '#8b98ad' }}>{o.label}</span>
                </button>
              );
            })}
          </div>

          {/* voice picker */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setVoiceOpen(o => !o)} title="Commentator voice"
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)', color: '#c4b5fd' }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
              </svg>
              <span className="text-[11px] font-bold">{VOICES.find(v => v.id === pvoice)?.label ?? 'Voice'}</span>
              <svg viewBox="0 0 24 24" className={`w-3 h-3 transition-transform ${voiceOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {voiceOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setVoiceOpen(false)} />
                <div className="absolute right-0 mt-1.5 z-50 w-36 rounded-xl p-1 anim-in"
                     style={{ background: '#0d1526', border: '1px solid var(--glass-border)', boxShadow: '0 12px 34px rgba(0,0,0,0.55)' }}>
                  {VOICES.map(v => {
                    const on = v.id === pvoice;
                    return (
                      <button key={v.id} onClick={() => chooseVoice(v.id)}
                        className="w-full flex items-center justify-between px-2.5 h-8 rounded-lg text-[12px] font-semibold transition-colors"
                        style={on ? { background: 'var(--purple-dim)', color: 'var(--purple)' } : { color: '#cbd5e1' }}
                        onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                        {v.label}
                        <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ background: v.sex === 'M' ? 'rgba(59,130,246,0.18)' : 'rgba(236,72,153,0.18)', color: v.sex === 'M' ? '#93c5fd' : '#f9a8d4' }}>{v.sex}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* live equaliser — animates while a line is on air */}
      <div className="flex items-end gap-[3px] h-5 mb-3 px-0.5" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} className="flex-1 rounded-full origin-bottom"
                style={{
                  background: onAir ? 'linear-gradient(180deg,var(--purple),var(--blue))' : 'rgba(255,255,255,0.08)',
                  height: '100%',
                  transform: onAir ? undefined : 'scaleY(0.18)',
                  animation: onAir ? `boz-eq ${420 + (i % 5) * 90}ms ease-in-out ${i * 30}ms infinite alternate` : 'none',
                }} />
        ))}
      </div>

      <div ref={scrollRef} className="space-y-2 flex-1 min-h-[10rem] max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
        {lines.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">The pundit is watching — start a live match.</p>
        )}
        {lines.slice(0, -1).map(l => {
          const big = BIG.has(l.kind);
          return (
            <div key={l.id} className="text-[13px] leading-snug rounded-xl px-3 py-2 anim-in"
                 style={big
                   ? { color: '#e9d5ff', background: 'rgba(167,139,250,0.08)', borderLeft: '2px solid var(--purple)', border: '1px solid rgba(167,139,250,0.25)' }
                   : { color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
              {l.ai && <span className="text-[8px] font-black mr-1.5 px-1 py-0.5 rounded align-middle" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>HAIKU</span>}
              {l.text}
            </div>
          );
        })}
        {latest && (
          <div className="text-[13px] text-gray-100 leading-snug rounded-xl px-3 py-2"
               style={{ background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.3)' }}>
            {latestLine?.ai && <span className="text-[8px] font-black mr-1.5 px-1 py-0.5 rounded align-middle" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>HAIKU</span>}
            {typed}<span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--blue)' }} />
          </div>
        )}
      </div>
    </div>
  );
}
