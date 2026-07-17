'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { BozEvent, MatchState } from '@bozpicks/shared';
import { Flag, FlagWash, FlagCorner, FlagBleed } from '@/components/ui/Flag';
import { TwoSidedTimeline } from '@/components/ui/TwoSidedTimeline';
import { MatchStats } from '@/components/ui/MatchStats';
import { MomentumRecap } from '@/components/ui/MatchMomentum';
import { PunditRail } from '@/components/ui/PunditRail';
import { CountUp } from '@/components/ui/CountUp';
import { IconChart, IconBall } from '@/components/ui/Icons';

type RawEvent = { id: string; delayMs: number; payload: BozEvent };
const SPEEDS = [0.5, 1, 2, 5, 10];
const FULL = 95; // clamp minute → %

/**
 * Match Replay — the recorded TxLINE event stream played back with a broadcast
 * presentation on par with the live match page: flag hero + live score, a
 * transport bar (scrub / play / speed), and the two-sided timeline + stats that
 * build up as the replay plays. Reuses the exact match-page components so a
 * finished fixture's replay reads as a real broadcast, not a debug log.
 */
export default function ReplayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<{ home: string; away: string } | null>(null);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [visible, setVisible] = useState<BozEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [speed, setSpeed] = useState(2);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [minute, setMinute] = useState(0);
  const [flash, setFlash] = useState(false);
  // the event currently being played back — feeds the AI Pundit booth so the
  // replay gets the same live commentary as /play (scrubbing doesn't set it;
  // jumping around shouldn't make the booth read out half the match at once)
  const [lastPlayed, setLastPlayed] = useState<BozEvent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(-1);
  const rawRef = useRef<RawEvent[]>([]);
  const prevScore = useRef({ home: 0, away: 0 });

  useEffect(() => {
    fetch(`/api/replay/${matchId}/events`)
      .then(r => r.json())
      .then((data: RawEvent[]) => { setRawEvents(data); rawRef.current = data; setLoading(false); })
      .catch(() => setLoading(false));
    // match metadata (team names for the flag hero)
    fetch('/api/matches', { cache: 'no-store' })
      .then(r => r.json())
      .then((ms: MatchState[]) => {
        const m = Array.isArray(ms) ? ms.find(x => x.id === matchId) : undefined;
        if (m) setMeta({ home: m.homeTeam, away: m.awayTeam });
      })
      .catch(() => {});
  }, [matchId]);

  const advance = useCallback((idx: number, spd: number) => {
    const evts = rawRef.current;
    if (idx >= evts.length) { setPlaying(false); return; }
    const payload = evts[idx].payload;
    cursorRef.current = idx;
    setCursor(idx);
    setMinute(payload.matchMinute || 0);
    if (payload.score) {
      const { home, away } = payload.score;
      if (home !== prevScore.current.home || away !== prevScore.current.away) {
        prevScore.current = { home, away };
        setFlash(true); setTimeout(() => setFlash(false), 700);
      }
      setScore({ home, away });
    }
    setVisible(prev => [payload, ...prev].slice(0, 200));
    setLastPlayed(payload); // hand the moment to the AI Pundit booth

    if (idx + 1 < evts.length) {
      // Pace from the MATCH MINUTE, not the recorded delay_ms. delay_ms is
      // wall-clock-at-record time, and the live recorder derives it from when
      // it first saw MATCH_START — for a fixture it joined mid-stream that's
      // never, so every row lands at delay_ms ≈ 0 and the whole replay flushed
      // in ~1s no matter the speed (0 / spd is still 0). The minute is always
      // meaningful, so 1x ≈ one second per match minute (~95s a match) and the
      // speed control actually means something. Order stays as stored (Seq),
      // since minutes can step backwards (full-time at 90' after a 96' shot).
      const curMin  = evts[idx].payload.matchMinute || 0;
      const nextMin = evts[idx + 1].payload.matchMinute || curMin;
      const gap = Math.max((Math.max(0, nextMin - curMin) * 1000) / spd, 90);
      timerRef.current = setTimeout(() => advance(idx + 1, spd), gap);
    } else {
      setPlaying(false);
    }
  }, []);

  const resetState = () => {
    setVisible([]); setCursor(-1); cursorRef.current = -1;
    setScore({ home: 0, away: 0 }); setMinute(0); prevScore.current = { home: 0, away: 0 };
  };

  const play = useCallback(() => {
    const start = cursorRef.current + 1;
    if (start >= rawRef.current.length) {
      resetState();
      setTimeout(() => { setPlaying(true); advance(0, speed); }, 0);
      return;
    }
    setPlaying(true);
    advance(start, speed);
  }, [advance, speed]);

  const pause = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const reset = useCallback(() => { pause(); resetState(); }, [pause]);

  // scrub to an arbitrary index — rebuild the revealed set up to that point
  const scrubTo = useCallback((idx: number) => {
    pause();
    const evts = rawRef.current;
    const clamped = Math.max(-1, Math.min(idx, evts.length - 1));
    const shown: BozEvent[] = [];
    let sc = { home: 0, away: 0 }, min = 0;
    for (let i = 0; i <= clamped; i++) {
      const p = evts[i].payload;
      shown.unshift(p);
      if (p.score) sc = { home: p.score.home, away: p.score.away };
      min = p.matchMinute || min;
    }
    cursorRef.current = clamped; setCursor(clamped);
    setVisible(shown.slice(0, 200)); setScore(sc); setMinute(min);
    prevScore.current = sc;
  }, [pause]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const progress = rawEvents.length > 0 ? ((cursor + 1) / rawEvents.length) * 100 : 0;
  const minutePct = Math.min(100, Math.max(0, (minute / FULL) * 100));
  const home = meta?.home ?? 'Home';
  const away = meta?.away ?? 'Away';
  // chronological order for the timeline/stats components (they expect ASC)
  const chrono = [...visible].reverse();

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto"
             style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'var(--blue)' }} />
        <p className="text-sm text-gray-400">Loading replay…</p>
      </div>
    </div>
  );

  if (rawEvents.length === 0) return (
    <div className="glass text-center py-20 max-w-sm mx-auto">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-gray-500"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
        <IconChart size={26} />
      </div>
      <p className="text-gray-400 font-semibold mb-1">No replay data</p>
      <p className="text-xs text-gray-600 mb-5">This match hasn&rsquo;t been recorded yet</p>
      <button onClick={() => router.back()} className="btn-ghost mx-auto text-xs">← Back</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ambient team-colour backdrop, same as the match page */}
      <div className="fixed inset-x-0 top-0 h-[70vh] pointer-events-none overflow-hidden -z-10"
           style={{ filter: 'blur(60px) saturate(1.3)', opacity: 0.16 }} aria-hidden>
        <FlagBleed team={home} side="home" opacity={1} />
        <FlagBleed team={away} side="away" opacity={1} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, var(--bg-deep) 95%)' }} />
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 12H5m7-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
        <span className="chip-glass chip-blue text-[10px]">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>
          Replay · recorded TxLINE stream
        </span>
      </div>

      {/* ── Broadcast hero: flags + score + minute ── */}
      <div className="glass relative overflow-hidden p-6 md:p-8 text-center">
        <FlagWash home={home} away={away} />
        <FlagCorner team={home} side="home" />
        <FlagCorner team={away} side="away" />
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 62% 120% at 50% 50%, rgba(7,11,24,0.78), rgba(7,11,24,0.28) 70%, transparent 100%), linear-gradient(to top, rgba(7,11,24,0.55), transparent 45%)' }} />

        <div className="relative flex items-start justify-center gap-4 md:gap-8">
          <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
            <Flag team={home} size="lg" className="rounded-md" />
            <p className="font-display font-bold text-base md:text-2xl leading-tight text-right truncate w-full" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>{home}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <div className={`font-display text-4xl md:text-6xl font-black tabular-nums tracking-tight ${flash ? 'score-flash' : ''}`}
                 style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.9))' }}>
              <CountUp value={score.home} duration={500} />
              <span className="text-gray-600 mx-2">–</span>
              <CountUp value={score.away} duration={500} />
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {playing && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--blue)' }} />}
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blue)', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                {minute > 0 ? `${minute}'` : 'Pre-match'}
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-start gap-2 min-w-0">
            <Flag team={away} size="lg" className="rounded-md" />
            <p className="font-display font-bold text-base md:text-2xl leading-tight text-left truncate w-full" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>{away}</p>
          </div>
        </div>

        {/* match-minute bar */}
        <div className="relative mt-5 mx-auto max-w-sm">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-[width] duration-500"
                 style={{ width: `${minutePct}%`, background: 'linear-gradient(90deg, var(--blue), var(--green))' }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-600 font-mono"><span>0&rsquo;</span><span>HT</span><span>90&rsquo;</span></div>
        </div>
      </div>

      {/* ── Transport bar ── */}
      <div className="glass p-4 sticky top-2 z-30">
        {/* scrubber over the whole event stream */}
        <input type="range" min={-1} max={rawEvents.length - 1} value={cursor}
          onChange={e => scrubTo(Number(e.target.value))}
          className="w-full mb-3" style={{ accentColor: 'var(--blue)' }} aria-label="Scrub replay" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <button onClick={reset} title="Restart"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>
            <button onClick={playing ? pause : play}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', boxShadow: '0 0 18px rgba(59,130,246,0.4)' }}>
              {playing
                ? <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z" /></svg>
                : <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
            </button>
            <span className="text-[11px] text-gray-500 font-mono tabular-nums">{cursor + 1}/{rawEvents.length}</span>
          </div>
          {/* Speed shows the resulting PLAYBACK LENGTH, not a bare multiplier —
              "8×" invites "8× of what?" (a 90-min match? the clip?). A ~95-min
              match at 1× is ~95s, so each option can state its own runtime. */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-gray-600 hidden sm:inline">Watch in</span>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
              {SPEEDS.map(s => {
                const secs = Math.round(95 / s);
                const label = secs >= 60 ? `${Math.round(secs / 60)}m` : `${secs}s`;
                return (
                  <button key={s} onClick={() => { setSpeed(s); if (playing) { pause(); setTimeout(() => { setPlaying(true); advance(cursorRef.current + 1, s); }, 0); } }}
                    title={`${s}× — the full match plays in about ${label}`}
                    className="px-2.5 h-7 rounded-lg text-[11px] font-bold tabular-nums transition-all"
                    style={speed === s ? { background: 'var(--blue-dim)', color: 'var(--blue)' } : { color: '#6b7280' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* thin progress fill under the transport */}
        <div className="h-[3px] rounded-full overflow-hidden mt-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--blue)', transition: 'width .2s' }} />
        </div>
      </div>

      {/* ── Broadcast body: timeline + stats build up as it plays ── */}
      {visible.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
               style={{ color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <IconBall size={22} />
          </div>
          <p className="text-sm text-gray-400">Press play to replay the match</p>
          <p className="text-xs text-gray-600 mt-1">The timeline, score and stats build up exactly as they happened.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr] items-start">
          <div className="flex flex-col gap-4 min-h-0">
            {chrono.length > 3 && <MomentumRecap events={chrono} homeTeam={home} awayTeam={away} />}
            <div className="glass p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-label">Timeline</h2>
                <span className="text-[10px] text-gray-600">{chrono.length} events</span>
              </div>
              <div className="max-h-[70vh] overflow-y-auto rail-scroll pr-1.5">
                <TwoSidedTimeline events={chrono} homeTeam={home} awayTeam={away} />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {/* the same AI Pundit booth as /play, fed by the replay's playback */}
            <PunditRail home={home} away={away} feedEvent={lastPlayed} />
            <MatchStats events={chrono} homeTeam={home} awayTeam={away} score={score} />
          </div>
        </div>
      )}
    </div>
  );
}
