'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRef } from 'react';
import type { MatchState, BozEvent, OddsSnapshot, AgentSignal, ParimutuelPool, Outcome } from '@bozpicks/shared';
import { estimatePayout } from '@bozpicks/shared';
import { useSSE } from '@/hooks/useSSE';
import { usePrediction } from '@/hooks/usePrediction';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Sparkline } from '@/components/ui/Sparkline';
import { Countdown } from '@/components/ui/Countdown';
import { MatchStats } from '@/components/ui/MatchStats';
import { Flag, FlagBleed } from '@/components/ui/Flag';
import { TwoSidedTimeline } from '@/components/ui/TwoSidedTimeline';
import { IconClock, IconChart, IconTrophy, IconSparkles, IconBolt } from '@/components/ui/Icons';

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
  const [events, setEvents] = useState<BozEvent[]>([]);
  const [currentOdds, setCurrentOdds] = useState<OddsSnapshot | null>(null);
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [pool, setPool] = useState<ParimutuelPool | null>(null);
  const [oddsHistory, setOddsHistory] = useState<OddsSnapshot[]>([]);
  const [prediction, setPrediction] = useState<Outcome | null>(null);
  const [betAmount, setBetAmount] = useState('10');
  const [explanations, setExplanations] = useState<{ headline: string; body: string; importance: string; generatedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [liveMinute, setLiveMinute] = useState(0);
  const prevScore = useRef({ home: 0, away: 0 });
  const minuteTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { publicKey, connected: walletConnected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { placePrediction, status: txStatus, error: txError, result: txResult, reset: resetTx } = usePrediction();

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
            onClick={async () => {
              const url = window.location.href;
              const title = `${match.homeTeam} vs ${match.awayTeam}`;
              if (navigator.share) {
                await navigator.share({ title, url }).catch(() => {});
              } else {
                await navigator.clipboard.writeText(url);
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: '#9ca3af' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Score header */}
      <div className="glass relative overflow-hidden p-6 md:p-8 text-center">
        {/* full-bleed flags fading toward the center — same look as the cards */}
        <FlagBleed team={match.homeTeam} side="home" opacity={0.3} />
        <FlagBleed team={match.awayTeam} side="away" opacity={0.3} />
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 55% 100% at 50% 50%, rgba(7,11,24,0.6), transparent 100%)' }} />
        {isLive && (
          <>
            <div className="absolute top-0 left-0 right-0 h-px"
                 style={{ background: 'linear-gradient(90deg,transparent,var(--red),transparent)' }} />
            {/* ambient live glow */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(239,68,68,0.07), transparent 70%)' }} />
          </>
        )}
        <div className="relative flex items-center justify-center gap-4 md:gap-8">
          <div className="flex-1 flex flex-col items-end gap-2">
            <Flag team={match.homeTeam} size="lg" className="rounded-md" />
            <p className="font-bold text-base md:text-xl leading-tight text-right">{match.homeTeam}</p>
          </div>
          <div className="text-center flex-shrink-0">
            {isLive || match.status === 'FINISHED' ? (
              <div className={`font-display text-4xl md:text-6xl font-black tabular-nums tracking-tight ${scoreFlash ? 'score-flash' : ''}`}>
                {match.homeScore}
                <span className="text-gray-600 mx-2">–</span>
                {match.awayScore}
              </div>
            ) : (
              <div className="text-2xl text-gray-600 font-light px-4">vs</div>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {isLive && <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: statusColor }} />}
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: statusColor }}>
                {match.status === 'HALFTIME' ? 'Half Time' : match.status}
                {isLive && ` · ${liveMinute}'`}
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-start gap-2">
            <Flag team={match.awayTeam} size="lg" className="rounded-md" />
            <p className="font-bold text-base md:text-xl leading-tight text-left">{match.awayTeam}</p>
          </div>
        </div>

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

      {/* Countdown for scheduled */}
      {match.status === 'SCHEDULED' && match.kickoffTime && (
        <div className="glass p-4 text-center space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Kickoff in</p>
          <div className="flex justify-center">
            <Countdown kickoffTime={match.kickoffTime} />
          </div>
          <p className="text-xs text-gray-600">
            {new Date(match.kickoffTime).toLocaleString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
            })}
          </p>
        </div>
      )}

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
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-label">Match Odds</h2>
              {bettable && <span className="text-[10px] text-gray-600">Tap an outcome to predict →</span>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {opts.map(o => {
                const active = prediction === o.outcome;
                return (
                  <button key={o.outcome} disabled={!bettable}
                    onClick={() => setPrediction(active ? null : o.outcome)}
                    className={`odds-btn relative rounded-2xl p-3.5 text-center ${bettable ? '' : '!cursor-default'}`}
                    style={{
                      background: active ? `rgba(${o.t},0.14)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? `rgba(${o.t},0.55)` : 'var(--glass-border)'}`,
                      boxShadow: active ? `0 0 18px rgba(${o.t},0.2)` : 'none',
                    }}>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded"
                            style={{ background: `rgba(${o.t},0.18)`, color: o.c }}>{o.short}</span>
                      <span className="text-[10px] text-gray-500">{o.label}</span>
                    </div>
                    <p className="stat-display text-2xl" style={{ color: active ? o.c : '#e2e8f0' }}>{o.val.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{(o.prob * 100).toFixed(0)}%</p>
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

      {/* ── Bet Slip — appears right below the odds once an outcome is picked ── */}
      {pool?.status === 'OPEN' && prediction && (() => {
        const sel = {
          HOME: { label: 'Home Win', odds: currentOdds?.homeWin, c: 'var(--green)', t: '16,185,129' },
          DRAW: { label: 'Draw',     odds: currentOdds?.draw,    c: '#94a3b8',      t: '148,163,184' },
          AWAY: { label: 'Away Win', odds: currentOdds?.awayWin, c: 'var(--blue)',  t: '59,130,246' },
        }[prediction];
        const amtMicro = Math.floor(parseFloat(betAmount) * 1_000_000) || 0;
        const payout = amtMicro > 0 ? estimatePayout(amtMicro, prediction, pool) / 1_000_000 : 0;
        const roi = payout > 0 && parseFloat(betAmount) > 0 ? (payout / parseFloat(betAmount) - 1) * 100 : 0;
        const belowMin = amtMicro > 0 && amtMicro < 1_000_000;

        return (
          <div className="glass p-5 space-y-4 anim-in" style={{ borderColor: `rgba(${sel.t},0.35)` }}>
            <div className="flex items-center justify-between">
              <h2 className="section-label">Bet Slip</h2>
              <button onClick={() => { setPrediction(null); resetTx(); }}
                className="text-[10px] font-semibold text-gray-600 hover:text-gray-300 transition-colors">Clear</button>
            </div>

            {/* selected pick */}
            <div className="flex items-center justify-between rounded-xl p-3.5"
                 style={{ background: `rgba(${sel.t},0.1)`, border: `1px solid rgba(${sel.t},0.3)` }}>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 truncate">{match.homeTeam} v {match.awayTeam}</p>
                <p className="text-sm font-bold" style={{ color: sel.c }}>{sel.label}</p>
              </div>
              <p className="stat-display text-xl flex-shrink-0 ml-3" style={{ color: sel.c }}>{sel.odds?.toFixed(2) ?? '—'}</p>
            </div>

            {txResult ? (
              /* success */
              <div className="tx-success relative overflow-hidden rounded-xl p-4 space-y-2"
                   style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.4)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="tx-check w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--green)', boxShadow: '0 0 18px rgba(16,185,129,0.6)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Prediction confirmed on-chain</p>
                    <p className="text-[10px] text-gray-500">Settled trustlessly on Solana devnet</p>
                  </div>
                </div>
                <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 hover:text-green-300 transition-colors break-all pl-0.5">
                  {txResult.txSignature.slice(0, 24)}…<span className="whitespace-nowrap">↗ Explorer</span>
                </a>
                <button onClick={resetTx} className="text-[10px] font-semibold text-gray-600 hover:text-gray-300 transition-colors">Place another →</button>
              </div>
            ) : txStatus === 'error' && txError ? (
              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-xs text-red-400">{txError}</p>
                <button onClick={resetTx} className="text-[10px] text-gray-600 mt-1 hover:text-gray-400">Try again</button>
              </div>
            ) : (
              <>
                {/* stake input + quick chips */}
                <div>
                  <div className="flex items-center gap-2 rounded-xl p-3"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                    <span className="text-xs text-gray-500">Stake</span>
                    <input type="number" min="1" value={betAmount}
                      onChange={e => setBetAmount(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-bold outline-none text-right tabular-nums"
                      style={{ color: '#e2e8f0' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--blue)' }}>USDC</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 25, 50].map(v => {
                      const on = parseFloat(betAmount) === v;
                      return (
                        <button key={v} onClick={() => setBetAmount(String(v))}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                          style={on
                            ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }
                            : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* payout summary */}
                <div className="space-y-1.5 px-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Est. payout</span>
                    <span className="font-bold tabular-nums" style={{ color: 'var(--green)' }}>{payout.toFixed(2)} USDC</span>
                  </div>
                  {roi !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Potential ROI</span>
                      <span className={`tabular-nums ${roi > 0 ? 'text-green-400' : 'text-red-400'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(1)}%</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                {walletConnected ? (
                  <button
                    onClick={async () => {
                      if (amtMicro < 1_000_000) return;
                      await placePrediction(id, prediction, amtMicro);
                    }}
                    disabled={txStatus === 'signing' || txStatus === 'confirming' || belowMin || amtMicro === 0}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'var(--blue)', color: '#fff' }}>
                    {txStatus === 'signing' && <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Waiting for signature…</>}
                    {txStatus === 'confirming' && <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Confirming on-chain…</>}
                    {txStatus === 'idle' && (belowMin ? 'Minimum 1 USDC' : `Confirm — ${betAmount || 0} USDC`)}
                  </button>
                ) : (
                  <button onClick={() => openWalletModal(true)}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                    style={{ background: 'var(--blue)', color: '#fff' }}>
                    Connect Wallet to Predict
                  </button>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Timeline */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-label">Timeline</h2>
          {events.length > 0 && <span className="text-[10px] text-gray-600">{events.length} events</span>}
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-11 h-11 mx-auto mb-3 rounded-2xl flex items-center justify-center text-gray-500"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
              {match.status === 'SCHEDULED' ? <IconClock size={20} /> : <IconChart size={20} />}
            </div>
            <p className="text-xs text-gray-600">
              {match.status === 'SCHEDULED' ? "Match hasn't started yet" : 'No events yet'}
            </p>
          </div>
        ) : (
          <TwoSidedTimeline events={events} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
        )}
      </div>

      {/* Odds Movement Chart */}
      {oddsHistory.length >= 3 && (
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
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
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
      )}

      {/* Pool */}
      {pool && (
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
      )}

      {/* AI Analysis */}
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
        ) : (
          <div className="py-8 text-center">
            <div className="w-11 h-11 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                 style={{ color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <IconSparkles size={20} />
            </div>
            <p className="text-xs font-medium text-gray-500">Monitoring market patterns…</p>
            <p className="text-[10px] text-gray-700 mt-1">
              AI explanations appear when significant events are detected
            </p>
          </div>
        )}
      </div>

      {/* Match Stats */}
      {events.length > 0 && match && (
        <MatchStats events={events} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      )}

      {/* Sharp Signals */}
      {signals.length > 0 && (
        <div className="glass p-5">
          <h2 className="section-label mb-4">Sharp Signals ({signals.length})</h2>
          <div className="space-y-2">
            {signals.map(s => {
              const dir = s.deltaPercent > 0 ? '↑' : '↓';
              const cs = {
                HIGH:   { color: 'var(--red)',    border: 'rgba(239,68,68,0.3)',   bg: 'var(--red-dim)' },
                MEDIUM: { color: 'var(--orange)', border: 'rgba(249,115,22,0.3)',  bg: 'var(--orange-dim)' },
                LOW:    { color: '#9ca3af',       border: 'rgba(107,114,128,0.2)', bg: 'rgba(107,114,128,0.08)' },
              }[s.confidence];
              return (
                <div key={s.id} className="glass rounded-2xl p-3" style={{ borderColor: cs.border }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: cs.color }}>
                        <IconBolt size={13} /> {s.affectedOutcome} {dir}{Math.abs(s.deltaPercent).toFixed(1)}%
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                        {s.confidence}
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
      )}

    </div>
  );
}
