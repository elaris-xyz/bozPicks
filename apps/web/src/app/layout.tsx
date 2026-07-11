import type { Metadata } from 'next';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import { Nav } from '@/components/ui/Nav';
import { Toaster } from '@/components/ui/Toast';
import { Notifier } from '@/components/ui/Notifier';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { KeyboardShortcuts } from '@/components/ui/KeyboardShortcuts';
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar';
import { SSEProvider } from '@/contexts/SSEContext';
import { LiveMatchProvider } from '@/contexts/LiveMatchContext';
import { VaultProvider } from '@/contexts/VaultContext';
import { VaultModal } from '@/components/ui/VaultModal';
import { SolanaWalletProvider } from '@/components/providers/WalletProvider';
import { CinematicFX } from '@/components/ui/CinematicFX';
import { SfxToggle } from '@/components/ui/SfxToggle';
import { FirstVisitHint } from '@/components/ui/FirstVisitHint';
import { CommandBridge } from '@/components/ui/CommandBridge';

// Fonts load via <link> in <head> rather than next/font: build-time fetch
// to Google Fonts fails on this network and stalls every dev compile.
// The CSS variables --font-inter / --font-display are set in globals.css.

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'bozPicks — Pick smart. Watch live. Get paid on-chain.',
    template: '%s · bozPicks',
  },
  description: 'Live World Cup intelligence · Autonomous agent · On-chain settlement',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'bozPicks', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: 'bozPicks',
    title: 'bozPicks — Pick smart. Watch live. Get paid on-chain.',
    description: 'Live World Cup intelligence powered by TxLINE, settled on Solana.',
  },
  twitter: { card: 'summary_large_image', title: 'bozPicks', description: 'Live World Cup intelligence · TxLINE · Solana' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B1020',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen"
            style={{ background: 'var(--bg-deep)', color: '#e2e8f0' }}>
        <a href="#main"
           className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:text-white"
           style={{ background: 'var(--blue)' }}>
          Skip to content
        </a>
        <SolanaWalletProvider>
        <VaultProvider>
        <SSEProvider>
        <LiveMatchProvider>
          {/* Cinematic background + live event VFX */}
          <CinematicFX />
          <CommandBridge />
          <SfxToggle />
          <FirstVisitHint />

          {/* Desktop nav */}
          <div className="hidden md:block">
            <Nav variant="desktop" />
          </div>

          {/* Mobile compact header */}
          <div className="md:hidden">
            <Nav variant="mobile-header" />
          </div>

          <main id="main" className="max-w-7xl mx-auto px-3 md:px-6 pt-4 md:pt-8 pb-24 md:pb-12">
            {children}
          </main>

          {/* Mobile bottom tabs */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
            <Nav variant="mobile-tabs" />
          </div>

          <Toaster />
          <Notifier />
          <OfflineBanner />
          <KeyboardShortcuts />
          <ServiceWorkerRegistrar />
          <VaultModal />
        </LiveMatchProvider>
        </SSEProvider>
        </VaultProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
