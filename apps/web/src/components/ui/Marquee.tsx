'use client';

/**
 * Slow-scrolling brand strip for landing pages — feature keywords
 * separated by neon dots, faded at both edges.
 */
export function Marquee({ items }: { items: string[] }) {
  // duplicated for seamless loop (animation translates -50%)
  const loop = [...items, ...items];

  return (
    <div className="marquee-mask overflow-hidden py-3 select-none" aria-hidden>
      <div className="flex items-center animate-marquee" style={{ width: 'max-content' }}>
        {loop.map((label, i) => (
          <span key={i} className="flex items-center flex-shrink-0">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-gray-600">
              {label}
            </span>
            <span className="mx-6 w-1 h-1 rounded-full"
                  style={{ background: 'rgb(var(--accent) / 0.6)', boxShadow: '0 0 6px rgb(var(--accent) / 0.8)' }} />
          </span>
        ))}
      </div>
    </div>
  );
}
