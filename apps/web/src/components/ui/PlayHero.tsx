import { HeroAura } from './HeroAura';

/**
 * Cinematic hero for /play (Track 2 — Fan Experience). Frames the three live
 * fan games without any wallet friction, matching the depth of the home hero:
 * aura backdrop, gradient headline, and a legend of the three ways to play.
 */
const MODES = [
  {
    label: 'Hi-Lo', desc: 'Call the next swing', color: '#3b82f6',
    icon: <path d="M4 14l5-5 4 4 7-7M17 6h4v4" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: 'Win Probability', desc: 'Live from the odds', color: '#10b981',
    icon: <><path d="M3 3v18h18" strokeLinecap="round" /><path d="M7 14l3-3 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></>,
  },
  {
    label: 'AI Pundit', desc: 'Claude on the mic', color: '#a78bfa',
    icon: <><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" /></>,
  },
];

export function PlayHero() {
  return (
    <div className="glass cyber-corners fx-rise relative overflow-hidden">
      <HeroAura color="var(--blue)" />
      <div className="relative p-5 md:p-7">
        <span className="chip-glass chip-blue uppercase">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
          Track 2 · Fan Experience
        </span>
        <h1 className="font-display text-2xl md:text-4xl font-black leading-tight mt-3">
          Read the game{' '}
          <span style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            as it happens.
          </span>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-lg">
          Three live games off the TxLINE feed — no wallet, no stakes, just the match.
          Every number updates the instant the ball does.
        </p>

        {/* three ways to play */}
        <div className="grid sm:grid-cols-3 gap-2.5 mt-5">
          {MODES.map(m => (
            <div key={m.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                 style={{ background: `${m.color}10`, border: `1px solid ${m.color}33` }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${m.color}1f`, color: m.color }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>{m.icon}</svg>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight" style={{ color: m.color }}>{m.label}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
