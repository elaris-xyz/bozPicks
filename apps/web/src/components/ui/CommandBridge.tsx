'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCENARIO_LIST } from '@/lib/scenarios';

/**
 * Command Bridge — the judge's control panel. Pick a real TxLINE fixture (proof
 * of the live integration) or a preset, choose the exact match outcome, set the
 * speed, and run. Every downstream result (market settlement, agent P&L, Hi-Lo)
 * is then deterministic and verifiable — nothing is hidden or random.
 */

const SPEEDS = [1, 2, 4, 8] as const;

interface Fixture { fixtureId: string; competition: string; home: string; away: string; startTime: number }
interface TxStatus { ok: boolean; count?: number; competitions?: string[]; latencyMs?: number; error?: string }

export function CommandBridge() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [scenarioKey, setScenarioKey] = useState('home-win');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureIdx, setFixtureIdx] = useState(-1); // -1 = preset
  const [tx, setTx] = useState<TxStatus | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    setSpeed(Number(localStorage.getItem('boz_demo_speed')) || 4);
    setScenarioKey(localStorage.getItem('boz_demo_scenario') || 'home-win');
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    fetch('/api/txline/fixtures', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: TxStatus & { fixtures?: Fixture[] }) => {
        setTx(d);
        if (d.ok && Array.isArray(d.fixtures)) setFixtures(d.fixtures);
      })
      .catch(() => setTx({ ok: false, error: 'unreachable' }));
  }, []);

  const chooseSpeed = (s: number) => { setSpeed(s); localStorage.setItem('boz_demo_speed', String(s)); };
  const chooseScenario = (k: string) => { setScenarioKey(k); localStorage.setItem('boz_demo_scenario', k); };

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const params = new URLSearchParams({ speed: String(speed), scenario: scenarioKey });
      const f = fixtures[fixtureIdx];
      if (f) {
        params.set('home', f.home); params.set('away', f.away);
        params.set('competition', f.competition); params.set('fixtureId', f.fixtureId);
      }
      await fetch(`/api/demo?${params.toString()}`, { method: 'POST' });
    } catch { /* ignore */ } finally { setRunning(false); }
  }, [running, speed, scenarioKey, fixtures, fixtureIdx]);

  const activeFixture = fixtures[fixtureIdx];
  const matchLabel = activeFixture ? `${activeFixture.home} v ${activeFixture.away}` : 'Brazil v Argentina (preset)';

  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[4.5rem] md:bottom-5 w-[min(94vw,720px)] print:hidden">
      {/* expanded panel */}
      {open && (
        <div className="glass anim-in mb-2 p-4 rounded-2xl" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Command Bridge</p>
            {/* TxLINE status */}
            <span className="text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1.5"
                  style={tx?.ok
                    ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.35)' }
                    : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid var(--glass-border)' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${tx?.ok ? 'badge-live' : ''}`} style={{ background: 'currentColor' }} />
              {tx == null ? 'TxLINE…' : tx.ok
                ? `TxLINE · ${tx.count} live fixtures · ${tx.latencyMs}ms`
                : 'TxLINE offline'}
            </span>
          </div>

          {/* fixture picker (real TxLINE) */}
          <label className="text-[10px] uppercase tracking-widest text-gray-600">Match — real TxLINE fixture or preset</label>
          <select value={fixtureIdx} onChange={e => setFixtureIdx(Number(e.target.value))}
            className="w-full mt-1 mb-3 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: '#e2e8f0' }}>
            <option value={-1}>Brazil v Argentina — preset (dramatic)</option>
            {fixtures.map((f, i) => (
              <option key={f.fixtureId} value={i}>{f.home} v {f.away} — {f.competition} · TxLINE #{f.fixtureId}</option>
            ))}
          </select>

          {/* scenario picker */}
          <label className="text-[10px] uppercase tracking-widest text-gray-600">Outcome — you decide, everything settles to it</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 mb-3">
            {SCENARIO_LIST.map(s => {
              const on = scenarioKey === s.key;
              return (
                <button key={s.key} onClick={() => chooseScenario(s.key)}
                  className="text-[11px] font-semibold px-2 py-2 rounded-xl transition-all text-left"
                  style={on
                    ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.45)' }
                    : { background: 'var(--glass-bg)', color: '#94a3b8', border: '1px solid var(--glass-border)' }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* speed */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">Speed</label>
            <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
              {SPEEDS.map(s => (
                <button key={s} onClick={() => chooseSpeed(s)}
                  className="px-2.5 h-6 text-[11px] font-bold tabular-nums transition-colors"
                  style={speed === s ? { background: 'var(--blue-dim)', color: 'var(--blue)' } : { color: '#6b7280' }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* compact bar */}
      <div className="glass flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.45)' }}>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-300 hover:text-white transition-colors">
          <span className={`w-1.5 h-1.5 rounded-full ${tx?.ok ? 'badge-live' : ''}`} style={{ background: tx?.ok ? 'var(--green)' : '#64748b' }} />
          <span className="hidden sm:inline">Command Bridge</span>
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="text-[11px] text-gray-500 truncate max-w-[38%] hidden sm:inline">{matchLabel}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
          {SCENARIO_LIST.find(s => s.key === scenarioKey)?.label ?? scenarioKey}
        </span>
        <div className="flex-1" />
        <button onClick={run} disabled={running}
          className="flex items-center gap-1.5 text-xs font-bold px-3 h-7 rounded-full transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
          style={running
            ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }
            : { background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff' }}>
          {running ? (<><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />Live…</>)
                   : (<><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>Run</>)}
        </button>
      </div>
    </div>
  );
}
