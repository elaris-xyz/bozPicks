'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { playSfx } from '@/lib/sfx';
import { hiloReading, isPossession } from '@/lib/hilo';
import { ShareModal } from './ShareModal';

/**
 * Hi-Lo: guess whether the next TxLINE reading will be higher or lower. Live,
 * replayable across matches, streak-based, shareable. The reading is home's
 * possession share — the one soccer stat that genuinely swings both ways — and
 * falls back to a TxLINE danger/corner attacking-pressure index when a feed
 * omits possession, so it is always a real read of the game, never a coin flip
 * on a monotonic counter. (see lib/hilo.ts)
 */

type Guess = 'HIGHER' | 'LOWER';
type Round = { value: number; guess: Guess; result: 'WIN' | 'LOSE' } | null;

const BEST_KEY = 'boz_hilo_best';

export function HiLoGame() {
  const [current, setCurrent] = useState<number | null>(null);
  const [pending, setPending] = useState<{ value: number; guess: Guess } | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [last, setLast] = useState<Round>(null);
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  const [readingLabel, setReadingLabel] = useState('Possession');
  const [recordBreak, setRecordBreak] = useState(0); // timestamp of the last record smash → triggers the burst
  const live = useLiveMatch();
  const isLive = !!live?.live;

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  // synchronous mirrors so the SSE callback can detect a record break reliably
  const streakRef = useRef(0);
  const bestRef = useRef(0);
  // the id of the match we're reading — events from other fixtures (the real
  // feed carries every match) must not resolve a guess
  const liveIdRef = useRef<string | null>(null);
  liveIdRef.current = live?.id ?? null;

  useEffect(() => {
    const b = Number(localStorage.getItem(BEST_KEY) || 0);
    if (b) { setBest(b); bestRef.current = b; }
  }, []);

  // No live match → no reading. Clear any value left over from a finished match
  // so the bar shows "—" instead of a stale (or fabricated 50/50) percentage.
  useEffect(() => {
    if (!isLive) { setCurrent(null); setPending(null); }
  }, [isLive]);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      if (liveIdRef.current && e.matchId !== liveIdRef.current) return;
      const stats = e.stats as MatchStats | undefined;
      const next = hiloReading(stats);
      if (next == null) return;
      setReadingLabel(isPossession(stats) ? 'Possession' : 'Pressure');

      const p = pendingRef.current;
      if (p) {
        const win = p.guess === 'HIGHER' ? next > p.value : next < p.value;
        // ties don't count — keep the guess alive against the next reading
        if (next === p.value) { setCurrent(next); return; }
        // resolve EXACTLY once: the real feed delivers events in bursts (a
        // snapshot poll publishes many records back-to-back), and React hasn't
        // re-rendered between them — clearing only via setPending left the ref
        // stale, so ONE guess was scored again by every event in the burst
        // (the "+10 per correct answer" bug). Clear the ref synchronously.
        pendingRef.current = null;
        setLast({ value: next, guess: p.guess, result: win ? 'WIN' : 'LOSE' });
        setRounds(r => r + 1);
        setFlash(win ? 'win' : 'lose');
        playSfx(win ? 'win' : 'lose');
        setTimeout(() => setFlash(null), 700);
        if (win) {
          const ns = streakRef.current + 1;
          streakRef.current = ns;
          setStreak(ns);
          if (ns > bestRef.current) {
            const hadRecord = bestRef.current > 0;
            bestRef.current = ns;
            setBest(ns);
            localStorage.setItem(BEST_KEY, String(ns));
            // smashed a real previous best → the card catches fire
            if (hadRecord) {
              setRecordBreak(Date.now());
              playSfx('goal');
              setTimeout(() => setRecordBreak(0), 1800);
            }
          }
        } else {
          streakRef.current = 0;
          setStreak(0);
        }
        setPending(null);
      }
      setCurrent(next);
    },
  });

  const guess = (g: Guess) => {
    if (current == null || pending || !isLive) return;
    setPending({ value: current, guess: g });
    playSfx('tick');
  };

  const [shareOpen, setShareOpen] = useState(false);

  const hasReading = isLive && current != null;
  const homePoss = current ?? 50;
  const awayPoss = 100 - homePoss;

  return (
    <div className={`glass sheen p-5 relative overflow-hidden h-full flex flex-col ${flash === 'lose' ? 'fx-shake' : ''} ${recordBreak ? 'fx-shake' : ''}`}
         style={{ boxShadow: recordBreak ? '0 0 60px rgba(249,115,22,0.55)' : flash === 'win' ? '0 0 40px rgba(16,185,129,0.35)' : flash === 'lose' ? '0 0 40px rgba(239,68,68,0.3)' : undefined, transition: 'box-shadow .3s' }}>

      {/* RECORD SMASHED — the card catches fire */}
      {recordBreak > 0 && (
        <div key={recordBreak} className="absolute inset-0 z-30 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="boz-record-flash absolute inset-0"
               style={{ background: 'radial-gradient(circle at 50% 60%, rgba(245,158,11,0.45), rgba(249,115,22,0.18) 45%, transparent 72%)' }} />
          {[0,1,2,3,4,5,6,7].map(i => (
            <span key={i} className="boz-record-flame absolute" style={{ left: `${6 + i * 12}%`, bottom: -6, fontSize: `${18 + (i % 3) * 6}px`, animationDelay: `${i * 60}ms` }}>🔥</span>
          ))}
          <div className="boz-record-pop relative text-center">
            <p className="font-display font-black uppercase tracking-widest" style={{ fontSize: 'clamp(1.1rem,4vw,1.7rem)', color: '#fde68a', textShadow: '0 0 24px rgba(245,158,11,0.85), 0 2px 12px rgba(0,0,0,0.8)' }}>New Record</p>
            <p className="font-display font-black leading-none mt-1" style={{ fontSize: 'clamp(2.4rem,9vw,3.4rem)', color: '#fb923c', textShadow: '0 0 34px rgba(249,115,22,0.8)' }}>{streak}<span className="text-2xl align-top ml-1">🔥</span></p>
          </div>
        </div>
      )}

      {/* +1 pop on a correct read */}
      {flash === 'win' && (
        <span className="fx-pop absolute left-1/2 top-1/2 -translate-x-1/2 z-20 font-display font-black pointer-events-none"
              style={{ fontSize: '2.6rem', color: 'var(--green)', textShadow: '0 0 24px rgba(16,185,129,0.7)' }}>
          +1{streak >= 3 ? ' 🔥' : ''}
        </span>
      )}
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-label">Hi-Lo · {readingLabel}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {isLive && live?.homeTeam
              ? <>Live: {live.homeTeam} {live.homeScore}–{live.awayScore} {live.awayTeam} · {live.minute}&rsquo;</>
              : `Guess the next ${readingLabel.toLowerCase()} swing`}
          </p>
        </div>
        {/* streak + best — arcade medallions */}
        <div className="flex items-center gap-2">
          <div className={`relative flex items-center gap-2 rounded-xl px-3 py-1.5 ${streak >= 3 ? 'fx-flame' : ''}`}
               style={streak > 0
                 ? { background: streak >= 3 ? 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(239,68,68,0.14))' : 'rgba(16,185,129,0.12)',
                     border: `1px solid ${streak >= 3 ? 'rgba(245,158,11,0.55)' : 'rgba(16,185,129,0.4)'}`,
                     boxShadow: streak >= 3 ? '0 0 18px rgba(245,158,11,0.3)' : '0 0 12px rgba(16,185,129,0.15)' }
                 : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill={streak >= 3 ? '#fbbf24' : streak > 0 ? 'var(--green)' : '#64748b'}>
              <path d="M12 2c1 3.5-1 5-2 6.5C8.7 10.4 8 12 8 13.5A4.5 4.5 0 0 0 12.5 18c2.6 0 4.5-2 4.5-4.7 0-2.7-1.6-4.7-2.8-6.3C13 5.4 12.4 3.8 12 2zM12.4 21.8c-4.5 0-7.4-3-7.4-6.9 0-2.1.8-4 2-5.6-.1.5-.1 1-.1 1.4 0 4.4 3.3 7.6 7.6 7.6 1 0 2-.2 2.9-.5-1.2 2.4-3 4-5 4z" />
            </svg>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums leading-none"
                 style={{ color: streak >= 3 ? '#fbbf24' : streak > 0 ? 'var(--green)' : '#94a3b8' }}>{streak}</p>
              <p className="text-[8px] uppercase tracking-widest text-gray-600">streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
               style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(167,139,250,0.08))', border: '1px solid rgba(245,158,11,0.35)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fcd34d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M5 4h14v3a7 7 0 0 1-14 0V4zM5 6H3v1a3 3 0 0 0 3 3M19 6h2v1a3 3 0 0 1-3 3" />
            </svg>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums leading-none text-amber-300">{best}</p>
              <p className="text-[8px] uppercase tracking-widest text-gray-600">best</p>
            </div>
          </div>
        </div>
      </div>

      {/* possession bar — dashes + empty track when there's no live reading */}
      <div className="mb-2 flex items-center justify-between text-xs font-bold">
        <span className="text-[var(--green)]">{hasReading ? `${homePoss}%` : '—'}</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-widest">{readingLabel}</span>
        <span className="text-[var(--blue)]">{hasReading ? `${awayPoss}%` : '—'}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {hasReading && (
          <>
            <div style={{ width: `${homePoss}%`, background: 'linear-gradient(90deg,var(--green),rgba(16,185,129,0.6))', transition: 'width .5s' }} />
            <div style={{ width: `${awayPoss}%`, background: 'linear-gradient(90deg,rgba(59,130,246,0.6),var(--blue))', transition: 'width .5s' }} />
          </>
        )}
      </div>

      {!isLive ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">No live match right now.</p>
          <p className="text-[11px] text-gray-600 mt-1">
            Tap the{' '}
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full align-middle" style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)' }}>
              <svg viewBox="0 0 24 24" className="w-2 h-2" fill="#fff"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
            </span>{' '}
            <span className="font-bold text-[var(--blue)]">Command Bridge</span> (bottom-left) to start one.
          </p>
        </div>
      ) : pending ? (
        <div className="text-center py-3">
          <p className="text-sm text-gray-300">
            You picked <span className="font-bold" style={{ color: pending.guess === 'HIGHER' ? 'var(--green)' : 'var(--red)' }}>{pending.guess}</span> from <span className="tabular-nums font-bold">{pending.value}%</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-1 animate-pulse">waiting for the next reading…</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => guess('HIGHER')}
            className="py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }}>
            ▲ Higher
          </button>
          <button onClick={() => guess('LOWER')}
            className="py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.4)' }}>
            ▼ Lower
          </button>
        </div>
      )}

      {/* last result + share */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <p className="text-[11px] text-gray-500">
          {last ? (
            <>Last: <span style={{ color: last.result === 'WIN' ? 'var(--green)' : 'var(--red)' }}>{last.result}</span> → {last.value}% · {rounds} rounds</>
          ) : `${rounds} rounds played`}
        </p>
        <button onClick={() => setShareOpen(true)} className="text-[11px] font-bold text-[var(--blue)] hover:brightness-125 flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Share
        </button>
      </div>

      {shareOpen && (
        <ShareModal
          data={{
            headline: `🔥 ${best} streak`,
            sub: 'Hi-Lo · reading the World Cup live from TxLINE data',
            text: `🔥 I hit a streak of ${best} on bozPicks Hi-Lo — reading the World Cup live from TxLINE data. Beat it:`,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
