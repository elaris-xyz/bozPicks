import { HeroSkeleton, PanelSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={4} />
      </div>
      <PanelSkeleton rows={3} />
    </div>
  );
}
