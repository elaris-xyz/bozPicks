'use client';

import { useEffect, useRef, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { SSEMessage, BozEvent, OddsSnapshot } from '@bozpicks/shared';
import {
  initAgent, evaluate, settleAgent, resultFrom, avgClv, winRate, markToMarket,
  type AgentState, type AgentId,
} from '@/lib/arena';
import { CountUp } from './CountUp';
import { Sparkline } from './Sparkline';

/**
 * Live Agent-vs-Agent Arena. Both agents run fully autonomously off the same
 * TxLINE odds stream — no human input — opening opposite positions on every
 * significant price move and settling when the match ends. Career P&L compounds
 * across matches (localStorage) so the better strategy pulls ahead over the
 * tournament, exactly as the track brief asks.
 */

const CAREER_KEY = 'boz_arena_career';
type Career = Record<AgentId, { pnl: number; bets: number; wins: number }>;

const META: Record<AgentId, { name: string; tag: string; color: string }> = {
  MOMENTUM:   { name: 'Momentum',   tag: 'rides the move',      color: 'var(--green)' },
  CONTRARIAN: { name: 'Contrarian', tag: 'fades the overshoot', color: 'var(--purple)' },
};

function AgentColumn({ agent, career, live, history }: { agent: AgentState; career: { pnl: number; bets: number; wins: number }; live: number; history: number[] }) {
  const m = META[agent.id];
  const clv = avgClv(agent);
  const wr = winRate(agent);
  return (
    <div className="glass sheen p-4 flex-1" style={{ borderColor: `${m.color}44` }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-display font-black text-base" style={{ color: m.color }}>{m.name}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{m.tag}</p>
        </div>
        <span className="w-2 h-2 rounded-full badge-live" style={{ background: m.color }} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-2xl font-black tabular-nums" style={{ color: live >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {live >= 0 ? '+' : ''}<CountUp value={Number(live.toFixed(1))} duration={700} />
          </p>
          <p className="text-[9px] uppercase tracking-widest text-gray-600">this match (u)</p>
        </div>
        <div>
          <p className="text-2xl font-black tabular-nums" style={{ color: career.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {career.pnl >= 0 ? '+' : ''}<CountUp value={Number(career.pnl.toFixed(1))} duration={700} />
          </p>
          <p className="text-[9px] uppercase tracking-widest text-gray-600">career (u)</p>
        </div>
      </div>

      {/* live equity curve */}
      {history.length > 1 && (
        <div className="mt-3">
          <Sparkline data={history} color={live >= 0 ? 'var(--green)' : 'var(--red)'} width={220} height={34} />
        </div>
      )}

      <div className="flex justify-between mt-3 text-[11px] text-gray-500">
        <span>open <span className="text-gray-300 font-bold">{agent.open.length}</span></span>
        <span>win% <span className="text-gray-300 font-bold">{wr.toFixed(0)}</span></span>
        <span>CLV <span className="font-bold" style={{ color: clv >= 0 ? 'var(--green)' : 'var(--red)' }}>{clv >= 0 ? '+' : ''}{clv.toFixed(1)}%</span></span>
      </div>

      {agent.open.length > 0 && (
        <div className="mt-3 space-y-1">
          {agent.open.slice(-3).map((p, i) => (
            <div key={`${p.minute}-${i}`} className="fx-open-pulse anim-in flex justify-between text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-gray-400">{p.minute}&rsquo; · {p.outcome}</span>
              <span className="tabular-nums text-gray-300">@ {p.oddsTaken.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentArena() {
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>({ MOMENTUM: initAgent('MOMENTUM'), CONTRARIAN: initAgent('CONTRARIAN') });
  const [histories, setHistories] = useState<Record<AgentId, number[]>>({ MOMENTUM: [], CONTRARIAN: [] });
  const [career, setCareer] = useState<Career>({ MOMENTUM: { pnl: 0, bets: 0, wins: 0 }, CONTRARIAN: { pnl: 0, bets: 0, wins: 0 } });
  const [ctx, setCtx] = useState<{ home?: string; away?: string; hs: number; as: number; min: number; live: boolean }>({ hs: 0, as: 0, min: 0, live: false });

  const prevOdds = useRef<OddsSnapshot | null>(null);
  const lastOdds = useRef<OddsSnapshot | null>(null);
  const score = useRef({ home: 0, away: 0 });
  const settledFor = useRef<string | null>(null);

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(CAREER_KEY) || ''); if (c) setCareer(c); } catch { /* first run */ }
  }, []);

  useSSE({
    onMessage: (msg: SSEMessage) => {
      if (msg.type !== 'event' || !msg.data) return;
      const e = msg.data as BozEvent;

      // fresh match → reset the per-match agents + equity curves (career persists)
      if (e.type === 'MATCH_START' && settledFor.current !== e.matchId) {
        setAgents({ MOMENTUM: initAgent('MOMENTUM'), CONTRARIAN: initAgent('CONTRARIAN') });
        setHistories({ MOMENTUM: [], CONTRARIAN: [] });
        prevOdds.current = null;
      }

      if (e.score) { score.current = e.score; setCtx(c => ({ ...c, hs: e.score!.home, as: e.score!.away, min: e.matchMinute, live: e.type !== 'MATCH_END' })); }

      if (e.odds) {
        const next = e.odds;
        const decisions = prevOdds.current ? evaluate(prevOdds.current, next, e.matchMinute) : {};
        setAgents(prev => {
          const na = {
            MOMENTUM:   decisions.MOMENTUM   ? { ...prev.MOMENTUM,   open: [...prev.MOMENTUM.open,   decisions.MOMENTUM] }   : prev.MOMENTUM,
            CONTRARIAN: decisions.CONTRARIAN ? { ...prev.CONTRARIAN, open: [...prev.CONTRARIAN.open, decisions.CONTRARIAN] } : prev.CONTRARIAN,
          };
          setHistories(h => ({
            MOMENTUM:   [...h.MOMENTUM,   markToMarket(na.MOMENTUM, next)].slice(-48),
            CONTRARIAN: [...h.CONTRARIAN, markToMarket(na.CONTRARIAN, next)].slice(-48),
          }));
          return na;
        });
        prevOdds.current = next;
        lastOdds.current = next;
      }

      if (e.type === 'MATCH_END' && lastOdds.current && settledFor.current !== e.matchId) {
        settledFor.current = e.matchId;
        const result = resultFrom(score.current.home, score.current.away);
        const closing = lastOdds.current;
        setAgents(prev => {
          const settled = {
            MOMENTUM: settleAgent(prev.MOMENTUM, result, closing),
            CONTRARIAN: settleAgent(prev.CONTRARIAN, result, closing),
          };
          setCareer(cr => {
            const upd: Career = {
              MOMENTUM: {
                pnl: cr.MOMENTUM.pnl + (settled.MOMENTUM.realizedPnl - prev.MOMENTUM.realizedPnl),
                bets: cr.MOMENTUM.bets + settled.MOMENTUM.settled.length - prev.MOMENTUM.settled.length,
                wins: cr.MOMENTUM.wins + settled.MOMENTUM.settled.filter(b => b.won).length - prev.MOMENTUM.settled.filter(b => b.won).length,
              },
              CONTRARIAN: {
                pnl: cr.CONTRARIAN.pnl + (settled.CONTRARIAN.realizedPnl - prev.CONTRARIAN.realizedPnl),
                bets: cr.CONTRARIAN.bets + settled.CONTRARIAN.settled.length - prev.CONTRARIAN.settled.length,
                wins: cr.CONTRARIAN.wins + settled.CONTRARIAN.settled.filter(b => b.won).length - prev.CONTRARIAN.settled.filter(b => b.won).length,
              },
            };
            localStorage.setItem(CAREER_KEY, JSON.stringify(upd));
            return upd;
          });
          return settled;
        });
        setCtx(c => ({ ...c, live: false }));
      }
    },
  });

  const leader: AgentId = career.MOMENTUM.pnl >= career.CONTRARIAN.pnl ? 'MOMENTUM' : 'CONTRARIAN';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          {ctx.live && ctx.home ? <>Live: {ctx.home} {ctx.hs}–{ctx.as} {ctx.away} · {ctx.min}&rsquo;</> : 'Both agents idle — start a live match'}
        </p>
        <p className="text-[11px] text-gray-500">Tournament leader: <span className="font-bold" style={{ color: META[leader].color }}>{META[leader].name}</span></p>
      </div>

      {/* career P&L tug-of-war */}
      {(() => {
        const m = career.MOMENTUM.pnl, c = career.CONTRARIAN.pnl;
        const share = 50 + Math.max(-45, Math.min(45, (m - c) * 1.5));
        return (
          <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ width: `${share}%`, background: 'linear-gradient(90deg,var(--green),rgba(16,185,129,0.45))', transition: 'width .6s cubic-bezier(.16,1,.3,1)' }} />
            <div style={{ width: `${100 - share}%`, background: 'linear-gradient(90deg,rgba(167,139,250,0.45),var(--purple))', transition: 'width .6s cubic-bezier(.16,1,.3,1)' }} />
          </div>
        );
      })()}
      <div className="flex flex-col sm:flex-row gap-3">
        <AgentColumn agent={agents.MOMENTUM} career={career.MOMENTUM}
          live={histories.MOMENTUM.at(-1) ?? agents.MOMENTUM.realizedPnl} history={histories.MOMENTUM} />
        <AgentColumn agent={agents.CONTRARIAN} career={career.CONTRARIAN}
          live={histories.CONTRARIAN.at(-1) ?? agents.CONTRARIAN.realizedPnl} history={histories.CONTRARIAN} />
      </div>
      <p className="text-[10px] text-gray-600 text-center">
        Autonomous · deterministic · settles on-chain at full-time. Career P&amp;L compounds across matches.
      </p>
    </div>
  );
}
