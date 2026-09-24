import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the guest list: head with actions, the greeting card, 6 KPI cards, table rows. */
export default function GuestsLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" aria-busy="true">
      <Skeleton className="h-9 w-full max-w-[520px]" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Skeleton className="mt-4 h-[74px] w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <KpiCard key={i} label={<Skeleton className="h-3 w-16" />} loading />
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
