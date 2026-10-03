import { Skeleton } from '@/components/app';

/** While a planning page loads: the header, the tools' chips and a few cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" aria-busy>
      <Skeleton shape="line" width="220px" height="28px" />
      <Skeleton shape="line" width="320px" className="mt-3" />
      <div className="mt-5 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} shape="block" width="104px" height="44px" radius="9999px" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Skeleton shape="block" height="180px" radius="12px" />
        <Skeleton shape="block" height="180px" radius="12px" />
        <Skeleton shape="block" height="240px" radius="12px" className="lg:col-span-2" />
      </div>
    </div>
  );
}
