'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, MatchStats } from '@bozpicks/shared';
import { playSfx } from '@/lib/sfx';
import { hiloReading, isPossession } from '@/lib/hilo';

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
  const live = useLiveMatch();
  const isLive = !!live?.live;

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const b = Number(localStorage.getItem(BEST_KEY) || 0);
    if (b) setBest(b);
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;
      const stats = e.stats as MatchStats | undefined;
      const next = hiloReading(stats);
      if (next == null) return;
      setReadingLabel(isPossession(stats) ? 'Possession' : 'Pressure');

      const p = pendingRef.current;
      if (p) {
        const win = p.guess === 'HIGHER' ? next > p.value : next < p.value;
        // ties don't count — keep the guess alive against the next reading
        if (next === p.value) { setCurrent(next); return; }
        setLast({ value: next, guess: p.guess, result: win ? 'WIN' : 'LOSE' });
        setRounds(r => r + 1);
        setFlash(win ? 'win' : 'lose');
        playSfx(win ? 'win' : 'lose');
        setTimeout(() => setFlash(null), 700);
        if (win) {
          setStreak(s => {
            const ns = s + 1;
            setBest(b => { const nb = Math.max(b, ns); localStorage.setItem(BEST_KEY, String(nb)); return nb; });
            return ns;
          });
        } else {
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

  const share = () => {
    const text = `🔥 I hit a streak of ${best} on bozPicks Hi-Lo — reading the World Cup live from TxLINE data. Beat it:`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).catch(() => {});
  };

  const homePoss = current ?? 50;
  const awayPoss = 100 - homePoss;

  return (
    <div className={`glass sheen p-5 relative overflow-hidden ${flash === 'lose' ? 'fx-shake' : ''}`}
         style={{ boxShadow: flash === 'win' ? '0 0 40px rgba(16,185,129,0.35)' : flash === 'lose' ? '0 0 40px rgba(239,68,68,0.3)' : undefined, transition: 'box-shadow .3s' }}>
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
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className={`text-2xl font-black tabular-nums ${streak >= 3 ? 'fx-flame' : ''}`}
               style={{ color: streak > 0 ? (streak >= 3 ? '#fbbf24' : 'var(--green)') : '#94a3b8' }}>
              {streak}{streak > 2 ? ' 🔥' : ''}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-gray-600">streak</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums text-amber-300">{best}</p>
            <p className="text-[9px] uppercase tracking-widest text-gray-600">best</p>
          </div>
        </div>
      </div>

      {/* possession bar */}
      <div className="mb-2 flex items-center justify-between text-xs font-bold">
        <span className="text-[var(--green)]">{homePoss}%</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-widest">{readingLabel}</span>
        <span className="text-[var(--blue)]">{awayPoss}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ width: `${homePoss}%`, background: 'linear-gradient(90deg,var(--green),rgba(16,185,129,0.6))', transition: 'width .5s' }} />
        <div style={{ width: `${awayPoss}%`, background: 'linear-gradient(90deg,rgba(59,130,246,0.6),var(--blue))', transition: 'width .5s' }} />
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
        <button onClick={share} className="text-[11px] font-bold text-[var(--blue)] hover:brightness-125 flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Share
        </button>
      </div>
    </div>
  );
}
