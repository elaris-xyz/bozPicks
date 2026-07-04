'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  IconBall, IconTrendUp, IconBolt, IconRadar, IconTarget,
  IconKickoff, IconSparkles, IconTrophy,
} from './Icons';

type Props = { onClose: () => void };

const SHORTCUTS = [
  { key: 'L', desc: 'Go to Live Matches' },
  { key: 'I', desc: 'Go to Insights' },
  { key: 'A', desc: 'Go to Agent Dashboard' },
  { key: 'S', desc: 'Go to Stats' },
  { key: '?', desc: 'Open this help menu' },
  { key: 'Esc', desc: 'Close any modal' },
];

const FEATURES = [
  { icon: <IconBall size={15} />,     color: 'var(--green)',  title: 'Live Matches',    desc: 'Real-time scores, odds, and match status' },
  { icon: <IconTrendUp size={15} />,  color: 'var(--blue)',   title: 'Odds Sparklines', desc: 'Probability movement charts on match detail' },
  { icon: <IconBolt size={15} />,     color: 'var(--orange)', title: 'Sharp Signals',   desc: 'Agent detects unusual odds movements' },
  { icon: <IconRadar size={15} />,    color: 'var(--purple)', title: 'Live Feed',       desc: 'Stream of goals, cards, and market events' },
  { icon: <IconTarget size={15} />,   color: 'var(--blue)',   title: 'Prediction Pool', desc: 'On-chain parimutuel predictions in USDC' },
  { icon: <IconKickoff size={15} />,  color: 'var(--green)',  title: 'Match Replay',    desc: 'Replay finished matches event-by-event' },
  { icon: <IconSparkles size={15} />, color: 'var(--blue)',   title: 'AI Analysis',     desc: 'Claude explains market impacts in real-time' },
  { icon: <IconTrophy size={15} />,   color: 'var(--amber)',  title: 'Leaderboard',     desc: 'Top predictors ranked by win rate and P&L' },
];

export function HelpModal({ onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 fade-in"
         onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} />

      <div className="relative w-full max-w-lg glass anim-in rounded-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
           style={{ scrollbarWidth: 'none' }}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <span style={{ color: 'var(--blue)' }}>boz</span>Picks
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Live football intelligence · Sharp money detection</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Features */}
        <div>
          <p className="section-label mb-3">Features</p>
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl p-3 flex items-start gap-2.5"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ color: f.color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-100">{f.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div>
          <p className="section-label mb-3">Keyboard Shortcuts</p>
          <div className="space-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center justify-between py-1.5"
                   style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <span className="text-xs text-gray-400">{s.desc}</span>
                <kbd className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                     style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-2 pt-1">
          <Link href="/stats" onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-center"
            style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
            View Stats
          </Link>
          <Link href="/leaderboard" onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-center"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid var(--glass-border)' }}>
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
