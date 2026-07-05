'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent } from '@bozpicks/shared';
import { punditLine, PUNDIT_ALWAYS } from '@/lib/pundit';

/**
 * Live AI Pundit rail: turns the TxLINE stream into running commentary with a
 * typing effect and optional text-to-speech — the "AI pundit bot" experience,
 * on-page.
 */

interface Line { id: string; text: string }

export function PunditRail({ home, away }: { home?: string; away?: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState('');
  const [tts, setTts] = useState(false);
  const lastOdds = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (Date.now() - new Date(e.timestamp).getTime() > 8000) return; // ignore catch-up

      if (e.type === 'ODDS_UPDATE') {
        if (Date.now() - lastOdds.current < 12000) return;   // throttle ticks
        lastOdds.current = Date.now();
      } else if (!PUNDIT_ALWAYS.has(e.type) && Math.random() > 0.55) {
        return; // sprinkle in some corners/yellows, not all
      }

      const text = punditLine(e, home, away);
      if (!text) return;
      const line = { id: `${e.id}-${Date.now()}`, text };
      setLines(prev => [...prev.slice(-14), line]);
      if (tts && typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N} .,'!–-]/gu, ''));
        u.rate = 1.08; u.pitch = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    },
  });

  // typing effect for the newest line
  const latest = lines[lines.length - 1]?.text ?? '';
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
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))', color: '#fff' }}>AI</span>
          <div>
            <p className="text-sm font-bold text-gray-100 leading-none">AI Pundit</p>
            <p className="text-[10px] text-gray-600 mt-0.5">reading the market live</p>
          </div>
        </div>
        <button onClick={() => setTts(t => !t)} title="Text to speech"
          className="text-[10px] font-bold px-2.5 h-7 rounded-full transition-all flex items-center gap-1"
          style={tts ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.4)' } : { background: 'var(--glass-bg)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
          {tts ? 'Voice on' : 'Voice'}
        </button>
      </div>

      <div ref={scrollRef} className="space-y-2 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
        {lines.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">The pundit is watching — start a live match.</p>
        )}
        {lines.slice(0, -1).map(l => (
          <div key={l.id} className="text-[13px] text-gray-300 leading-snug rounded-xl px-3 py-2 anim-in"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            {l.text}
          </div>
        ))}
        {latest && (
          <div className="text-[13px] text-gray-100 leading-snug rounded-xl px-3 py-2"
               style={{ background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.3)' }}>
            {typed}<span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--blue)' }} />
          </div>
        )}
      </div>
    </div>
  );
}
