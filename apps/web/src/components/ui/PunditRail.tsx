'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, BozEventType } from '@bozpicks/shared';
import { punditLine, PUNDIT_ALWAYS, spokenFor } from '@/lib/pundit';
import { initVoice, onSpeaking, say, stopSpeaking, voiceName, neuralActive } from '@/lib/tts';

/**
 * Live AI Pundit booth. Turns the TxLINE stream into running commentary with a
 * typing effect and a natural-voice read. The voice only speaks the moments
 * that matter (goals, reds, penalties) in short punchy lines — routine chatter
 * is shown on screen but never voiced — so lines never clip over each other.
 */

const BIG = new Set<BozEventType>(['GOAL', 'RED_CARD', 'PENALTY']);
interface Line { id: string; text: string; ai?: boolean; kind: BozEventType }

export function PunditRail({ home: homeProp, away: awayProp }: { home?: string; away?: string } = {}) {
  const live = useLiveMatch();
  const home = homeProp ?? live?.homeTeam;
  const away = awayProp ?? live?.awayTeam;
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState('');
  const [tts, setTts] = useState(false);
  const [onAir, setOnAir] = useState(false);
  const [vName, setVName] = useState<string | null>(null);
  const [neural, setNeural] = useState(false);
  const lastOdds = useRef(0);
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  const scrollRef = useRef<HTMLDivElement>(null);

  // load the best available voice + track on-air state for the equaliser
  useEffect(() => {
    initVoice();
    const t = setTimeout(() => setVName(voiceName()), 400);
    const off = onSpeaking(air => { setOnAir(air); if (!air) setNeural(neuralActive()); });
    return () => { clearTimeout(t); off(); stopSpeaking(); };
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (Date.now() - new Date(e.timestamp).getTime() > 8000) return; // ignore catch-up

      if (e.type === 'ODDS_UPDATE') {
        if (Date.now() - lastOdds.current < 12000) return;   // throttle ticks
        lastOdds.current = Date.now();
      } else if (!PUNDIT_ALWAYS.has(e.type) && Math.random() > 0.5) {
        return; // sprinkle in some corners/yellows, not all
      }

      const push = (text: string, ai = false) => {
        if (!text) return;
        setLines(prev => [...prev.slice(-14), { id: `${e.id}-${Date.now()}`, text, ai, kind: e.type }]);
      };

      // Voice: only the big moments, in a short punchy line (barge-in). Routine
      // events are shown on screen but not spoken — no overlap, no clipping.
      if (ttsRef.current) {
        const s = spokenFor(e, home, away);
        if (s) say(s.text, s.priority);
      }

      // Screen line: big moments get a real LLM line (Claude Haiku, with a
      // template fallback); everything else uses the instant local template.
      if (e.type === 'GOAL' || e.type === 'RED_CARD') {
        fetch('/api/pundit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: e, home, away }),
        })
          .then(r => r.json())
          .then((d: { line?: string; ai?: boolean }) => push(d.line ?? punditLine(e, home, away) ?? '', !!d.ai))
          .catch(() => push(punditLine(e, home, away) ?? ''));
      } else {
        push(punditLine(e, home, away) ?? '');
      }
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
    <div className="glass p-4 relative overflow-hidden"
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
          className="text-[10px] font-bold px-2.5 h-7 rounded-full transition-all flex items-center gap-1 flex-shrink-0"
          style={tts ? { background: 'var(--purple-dim)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.45)' } : { background: 'var(--glass-bg)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {tts ? <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></>
                 : <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6M16 9l6 6" /></>}
          </svg>
          {tts ? 'Voice on' : 'Voice'}
        </button>
      </div>

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

      <div ref={scrollRef} className="space-y-2 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
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
