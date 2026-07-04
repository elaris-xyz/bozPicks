'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HelpModal } from './HelpModal';

export function KeyboardShortcuts() {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') { setShowHelp(true); return; }

      const routes: Record<string, [string, string]> = {
        l: ['/', 'Live Matches'],
        i: ['/insights', 'Insights'],
        a: ['/agent', 'Agent'],
        s: ['/stats', 'Stats'],
        d: ['/schedule', 'Schedule'],
      };

      if (routes[e.key]) {
        const [path, label] = routes[e.key];
        router.push(path);
        setHint(label);
        setTimeout(() => setHint(null), 1500);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  return (
    <>
      {hint && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[150]
                        glass px-4 py-2 rounded-full text-sm font-semibold fade-in pointer-events-none"
             style={{ color: 'var(--blue)' }}>
          → {hint}
        </div>
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
