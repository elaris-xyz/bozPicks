import { Skeleton, PanelSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
      <div className="glass p-6 md:p-8">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-end gap-2"><Skeleton className="h-9 w-12" /><Skeleton className="h-4 w-24" /></div>
          <Skeleton className="h-14 w-28" />
          <div className="flex flex-col items-start gap-2"><Skeleton className="h-9 w-12" /><Skeleton className="h-4 w-24" /></div>
        </div>
      </div>
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={4} />
    </div>
  );
}
