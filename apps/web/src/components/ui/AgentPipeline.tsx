/**
 * Signature Track-3 visual: the autonomous detection loop. Shows how the agent
 * turns a raw odds stream into a graded signal — Subscribe → Detect → Signal →
 * Verify — with a pulse travelling the track so it reads as a live loop, not a
 * static diagram. Mirrors the Markets settlement pipeline for a consistent feel.
 */
const NODES = [
  {
    label: 'Subscribe', sub: 'TxLINE odds SSE', color: '#a78bfa',
    icon: <><circle cx="12" cy="12" r="2" /><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10" strokeLinecap="round" /></>,
  },
  {
    label: 'Detect', sub: 'Δ over the window', color: '#f59e0b',
    icon: <path d="M3 17l5-5 4 4 8-8M17 4h4v4" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: 'Signal', sub: 'Publish + confidence', color: '#3b82f6',
    icon: <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" strokeLinejoin="round" />,
  },
  {
    label: 'Verify', sub: 'Graded vs final', color: '#10b981',
    icon: <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function AgentPipeline() {
  return (
    <div className="glass relative overflow-hidden p-5 md:p-6">
      <div className="absolute -top-16 right-0 w-56 h-56 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.12), transparent 70%)' }} />
      <div className="relative flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--purple)', boxShadow: '0 0 10px rgba(167,139,250,0.6)' }} />
        <h2 className="text-sm font-bold tracking-tight text-gray-100">Autonomous detection loop</h2>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">no human input</span>
      </div>
      <p className="relative text-[12px] text-gray-500 mb-5">
        The agent runs this loop on every price tick — and keeps its own scorecard.
      </p>

      <div className="relative">
        <div className="absolute left-[12%] right-[12%] h-[2px] rounded-full"
             style={{ top: 26, background: 'linear-gradient(90deg,#a78bfa,#f59e0b,#3b82f6,#10b981)', opacity: 0.35 }}>
          <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ background: '#fff', boxShadow: '0 0 12px #fff, 0 0 4px #a78bfa', animation: 'boz-flow 3s linear infinite' }} />
          <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ background: '#fff', boxShadow: '0 0 12px #fff, 0 0 4px #10b981', animation: 'boz-flow 3s linear infinite 1.5s' }} />
        </div>

        <div className="relative flex items-start justify-between gap-1">
          {NODES.map((n, i) => (
            <div key={n.label} className="flex flex-col items-center text-center flex-1 min-w-0 anim-in" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-2"
                    style={{ background: `${n.color}18`, border: `1px solid ${n.color}55`, color: n.color, boxShadow: `0 0 20px ${n.color}22` }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill={n.label === 'Signal' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>{n.icon}</svg>
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
