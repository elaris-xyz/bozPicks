'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletModal } from './WalletModal';
import { useSSEContext } from '@/contexts/SSEContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconPulse, IconChart, IconRadar, IconTrendUp, IconTrophy, IconClock, IconWallet } from './Icons';

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
  { href: '/agent',    label: 'Agent',    icon: <IconRadar size={18} /> },
  { href: '/stats',    label: 'Stats',    icon: <IconTrendUp size={18} /> },
];

const desktopExtra = [
  { href: '/insights',    label: 'Insights',    icon: <IconChart size={18} /> },
  { href: '/schedule',    label: 'Schedule',    icon: <IconClock size={18} /> },
  { href: '/leaderboard', label: 'Leaderboard', icon: <IconTrophy size={18} /> },
];

/** Neon logo mark — bolt inside a gradient rounded square */
function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, rgb(var(--c-blue)), rgb(var(--c-purple)))',
        boxShadow: '0 0 14px rgb(var(--c-blue) / 0.45)',
      }}>
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="#fff" aria-hidden>
        <path d="M13 2 4.5 13.5H10L9 22l8.5-11.5H12L13 2z" />
      </svg>
    </span>
  );
}

function Logo({ connected, compact = false }: { connected: boolean; compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group/logo">
      <LogoMark size={compact ? 24 : 28} />
      <span className={`font-display font-bold tracking-tight leading-none ${compact ? 'text-sm' : 'text-base'}`}>
        <span style={{ color: 'rgb(var(--c-blue))' }}>boz</span>
        <span className="text-white">Picks</span>
      </span>
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${connected ? 'badge-live' : ''}`}
        style={{ background: connected ? 'var(--green)' : '#4b5563' }}
        title={connected ? 'Live feed connected' : 'Feed offline'}
      />
    </Link>
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
  const { connected } = useSSEContext();
  const [walletOpen, setWalletOpen] = useState(false);

  /* ── Desktop top bar ─────────────────────────────────────────────── */
  if (variant === 'desktop') {
    return (
      <header className="sticky top-0 z-50"
              style={{
                background: 'rgba(9,13,26,0.82)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}>
        <div className="max-w-6xl mx-auto px-6 h-15 flex items-center justify-between gap-6" style={{ height: 60 }}>
          <Logo connected={connected} />

          <nav className="flex items-center gap-1">
            {[...tabs, ...desktopExtra].map(({ href, label, icon }) => {
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
                  {/* icon-only between md and lg so the wallet button always fits */}
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          <WalletButton onClick={() => setWalletOpen(true)} />
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
          <Logo connected={connected} compact />
          <WalletButton compact onClick={() => setWalletOpen(true)} />
        </header>
        {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
      </>
    );
  }

  /* ── Mobile bottom tabs ──────────────────────────────────────────── */
  return (
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
              {/* neon indicator above the active tab */}
              {active && (
                <span className="absolute top-0 w-10 h-0.5 rounded-full"
                      style={{
                        background: 'rgb(var(--accent))',
                        boxShadow: '0 0 8px rgb(var(--accent) / 0.8)',
                      }} />
              )}
              <span className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}
                    style={active ? { filter: 'drop-shadow(0 0 6px rgb(var(--accent) / 0.6))' } : {}}>
                {icon}
              </span>
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
