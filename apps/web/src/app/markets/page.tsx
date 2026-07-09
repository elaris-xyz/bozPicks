import { MarketsPanel } from '@/components/ui/MarketsPanel';
import { MarketsHero } from '@/components/ui/MarketsHero';
import { MarketsBanner } from '@/components/ui/MarketsBanner';
import { OnChainProof } from '@/components/ui/OnChainProof';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Prediction Markets',
  description: 'Parametric prop markets settled trustlessly from TxLINE Merkle proofs.',
};

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <MarketsHero />

      {/* live centrepiece — pool + settlement status (or an invite when idle) */}
      <MarketsBanner />

      {/* one-click on-chain verification of the deployed programs */}
      <OnChainProof />

      {/* the prop-market cards + verifiable-resolution receipts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--green)' }}>Prop Markets</h2>
        </div>
        <MarketsPanel />
      </section>
    </div>
  );
}
