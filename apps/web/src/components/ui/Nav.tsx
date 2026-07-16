'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletModal } from './WalletModal';
import { useVault } from '@/contexts/VaultContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { usdcToDisplay } from '@bozpicks/shared';
import { IconPulse, IconRadar, IconTrendUp, IconTrophy, IconClock, IconWallet } from './Icons';

type NavVariant = 'desktop' | 'mobile-header' | 'mobile-tabs';

const GameIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
    <rect x="2" y="6" width="20" height="12" rx="4" />
  </svg>
);

const tabs = [
  { href: '/',         label: 'Live',     icon: <IconPulse size={18} /> },
  { href: '/play',     label: 'Play',     icon: <GameIcon size={18} /> },
  { href: '/markets',  label: 'Markets',  icon: <IconTrendUp size={18} /> },
  { href: '/agent',    label: 'Agent',    icon: <IconRadar size={18} /> },
];

const InfoIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
  </svg>
);

const MoreIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);

// Everything beyond the three products lives under "More" — identical on
// desktop and mobile so nothing appears in one place but not the other.
// Deliberately trimmed: /insights duplicated the Live Feed + agent signals and
// /stats added little over the per-page banners, so they're out of the menu
// (routes stay alive) — a tight menu reads as a focused product to a judge.
const moreLinks = [
  { href: '/schedule',    label: 'Schedule',       icon: <IconClock size={18} /> },
  { href: '/leaderboard', label: 'Leaderboard',    icon: <IconTrophy size={18} /> },
  { href: '/predictions', label: 'My Predictions', icon: <IconWallet size={18} /> },
  { href: '/about',       label: 'About',          icon: <InfoIcon size={18} /> },
];

/** The bozPicks GOAT — cyberpunk coin mark, neon glow to match the theme */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex flex-shrink-0 rounded-full transition-transform duration-200 group-hover/logo:scale-110"
          style={{ width: size, height: size, boxShadow: '0 0 14px rgb(var(--c-purple) / 0.5)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bozPickLogo.png" alt="bozPicks" width={size} height={size}
           className="rounded-full object-contain" draggable={false} />
    </span>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group/logo">
      <LogoMark size={compact ? 24 : 28} />
      <span className={`font-display font-bold tracking-tight leading-none ${compact ? 'text-sm' : 'text-base'}`}>
        <span style={{ color: 'rgb(var(--c-blue))' }}>boz</span>
        <span className="text-white">Picks</span>
      </span>
    </Link>
  );
}

/** Game-vault balance pill — opens the vault cashier. Only shown when a wallet
    is connected (the vault is keyed to the wallet). */
function VaultChip({ compact = false }: { compact?: boolean }) {
  const { connected } = useWallet();
  const { balance, open } = useVault();
  if (!connected) return null;
  return (
    <button onClick={() => open()}
      className={`inline-flex items-center gap-1.5 font-bold rounded-full transition-all active:scale-95 tabular-nums
                  ${compact ? 'text-[10px] px-2.5 h-7' : 'text-[11px] px-3 h-8'}`}
      style={{
        color: '#c4b5fd',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(167,139,250,0.14))',
        border: '1px solid rgba(129,140,248,0.4)',
      }}
      title="Game vault — deposit, cash out, history">
      <svg viewBox="0 0 24 24" className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" />
      </svg>
      {usdcToDisplay(balance)}
      {!compact && <span className="text-[9px] font-semibold text-gray-500">USDC</span>}
    </button>
  );
}

function WalletButton({ compact = false, onClick }: { compact?: boolean; onClick: () => void }) {
  const { publicKey, connected: walletConnected } = useWallet();
  const shortAddr = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  if (walletConnected) {
    return (
      <button onClick={onClick}
        className={`chip-glass chip-green font-mono normal-case ${compact ? 'text-[10px]' : 'text-[11px]'} transition-transform active:scale-95`}>
        <span className="w-1.5 h-1.5 rounded-full badge-live" style={{ background: 'currentColor' }} />
        {shortAddr}
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 font-semibold rounded-full transition-all active:scale-95
                  ${compact ? 'text-[11px] px-3 h-7' : 'text-xs px-4 h-8'}`}
      style={{
        color: '#fff',
        background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))',
        boxShadow: '0 0 16px rgb(var(--c-blue) / 0.35)',
      }}>
      <IconWallet size={compact ? 13 : 14} />
      {compact ? 'Connect' : 'Connect Wallet'}
    </button>
  );
}

export function Nav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname();
  const [walletOpen, setWalletOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreLinks.some(l => l.href === pathname);

  /* ── Desktop top bar ─────────────────────────────────────────────── */
  if (variant === 'desktop') {
    return (
      <header className="sticky top-0 z-50"
              style={{
                background: 'rgba(9,13,26,0.82)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}>
        <div className="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between gap-6" style={{ height: 60 }}>
          <Logo />

          <nav className="flex items-center gap-1">
            {tabs.map(({ href, label, icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}
                  className="relative flex items-center gap-2 px-3.5 h-9 rounded-full text-[13px] font-semibold
                             transition-all duration-200"
                  style={active
                    ? {
                        color: 'rgb(var(--accent))',
                        background: 'rgb(var(--accent) / 0.12)',
                        border: '1px solid rgb(var(--accent) / 0.45)',
                        boxShadow: '0 0 14px rgb(var(--accent) / 0.18)',
                      }
                    : { color: '#8b98ad', border: '1px solid transparent' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8b98ad'; }}
                >
                  <span className={active ? '' : 'opacity-70'}>{icon}</span>
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}

            {/* More dropdown */}
            <div className="relative">
              <button onClick={() => setMoreOpen(o => !o)}
                className="relative flex items-center gap-2 px-3.5 h-9 rounded-full text-[13px] font-semibold transition-all duration-200"
                style={moreActive || moreOpen
                  ? { color: 'rgb(var(--accent))', background: 'rgb(var(--accent) / 0.12)', border: '1px solid rgb(var(--accent) / 0.45)' }
                  : { color: '#8b98ad', border: '1px solid transparent' }}>
                <MoreIcon size={18} />
                <span className="hidden lg:inline">More</span>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-2xl p-1.5 anim-in"
                       style={{ background: '#0d1526', border: '1px solid var(--glass-border)', boxShadow: '0 16px 44px rgba(0,0,0,0.6)' }}>
                    {moreLinks.map(({ href, label, icon }) => {
                      const active = pathname === href;
                      return (
                        <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-2.5 px-3 h-9 rounded-xl text-[13px] font-semibold transition-colors"
                          style={active
                            ? { color: 'rgb(var(--accent))', background: 'rgb(var(--accent) / 0.1)' }
                            : { color: '#94a3b8' }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                          <span className="opacity-70">{icon}</span>{label}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <VaultChip />
            <WalletButton onClick={() => setWalletOpen(true)} />
          </div>
        </div>
        {/* hairline gradient under the bar */}
        <div className="h-px"
             style={{ background: 'linear-gradient(90deg, transparent 5%, rgb(var(--accent) / 0.4), transparent 95%)' }} />
        {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
      </header>
    );
  }

  /* ── Mobile compact header (logo + wallet) ───────────────────────── */
  if (variant === 'mobile-header') {
    return (
      <>
        <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-12"
                style={{
                  background: 'rgba(9,13,26,0.88)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderBottom: '1px solid var(--glass-border)',
                }}>
          <Logo compact />
          <div className="flex items-center gap-1.5">
            <VaultChip compact />
            <WalletButton compact onClick={() => setWalletOpen(true)} />
          </div>
        </header>
        {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
      </>
    );
  }

  /* ── Mobile bottom tabs ──────────────────────────────────────────── */
  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(3,6,16,0.6)' }} />
          <div className="relative glass rounded-t-3xl p-3 pb-6 anim-in" onClick={e => e.stopPropagation()}
               style={{ boxShadow: '0 -12px 40px rgba(0,0,0,0.5)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--glass-border)' }} />
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-colors"
                    style={active
                      ? { color: 'rgb(var(--accent))', background: 'rgb(var(--accent) / 0.1)', border: '1px solid rgb(var(--accent) / 0.3)' }
                      : { color: '#94a3b8', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                    {icon}
                    <span className="text-[11px] font-semibold">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="pb-safe"
           style={{
             background: 'rgba(9,13,26,0.92)',
             backdropFilter: 'blur(20px)',
             WebkitBackdropFilter: 'blur(20px)',
             borderTop: '1px solid var(--glass-border)',
           }}>
        <div className="flex px-2">
          {tabs.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className="relative flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-200"
                style={{ color: active ? 'rgb(var(--accent))' : '#64748b' }}>
                {active && (
                  <span className="absolute top-0 w-10 h-0.5 rounded-full"
                        style={{ background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgb(var(--accent) / 0.8)' }} />
                )}
                <span className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}
                      style={active ? { filter: 'drop-shadow(0 0 6px rgb(var(--accent) / 0.6))' } : {}}>
                  {icon}
                </span>
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </Link>
            );
          })}

          {/* More tab */}
          <button onClick={() => setMoreOpen(true)}
            className="relative flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-200"
            style={{ color: moreActive || moreOpen ? 'rgb(var(--accent))' : '#64748b' }}>
            <MoreIcon size={18} />
            <span className="text-[10px] font-semibold tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
