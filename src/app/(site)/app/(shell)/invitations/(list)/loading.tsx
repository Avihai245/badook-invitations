import { Skeleton } from '@/components/app';

/** Skeleton shaped like the list (§9B.3-H: never a page spinner). */
export default function Loading() {
  return (
    <div aria-busy className="mx-auto max-w-[1280px] px-6 pt-8 pb-16">
      <div className="flex items-center justify-between gap-4">
        <Skeleton shape="line" width={180} height={26} />
        <Skeleton width={140} height={40} radius={8} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="max-sm:flex max-sm:gap-4">
            <Skeleton className="aspect-[9/16] max-sm:w-24!" height="auto" radius={24} />
            <div className="max-sm:flex-1">
              <Skeleton shape="line" width="60%" className="mt-3" />
              <Skeleton shape="line" width="40%" className="mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
