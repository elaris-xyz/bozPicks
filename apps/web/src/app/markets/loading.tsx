import { HeroSkeleton, MarketGridSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <MarketGridSkeleton />
    </div>
  );
}
