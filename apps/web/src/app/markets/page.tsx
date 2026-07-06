import { MarketsPanel } from '@/components/ui/MarketsPanel';
import { HeroAura } from '@/components/ui/HeroAura';
import { HeroMarketSummary } from '@/components/ui/HeroMarketSummary';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Prediction Markets · bozPicks',
  description: 'Parametric prop markets settled trustlessly from TxLINE Merkle proofs.',
};

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <header className="glass fx-rise relative overflow-hidden p-6 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-center">
        <HeroAura color="var(--green)" />
        <div className="relative">
          <span className="chip-glass chip-green uppercase mb-2">Track 1 — Prediction & Settlement</span>
          <h1 className="font-display text-2xl md:text-3xl font-black mt-2">Prediction Markets</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Parametric prop markets — goals, corners, cards, BTTS — as USDC parimutuel
            pools, settled trustlessly the moment TxLINE confirms the result on-chain.
          </p>
        </div>
        <div className="relative"><HeroMarketSummary /></div>
      </header>
      <MarketsPanel />
    </div>
  );
}
