import { PlayHero } from '@/components/ui/PlayHero';
import { LiveScoreboard } from '@/components/ui/LiveScoreboard';
import { HiLoGame } from '@/components/ui/HiLoGame';
import { LiveStatsPanel } from '@/components/ui/LiveStatsPanel';
import { LiveEventFeed } from '@/components/ui/LiveEventFeed';
import { PunditRail } from '@/components/ui/PunditRail';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Play',
  description: 'Live World Cup fan games powered by TxLINE data — Hi-Lo, win-probability and an AI pundit.',
};

export default function PlayPage() {
  return (
    <div className="space-y-6">
      <PlayHero />

      {/* live centrepiece — broadcast scorebug (or an invite when idle) */}
      <LiveScoreboard />

      {/* the three fan games, side by side */}
      {/* items-stretch + h-full roots: the three cards stay equal height in
          every state — no more columns jumping as content changes */}
      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <HiLoGame />
        <LiveStatsPanel />
        <PunditRail />
      </div>

      {/* full event stream */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--blue)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--blue)' }}>Live Feed</h2>
        </div>
        <LiveEventFeed />
      </section>
    </div>
  );
}
