'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  );
}

export function MatchCardSkeleton() {
  // mirrors the poster MatchCard aspect + layout so hydration doesn't jump
  return (
    <div className="poster-card relative overflow-hidden aspect-[16/9] sm:aspect-[4/3] animate-pulse">
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.02)' }} />
      <div className="absolute top-2.5 left-2.5"><Skeleton className="w-7 h-7 !rounded-full" /></div>
      <div className="absolute top-2.5 right-2.5"><Skeleton className="w-16 h-7 !rounded-full" /></div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Skeleton className="h-9 w-24" />
        <div className="flex gap-1.5"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-12" /></div>
      </div>
      <div className="absolute bottom-3 inset-x-3.5 flex justify-between">
        <Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export function MatchListSkeleton() {
  return (
    <div className="space-y-5">
      {/* search bar */}
      <Skeleton className="h-11 w-full !rounded-xl" />
      {/* tabs */}
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 !rounded-xl" />)}
      </div>
      {/* live label */}
      <Skeleton className="h-3 w-24" />
      {/* poster grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <MatchCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="glass p-6 md:p-8 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  );
}

export function MarketGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass p-4 space-y-3">
          <div className="flex justify-between"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-16" /></div>
          <div className="grid grid-cols-2 gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4 text-center space-y-2">
          <Skeleton className="h-7 w-12 mx-auto" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SignalSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
