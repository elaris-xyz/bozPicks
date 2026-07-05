import { StatsSkeleton, PanelSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="glass p-6 md:p-8 space-y-5">
        <div className="h-8" />
        <StatsSkeleton />
      </div>
      <PanelSkeleton rows={3} />
    </div>
  );
}
