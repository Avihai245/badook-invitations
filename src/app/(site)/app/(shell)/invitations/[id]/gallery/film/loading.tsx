import { Skeleton } from '@/components/app';

/** Shaped like the film studio, under the invitation's header (§9B.3-H: skeletons, not spinners). */
export default function FilmLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6">
      <Skeleton shape="line" width={180} height={24} />
      <Skeleton shape="line" width={420} height={12} className="mt-3 max-w-full" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:row-start-1">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={150} radius={10} />
          ))}
        </div>
        <div className="grid gap-5 lg:col-start-2 lg:row-start-1">
          <Skeleton height={300} radius={12} />
          <Skeleton height={380} radius={12} />
        </div>
      </div>
    </div>
  );
}
