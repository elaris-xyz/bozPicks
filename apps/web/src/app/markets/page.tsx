import { MarketsPanel } from '@/components/ui/MarketsPanel';
import { MarketsHero } from '@/components/ui/MarketsHero';
import { MarketsBanner } from '@/components/ui/MarketsBanner';
import { SettlementPipeline } from '@/components/ui/SettlementPipeline';
import { OnChainProof } from '@/components/ui/OnChainProof';
import { RealProofCard } from '@/components/ui/RealProofCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Prediction Markets',
  description: 'Parametric prop markets settled trustlessly from TxLINE Merkle proofs.',
};

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <MarketsHero />

      {/* ── WHAT YOU DO HERE: pick an outcome and stake ──────────────────────
          The live pool banner sets the scene, then the actual prop markets come
          straight after — a user who came to predict never has to scroll past
          the credibility section to find where to act. */}
      <MarketsBanner />

      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--green)' }}>Predict &amp; stake</h2>
          <span className="text-[11px] text-gray-500">pick an outcome — winners split the pool</span>
        </div>
        <MarketsPanel />
      </section>

      {/* ── HOW IT PAYS OUT: the trustless-settlement proof, for anyone who
          wants to check the plumbing. Kept below the markets so it informs
          rather than blocks — this is the Track 1 credibility story. */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--blue)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--blue)' }}>How settlement works</h2>
          <span className="text-[11px] text-gray-500">no trusted oracle — verify it yourself</span>
        </div>

        {/* signature visual — the trustless settlement flow */}
        <SettlementPipeline />

        {/* one-click on-chain verification of the deployed programs */}
        <OnChainProof />

        {/* live verification of a REAL fixture's TxLINE Merkle proof (its own
            real match — independent of any demo you ran above) */}
        <RealProofCard />
      </section>
    </div>
  );
}
