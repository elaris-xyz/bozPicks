'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent, MatchState, AgentSignal } from '@bozpicks/shared';
import { MOM_CLAMP } from '@/lib/momentum';
import {
  W, H, PAD_L, PAD_R, PAD_T, PAD_B, BASE_Y, AMP,
  simulateMomentum, movingAverage, smoothLine, smoothArea, shortName,
} from './MatchMomentum';
import { Flag } from './Flag';
import { IconBolt } from './Icons';

/**
 * WHAT THE AGENT SAW — the pitch-pressure wave with the detector's sharp-move
 * calls pinned on top of it. The fan chart on /play shows the game; THIS one
 * shows the market context around every signal the agent fired: a bolt at 67'
 * sitting on the pressure swing after a red card tells a desk exactly why the
 * line moved. Live match if one is on air, otherwise the latest finished one.
 */
export function AgentMomentum() {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [events, setEvents] = useState<BozEvent[]>([]);
  const [signals, setSignals] = useState<AgentSignal[]>([]);

  const loadMatch = async (id: string) => {
    const [detail, sigs] = await Promise.all([
      fetch(`/api/matches/${id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/agents/signals?matchId=${id}`).then(r => r.json()).catch(() => []),
    ]);
    if (detail?.events) setEvents(detail.events);
    if (Array.isArray(sigs)) setSignals(sigs);
  };

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then((ms: MatchState[]) => {
        if (!Array.isArray(ms)) return;
        const live = ms.find(m => m.status === 'LIVE' || m.status === 'HALFTIME');
        const finished = ms.filter(m => m.status === 'FINISHED')
          .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
        const pick = live ?? finished;
        if (pick) { setMatch(pick); loadMatch(pick.id); }
      })
      .catch(() => {});
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'event' && msg.data) {
        const e = msg.data as BozEvent;
        if (e.type === 'MATCH_START' && e.matchId !== match?.id) {
          // a new match kicked off — the agent's attention moves with the feed
          setEvents([]); setSignals([]);
          fetch('/api/matches').then(r => r.json()).then((ms: MatchState[]) => {
            const m = Array.isArray(ms) ? ms.find(x => x.id === e.matchId) : null;
            if (m) { setMatch(m); loadMatch(m.id); }
          }).catch(() => {});
          return;
        }
        if (e.matchId !== match?.id) return;
        setEvents(prev => prev.some(x => x.id === e.id) ? prev : [...prev, e]);
        if (e.type === 'MATCH_END') setMatch(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
        else if (e.matchMinute) setMatch(prev => prev ? { ...prev, status: 'LIVE', currentMinute: e.matchMinute } : prev);
      }
      if (msg.type === 'signal' && msg.data) {
        const s = msg.data as AgentSignal;
        if (s.matchId !== match?.id) return;
        setSignals(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
      }
    },
  });

  if (!match || events.length < 4) return null;

  const isLive = match.status === 'LIVE' || match.status === 'HALFTIME';
  const upTo = isLive ? Math.max(2, Math.min(90, match.currentMinute || 0)) : 90;
  const { pts, goals } = simulateMomentum(events, match.homeTeam, upTo);

  const xFor = (min: number) => PAD_L + (Math.min(min, 90) / 90) * (W - PAD_L - PAD_R);
  const yFor = (v: number) => BASE_Y - (Math.max(-MOM_CLAMP, Math.min(MOM_CLAMP, v)) / MOM_CLAMP) * AMP;
  const sv = movingAverage(pts.map(p => p.v), 3);
  const curve = pts.map((p, i) => ({ x: xFor(p.min), y: yFor(sv[i]) }));
  const areaD = smoothArea(curve, BASE_Y);
  const lineD = smoothLine(curve);
  const ticks = [0, 15, 30, 45, 60, 75, 90];

  // pin each signal to a match minute via its correlated / nearest odds event
  const oddsEvents = events.filter(e => e.type === 'ODDS_UPDATE');
  const minuteFor = (s: AgentSignal): number | null => {
    const byId = s.correlatedEventId && events.find(e => e.id === s.correlatedEventId);
    if (byId) return byId.matchMinute || 0;
    if (!oddsEvents.length) return null;
    const t = new Date(s.detectedAt).getTime();
    const nearest = oddsEvents.reduce((best, e) =>
      Math.abs(new Date(e.timestamp).getTime() - t) < Math.abs(new Date(best.timestamp).getTime() - t) ? e : best);
    return nearest.matchMinute || 0;
  };
  const markers = signals
    .map(s => ({ s, min: minuteFor(s) }))
    .filter((m): m is { s: AgentSignal; min: number } => m.min != null && m.min <= upTo);

  return (
    <div className="glass p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="section-label">What The Agent Saw</h2>
        <p className="text-[10px] text-gray-500 hidden sm:block">
          pitch pressure × the detector&rsquo;s sharp-move calls — {isLive ? 'live' : `${match.homeTeam} v ${match.awayTeam}, full time`}
        </p>
      </div>

      <div className="relative w-full" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="momAgHome" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_T} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(16,185,129,0.5)" /><stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
            </linearGradient>
            <linearGradient id="momAgAway" gradientUnits="userSpaceOnUse" x1="0" y1={H - PAD_B} x2="0" y2={BASE_Y}>
              <stop offset="0%" stopColor="rgba(59,130,246,0.5)" /><stop offset="100%" stopColor="rgba(59,130,246,0.04)" />
            </linearGradient>
            <clipPath id="momAgAbove"><rect x="0" y="0" width={W} height={BASE_Y} /></clipPath>
            <clipPath id="momAgBelow"><rect x="0" y={BASE_Y} width={W} height={H - BASE_Y} /></clipPath>
          </defs>

          {ticks.map(m => (
            <line key={m} x1={xFor(m)} y1={PAD_T - 4} x2={xFor(m)} y2={H - PAD_B + 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

          <path d={areaD} fill="url(#momAgHome)" clipPath="url(#momAgAbove)" />
          <path d={areaD} fill="url(#momAgAway)" clipPath="url(#momAgBelow)" />
          <path d={lineD} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momAgAbove)" vectorEffect="non-scaling-stroke" />
          <path d={lineD} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#momAgBelow)" vectorEffect="non-scaling-stroke" />

          {goals.map((g, i) => {
            const x = xFor(g.min);
            const up = g.side === 'home';
            const yPin = up ? yFor(6.5) : yFor(-6.5);
            const c = up ? 'var(--green)' : 'var(--blue)';
            return (
              <g key={`g${i}`}>
                <line x1={x} y1={BASE_Y} x2={x} y2={yPin} stroke={c} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.45} />
                <path d={up ? `M ${x} ${yPin} l 9 3 l -9 3 z` : `M ${x} ${yPin} l 9 -3 l -9 -3 z`} fill={c} />
              </g>
            );
          })}

          {/* the agent's calls: an orange bolt marker dropped on the exact minute */}
          {markers.map(({ s, min }, i) => {
            const x = xFor(min);
            return (
              <g key={s.id ?? `s${i}`}>
                <line x1={x} y1={PAD_T + 2} x2={x} y2={H - PAD_B} stroke="rgba(249,115,22,0.4)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <circle cx={x} cy={PAD_T + 6} r={7} fill="rgba(249,115,22,0.16)" stroke="rgba(249,115,22,0.7)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <path d={`M ${x + 1.5} ${PAD_T + 1.5} l -4 5.5 h 2.8 l -1.4 4 l 4.2 -5.7 h -2.8 z`} fill="var(--orange)" />
                <title>{`${s.affectedOutcome} ${s.deltaPercent > 0 ? '↑' : '↓'}${Math.abs(s.deltaPercent).toFixed(1)}% · ${s.confidence} · ${min}'`}</title>
              </g>
            );
          })}
        </svg>

        {ticks.map(m => (
          <span key={m} className="absolute text-[9px] text-gray-500 -translate-x-1/2" style={{ left: `${(xFor(m) / W) * 100}%`, bottom: 2 }}>
            {m === 45 ? 'HT' : `${m}'`}
          </span>
        ))}

        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y - AMP * 0.55) - 8 }}>
          <Flag team={match.homeTeam} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--green)' }}>{shortName(match.homeTeam)}</span>
        </div>
        <div className="absolute left-2 flex items-center gap-1" style={{ top: (BASE_Y + AMP * 0.55) - 8 }}>
          <Flag team={match.awayTeam} size="xs" /><span className="text-[9px] font-black" style={{ color: 'var(--blue)' }}>{shortName(match.awayTeam)}</span>
        </div>
      </div>

      {/* legend — why each mark exists */}
      <div className="flex items-center gap-4 mt-1.5 text-[9px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span style={{ color: 'var(--orange)' }}><IconBolt size={10} /></span> agent signal ({markers.length})</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: 'var(--green)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} /> goal</span>
        <span className="hidden sm:inline">hover a bolt for the call</span>
      </div>
    </div>
  );
}
