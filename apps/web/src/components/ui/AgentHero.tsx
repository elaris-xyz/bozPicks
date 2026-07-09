import { HeroAura } from './HeroAura';

/**
 * Cinematic hero for /agent (Track 3 — Trading Tools & Agents). Same depth as
 * the home / play / markets heroes: aura backdrop, gradient headline, and a
 * legend of what makes the agent autonomous.
 */
const FEATURES = [
  {
    label: 'Reads live odds', desc: 'TxLINE SSE stream', color: '#a78bfa',
    icon: <><circle cx="12" cy="12" r="2" /><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17" strokeLinecap="round" /></>,
  },
  {
    label: 'Detects sharp moves', desc: 'Δ over a time window', color: '#f59e0b',
    icon: <path d="M3 17l5-5 4 4 8-8M17 4h4v4" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: 'Self-verifies', desc: 'Graded vs the final', color: '#10b981',
    icon: <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function AgentHero() {
  return (
    <div className="glass fx-rise relative overflow-hidden">
      <HeroAura color="var(--purple)" />
      <div className="relative p-5 md:p-7">
        <span className="chip-glass uppercase" style={{ background: 'rgba(167,139,250,0.14)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.4)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
          Track 3 · Trading Tools &amp; Agents
        </span>
        <h1 className="font-display text-2xl md:text-4xl font-black leading-tight mt-3">
          Read the market.{' '}
          <span style={{ background: 'linear-gradient(135deg,#a78bfa,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Act on the move.
          </span>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-lg">
          A headless agent lives on the TxLINE odds stream — no human input. It flags every
          sharp move the instant the market repriced, then grades itself against the final result.
        </p>

        {/* what makes it autonomous */}
        <div className="grid sm:grid-cols-3 gap-2.5 mt-5">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                 style={{ background: `${f.color}10`, border: `1px solid ${f.color}33` }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${f.color}1f`, color: f.color }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>{f.icon}</svg>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight" style={{ color: f.color }}>{f.label}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
