import type { ReactNode } from 'react';

/**
 * Shared page header for the secondary pages — the same visual language as the
 * track pages: accent dot + bold display title, optional count pill and
 * subtitle, with a rise-in entrance. Keeps /schedule, /leaderboard,
 * /predictions cohesive with Live / Play / Markets / Agent.
 */
export function PageHeader({
  title, subtitle, action, accent = 'var(--blue)', count,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** section accent colour (dot + count pill) */
  accent?: string;
  /** optional count badge next to the title */
  count?: number;
}) {
  return (
    <div className="fx-rise flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: accent, boxShadow: `0 0 10px ${accent}88` }} />
          <h1 className="font-display text-lg md:text-2xl font-black tracking-tight">{title}</h1>
          {typeof count === 'number' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                  style={{ background: `${accent}1f`, color: accent }}>{count}</span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1 ml-[22px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
