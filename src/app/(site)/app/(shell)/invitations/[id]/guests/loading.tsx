import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the guest list: the title, the two main actions, 6 KPI cards, the greeting, table rows. */
export default function GuestsLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="size-10 shrink-0" />
      </div>
      <div className="mt-5 grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 p-5 sm:p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full max-w-[280px]" />
            <Skeleton className="h-4 w-full max-w-[360px]" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <KpiCard key={i} label={<Skeleton className="h-3 w-16" />} loading />
        ))}
      </div>
      <Skeleton className="mt-4 h-[74px] w-full" />
      <div className="mt-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
