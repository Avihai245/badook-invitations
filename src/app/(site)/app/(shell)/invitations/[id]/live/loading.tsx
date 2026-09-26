import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the event day's live hall: the title, four numbers, the map beside the side cards. */
export default function LiveLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <Skeleton shape="line" width={160} height={24} />
      <Skeleton shape="line" width={460} height={12} className="mt-3 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCard key={i} label="" loading />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton height={420} radius={12} />
        <div className="grid gap-5">
          <Skeleton height={140} radius={12} />
          <Skeleton height={220} radius={12} />
        </div>
      </div>
    </div>
  );
}
