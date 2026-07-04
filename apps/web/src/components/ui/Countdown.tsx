'use client';

import { useState, useEffect } from 'react';

export function Countdown({ kickoffTime }: { kickoffTime: string }) {
  const [ms, setMs] = useState(() => new Date(kickoffTime).getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setMs(new Date(kickoffTime).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [kickoffTime]);

  // Kickoff passed but status still SCHEDULED — the status pill already says
  // "SOON", so rendering "Starting soon" here was redundant noise.
  if (ms <= 0) return null;

  const totalSecs = Math.floor(ms / 1000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;

  if (days > 0) {
    return (
      <span className="text-xs text-gray-400 font-mono">
        {days}d {String(hours).padStart(2, '0')}h
      </span>
    );
  }

  return (
    <div className="flex items-center gap-px font-mono text-xs">
      {hours > 0 && (
        <>
          <span className="font-bold text-gray-200">{String(hours).padStart(2,'0')}</span>
          <span className="text-gray-600 mx-0.5">h</span>
        </>
      )}
      <span className="font-bold text-gray-200">{String(mins).padStart(2,'0')}</span>
      <span className="text-gray-600 mx-0.5">m</span>
      <span className="font-bold" style={{ color: 'var(--blue)' }}>{String(secs).padStart(2,'0')}</span>
      <span className="text-gray-600 ml-0.5">s</span>
    </div>
  );
}
