'use client';

import { useEffect, useState, useRef } from 'react';
import type { AgentSignal, SSEMessage } from '@bozpicks/shared';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import { useSSEContext } from '@/contexts/SSEContext';
import { IconRadar, IconBolt } from '@/components/ui/Icons';
import { AgentArena } from '@/components/ui/AgentArena';
import { AgentHero } from '@/components/ui/AgentHero';
import { AgentBanner } from '@/components/ui/AgentBanner';
import { AgentPipeline } from '@/components/ui/AgentPipeline';
import { AgentMomentum } from '@/components/ui/AgentMomentum';

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
  const [configSaved, setConfigSaved] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load the LIVE config the headless agent (Railway) is actually running —
  // not a local guess, so the sliders start where the agent really is
  useEffect(() => {
    fetch('/api/agents/config')
      .then(r => r.json())
      .then(cfg => {
        if (typeof cfg.threshold === 'number') setThreshold(Math.round(cfg.threshold * 100));
        if (typeof cfg.windowMs === 'number') setWindowMin(Math.round(cfg.windowMs / 60_000));
      })
      .catch(() => {});
  }, []);

  // push a slider change to the agent (debounced so a drag doesn't spam
  // requests) — the headless process picks it up within ~5s, no restart
  const pushConfig = (nextThreshold: number, nextWindowMin: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/agents/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: nextThreshold / 100, windowMs: nextWindowMin * 60_000 }),
      })
        .then(r => r.ok && setConfigSaved(true))
        .then(() => setTimeout(() => setConfigSaved(false), 2000))
        .catch(() => {});
    }, 400);
  };

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
    <div className="theme-agent space-y-6">

      {/* ── Cinematic hero ── */}
      <AgentHero />

      {/* ── Live centrepiece — headline numbers (or an invite when idle) ── */}
      <AgentBanner
        totalSignals={stats?.totalSignals ?? signals.length}
        accuracy={accuracy}
        liveMatches={live?.live ? Math.max(1, stats?.liveMatches ?? 0) : (stats?.liveMatches ?? 0)}
        highConf={stats?.highConfidence ?? 0}
        live={live}
        connected={connected}
      />

      {/* ── Signature visual — the autonomous detection loop ── */}
      <AgentPipeline />

      {/* ── Signal context: pitch pressure with the detector's calls on top ── */}
      <AgentMomentum />

      {/* ── Agent-vs-Agent Arena ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--purple)', boxShadow: '0 0 10px rgba(167,139,250,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--purple)' }}>Agent-vs-Agent Arena</h2>
          <span className="text-[10px] text-gray-600">two strategies · one feed</span>
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
                onChange={e => { const v = Number(e.target.value); setThreshold(v); pushConfig(v, windowMin); }}
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
                onChange={e => { const v = Number(e.target.value); setWindowMin(v); pushConfig(threshold, v); }}
                className="w-full" style={{ accentColor: 'var(--purple)' }} />
              <div className="flex justify-between text-[9px] text-gray-700 mt-1">
                <span>1 min — fast</span><span>10 min — broad</span>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-gray-700">
              <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {configSaved
                  ? <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                  : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>}
              </svg>
              {configSaved
                ? <span style={{ color: 'var(--green)' }}>Saved — the live agent applies this within ~5s.</span>
                : 'Live control — changes reach the running agent, no restart needed.'}
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
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-2.5 h-2.5 rounded-full badge-live" style={{ background: 'var(--amber)', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight text-gray-100">Active signals</h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)' }}>{active.length}</span>
          <span className="text-[10px] text-gray-600">pending verification</span>
        </div>
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
        ) : (() => {
          // Collapse the wall: repeated same-direction calls on the same outcome
          // aggregate into one row with a ×N count — a judge reads the market
          // stance in 3 rows instead of scrolling 30 near-identical cards.
          const groups = new Map<string, { latest: AgentSignal; count: number; maxAbs: number }>();
          for (const s of active) {
            const key = `${s.affectedOutcome}|${s.deltaPercent > 0 ? 'up' : 'down'}|${s.confidence}`;
            const g = groups.get(key);
            if (!g) groups.set(key, { latest: s, count: 1, maxAbs: Math.abs(s.deltaPercent) });
            else {
              g.count++;
              g.maxAbs = Math.max(g.maxAbs, Math.abs(s.deltaPercent));
              if (new Date(s.detectedAt) > new Date(g.latest.detectedAt)) g.latest = s;
            }
          }
          const rows = [...groups.values()].sort((a, b) => b.count - a.count);
          const shown = signalsExpanded ? rows : rows.slice(0, 6);
          return (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {shown.map(g => <SignalRow key={g.latest.id} signal={g.latest} count={g.count} />)}
              </div>
              {rows.length > 6 && (
                <button onClick={() => setSignalsExpanded(v => !v)}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all hover:brightness-125"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--purple)' }}>
                  {signalsExpanded ? 'Show less' : `Show all · ${rows.length} stances`}
                  <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${signalsExpanded ? 'rotate-180' : ''}`}
                       fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* ── History + accuracy chart ── */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
            <h2 className="text-sm font-bold tracking-tight text-gray-100">Verified history</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--green)' }}>{history.length}</span>
            <span className="text-[10px] text-gray-600">graded vs final</span>
          </div>
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

function SignalRow({ signal, showResult, count = 1 }: { signal: AgentSignal; showResult?: boolean; count?: number }) {
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
            {count > 1 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.4)' }}>
                ×{count}
              </span>
            )}
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
