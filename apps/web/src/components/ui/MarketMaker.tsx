'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { SSEMessage, BozEvent, OddsSnapshot, Outcome } from '@bozpicks/shared';
import { initMM, mmStep, mmPnl, mmExposure, mmSpreadPct, type MMState } from '@bozpicks/shared';
import { CountUp } from './CountUp';
import { Sparkline } from './Sparkline';

/**
 * In-Play Market Maker — the third autonomous agent. It quotes a live two-sided
 * market (bid/ask) on every 1X2 outcome off the TxLINE consensus, widening with
 * volatility and skewing against inventory, and books the spread as the price
 * crosses its quotes. Runs the SAME shared `mmStep` core as the headless maker
 * (apps/agent), driven here off the live SSE odds feed — the card is a mirror of
 * the real autonomous process. P&L is mark-to-market: spread earned minus
 * adverse selection, the exact figure a market operator judges a maker on.
 */

const CAREER_KEY = 'boz_mm_career';
const ACCENT = '6,182,212'; // cyan — the maker's own identity vs arena green/purple

interface Career { pnl: number; fills: number; volume: number; edge: number; matches: number }
const OUTCOMES: Outcome[] = ['HOME', 'DRAW', 'AWAY'];
const OUT_COLOR: Record<Outcome, string> = { HOME: 'var(--green)', DRAW: '#94a3b8', AWAY: 'var(--blue)' };

export function MarketMaker() {
  const [mm, setMM] = useState<MMState>(() => initMM());
  const [pnlHist, setPnlHist] = useState<number[]>([]);
  const [career, setCareer] = useState<Career>({ pnl: 0, fills: 0, volume: 0, edge: 0, matches: 0 });
  const live = useLiveMatch();

  const lastOdds = useRef<OddsSnapshot | null>(null);
  const settledFor = useRef<string | null>(null);

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(CAREER_KEY) || ''); if (c) setCareer(c); } catch { /* first run */ }
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;

      if (e.type === 'MATCH_START' && settledFor.current !== e.matchId) {
        setMM(initMM()); setPnlHist([]); lastOdds.current = null;
      }

      if (e.odds) {
        const next = e.odds;
        setMM(prev => {
          const stepped = mmStep(prev, next);
          setPnlHist(h => [...h, mmPnl(stepped, next)].slice(-48));
          return stepped;
        });
        lastOdds.current = next;
      }

      if (e.type === 'MATCH_END' && lastOdds.current && settledFor.current !== e.matchId) {
        settledFor.current = e.matchId;
        const close = lastOdds.current;
        setMM(prev => {
          const realized = mmPnl(prev, close);
          setCareer(cr => {
            const upd: Career = {
              pnl: cr.pnl + realized, fills: cr.fills + prev.fills,
              volume: cr.volume + prev.volume, edge: cr.edge + prev.edgeCaptured,
              matches: cr.matches + 1,
            };
            localStorage.setItem(CAREER_KEY, JSON.stringify(upd));
            return upd;
          });
          return prev;
        });
      }
    },
  });

  const pnl = lastOdds.current ? mmPnl(mm, lastOdds.current) : 0;
  const exposure = mmExposure(mm);
  const spread = mmSpreadPct(mm);
  const quotes = mm.quotes ?? [];
  const isLive = !!live?.live;

  return (
    <div className="glass sheen p-4 relative overflow-hidden" style={{ borderColor: `rgba(${ACCENT},0.28)` }}>
      <div className="absolute -top-12 right-0 w-40 h-40 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, rgba(${ACCENT},0.1), transparent 70%)` }} />

      {/* header + headline P&L */}
      <div className="relative flex items-start justify-between mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full badge-live" style={{ background: `rgb(${ACCENT})` }} />
            <p className="font-display font-black text-base" style={{ color: `rgb(${ACCENT})` }}>In-Play Market Maker</p>
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">quotes both sides · earns the spread</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums leading-none" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnl >= 0 ? '+' : ''}<CountUp value={Number(pnl.toFixed(1))} duration={600} />
          </p>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">P&amp;L mark-to-market</p>
        </div>
      </div>

      {/* live quote ladder — bid | fair | ask per outcome + inventory */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[46px_1fr_1fr_1fr_54px] gap-2 text-[8px] font-black uppercase tracking-widest text-gray-600 px-1">
          <span></span><span className="text-center">Bid</span><span className="text-center">Fair</span><span className="text-center">Ask</span><span className="text-right">Inv</span>
        </div>
        {OUTCOMES.map(o => {
          const q = quotes.find(x => x.outcome === o);
          const inv = q?.inventory ?? 0;
          const invColor = inv > 0 ? 'var(--green)' : inv < 0 ? 'var(--blue)' : '#6b7280';
          return (
            <div key={o} className="grid grid-cols-[46px_1fr_1fr_1fr_54px] gap-2 items-center">
              <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: OUT_COLOR[o] }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: OUT_COLOR[o] }} />{o === 'DRAW' ? 'DRW' : o === 'HOME' ? 'HOME' : 'AWAY'}
              </span>
              <span className="text-center text-[12px] font-bold tabular-nums rounded-md py-1"
                    style={{ color: 'var(--green)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                {q ? q.bid.toFixed(1) : '—'}
              </span>
              <span className="text-center text-[12px] font-black tabular-nums text-gray-200">{q ? q.fair.toFixed(1) : '—'}</span>
              <span className="text-center text-[12px] font-bold tabular-nums rounded-md py-1"
                    style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                {q ? q.ask.toFixed(1) : '—'}
              </span>
              <span className="text-right text-[11px] font-black tabular-nums" style={{ color: invColor }}>
                {inv > 0 ? '+' : ''}{inv}
              </span>
            </div>
          );
        })}
      </div>

      {/* P&L curve — a proper labelled panel, not a squished strip */}
      <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid var(--glass-border)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">P&amp;L curve</span>
          <span className="text-[10px] tabular-nums font-bold" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}
          </span>
        </div>
        {pnlHist.length > 1 ? (
          <Sparkline data={pnlHist} color={pnl >= 0 ? `rgb(${ACCENT})` : 'var(--red)'} width={560} height={60} />
        ) : (
          <div className="h-[60px] flex items-center justify-center text-[11px] text-gray-600">
            the curve draws itself as the maker books fills
          </div>
        )}
      </div>

      {/* desk stats — full labels, readable */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        <Stat label="Spread edge" value={`+${mm.edgeCaptured.toFixed(1)}`} color="var(--green)" />
        <Stat label="Fills" value={String(mm.fills)} />
        <Stat label="Volume" value={String(mm.volume)} />
        <Stat label="Quoted spread" value={`${spread.toFixed(1)}%`} />
      </div>

      {/* exposure + career */}
      <div className="flex items-center justify-between mt-3 pt-3 text-[10px] text-gray-500" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <span>exposure <span className="font-bold" style={{ color: exposure > 40 ? 'var(--amber)' : '#9ca3af' }}>{exposure}u</span></span>
        <span className="text-gray-600">
          career <span className="font-bold tabular-nums" style={{ color: career.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{career.pnl >= 0 ? '+' : ''}{career.pnl.toFixed(1)}</span>
          {' '}· {career.fills} fills · {career.matches} mkt{career.matches === 1 ? '' : 's'}
        </span>
      </div>

      {!isLive && quotes.length === 0 && (
        <p className="text-[10px] text-gray-600 text-center mt-3">Idle — quotes stream in the moment a live match's odds move.</p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg py-2 px-1 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
      <p className="text-[15px] font-black tabular-nums leading-none" style={{ color: color ?? '#e2e8f0' }}>{value}</p>
      <p className="text-[9px] font-semibold tracking-wide text-gray-400 mt-1">{label}</p>
    </div>
  );
}
