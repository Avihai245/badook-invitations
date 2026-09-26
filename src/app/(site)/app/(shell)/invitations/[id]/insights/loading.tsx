import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the insights tab, under the invitation's header (§9B.3-H: skeletons, not spinners). */
export default function InsightsLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <Skeleton shape="line" width={160} height={24} />
      <Skeleton shape="line" width={460} height={12} className="mt-3 max-w-full" />
      <Skeleton shape="line" width={300} height={34} className="mt-5 max-w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCard key={i} label="" loading />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Skeleton height={260} radius={12} />
        <Skeleton height={260} radius={12} />
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={160} radius={12} />
        ))}
      </div>
    </div>
  );
}
