'use client';

import { useState, useEffect, useRef } from 'react';
import { IconBolt, IconBall, IconCard, IconPulse } from './Icons';

type ToastKind = 'signal' | 'goal' | 'card' | 'info' | 'warn';
type ToastItem = { id: number; title: string; body?: string; kind: ToastKind };

let _nextId = 0;
const _listeners = new Set<(t: ToastItem) => void>();

export function fireToast(t: Omit<ToastItem, 'id'>) {
  const item: ToastItem = { ...t, id: _nextId++ };
  _listeners.forEach(fn => fn(item));
}

const TOAST_TTL_MS = 3800;
const MAX_VISIBLE = 3;

const KIND_CONFIG: Record<ToastKind, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  signal: { icon: <IconBolt size={16} />,  color: 'var(--orange)', bg: 'rgba(11,16,32,0.97)', border: 'rgba(249,115,22,0.4)' },
  goal:   { icon: <IconBall size={16} />,  color: 'var(--green)',  bg: 'rgba(11,16,32,0.97)', border: 'rgba(16,185,129,0.4)' },
  card:   { icon: <IconCard size={15} />,  color: 'var(--amber)',  bg: 'rgba(11,16,32,0.97)', border: 'rgba(245,158,11,0.4)' },
  warn:   { icon: <IconCard size={15} />,  color: 'var(--red)',    bg: 'rgba(11,16,32,0.97)', border: 'rgba(239,68,68,0.4)' },
  info:   { icon: <IconPulse size={16} />, color: 'var(--blue)',   bg: 'rgba(11,16,32,0.97)', border: 'rgba(59,130,246,0.4)' },
};

function ToastChip({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const cfg = KIND_CONFIG[item.kind];
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const ttl = setTimeout(() => setLeaving(true), TOAST_TTL_MS);
    return () => clearTimeout(ttl);
  }, []);

  // let the exit animation play before unmounting
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onRemove, 200);
    return () => clearTimeout(t);
  }, [leaving, onRemove]);

  return (
    <div
      className={`glass relative overflow-hidden flex items-start gap-3 p-3.5 rounded-2xl w-72 md:w-80 cursor-pointer transition-all duration-200 ${
        leaving ? 'opacity-0 translate-x-4' : 'anim-in'
      }`}
      style={{ background: cfg.bg, borderColor: cfg.border }}
      onClick={() => setLeaving(true)}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ color: cfg.color, background: 'rgba(255,255,255,0.05)', border: `1px solid ${cfg.border}` }}>
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight" style={{ color: cfg.color }}>{item.title}</p>
        {item.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.body}</p>}
      </div>
      {/* auto-dismiss progress */}
      <span
        className="absolute bottom-0 left-0 h-0.5 toast-progress"
        style={{ background: cfg.color, animationDuration: `${TOAST_TTL_MS}ms` }}
      />
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const handler = (t: ToastItem) => {
      // Dedupe identical toasts fired within the TTL (e.g. SSE replays)
      const key = `${t.kind}:${t.title}:${t.body ?? ''}`;
      const now = Date.now();
      const last = recentRef.current.get(key);
      if (last && now - last < TOAST_TTL_MS) return;
      recentRef.current.set(key, now);
      // prune stale dedupe entries
      recentRef.current.forEach((ts, k) => {
        if (now - ts > TOAST_TTL_MS * 2) recentRef.current.delete(k);
      });
      setToasts(prev => [t, ...prev].slice(0, MAX_VISIBLE));
    };
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // lifted on desktop (bottom-20) so toasts sit ABOVE the live match bar's
  // score pill (pinned bottom-right) instead of landing on top of it
  return (
    <div className="fixed top-16 right-3 md:top-auto md:bottom-20 md:right-6 z-[200] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastChip item={t} onRemove={() => remove(t.id)} />
        </div>
      ))}
    </div>
  );
}
