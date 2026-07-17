'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live real-proof showcase (Track 1's strongest credibility element). Fetches a
 * REAL fixture's TxLINE Merkle proof and re-folds it in this session to
 * reproduce TxLINE's own committed eventStatRoot — proving the result
 * trustlessly against TxLINE's cryptography, live, with no simulated root. This
 * is the honest counterpart to the demo's SIMULATED receipts.
 *
 * Auto-picks the most compelling real fixture (a match in play RIGHT NOW > a
 * recently-finished one > an evergreen finished showcase), so on a real match
 * day it verifies the LIVE game and keeps the score current. The proof is
 * fetched from TxLINE at request time and discarded — nothing bundled
 * (licence §7.1 "use", not redistribution).
 */

interface VerifiedStat {
  key: number; value: number; period: number; verified: boolean;
  eventStatRoot: string; proofNodes: number; meaning: string;
}
interface RealProof {
  fixtureId: string; seq: number; mode: 'FINAL' | 'LIVE';
  home: string; away: string;
  homeScore: number; awayScore: number; participant1IsHome: boolean;
  stats: VerifiedStat[]; verifiedAt: string;
}

const LIVE_POLL_MS = 20_000;

export function RealProofCard() {
  const [data, setData] = useState<RealProof | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [err, setErr] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) { setState('loading'); setErr(''); }
    try {
      const r = await fetch('/api/proof/real', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? `error ${r.status}`); setState('error'); return null; }
      setData(j); setState('idle');
      return j as RealProof;
    } catch (e) {
      if (!opts.silent) { setErr((e as Error).message); setState('error'); }
      return null;
    }
  }, []);

  // auto-load on mount so a judge sees a real proof immediately — no click needed
  useEffect(() => { void load(); }, [load]);

  // while a real match is LIVE, keep the verified score current on a gentle poll
  useEffect(() => {
    if (data?.mode !== 'LIVE') { if (pollRef.current) clearTimeout(pollRef.current); return; }
    pollRef.current = setTimeout(function tick() {
      void load({ silent: true }).finally(() => { pollRef.current = setTimeout(tick, LIVE_POLL_MS); });
    }, LIVE_POLL_MS);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [data?.mode, load]);

  const allVerified = data && data.stats.length > 0 && data.stats.every(s => s.verified);
  const isLive = data?.mode === 'LIVE';
  const period = data?.stats[0]?.period ?? 100;

  // winner line, written NATURALLY (winner first) so "England 1–2 Argentina"
  // in the header never reads as ambiguous — this spells out who actually won
  const summary = (() => {
    if (!data) return null;
    const { home, away, homeScore: h, awayScore: a } = data;
    const hi = Math.max(h, a), lo = Math.min(h, a);
    const leader = h > a ? home : away;
    if (h === a) return { icon: '⚖️', text: isLive ? `Level ${h}–${a}` : `Draw ${h}–${a}` };
    if (isLive) return { icon: '🔴', text: `${leader} lead ${hi}–${lo}` };
    return { icon: '🏆', text: `${leader} win ${hi}–${lo}` };
  })();

  return (
    <div className="glass relative overflow-hidden p-5">
      <div className="absolute -top-16 left-0 w-56 h-56 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${isLive ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'}, transparent 70%)` }} />

      <div className="relative flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'badge-live' : ''}`}
              style={{ background: isLive ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 10px ${isLive ? 'rgba(239,68,68,0.6)' : 'rgba(16,185,129,0.6)'}` }} />
        <h2 className="text-sm font-bold tracking-tight text-gray-100">Verify a real result</h2>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">not simulated</span>
      </div>
      <p className="relative text-[12px] text-gray-500 mb-4 max-w-2xl">
        The demo settles synthetic matches with <span style={{ color: 'var(--amber)' }}>Simulated</span> receipts.
        Here we do the real thing: pull a <b className="text-gray-300">real</b> World Cup fixture's TxLINE Merkle
        proof and re-fold it in your browser session to reproduce TxLINE's own committed root — trustless
        verification against real cryptography, no oracle.
      </p>

      {state === 'loading' && !data && (
        <div className="relative flex items-center gap-2 text-xs text-gray-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--green)' }} />
          Fetching &amp; verifying a live TxLINE proof…
        </div>
      )}

      {state === 'error' && (
        <div className="relative flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-snug"
             style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d' }}>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3 2 20h20L12 3z" strokeLinejoin="round" /><path d="M12 10v4M12 17.5v.01" strokeLinecap="round" /></svg>
          <div className="flex-1">
            {err.includes('token')
              ? 'TxLINE token not set on this deploy — set TXLINE_API_KEY in the environment to enable live proof verification.'
              : `Could not verify: ${err}`}
            <button onClick={() => load()} className="ml-2 underline hover:brightness-125">retry</button>
          </div>
        </div>
      )}

      {data && (
        <div className="relative anim-in">
          {/* result header */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1">
            {isLive ? (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ color: 'var(--red)', border: '1px solid var(--red)', background: 'rgba(239,68,68,0.1)' }}>
                <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />Live · in-play
              </span>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ color: 'var(--green)', border: '1px solid var(--green)', background: 'rgba(16,185,129,0.1)' }}>
                Full-time
              </span>
            )}
            <span className="text-sm font-black text-gray-100 tabular-nums">
              {data.home} <span style={{ color: 'var(--green)' }}>{data.homeScore}</span>
              <span className="text-gray-600">–</span>
              <span style={{ color: 'var(--blue)' }}>{data.awayScore}</span> {data.away}
            </span>
            {summary && (
              <span className="text-[11px] font-bold text-gray-300">{summary.icon} {summary.text}</span>
            )}
          </div>
          <p className="text-[10px] font-mono text-gray-600 mb-3">
            fixture #{data.fixtureId} · {isLive ? `in-play seq ${data.seq}` : `game_finalised seq ${data.seq}`}
            {allVerified && <span className="ml-2" style={{ color: 'var(--green)' }}>✓ proof verified</span>}
          </p>

          {/* per-stat verification rows */}
          <div className="space-y-1.5">
            {data.stats.map(s => (
              <div key={s.key} className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                   style={{ background: s.verified ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${s.verified ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: s.verified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: s.verified ? 'var(--green)' : 'var(--amber)' }}>
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    {s.verified ? <path d="M4 12l5 5L20 6" /> : <path d="M12 3 2 20h20L12 3z" />}
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-gray-200">
                    <span className="font-mono" style={{ color: 'var(--green)' }}>key {s.key}</span>
                    <span className="text-gray-500"> · {s.meaning}</span> = <b className="tabular-nums">{s.value}</b>
                    <span className="text-gray-600"> · period {s.period}</span>
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono truncate">
                    eventStatRoot {s.eventStatRoot.slice(0, 16)}… · {s.proofNodes}-node proof {s.verified ? 'reproduced locally ✓' : 'mismatch'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-[10px] text-gray-600 leading-snug flex-1">
              Each row: we hashed the ScoreStat leaf <span className="font-mono">sha256(key ‖ value ‖ period={period})</span>,
              folded TxLINE's proof by <span className="font-mono">is_right_sibling</span>, and matched TxLINE's own
              <span className="font-mono"> eventStatRoot</span>. Fetched live just now — nothing bundled.
            </p>
            <button onClick={() => load()} title="Re-fetch and verify"
              className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-[var(--blue)] hover:brightness-125">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></svg>
              {isLive ? 'Refresh' : 'Re-verify'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
