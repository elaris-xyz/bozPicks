'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[400] flex items-center justify-center gap-2 py-2 text-xs font-semibold"
         style={{ background: 'var(--red-dim)', borderBottom: '1px solid rgba(239,68,68,0.4)', color: 'var(--red)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      No internet connection — live data paused
    </div>
  );
}
