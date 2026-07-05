import Link from 'next/link';
import { HeroAura } from '@/components/ui/HeroAura';

export const metadata = {
  title: 'About · bozPicks',
  description: 'Three World Cup products on one live TxLINE data core — consumer games, prediction markets, and autonomous trading agents.',
};

const TRACKS = [
  {
    href: '/play', badge: 'Track 2 · Fan', color: '#3b82f6', name: 'bozPicks',
    title: 'Consumer & Fan Experiences',
    desc: 'Hi-Lo stat games, a live win-probability gauge and an AI pundit — a phone-first way to read the match as it happens.',
    points: ['Replayable Hi-Lo game', 'Live possession & danger', 'AI pundit with TTS'],
  },
  {
    href: '/markets', badge: 'Track 1 · Settlement', color: '#10b981', name: 'bozSettle',
    title: 'Prediction Markets & Settlement',
    desc: 'USDC parimutuel prop markets — goals, corners, cards, BTTS — that settle themselves the instant TxLINE confirms the result.',
    points: ['Parametric prop markets', 'Trustless Merkle settlement', 'Verifiable resolution receipt'],
  },
  {
    href: '/agent', badge: 'Track 3 · Agents', color: '#a78bfa', name: 'bozAgent',
    title: 'Trading Tools & Agents',
    desc: 'Two autonomous agents trade the same odds stream with opposite theses in a head-to-head Arena, scored on closing-line value.',
    points: ['Agent-vs-Agent Arena', 'CLV + accuracy tracking', 'Fully autonomous'],
  },
];

const STACK = [
  { k: 'Data', v: 'TxLINE — real-time scores, events & consensus odds, anchored on Solana' },
  { k: 'Chain', v: 'Solana devnet — USDC escrow + validate_stat Merkle proofs' },
  { k: 'Realtime', v: 'Server-Sent Events + Redis pub/sub' },
  { k: 'AI', v: 'Claude Haiku for market analysis' },
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      {/* hero */}
      <header className="glass fx-rise relative overflow-hidden p-8 md:p-10 text-center">
        <HeroAura color="var(--blue)" />
        <div className="relative">
          <span className="chip-glass uppercase">World Cup 2026 · TxLINE Hackathon</span>
          <h1 className="font-display text-3xl md:text-4xl font-black mt-4 leading-tight">
            One live data core.<br />
            <span style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Three World Cup products.
            </span>
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl mx-auto">
            bozPicks turns TxLINE&rsquo;s real-time feed for all 104 matches into a fan game,
            a trustless prediction market, and an autonomous trading arena.
          </p>
        </div>
      </header>

      {/* three tracks */}
      <div className="grid gap-4 lg:grid-cols-3">
        {TRACKS.map(t => (
          <Link key={t.href} href={t.href}
            className="glass sheen group relative overflow-hidden p-5 flex flex-col transition-transform hover:-translate-y-1"
            style={{ borderColor: `${t.color}44` }}>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full self-start"
                  style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55` }}>{t.badge}</span>
            <h2 className="font-display text-xl font-black mt-3" style={{ color: t.color }}>{t.name}</h2>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-0.5">{t.title}</p>
            <p className="text-sm text-gray-400 mt-3 flex-1">{t.desc}</p>
            <ul className="mt-4 space-y-1.5">
              {t.points.map(p => (
                <li key={p} className="flex items-center gap-2 text-[13px] text-gray-300">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke={t.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  {p}
                </li>
              ))}
            </ul>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: t.color }}>
              Open {t.name}
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </Link>
        ))}
      </div>

      {/* tech stack */}
      <section className="glass p-6">
        <p className="section-label mb-4">Built on</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {STACK.map(s => (
            <div key={s.k} className="flex gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 w-16 flex-shrink-0 pt-0.5">{s.k}</span>
              <span className="text-[13px] text-gray-300">{s.v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
