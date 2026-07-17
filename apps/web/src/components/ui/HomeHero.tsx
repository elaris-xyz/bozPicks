import Link from 'next/link';
import { HeroAura } from './HeroAura';

/**
 * Compact homepage hero — frames the product and its three tracks without
 * pushing the live match list far down. Striker art on the right (lg+),
 * headline on the left, quick links to each track.
 */
const LINKS = [
  { href: '/play', label: 'Play', color: '#3b82f6' },
  { href: '/markets', label: 'Markets', color: '#10b981' },
  { href: '/agent', label: 'Agent', color: '#a78bfa' },
];

export function HomeHero() {
  return (
    <div className="glass cyber-corners fx-rise relative overflow-hidden">
      <HeroAura color="var(--blue)" />
      {/* gold flourish: an ember traces the card outline once, then a soft
          gold sweep drifts across the inside — one shared 12s cycle, mostly
          still (see globals.css .boz-gold-orbit / .boz-gold-sweep) */}
      <span className="boz-gold-orbit" aria-hidden />
      <div className="boz-gold-sweep" aria-hidden />

      {/* banner art, right side (desktop) — h-full + object-contain so the
          whole image is always visible, never clipped by the card edge */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/baner.png" alt="" aria-hidden
           className="hidden lg:block absolute right-0 top-0 h-full w-auto max-w-none object-contain object-right pointer-events-none select-none"
           style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))' }} />

      <div className="relative p-5 md:p-7 lg:max-w-[58%]">
        <span className="chip-glass chip-green uppercase">
          <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />
          Live · World Cup 2026
        </span>
        <h1 className="font-display text-2xl md:text-3xl font-black leading-tight mt-3">
          Pick smart. Watch live.<br />
          <span style={{ background: 'linear-gradient(135deg,#3b82f6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Get paid on-chain.
          </span>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-md">
          Live scores, odds and events for all 104 matches<br />
          powered by TxLINE, settled on Solana.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className="text-xs font-bold px-3 h-8 inline-flex items-center rounded-full transition-all hover:brightness-125"
              style={{ background: `${l.color}18`, color: l.color, border: `1px solid ${l.color}44` }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
