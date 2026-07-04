'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DemoButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const router = useRouter();

  const start = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/demo', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMatchId(data.matchId);
        setState('done');
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  const stop = async () => {
    await fetch('/api/demo', { method: 'DELETE' });
    setState('idle');
    setMatchId(null);
  };

  if (state === 'done' && matchId) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/match/${matchId}`)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'var(--green)' }} />
          Watch Demo Match →
        </button>
        <button
          onClick={stop}
          className="text-xs px-2.5 py-1.5 rounded-xl transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280', border: '1px solid var(--glass-border)' }}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      disabled={state === 'loading'}
      className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
      {state === 'loading' ? (
        <>
          <span
            className="w-3 h-3 rounded-full border border-t-blue-400 animate-spin"
            style={{ borderColor: 'rgba(59,130,246,0.3)', borderTopColor: 'var(--blue)' }}
          />
          Seeding...
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
            <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
          </svg>
          Run Demo
        </>
      )}
    </button>
  );
}
