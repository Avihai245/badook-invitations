import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the dashboard: head, 4 KPI cards, 2 bar cards, table rows (§9B.3-H). */
export default function ResponsesLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCard key={i} label={<Skeleton className="h-3 w-16" />} loading />
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-[18px]">
            <Skeleton className="h-4 w-32" />
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-3 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
