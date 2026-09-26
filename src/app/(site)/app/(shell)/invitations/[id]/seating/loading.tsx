import { Skeleton } from '@/components/app';

/** Shaped like the seating screen: the title and actions, the summary line, the list beside the map. */
export default function SeatingLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <Skeleton className="mt-4 h-5 w-80 max-w-full" />
      <div className="mt-3 grid h-[72dvh] min-h-[460px] overflow-hidden rounded-card border border-line bg-surface lg:h-[min(76dvh,860px)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-line p-3 max-lg:hidden lg:border-e">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-2/3" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
        <div className="flex flex-col">
          <div className="flex gap-2 border-b border-line p-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-12" />
            ))}
          </div>
          <div className="flex-1 bg-[#ebe8e3]" />
        </div>
      </div>
    </div>
  );
}
