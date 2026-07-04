import { HiLoGame } from '@/components/ui/HiLoGame';
import { LiveStatsPanel } from '@/components/ui/LiveStatsPanel';
import { LiveEventFeed } from '@/components/ui/LiveEventFeed';
import { DemoButton } from '@/components/ui/DemoButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Play · bozPicks',
  description: 'Live World Cup fan games powered by TxLINE data.',
};

export default function PlayPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Play Live</h1>
          <p className="text-sm text-gray-500 mt-1">
            Read the game as it happens — every number is live TxLINE data.
          </p>
        </div>
        <DemoButton />
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <HiLoGame />
        <LiveStatsPanel />
      </div>

      <section className="space-y-3">
        <p className="section-label">Live Feed</p>
        <LiveEventFeed />
      </section>
    </div>
  );
}
