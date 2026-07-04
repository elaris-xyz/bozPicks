'use client';

import { useEffect, useState } from 'react';
import { IconBolt, IconBall, IconCard, IconKickoff } from './Icons';

type Pref = { goals: boolean; redCards: boolean; signals: boolean; matchStart: boolean };

const DEFAULT: Pref = { goals: true, redCards: true, signals: true, matchStart: false };

const ITEMS: { key: keyof Pref; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { key: 'signals',    label: 'Sharp Signals',  desc: 'Notify when odds move sharply',  icon: <IconBolt size={16} />,    color: 'var(--orange)' },
  { key: 'goals',      label: 'Goals',          desc: 'Notify on each goal scored',     icon: <IconBall size={16} />,    color: 'var(--green)' },
  { key: 'redCards',   label: 'Red Cards',      desc: 'Notify on red card events',      icon: <IconCard size={15} />,    color: 'var(--red)' },
  { key: 'matchStart', label: 'Match Start',    desc: 'Notify when a match kicks off',  icon: <IconKickoff size={16} />, color: 'var(--green)' },
];

export function NotificationSettings({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Pref>(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('notif_prefs');
      if (saved) setPrefs({ ...DEFAULT, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const toggle = (key: keyof Pref) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('notif_prefs', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center fade-in"
         onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />

      <div className="relative w-full md:max-w-sm glass anim-in rounded-t-3xl md:rounded-3xl p-6 space-y-4"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold">Notifications</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose what alerts you receive</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {ITEMS.map(({ key, label, desc, icon, color }) => (
            <button key={key} onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all hover:bg-white/[0.02]"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--glass-border)' }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>{icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[10px] text-gray-500">{desc}</p>
              </div>
              <div className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
                   style={{ background: prefs[key] ? 'var(--blue)' : 'rgba(107,114,128,0.3)' }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                     style={{ left: prefs[key] ? '22px' : '2px' }} />
              </div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-center text-gray-700">
          Preferences saved locally · Restart app to apply
        </p>
      </div>
    </div>
  );
}
