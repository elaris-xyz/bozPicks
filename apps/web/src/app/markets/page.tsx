import { MarketsPanel } from '@/components/ui/MarketsPanel';
import { DemoButton } from '@/components/ui/DemoButton';
import { HeroAura } from '@/components/ui/HeroAura';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Prediction Markets · bozPicks',
  description: 'Parametric prop markets settled trustlessly from TxLINE Merkle proofs.',
};

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <header className="glass fx-rise relative overflow-hidden p-6 flex items-end justify-between flex-wrap gap-3">
        <HeroAura color="var(--green)" />
        <div className="relative">
          <span className="chip-glass chip-green uppercase mb-2">Track 1 — Prediction & Settlement</span>
          <h1 className="font-display text-2xl font-black mt-2">Prediction Markets</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Parametric prop markets — goals, corners, cards, BTTS — as USDC parimutuel
            pools, settled trustlessly the moment TxLINE confirms the result on-chain.
          </p>
        </div>
        <div className="relative"><DemoButton /></div>
      </header>
      <MarketsPanel />
    </div>
  );
}
