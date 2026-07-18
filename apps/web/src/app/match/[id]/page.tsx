'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRef } from 'react';
import dynamic from 'next/dynamic';
import type { MatchState, BozEvent, OddsSnapshot, AgentSignal, ParimutuelPool, Outcome } from '@bozpicks/shared';
import { useSSE } from '@/hooks/useSSE';
import { Sparkline } from '@/components/ui/Sparkline';
import { Countdown } from '@/components/ui/Countdown';
import { MatchStats } from '@/components/ui/MatchStats';
import { CountUp } from '@/components/ui/CountUp';
import { ShareModal } from '@/components/ui/ShareModal';
import { Flag, FlagBleed, FlagCorner, FlagWash } from '@/components/ui/Flag';
import { TwoSidedTimeline } from '@/components/ui/TwoSidedTimeline';
import { MomentumRecap } from '@/components/ui/MatchMomentum';
import { Lineup } from '@/components/ui/Lineup';
import { IconBall, IconChart, IconTrophy, IconBolt } from '@/components/ui/Icons';
import { useOddsFormat, formatOdds, type OddsFormat } from '@/hooks/useOddsFormat';
import { signalStyle } from '@/lib/signalStyle';

// Wallet-heavy bet slip is loaded only when an outcome is picked, keeping the
// Solana wallet adapter out of the match page's initial bundle.
const MatchBetSlip = dynamic(
  () => import('@/components/ui/MatchBetSlip').then(m => m.MatchBetSlip),
  { ssr: false },
);

const STATUS_COLOR: Record<string, string> = {
  LIVE: 'text-red-400',
  HALFTIME: 'text-amber-400',
  SCHEDULED: 'text-gray-400',
  FINISHED: 'text-gray-500',
};

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchState | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [events, setEvents] = useState<BozEvent[]>([]);
  const [currentOdds, setCurrentOdds] = useState<OddsSnapshot | null>(null);
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [pool, setPool] = useState<ParimutuelPool | null>(null);
  const [oddsHistory, setOddsHistory] = useState<OddsSnapshot[]>([]);
  const [prediction, setPrediction] = useState<Outcome | null>(null);
  const { format: oddsFormat, setFormat: setOddsFormat } = useOddsFormat();
  const [explanations, setExplanations] = useState<{ headline: string; body: string; importance: string; generatedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [liveMinute, setLiveMinute] = useState(0);
  const prevScore = useRef({ home: 0, away: 0 });
  const minuteTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial data
  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.state) {
          setMatch({
            id,
            homeTeam: data.state.homeTeam ?? '',
            awayTeam: data.state.awayTeam ?? '',
            homeScore: Number(data.state.homeScore ?? 0),
            awayScore: Number(data.state.awayScore ?? 0),
            status: data.state.status ?? 'SCHEDULED',
            currentMinute: Number(data.state.currentMinute ?? 0),
            kickoffTime: data.state.kickoffTime ?? '',
            lastUpdated: new Date().toISOString(),
          });
        } else {
          // Fallback: fetch from matches list
          fetch('/api/matches')
            .then(r => r.json())
            .then((matches: MatchState[]) => {
              const m = matches.find(m => m.id === id);
              if (m) setMatch(m);
            });
        }
        setEvents(data.events ?? []);
        if (data.currentOdds) setCurrentOdds(data.currentOdds);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/agents/signals?matchId=${id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSignals(data); })
      .catch(() => {});

    fetch(`/api/pools/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setPool(data); })
      .catch(() => {});

    fetch(`/api/matches/${id}/odds`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOddsHistory(data); })
      .catch(() => {});

    fetch(`/api/matches/${id}/explain`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setExplanations(data); })
      .catch(() => {});
  }, [id]);

  // Live minute auto-increment
  useEffect(() => {
    if (!match) return;
    setLiveMinute(match.currentMinute);
    if (minuteTimer.current) clearInterval(minuteTimer.current);
    if (match.status === 'LIVE') {
      minuteTimer.current = setInterval(() => setLiveMinute(m => m + 1), 60_000);
    }
    return () => { if (minuteTimer.current) clearInterval(minuteTimer.current); };
  }, [match?.status, match?.currentMinute]);

  // Real-time updates
  useSSE({
    matchId: id,
    onMessage: (msg) => {
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;
        if (e.matchId !== id) return;
        setEvents(prev => prev.some(x => x.id === e.id) ? prev : [e, ...prev].slice(0, 100));
        // History replay must never touch the header: the initial API fetch
        // already holds the freshest state, and an old catchup event (e.g. a
        // 19' penalty at 0–0) used to roll a finished match's score backwards.
        if (msg.catchup) return;
        if (e.score) {
          const { home, away } = e.score;
          if (home !== prevScore.current.home || away !== prevScore.current.away) {
            prevScore.current = { home, away };
            setScoreFlash(true);
            setTimeout(() => setScoreFlash(false), 800);
          }
          setMatch(prev => prev ? { ...prev, homeScore: home, awayScore: away, currentMinute: e.matchMinute } : prev);
        }
        if (e.odds) {
          setCurrentOdds(e.odds);
          setOddsHistory(prev => [...prev, e.odds!].slice(-50));
        }
      }
      if (msg.type === 'signal' && msg.data) {
        const s = msg.data as AgentSignal;
        if (s.matchId !== id) return;
        setSignals(prev => {
          if (prev.some(x => x.id === s.id)) return prev;
          return [s, ...prev].slice(0, 20);
        });
      }
    },
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="space-y-3 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mx-auto" />
        <p className="text-sm">Loading match...</p>
      </div>
    </div>
  );

  if (!match) return (
    <div className="glass text-center py-20">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-gray-500"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
        <IconChart size={26} />
      </div>
      <p className="text-gray-400">Match not found</p>
      <button onClick={() => router.back()} className="btn-ghost mx-auto mt-4 text-xs">← Back</button>
    </div>
  );

  const isLive = match.status === 'LIVE' || match.status === 'HALFTIME';
  // LIVE is green ("on air"), not red
  const statusColor = { LIVE: 'var(--green)', HALFTIME: 'var(--amber)', SCHEDULED: '#6b7280', FINISHED: '#4b5563' }[match.status];

  // goalscorers per side (broadcast-style lines under the team names)
  const scorersFor = (team: string) => events
    .filter(e => e.type === 'GOAL' && e.team === team)
    .sort((a, b) => (a.matchMinute || 0) - (b.matchMinute || 0))
    .map(e => {
      // player is "Mbappé · #10" (named squad) or "France · #7" (fallback);
      // show the name part, but never just the team name
      const name = (e.player ?? '').split(' · ')[0].trim();
      return {
        who: name && name !== team ? name : 'Goal',
        min: e.matchMinute || 0,
        tag: e.isOwnGoal ? 'OG' : e.isPenalty ? 'P' : null,
      };
    });
  const homeScorers = scorersFor(match.homeTeam);
  const awayScorers = scorersFor(match.awayTeam);
  const winner: 'home' | 'away' | null =
    match.status === 'FINISHED' && match.homeScore !== match.awayScore
      ? (match.homeScore > match.awayScore ? 'home' : 'away') : null;

  const scorerLines = (list: { who: string; min: number; tag: string | null }[], side: 'home' | 'away') =>
    list.length > 0 && (
      <div className={`space-y-0.5 ${side === 'home' ? 'text-right' : 'text-left'}`}>
        {list.slice(0, 4).map((g, i) => (
          <p key={i} className={`flex items-center gap-1 text-[10px] text-gray-300 ${side === 'home' ? 'justify-end' : ''}`}
             style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
            <span style={{ color: side === 'home' ? 'var(--green)' : 'var(--blue)' }}><IconBall size={9} /></span>
            <span className="font-semibold">{g.who}</span>
            <span className="text-gray-500 font-mono">{g.min}&rsquo;{g.tag ? ` (${g.tag})` : ''}</span>
          </p>
        ))}
        {list.length > 4 && <p className="text-[9px] text-gray-500">+{list.length - 4} more</p>}
      </div>
    );

  return (
    <div className="space-y-4">
      {/* ambient team-color backdrop — heavily blurred flags behind the page */}
      <div className="fixed inset-x-0 top-0 h-[70vh] pointer-events-none overflow-hidden -z-10"
           style={{ filter: 'blur(60px) saturate(1.3)', opacity: 0.16 }} aria-hidden>
        <FlagBleed team={match.homeTeam} side="home" opacity={1} />
        <FlagBleed team={match.awayTeam} side="away" opacity={1} />
        {/* fade the ambience out toward the bottom */}
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(to bottom, transparent 30%, var(--bg-deep) 95%)' }} />
      </div>

      {/* Back + Replay */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5m7-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2">
          {/* Replay plays back the recorded stream — real fixtures come from the
              ingest recorder, demo runs record themselves as they play */}
          {match.status === 'FINISHED' && (
            <button onClick={() => router.push(`/replay/${id}`)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: '#9ca3af' }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
              </svg>
              Replay
            </button>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: '#9ca3af' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          data={{
            headline: `${match.homeTeam} v ${match.awayTeam}`,
            sub: 'powered by TxLINE · settled on Solana',
            // caption matures with the match: result once it's known
            text: match.status === 'FINISHED'
              ? `FT: ${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam} — tracked live on bozPicks with TxLINE data:`
              : isLive
              ? `${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam} · ${liveMinute}' LIVE — watching on bozPicks:`
              : `${match.homeTeam} v ${match.awayTeam} is coming up — following it live on bozPicks:`,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            match: {
              home: match.homeTeam, away: match.awayTeam,
              homeScore: match.homeScore, awayScore: match.awayScore,
              status: match.status, minute: liveMinute, kickoffTime: match.kickoffTime,
            },
          }}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* ── Broadcast hero: full corner flags (every stripe visible) over a
             blended wash of both teams' colours; countdown lives here too ── */}
      <div className="glass relative overflow-hidden p-6 md:p-9 text-center">
        {/* colour-mix layer — both flags blurred + stretched into each other */}
        <FlagWash home={match.homeTeam} away={match.awayTeam} />
        {/* crisp full-height flags in the corners, correct 4:3 aspect */}
        <FlagCorner team={match.homeTeam} side="home" />
        <FlagCorner team={match.awayTeam} side="away" />
        {/* readability vignette — darkens centre + bottom for the type */}
        <div className="absolute inset-0 pointer-events-none"
             style={{
               background: `
                 radial-gradient(ellipse 62% 120% at 50% 50%, rgba(7,11,24,0.78), rgba(7,11,24,0.28) 70%, transparent 100%),
                 linear-gradient(to top, rgba(7,11,24,0.55), transparent 45%)
               `,
             }} />
        {isLive && (
          <div className="absolute top-0 left-0 right-0 h-[2px]"
               style={{ background: 'linear-gradient(90deg,transparent,var(--green),transparent)' }} />
        )}

        {/* champion glow on the winning side */}
        {winner && (
          <div className="absolute inset-y-0 w-1/2 pointer-events-none"
               style={{
                 ...(winner === 'home' ? { left: 0 } : { right: 0 }),
                 background: `radial-gradient(ellipse 80% 90% at ${winner === 'home' ? '15%' : '85%'} 50%, rgba(245,158,11,0.12), transparent 70%)`,
               }} />
        )}

        <div className="relative flex items-start justify-center gap-4 md:gap-8">
          <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
            <Flag team={match.homeTeam} size="lg" className="rounded-md" />
            <div className="flex items-center gap-1.5 justify-end w-full">
              {winner === 'home' && (
                <span style={{ color: '#fcd34d', filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.6))' }}><IconTrophy size={15} /></span>
              )}
              <p className="font-display font-bold text-base md:text-2xl leading-tight text-right truncate"
                 style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>{match.homeTeam}</p>
            </div>
            {scorerLines(homeScorers, 'home')}
          </div>
          <div className="text-center flex-shrink-0">
            {isLive || match.status === 'FINISHED' ? (
              <div className={`font-display text-4xl md:text-6xl font-black tabular-nums tracking-tight ${scoreFlash ? 'score-flash' : ''}`}
                   style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.9))' }}>
                <CountUp value={match.homeScore} duration={600} />
                <span className="text-gray-600 mx-2">–</span>
                <CountUp value={match.awayScore} duration={600} />
              </div>
            ) : (
              <div className="text-2xl text-gray-600 font-light px-4">vs</div>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {isLive && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: statusColor }} />}
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: statusColor, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                {match.status === 'HALFTIME' ? 'Half Time' : match.status}
                {isLive && ` · ${liveMinute}'`}
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-start gap-2 min-w-0">
            <Flag team={match.awayTeam} size="lg" className="rounded-md" />
            <div className="flex items-center gap-1.5 w-full">
              <p className="font-display font-bold text-base md:text-2xl leading-tight text-left truncate"
                 style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>{match.awayTeam}</p>
              {winner === 'away' && (
                <span style={{ color: '#fcd34d', filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.6))' }}><IconTrophy size={15} /></span>
              )}
            </div>
            {scorerLines(awayScorers, 'away')}
          </div>
        </div>

        {/* scheduled: countdown INSIDE the hero — no orphan card below */}
        {match.status === 'SCHEDULED' && match.kickoffTime && (
          <div className="relative mt-5 flex flex-col items-center gap-1.5">
            <div className="flex justify-center"><Countdown kickoffTime={match.kickoffTime} /></div>
            <p className="text-[11px] text-gray-500" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
              {new Date(match.kickoffTime).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
              })}
            </p>
          </div>
        )}

        {/* live match-minute progress bar */}
        {isLive && (
          <div className="relative mt-5 mx-auto max-w-sm">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-[width] duration-1000"
                   style={{
                     width: `${Math.min(100, (liveMinute / 90) * 100)}%`,
                     background: 'linear-gradient(90deg, var(--green), var(--amber))',
                   }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-600 font-mono">
              <span>0'</span><span>HT</span><span>90'</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Match Odds — interactive selector when a pool is open ── */}
      {currentOdds && (() => {
        const bettable = pool?.status === 'OPEN';
        const opts = [
          { outcome: 'HOME' as Outcome, label: 'Home Win', short: '1', val: currentOdds.homeWin, prob: currentOdds.impliedProb?.home ?? 0, c: 'var(--green)', t: '16,185,129' },
          { outcome: 'DRAW' as Outcome, label: 'Draw',     short: 'X', val: currentOdds.draw,    prob: currentOdds.impliedProb?.draw  ?? 0, c: '#94a3b8',      t: '148,163,184' },
          { outcome: 'AWAY' as Outcome, label: 'Away Win', short: '2', val: currentOdds.awayWin, prob: currentOdds.impliedProb?.away  ?? 0, c: 'var(--blue)',  t: '59,130,246' },
        ];
        return (
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h2 className="section-label">Match Odds</h2>
              <div className="flex items-center gap-2">
                {bettable && <span className="text-[10px] text-gray-600 hidden sm:block">Tap an outcome to predict →</span>}
                {/* Dec / Frac / US format toggle */}
                <div className="flex flex-shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--glass-border)' }}>
                  {([['decimal', 'Dec'], ['fractional', 'Frac'], ['american', 'US']] as [OddsFormat, string][]).map(([f, label]) => (
                    <button key={f} onClick={() => setOddsFormat(f)}
                      className="px-2 h-6 text-[10px] font-bold transition-all"
                      style={oddsFormat === f
                        ? { background: 'var(--blue-dim)', color: 'var(--blue)' }
                        : { background: 'transparent', color: '#4b5563' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {opts.map(o => {
                const active = prediction === o.outcome;
                return (
                  <button key={o.outcome} disabled={!bettable}
                    onClick={() => setPrediction(active ? null : o.outcome)}
                    className={`odds-btn card-shine group relative overflow-hidden rounded-2xl p-3.5 pb-4 text-center transition-all duration-200
                                ${bettable ? 'hover:-translate-y-0.5' : '!cursor-default'}`}
                    style={{
                      background: active
                        ? `linear-gradient(160deg, rgba(${o.t},0.16), rgba(${o.t},0.05))`
                        : `linear-gradient(160deg, rgba(${o.t},0.07), rgba(255,255,255,0.02) 60%)`,
                      border: `1px solid ${active ? `rgba(${o.t},0.6)` : `rgba(${o.t},0.18)`}`,
                      boxShadow: active ? `0 0 22px rgba(${o.t},0.22)` : 'none',
                    }}>
                    {/* outcome-coloured accent edge */}
                    <span className="absolute top-0 left-0 right-0 h-[2px]"
                          style={{ background: `linear-gradient(90deg, transparent, rgba(${o.t},${active ? 0.9 : 0.5}), transparent)` }} />
                    {/* soft glow behind the number */}
                    <span className="absolute inset-0 pointer-events-none"
                          style={{ background: `radial-gradient(ellipse 70% 55% at 50% 42%, rgba(${o.t},0.10), transparent 70%)` }} />

                    <div className="relative flex items-center justify-center gap-1.5 mb-2">
                      <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded"
                            style={{ background: `rgba(${o.t},0.18)`, color: o.c }}>{o.short}</span>
                      <span className="text-[10px] text-gray-500">{o.label}</span>
                    </div>
                    <p className="relative stat-display text-2xl transition-transform duration-200 group-hover:scale-105"
                       style={{ color: o.c, filter: `drop-shadow(0 0 10px rgba(${o.t},0.35))` }}>
                      {formatOdds(o.val, oddsFormat)}
                    </p>
                    <p className="relative text-[10px] text-gray-500 mt-1 tabular-nums">{(o.prob * 100).toFixed(0)}%</p>
                    {/* implied-probability meter along the bottom */}
                    <span className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="absolute left-0 top-0 bottom-0 rounded-r-full"
                            style={{ width: `${Math.round(o.prob * 100)}%`, background: `rgba(${o.t},0.75)`, transition: 'width .6s' }} />
                    </span>
                    {active && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: o.c }}>
                        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Bet Slip — lazy-loaded once an outcome is picked ── */}
      {pool?.status === 'OPEN' && prediction && (
        <MatchBetSlip
          matchId={id} prediction={prediction} currentOdds={currentOdds} pool={pool}
          homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          onClear={() => setPrediction(null)} />
      )}

      {/* ── Match centre — layout branches on match state:
             · SCHEDULED: no empty timeline shell; pre-match cards in 2 columns
             · LIVE/FINISHED: timeline (main) + stats-first side column ── */}
      {(() => {
      const isSched = match.status === 'SCHEDULED';

      // full-time momentum recap — reconstructed from the recorded events
      const momentumCard = !isSched && events.length > 3 && (
        <MomentumRecap events={events} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      );

      // Turning points: the biggest implied-probability swings, tied to the
      // pitch event that caused them — only possible because we keep the full
      // odds history alongside the event log.
      const turningPoints = (() => {
        if (isSched) return [];
        const asc = [...events].sort((a, b) => (a.matchMinute || 0) - (b.matchMinute || 0));
        const labels: Record<string, string> = {
          GOAL: 'Goal', PENALTY: 'Penalty', RED_CARD: 'Red card', YELLOW_CARD: 'Yellow card',
          VAR: 'VAR review', SUBSTITUTION: 'Substitution', SHOT: 'Shot', CORNER: 'Corner',
        };
        let prevProb: number | null = null;
        let lastCtx: BozEvent | null = null;
        const cands: { min: number; label: string; before: number; after: number; delta: number }[] = [];
        for (const e of asc) {
          if (e.type !== 'ODDS_UPDATE') {
            if (e.type in labels) lastCtx = e;
            continue;
          }
          const after = e.odds?.impliedProb?.home;
          if (typeof after === 'number' && prevProb != null && Math.abs(after - prevProb) >= 0.03) {
            const label = lastCtx
              ? `${labels[lastCtx.type]}${lastCtx.player ? ` — ${lastCtx.player}` : lastCtx.team ? ` — ${lastCtx.team}` : ''}`
              : 'Market shift';
            cands.push({ min: e.matchMinute || lastCtx?.matchMinute || 0, label, before: prevProb, after, delta: after - prevProb });
          }
          if (typeof after === 'number') prevProb = after;
        }
        return cands.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3).sort((a, b) => a.min - b.min);
      })();

      const turningCard = turningPoints.length > 0 && (
        <div className="glass p-5">
          <h2 className="section-label mb-4">Turning Points</h2>
          <div className="space-y-2.5">
            {turningPoints.map((t, i) => {
              const up = t.delta > 0;
              const c = up ? 'var(--green)' : 'var(--blue)';
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3 anim-in"
                     style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', animationDelay: `${i * 70}ms` }}>
                  <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black font-mono"
                        style={{ background: `${up ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)'}`, color: c, border: `1px solid ${up ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                    {t.min}&rsquo;
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-200 truncate">{t.label}</p>
                    <p className="text-[10px] text-gray-500">
                      {match.homeTeam} win {Math.round(t.before * 100)}% → <span style={{ color: c }}>{Math.round(t.after * 100)}%</span>
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-black tabular-nums" style={{ color: c }}>
                    {up ? '▲' : '▼'} {Math.abs(t.delta * 100).toFixed(0)}pp
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );

      const timelineCard = (
      /* flex-1 + min-h-0: the card stretches to whatever height the side column
         sets, and the timeline scrolls INSIDE it — both columns always end on
         the same line */
      <div className="glass p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <h2 className="section-label">Timeline</h2>
          {events.length > 0 && <span className="text-[10px] text-gray-600">{events.length} events</span>}
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-11 h-11 mx-auto mb-3 rounded-2xl flex items-center justify-center text-gray-500"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
              <IconChart size={20} />
            </div>
            <p className="text-xs text-gray-600">No events yet</p>
          </div>
        ) : (
          <div className="flex-1 min-h-[360px] max-h-[70vh] lg:max-h-none overflow-y-auto rail-scroll pr-1.5">
            <TwoSidedTimeline events={events} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          </div>
        )}
      </div>
      );

      const oddsMovementCard = oddsHistory.length >= 3 && (
        <div className="glass p-5">
          <h2 className="section-label mb-4">Odds Movement</h2>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Home', key: 'home' as const, color: 'var(--green)',  vals: oddsHistory.map(o => o.impliedProb.home) },
              { label: 'Draw', key: 'draw' as const, color: '#9ca3af',       vals: oddsHistory.map(o => o.impliedProb.draw) },
              { label: 'Away', key: 'away' as const, color: 'var(--blue)',   vals: oddsHistory.map(o => o.impliedProb.away) },
            ] as const).map(({ label, color, vals }) => {
              const first = vals[0] ?? 0;
              const last  = vals[vals.length - 1] ?? 0;
              const delta = ((last - first) / (first || 0.001)) * 100;
              return (
                /* each outcome gets its OWN glass panel — three distinct tiles,
                   not one run-on strip */
                <div key={label} className="space-y-2 rounded-xl p-3"
                     style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                    <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  </div>
                  <Sparkline data={vals} color={color} width={90} height={36} />
                  <p className="text-xs font-bold tabular-nums" style={{ color }}>
                    {(last * 100).toFixed(0)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );

      const poolCard = pool && (
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-label">Prediction Pool</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={pool.status === 'OPEN'
                    ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }
                    : pool.status === 'LOCKED'
                    ? { background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.3)' }
                    : { background: 'rgba(107,114,128,0.1)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.2)' }}>
              {pool.status}
            </span>
          </div>
          {(() => {
            const total = pool.totalPool || 1;
            const toUsdc = (n: number) => (n / 1_000_000).toFixed(1);
            const rows = [
              { label: 'Home', amount: pool.pools.home, barColor: 'var(--green)', textColor: 'var(--green)', outcome: 'HOME' },
              { label: 'Draw', amount: pool.pools.draw, barColor: '#6b7280',      textColor: '#9ca3af',      outcome: 'DRAW' },
              { label: 'Away', amount: pool.pools.away, barColor: 'var(--blue)',  textColor: 'var(--blue)',  outcome: 'AWAY' },
            ] as const;
            return (
              <>
                <div className="space-y-3">
                  {rows.map(({ label, amount, barColor, textColor, outcome }) => {
                    const pct = amount / total;
                    const isWinner = pool.winningOutcome === outcome;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: textColor }}>
                            {isWinner && <IconTrophy size={12} />}{label}
                          </span>
                          <span className="text-gray-500">{(pct * 100).toFixed(0)}% · {toUsdc(amount)} USDC</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden"
                             style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${Math.max(pct * 100, 2)}%`, background: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-4 pt-3"
                     style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <span>Total <span className="text-gray-400 font-mono ml-1">{toUsdc(pool.totalPool)} USDC</span></span>
                  <span>Fee <span className="text-gray-400 ml-1">{pool.feeBps / 100}%</span></span>
                </div>
              </>
            );
          })()}
        </div>
      );

      // only rendered once Claude has actually written something — a permanently
      // "monitoring…" placeholder card is dead weight
      const aiCard = explanations.length > 0 && (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full spin-slow" style={{ background: 'var(--blue)', boxShadow: '0 0 6px var(--blue)' }} />
          <h2 className="section-label">AI Analysis</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>BETA</span>
        </div>

        {explanations.length > 0 ? (
          <div className="space-y-3">
            {explanations.slice(0, 5).map((ex, i) => {
              const impColor = { CRITICAL: 'var(--red)', HIGH: 'var(--orange)', MEDIUM: 'var(--amber)', LOW: '#6b7280' }[ex.importance] ?? '#6b7280';
              return (
                <div key={i} className="rounded-xl p-3 space-y-1"
                     style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold" style={{ color: impColor }}>{ex.headline}</p>
                    <span className="text-[9px] text-gray-700">{new Date(ex.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{ex.body}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      );

      // Starting XI pitch — self-hides unless TxLINE has published the lineup.
      // Lives at the TOP of the side column (above stats), subs listed inside it.
      const lineupCard = (
        <Lineup fixtureId={id} home={match.homeTeam} away={match.awayTeam} />
      );

      const statsCard = events.length > 0 && (
        <MatchStats events={events} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
                    score={{ home: match.homeScore, away: match.awayScore }} />
      );

      const signalsCard = signals.length > 0 && (
        <div className="glass p-5">
          <h2 className="section-label mb-4">Sharp Signals ({signals.length})</h2>
          <div className="space-y-2">
            {signals.map(s => {
              const dir = s.deltaPercent > 0 ? '▲' : '▼';
              // one app-wide standard: gold / blue / slate by confidence (see lib/signalStyle)
              const cs = signalStyle(s.confidence);
              return (
                <div key={s.id} className="glass rounded-2xl p-3" style={{ borderColor: cs.border }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: cs.color }}>
                        <IconBolt size={13} /> {s.affectedOutcome} {dir}{Math.abs(s.deltaPercent).toFixed(1)}%
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                        {cs.label}
                      </span>
                      {s.outcomeVerified && (
                        <span className="w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ color: s.wasAccurate ? 'var(--green)' : 'var(--red)',
                                       background: s.wasAccurate ? 'var(--green-dim)' : 'var(--red-dim)' }}>
                          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            {s.wasAccurate ? <path d="M4 12l5 5L20 6" /> : <path d="M6 6l12 12M18 6L6 18" />}
                          </svg>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600">{new Date(s.detectedAt).toLocaleTimeString()}</span>
                  </div>
                  {s.context && <p className="text-xs text-gray-500 mt-1">{s.context}</p>}
                </div>
              );
            })}
          </div>
        </div>
      );

      // pre-match: balanced auto-flow grid, no empty timeline shell (cards that
      // have nothing to say — AI, signals — simply don't render)
      if (isSched) return (
        <div className="space-y-4">
          {/* pre-match, the XI is the headline once it lands — full width */}
          {lineupCard}
          <div className="grid gap-4 md:grid-cols-2 items-start">
            {poolCard}{aiCard}{signalsCard}{oddsMovementCard}
          </div>
        </div>
      );

      // live / finished: momentum + timeline main, stats + turning points lead
      // the side. items-stretch + flex column: the RIGHT column's natural height
      // sets the row, and the timeline card stretches (scrolling inside) so both
      // columns always end on exactly the same line.
      return (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr] items-stretch">
          <div className="flex flex-col gap-4 min-h-0">{momentumCard}{timelineCard}</div>
          <div className="space-y-4">{lineupCard}{statsCard}{turningCard}{oddsMovementCard}{poolCard}{aiCard}{signalsCard}</div>
        </div>
      );
      })()}

    </div>
  );
}
