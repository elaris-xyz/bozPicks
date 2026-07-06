import type { ReactNode } from 'react';

/**
 * Shared page header — title + subtitle with a neon accent underline and a
 * subtle rise-in entrance, so the secondary pages feel cohesive with the
 * cinematic track pages.
 */
export function PageHeader({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="fx-rise flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display text-lg md:text-xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        <div className="h-0.5 w-10 rounded-full mt-2"
             style={{ background: 'linear-gradient(90deg, rgb(var(--accent)), transparent)' }} />
      </div>
      {action}
    </div>
  );
}
