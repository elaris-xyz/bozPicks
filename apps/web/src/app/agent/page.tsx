'use client';

import { useEffect, useState, useRef } from 'react';
import type { AgentSignal, SSEMessage } from '@bozpicks/shared';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import { useSSEContext } from '@/contexts/SSEContext';
import { IconRadar, IconTarget, IconPulse, IconBolt } from '@/components/ui/Icons';
import { CountUp } from '@/components/ui/CountUp';
import { AgentArena } from '@/components/ui/AgentArena';
import { HeroAura } from '@/components/ui/HeroAura';

interface AgentStats {
  totalSignals: number;
  activeSignals: number;
  verifiedSignals: number;
  accurateSignals: number;
  accuracyRate: number | null;
  highConfidence: number;
  mediumConfidence: number;
  lastSignalAt: string | null;
  liveMatches: number;
  totalMatches: number;
  agentStatus: string;
  detectionThreshold: number;
  windowMs: number;
}

export default function AgentPage() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const { connected } = useSSEContext();
  const live = useLiveMatch();
  const [threshold, setThreshold] = useState(10);
  const [windowMin, setWindowMin] = useState(2);
  const [configOpen, setConfigOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load config from localStorage
  useEffect(() => {
    setThreshold(parseFloat(localStorage.getItem('agent_threshold') ?? '10'));
    setWindowMin(parseInt(localStorage.getItem('agent_window') ?? '2'));
  }, []);

  // fetch signals + stats, poll every 15s
  const refresh = () => {
    fetch('/api/agents/signals')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSignals(data); })
      .catch(() => {});
    fetch('/api/agents/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // live signal feed via SSE
  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type === 'signal' && msg.data) {
        const s = msg.data as AgentSignal;
        setSignals(prev => {
          if (prev.some(x => x.id === s.id)) return prev;
          return [s, ...prev].slice(0, 50);
        });
        refresh();
      }
    },
  });

  const verified = signals.filter(s => s.outcomeVerified);
  const accurate = verified.filter(s => s.wasAccurate);
  const localAccuracy = verified.length > 0 ? Math.round((accurate.length / verified.length) * 100) : null;
  const accuracy = stats?.accuracyRate ?? localAccuracy;

  const active  = signals.filter(s => !s.outcomeVerified);
  const history = signals.filter(s => s.outcomeVerified);

  return (
    <div className="theme-agent space-y-5">

      {/* ── Hero ── */}
      <div className="glass hero-glow fx-rise relative overflow-hidden p-6 md:p-8">
        <HeroAura color="var(--purple)" />
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'linear-gradient(90deg,transparent,rgb(var(--accent)),transparent)' }} />

        <div className="relative flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="chip-glass uppercase">Track 3 — Trading Tools</span>
            </div>
            <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight">
              boz<span style={{
                background: 'linear-gradient(135deg, var(--purple), #c4b5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Agent</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Autonomous sharp-move detector · Powered by TxLINE live odds
            </p>
          </div>
          <div className={`chip-glass ${live?.live ? 'chip-green' : connected ? 'chip-blue' : 'chip-slate'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${live?.live ? 'badge-live' : ''}`}
                  style={{ background: 'currentColor' }} />
            {live?.live ? `LIVE ${live.minute}'` : connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              value: stats?.totalSignals ?? signals.length,
              label: 'Total Signals',
              color: 'var(--purple)',
              icon: <IconRadar size={20} />,
            },
            {
              value: accuracy !== null ? `${accuracy}%` : '—',
              label: 'Accuracy',
              color: accuracy !== null && accuracy >= 60 ? 'var(--green)' : accuracy !== null && accuracy >= 40 ? 'var(--amber)' : '#9ca3af',
              icon: <IconTarget size={20} />,
            },
            {
              value: live?.live ? Math.max(1, stats?.liveMatches ?? 0) : (stats?.liveMatches ?? 0),
              label: 'Live Matches',
              color: 'var(--green)',
              icon: <IconPulse size={20} />,
            },
            {
              value: stats?.highConfidence ?? 0,
              label: 'High Conf.',
              color: 'var(--orange)',
              icon: <IconBolt size={20} />,
            },
          ].map(({ value, label, color, icon }) => (
            <div key={label} className="poster-card rounded-2xl p-4 text-center">
              <div className="w-9 h-9 mx-auto mb-2 rounded-xl flex items-center justify-center"
                   style={{ color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
                {icon}
              </div>
              <p className="stat-display text-2xl" style={{ color }}>
                {typeof value === 'number'
                  ? <CountUp value={value} />
                  : typeof value === 'string' && value.endsWith('%')
                    ? <CountUp value={parseFloat(value)} suffix="%" />
                    : value}
              </p>
              <p className="section-label mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {/* How it works — 3 steps */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { step: '1', label: 'Subscribe', desc: 'TxLINE SSE odds stream', color: 'var(--purple)' },
            { step: '2', label: 'Detect',    desc: `>${stats?.detectionThreshold ?? 10}% shift in ${(stats?.windowMs ?? 120000) / 60000} min window`, color: 'var(--amber)' },
            { step: '3', label: 'Signal',    desc: 'Publish + verify accuracy', color: 'var(--green)' },
          ].map(({ step, label, desc, color }) => (
            <div key={step} className="rounded-xl p-3"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2"
                   style={{ background: `${color}22`, color }}>
                {step}
              </div>
              <p className="text-xs font-semibold text-gray-200">{label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agent-vs-Agent Arena ── */}
      <div className="space-y-3">
        <div>
          <p className="section-label" style={{ color: 'var(--purple)' }}>Agent-vs-Agent Arena</p>
          <p className="text-[11px] text-gray-600 mt-0.5">Two autonomous strategies, one live feed, opposite theses — best P&amp;L wins the tournament.</p>
        </div>
        <AgentArena />
      </div>

      {/* ── Config ── */}
      <div className="glass p-4">
        <button className="w-full flex items-center justify-between"
                onClick={() => setConfigOpen(o => !o)}>
          <div className="flex items-center gap-3">
            <p className="section-label">Agent Config</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
              threshold {threshold}% · {windowMin}min window
            </span>
          </div>
          <svg className={`w-3.5 h-3.5 text-gray-600 transition-transform ${configOpen ? 'rotate-180' : ''}`}
               fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {configOpen && (
          <div className="mt-4 space-y-4 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Sharp Move Threshold</span>
                <span className="font-bold" style={{ color: 'var(--purple)' }}>{threshold}%</span>
              </div>
              <input type="range" min={3} max={30} step={1} value={threshold}
                onChange={e => { const v = Number(e.target.value); setThreshold(v); localStorage.setItem('agent_threshold', String(v)); }}
                className="w-full" style={{ accentColor: 'var(--purple)' }} />
              <div className="flex justify-between text-[9px] text-gray-700 mt-1">
                <span>3% — sensitive</span><span>30% — conservative</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Analysis Window</span>
                <span className="font-bold" style={{ color: 'var(--purple)' }}>{windowMin} min</span>
              </div>
              <input type="range" min={1} max={10} step={1} value={windowMin}
                onChange={e => { const v = Number(e.target.value); setWindowMin(v); localStorage.setItem('agent_window', String(v)); }}
                className="w-full" style={{ accentColor: 'var(--purple)' }} />
              <div className="flex justify-between text-[9px] text-gray-700 mt-1">
                <span>1 min — fast</span><span>10 min — broad</span>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-gray-700">
              <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" />
              </svg>
              UI preview only — restart agent with updated env vars to apply server-side.
            </p>
          </div>
        )}
      </div>

      {/* ── Export ── */}
      {signals.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="section-label">
            Signals — {signals.length} total
          </p>
          <button
            onClick={() => {
              const headers = ['ID','Match','Outcome','Delta%','Confidence','Detected','Verified','Accurate','Context'];
              const rows = signals.map(s => [
                s.id, s.matchId, s.affectedOutcome, s.deltaPercent.toFixed(2),
                s.confidence, new Date(s.detectedAt).toISOString(),
                s.outcomeVerified, s.wasAccurate ?? '',
                (s.context ?? '').replace(/"/g, '""'),
              ].map(v => `"${v}"`).join(','));
              const csv = [headers.join(','), ...rows].join('\n');
              const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
                download: `bozagent-signals-${new Date().toISOString().slice(0,10)}.csv`,
              });
              a.click();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid var(--glass-border)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        </div>
      )}

      {/* ── Active signals ── */}
      <div>
        <p className="section-label mb-3">
          Active — {active.length} pending verification
        </p>
        {active.length === 0 ? (
          <div className="glass p-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                 style={{ color: 'var(--purple)', background: 'var(--purple-dim)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <IconRadar size={22} />
            </div>
            <p className="text-sm text-gray-500">Agent is watching live odds</p>
            <p className="text-xs text-gray-700 mt-1">
              Signals appear when odds shift &gt;{threshold}% within {windowMin} min
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(s => <SignalRow key={s.id} signal={s} />)}
          </div>
        )}
      </div>

      {/* ── History + accuracy chart ── */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="section-label">
            Verified History — {history.length} signals
          </p>
          <div className="glass p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-gray-600">Last {Math.min(history.length, 20)} results</p>
              {accuracy !== null && (
                <span className="text-xs font-bold"
                      style={{ color: accuracy >= 60 ? 'var(--green)' : accuracy >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                  {accuracy}% accuracy
                </span>
              )}
            </div>
            <div className="flex items-end gap-1 h-12">
              {history.slice(0, 20).reverse().map((s, i) => (
                <div key={s.id}
                     title={s.wasAccurate ? 'Accurate' : 'Inaccurate'}
                     className="flex-1 rounded-sm"
                     style={{
                       height: s.confidence === 'HIGH' ? '100%' : s.confidence === 'MEDIUM' ? '70%' : '40%',
                       background: s.wasAccurate ? 'var(--green)' : 'var(--red)',
                       opacity: 0.5 + (i / 20) * 0.5,
                     }} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-700 mt-1.5">
              <span>← Oldest</span><span>Latest →</span>
            </div>
          </div>
          <div className="space-y-2">
            {history.slice(0, 10).map(s => <SignalRow key={s.id} signal={s} showResult />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal, showResult }: { signal: AgentSignal; showResult?: boolean }) {
  const dir = signal.deltaPercent > 0 ? '↑' : '↓';
  const pct = Math.abs(signal.deltaPercent).toFixed(1);
  const cs = {
    HIGH:   { color: 'var(--red)',    border: 'rgba(239,68,68,0.25)',   bg: 'var(--red-dim)' },
    MEDIUM: { color: 'var(--orange)', border: 'rgba(249,115,22,0.25)',  bg: 'var(--orange-dim)' },
    LOW:    { color: '#9ca3af',       border: 'rgba(107,114,128,0.2)',  bg: 'rgba(107,114,128,0.08)' },
  }[signal.confidence];

  return (
    <div className="glass anim-in rounded-2xl p-4" style={{ borderColor: cs.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-bold text-sm" style={{ color: cs.color }}>
              <IconBolt size={13} /> {signal.affectedOutcome} {dir}{pct}%
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
              {signal.confidence}
            </span>
            {showResult && signal.outcomeVerified && (
              <span className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ color: signal.wasAccurate ? 'var(--green)' : 'var(--red)',
                             background: signal.wasAccurate ? 'var(--green-dim)' : 'var(--red-dim)' }}>
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  {signal.wasAccurate ? <path d="M4 12l5 5L20 6" /> : <path d="M6 6l12 12M18 6L6 18" />}
                </svg>
              </span>
            )}
          </div>
          {signal.context && (
            <p className="text-xs text-gray-500 mt-1">{signal.context}</p>
          )}
          <p className="text-[10px] text-gray-600 mt-1">
            {new Date(signal.detectedAt).toLocaleTimeString()} · {signal.matchId}
          </p>
        </div>
      </div>
    </div>
  );
}
