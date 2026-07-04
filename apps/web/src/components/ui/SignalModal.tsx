'use client';

import { useEffect } from 'react';
import type { AgentSignal } from '@bozpicks/shared';
import { IconBolt, IconClock } from './Icons';

type Props = { signal: AgentSignal; onClose: () => void };

const OUTCOME_LABELS = { HOME: 'Home Win', DRAW: 'Draw', AWAY: 'Away Win' };

export function SignalModal({ signal, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const dir = signal.deltaPercent > 0 ? '↑' : '↓';
  const cs = {
    HIGH:   { color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(239,68,68,0.4)' },
    MEDIUM: { color: 'var(--orange)', bg: 'var(--orange-dim)', border: 'rgba(249,115,22,0.4)' },
    LOW:    { color: '#9ca3af',       bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  }[signal.confidence];

  const before = signal.oddsBefore;
  const after  = signal.oddsAfter;

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center fade-in"
         onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />

      <div className="relative w-full md:max-w-md glass anim-in rounded-t-3xl md:rounded-3xl p-6 space-y-5"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: cs.color }}>
                <IconBolt size={13} /> Sharp Move
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                {signal.confidence}
              </span>
            </div>
            <p className="text-2xl font-black" style={{ color: cs.color }}>
              {OUTCOME_LABELS[signal.affectedOutcome]} {dir}{Math.abs(signal.deltaPercent).toFixed(1)}%
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)' }}>×</button>
        </div>

        {/* Context */}
        {signal.context && (
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Context</p>
            <p className="text-sm text-gray-300">{signal.context}</p>
          </div>
        )}

        {/* Odds comparison */}
        {before && after && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Odds Movement</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: 'Home', before: before.homeWin, after: after.homeWin, color: 'var(--green)' },
                { label: 'Draw', before: before.draw,    after: after.draw,    color: '#9ca3af' },
                { label: 'Away', before: before.awayWin, after: after.awayWin, color: 'var(--blue)' },
              ]).map(({ label, before: b, after: a, color }) => {
                const changed = Math.abs(a - b) > 0.01;
                const up = a > b;
                return (
                  <div key={label} className="rounded-xl p-2.5 text-center"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                    <p className="text-[10px] text-gray-600 mb-1">{label}</p>
                    <p className="text-xs text-gray-500 line-through">{b.toFixed(2)}</p>
                    <p className="text-base font-bold" style={{ color: changed ? color : '#9ca3af' }}>
                      {a.toFixed(2)}
                    </p>
                    {changed && (
                      <p className="text-[10px] font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                        {up ? '↑' : '↓'}{Math.abs(((a - b) / b) * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex justify-between text-xs text-gray-600 pt-2"
             style={{ borderTop: '1px solid var(--glass-border)' }}>
          <span>{new Date(signal.detectedAt).toLocaleTimeString()}</span>
          {signal.outcomeVerified ? (
            <span className={`inline-flex items-center gap-1.5 font-bold ${signal.wasAccurate ? 'text-green-400' : 'text-red-400'}`}>
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                {signal.wasAccurate ? <path d="M4 12l5 5L20 6" /> : <path d="M6 6l12 12M18 6L6 18" />}
              </svg>
              {signal.wasAccurate ? 'Accurate prediction' : 'Inaccurate'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><IconClock size={12} /> Pending verification</span>
          )}
        </div>
      </div>
    </div>
  );
}
