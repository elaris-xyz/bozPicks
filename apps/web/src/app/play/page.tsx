import { HiLoGame } from '@/components/ui/HiLoGame';
import { LiveStatsPanel } from '@/components/ui/LiveStatsPanel';
import { LiveEventFeed } from '@/components/ui/LiveEventFeed';
import { HeroAura } from '@/components/ui/HeroAura';
import { PunditRail } from '@/components/ui/PunditRail';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Play · bozPicks',
  description: 'Live World Cup fan games powered by TxLINE data.',
};

export default function PlayPage() {
  return (
    <div className="space-y-6">
      <header className="glass fx-rise relative overflow-hidden p-6">
        <HeroAura color="var(--blue)" />
        <div className="relative">
          <span className="chip-glass chip-blue uppercase mb-2">Track 2 — Fan Experience</span>
          <h1 className="font-display text-2xl font-black mt-2">Play Live</h1>
          <p className="text-sm text-gray-500 mt-1">
            Read the game as it happens — every number is live TxLINE data.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <HiLoGame />
        <LiveStatsPanel />
      </div>

      <PunditRail home="Brazil" away="Argentina" />

      <section className="space-y-3">
        <p className="section-label">Live Feed</p>
        <LiveEventFeed />
      </section>
    </div>
  );
}
