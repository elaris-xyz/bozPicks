/**
 * Signature Track-1 visual: the trustless-settlement pipeline. Shows the exact
 * path a market takes from the final whistle to a USDC payout — TxLINE stat →
 * Merkle proof → on-chain validate_stat → payout — with a pulse travelling the
 * track so it reads as a living flow, not a static diagram. This is the story
 * that separates "we settled it" from "an oracle told us to".
 */
const NODES = [
  {
    label: 'Full time', sub: 'TxLINE final stat', color: '#10b981',
    icon: <><circle cx="9" cy="14" r="5" /><path d="M14 12h7M14 12l-1-4h5l-1 4" strokeLinecap="round" strokeLinejoin="round" /></>,
  },
  {
    label: 'Merkle proof', sub: 'stat → root', color: '#3b82f6',
    icon: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M8.2 7.2 15.8 11M8.2 16.8 15.8 13" strokeLinecap="round" /></>,
  },
  {
    label: 'validate_stat', sub: 'Solana CPI', color: '#a78bfa',
    icon: <path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: 'Payout', sub: 'USDC to winners', color: '#34d399',
    icon: <><circle cx="8" cy="9" r="5" /><path d="M14.5 5.3a5 5 0 0 1 0 9.4M8 7v4M6.3 9h3.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  },
];

export function SettlementPipeline() {
  return (
    <div className="glass relative overflow-hidden p-5 md:p-6">
      <div className="absolute -top-16 right-0 w-56 h-56 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)' }} />
      <div className="relative flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 10px rgba(16,185,129,0.6)' }} />
        <h2 className="text-sm font-bold tracking-tight text-gray-100">Trustless settlement</h2>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">no oracle</span>
      </div>
      <p className="relative text-[12px] text-gray-500 mb-5">
        Every market resolves down this path — a judge can verify each hop.
      </p>

      <div className="relative">
        {/* flow track behind the nodes */}
        <div className="absolute left-[12%] right-[12%] h-[2px] rounded-full"
             style={{ top: 26, background: 'linear-gradient(90deg,#10b981,#3b82f6,#a78bfa,#34d399)', opacity: 0.35 }}>
          <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ background: '#fff', boxShadow: '0 0 12px #fff, 0 0 4px #3b82f6', animation: 'boz-flow 3s linear infinite' }} />
          <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ background: '#fff', boxShadow: '0 0 12px #fff, 0 0 4px #a78bfa', animation: 'boz-flow 3s linear infinite 1.5s' }} />
        </div>

        <div className="relative flex items-start justify-between gap-1">
          {NODES.map((n, i) => (
            <div key={n.label} className="flex flex-col items-center text-center flex-1 min-w-0 anim-in" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-2"
                    style={{ background: `${n.color}18`, border: `1px solid ${n.color}55`, color: n.color, boxShadow: `0 0 20px ${n.color}22` }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8}>{n.icon}</svg>
              </span>
              <p className="text-[11px] md:text-xs font-bold leading-tight" style={{ color: n.color }}>{n.label}</p>
              <p className="text-[9px] md:text-[10px] text-gray-500 leading-tight mt-0.5">{n.sub}</p>
              {i < NODES.length - 1 && (
                <svg className="md:hidden w-3 h-3 text-gray-600 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
