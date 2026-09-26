import { KpiCard, Skeleton } from '@/components/app';

/** Shaped like the gallery tab, under the invitation's header (§9B.3-H: skeletons, not spinners). */
export default function GalleryLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <Skeleton shape="line" width={180} height={24} />
      <Skeleton shape="line" width={420} height={12} className="mt-3 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCard key={i} label="" loading />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Skeleton height={320} radius={12} />
        <Skeleton height={320} radius={12} />
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} height={120} radius={10} />
        ))}
      </div>
    </div>
  );
}
