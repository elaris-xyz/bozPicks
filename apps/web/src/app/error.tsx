'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="glass text-center p-10 max-w-sm w-full">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
             style={{ color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" />
          </svg>
        </div>
        <p className="font-display text-lg font-semibold mb-1">Something went wrong</p>
        <p className="text-xs text-gray-500 mb-6 font-mono break-words">{error.message}</p>
        <button onClick={reset} className="btn-accent mx-auto">Try again</button>
      </div>
    </div>
  );
}
