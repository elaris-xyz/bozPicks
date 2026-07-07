'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCENARIO_LIST } from '@/lib/scenarios';

/**
 * Command Bridge — the judge's control panel. Collapsed it's a single launcher
 * icon in the bottom-left corner (mirroring the sound toggle on the right) so it
 * never clutters the page. Tap it and the panel opens from the left: pick a real
 * TxLINE fixture (proof of the live integration) or a preset, choose the exact
 * outcome, set the speed, and Run. Every downstream result (market settlement,
 * agent P&L, Hi-Lo) is then deterministic and verifiable — nothing is random.
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

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
    <div className="fixed z-40 bottom-20 left-3 md:bottom-4 md:left-4 print:hidden">
      {/* expanded panel — opens from the corner, upward */}
      {open && (
        <div className="anim-in absolute bottom-full mb-2 left-0 w-[min(92vw,380px)]">
          <div className="glass p-4 rounded-2xl" style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Command Bridge</p>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1.5"
                    style={tx?.ok
                      ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.35)' }
                      : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid var(--glass-border)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${tx?.ok ? 'badge-live' : ''}`} style={{ background: 'currentColor' }} />
                {tx == null ? 'TxLINE…' : tx.ok
                  ? `${tx.count} live fixtures · ${tx.latencyMs}ms`
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
            <div className="grid grid-cols-2 gap-2 mt-1 mb-3">
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

            {/* speed + run */}
            <div className="flex items-center justify-between gap-2">
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
              <button onClick={run} disabled={running}
                className="flex items-center gap-1.5 text-xs font-bold px-4 h-8 rounded-full transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
                style={running
                  ? { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }
                  : { background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff' }}>
                {running ? (<><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />Live…</>)
                         : (<><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>Run</>)}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 truncate">{matchLabel} · {SCENARIO_LIST.find(s => s.key === scenarioKey)?.label ?? scenarioKey}</p>
          </div>
        </div>
      )}

      {/* launcher icon — mirrors the sound toggle on the right */}
      <button onClick={() => setOpen(o => !o)}
        title="Command Bridge — run a live match" aria-label="Command Bridge"
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={open
          ? { background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', border: '1px solid rgba(59,130,246,0.5)', color: '#fff', boxShadow: '0 0 18px rgba(59,130,246,0.4)' }
          : { background: 'rgba(9,13,26,0.8)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)', color: 'var(--blue)' }}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
        {/* live TxLINE dot */}
        {tx?.ok && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full badge-live"
                style={{ background: 'var(--green)', border: '2px solid var(--bg-deep)' }} />
        )}
      </button>
    </div>
  );
}
