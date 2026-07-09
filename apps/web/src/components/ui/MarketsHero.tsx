import { HeroAura } from './HeroAura';

/**
 * Cinematic hero for /markets (Track 1 — Prediction & Settlement). Mirrors the
 * depth of the home + play heroes: aura backdrop, gradient headline, and a
 * legend of the three things that make these markets trustworthy.
 */
const FEATURES = [
  {
    label: 'Parimutuel pools', desc: 'USDC, winners split', color: '#10b981',
    icon: <><circle cx="12" cy="12" r="8" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 1.9-2.5 3.2M12 16h.01" strokeLinecap="round" strokeLinejoin="round" /></>,
  },
  {
    label: 'Trustless settlement', desc: 'From a TxLINE proof', color: '#3b82f6',
    icon: <path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: 'On-chain proof', desc: 'Live on Solana devnet', color: '#a78bfa',
    icon: <path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-1M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h1" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function MarketsHero() {
  return (
    <div className="glass fx-rise relative overflow-hidden">
      <HeroAura color="var(--green)" />
      <div className="relative p-5 md:p-7">
        <span className="chip-glass chip-green uppercase">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
          Track 1 · Prediction &amp; Settlement
        </span>
        <h1 className="font-display text-2xl md:text-4xl font-black leading-tight mt-3">
          Back the call.{' '}
          <span style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Settled by proof.
          </span>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-lg">
          Parametric prop markets — goals, corners, cards, BTTS — as USDC parimutuel pools
          on a live devnet program, resolved from a TxLINE Merkle proof the moment the
          fixture finishes. No trusted oracle.
        </p>

        {/* the three guarantees */}
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
