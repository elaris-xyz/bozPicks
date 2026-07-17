'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCENARIO_LIST } from '@/lib/scenarios';
import { useSSEContext, useSSESubscription } from '@/contexts/SSEContext';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import { fireToast } from './Toast';

/**
 * Command Bridge — the judge's control panel. Collapsed it's a single launcher
 * icon in the bottom-left corner (mirroring the sound toggle on the right) so it
 * never clutters the page. Tap it and a SOLID, self-contained panel opens from
 * the corner: pick a real TxLINE fixture (proof of the live integration) or a
 * preset, choose the exact outcome, set the speed, and Run. Every downstream
 * result (settlement, agent P&L, Hi-Lo) is deterministic and verifiable.
 */

const SPEEDS = [1, 2, 4, 8] as const;
const PANEL_BG = 'linear-gradient(180deg, #101a30, #0a0f1e)';

interface Fixture { fixtureId: string; competition: string; home: string; away: string; startTime: number }
interface TxStatus { ok: boolean; count?: number; competitions?: string[]; latencyMs?: number; error?: string }

export function CommandBridge() {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'warn' | 'error'; text: string } | null>(null);
  const [speed, setSpeed] = useState(4);
  const [scenarioKey, setScenarioKey] = useState('home-win');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureIdx, setFixtureIdx] = useState(-1); // -1 = preset
  const [tx, setTx] = useState<TxStatus | null>(null);
  const bootstrapped = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Unified live state (same source every page uses) + stream self-healing.
  const live = useLiveMatch();
  const { reconnect } = useSSEContext();
  const lastLiveEvent = useRef(0);
  useSSESubscription(msg => {
    if (msg.type === 'event' && !msg.catchup) lastLiveEvent.current = Date.now();
  });

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

  // close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPickerOpen(false); setOpen(false); } };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setPickerOpen(false); setOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const chooseSpeed = (s: number) => { setSpeed(s); localStorage.setItem('boz_demo_speed', String(s)); };
  const chooseScenario = (k: string) => { setScenarioKey(k); localStorage.setItem('boz_demo_scenario', k); };

  const run = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setNotice(null);
    setPickerOpen(false);
    try {
      const params = new URLSearchParams({ speed: String(speed), scenario: scenarioKey });
      const f = fixtures[fixtureIdx];
      if (f) {
        params.set('home', f.home); params.set('away', f.away);
        params.set('competition', f.competition); params.set('fixtureId', f.fixtureId);
      }
      const res = await fetch(`/api/demo?${params.toString()}`, { method: 'POST' });

      if (res.status === 409) {
        // a replay is already on air — honest feedback instead of silence
        setNotice({ kind: 'warn', text: 'A match is already running — it’s live on every page right now.' });
        return;
      }
      if (res.status === 503) {
        setNotice({ kind: 'error', text: 'Realtime backend unavailable — the Redis instance is down or over its quota. Swap REDIS_URL and restart.' });
        return;
      }
      if (!res.ok) {
        setNotice({ kind: 'error', text: `Could not start (${res.status}) — try again.` });
        return;
      }

      const d = await res.json().catch(() => ({}));
      setOpen(false); // ACK received → the match kicks off within a second
      fireToast({ kind: 'info', title: 'Match starting', body: `${d.homeTeam ?? 'Home'} v ${d.awayTeam ?? 'Away'} · every page is now live` });

      // Watchdog: if no live event lands within 7s the SSE stream is a zombie
      // (connected but silent) — force one fresh connection, then warn.
      const ackAt = Date.now();
      setTimeout(() => {
        if (lastLiveEvent.current < ackAt) {
          reconnect();
          setTimeout(() => {
            if (lastLiveEvent.current < ackAt) {
              fireToast({ kind: 'warn', title: 'Live stream reconnecting…', body: 'Events should resume in a few seconds.' });
            }
          }, 7000);
        }
      }, 7000);
    } catch {
      setNotice({ kind: 'error', text: 'Network error — the demo could not start.' });
    } finally {
      setStarting(false);
    }
  }, [starting, speed, scenarioKey, fixtures, fixtureIdx, reconnect]);

  const activeFixture = fixtures[fixtureIdx];
  const matchLabel = activeFixture ? `${activeFixture.home} v ${activeFixture.away}` : 'Brazil v Argentina (preset)';
  const pickerLabel = activeFixture
    ? `${activeFixture.home} v ${activeFixture.away} · #${activeFixture.fixtureId}`
    : 'Brazil v Argentina — preset';

  return (
    <div ref={wrapRef} className="fixed z-40 bottom-24 left-3 md:bottom-10 md:left-4 print:hidden">
      {/* expanded panel — solid, opens from the corner upward */}
      {open && (
        <div className="anim-in absolute bottom-full mb-2 left-0 w-[min(92vw,384px)]">
          <div className="rounded-2xl p-4"
               style={{ background: PANEL_BG, border: '1px solid rgba(99,140,255,0.28)', boxShadow: '0 20px 56px rgba(0,0,0,0.62)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="var(--blue)"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Command Bridge</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1.5"
                    style={tx?.ok
                      ? { background: 'rgba(16,185,129,0.12)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.35)' }
                      : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${tx?.ok ? 'badge-live' : ''}`} style={{ background: 'currentColor' }} />
                {tx == null ? 'TxLINE…' : tx.ok ? `${tx.count} live fixtures · ${tx.latencyMs}ms` : 'TxLINE offline'}
              </span>
            </div>

            {/* fixture picker — custom themed dropdown */}
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Match — real TxLINE fixture or preset</label>
            <div className="relative mt-1 mb-3">
              <button type="button" onClick={() => setPickerOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${pickerOpen ? 'rgba(99,140,255,0.5)' : 'rgba(255,255,255,0.1)'}`, color: '#e2e8f0' }}>
                <span className="truncate text-left">{pickerLabel}</span>
                <svg className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {pickerOpen && (
                <div className="absolute z-10 bottom-full mb-1 left-0 right-0 max-h-56 overflow-y-auto rounded-xl py-1 rail-scroll anim-in"
                     style={{ background: '#0c1424', border: '1px solid rgba(99,140,255,0.3)', boxShadow: '0 -12px 32px rgba(0,0,0,0.55)' }}>
                  <FixtureOption active={fixtureIdx === -1} onClick={() => { setFixtureIdx(-1); setPickerOpen(false); }}
                    title="Brazil v Argentina" sub="preset · dramatic" />
                  {fixtures.map((f, i) => (
                    <FixtureOption key={f.fixtureId} active={fixtureIdx === i} onClick={() => { setFixtureIdx(i); setPickerOpen(false); }}
                      title={`${f.home} v ${f.away}`} sub={`${f.competition} · TxLINE #${f.fixtureId}`} />
                  ))}
                </div>
              )}
            </div>

            {/* scenario picker */}
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Outcome — you decide, everything settles to it</label>
            <div className="grid grid-cols-2 gap-2 mt-1 mb-3">
              {SCENARIO_LIST.map(s => {
                const on = scenarioKey === s.key;
                return (
                  <button key={s.key} onClick={() => chooseScenario(s.key)}
                    className="text-[11px] font-semibold px-2.5 py-2 rounded-xl transition-all text-left"
                    style={on
                      ? { background: 'rgba(59,130,246,0.16)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.5)' }
                      : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* status notice — 409 / errors get honest, visible feedback */}
            {notice && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-3 text-[11px] leading-snug anim-in"
                   style={notice.kind === 'warn'
                     ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d' }
                     : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3 2 20h20L12 3z" strokeLinejoin="round" /><path d="M12 10v4M12 17.5v.01" strokeLinecap="round" />
                </svg>
                {notice.text}
              </div>
            )}

            {/* speed + run */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Label the RUNTIME, not a multiplier: a 90-minute match is
                    compressed to ~42s at 1×, so "8×" read as "8× of 90 minutes"
                    and set the wrong expectation. Each option states how long
                    the run actually takes. */}
                <label className="text-[10px] uppercase tracking-widest text-gray-500">Runs in</label>
                <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => chooseSpeed(s)}
                      title={`${s}× — full match in about ${Math.round(42 / s)}s`}
                      className="px-2.5 h-6 text-[11px] font-bold tabular-nums transition-colors"
                      style={speed === s ? { background: 'rgba(59,130,246,0.2)', color: '#93c5fd' } : { color: '#64748b' }}>
                      {Math.round(42 / s)}s
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={run} disabled={starting || !!live?.live}
                className="flex items-center gap-1.5 text-xs font-bold px-4 h-8 rounded-full transition-all hover:brightness-110 active:scale-95 flex-shrink-0 disabled:cursor-default"
                style={live?.live
                  ? { background: 'rgba(16,185,129,0.15)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.4)' }
                  : starting
                  ? { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)' }
                  : { background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))', color: '#fff' }}>
                {live?.live
                  ? (<><span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />Live · {live.minute}&rsquo;</>)
                  : starting
                  ? (<><span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,197,253,0.3)', borderTopColor: '#93c5fd' }} />Starting…</>)
                  : (<><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>Run</>)}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 truncate">{matchLabel} · {SCENARIO_LIST.find(s => s.key === scenarioKey)?.label ?? scenarioKey}</p>
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
          : { background: 'rgba(9,13,26,0.85)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', color: 'var(--blue)' }}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" /></svg>
        {/* live match on air → pulsing green ring (unified with every page) */}
        {live?.live && !open && (
          <span className="absolute -inset-1 rounded-full animate-ping pointer-events-none"
                style={{ background: 'rgba(16,185,129,0.25)' }} />
        )}
        {(live?.live || tx?.ok) && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full badge-live"
                style={{ background: 'var(--green)', border: '2px solid var(--bg-deep)' }} />
        )}
      </button>
    </div>
  );
}

function FixtureOption({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/5"
      style={active ? { background: 'rgba(59,130,246,0.14)' } : undefined}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? 'var(--blue)' : 'transparent', border: active ? 'none' : '1px solid rgba(255,255,255,0.2)' }} />
      <span className="min-w-0">
        <span className="block text-[12px] text-gray-200 truncate">{title}</span>
        <span className="block text-[10px] text-gray-500 truncate">{sub}</span>
      </span>
    </button>
  );
}
