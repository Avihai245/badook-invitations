import { Skeleton } from '@/components/app';

/** Shaped like the share screen: page head, then the two cards (§9B.3-H: skeletons, not spinners). */
export default function ShareLoading() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-8 pb-16 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 grid gap-5 min-[900px]:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-36 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-12 w-44" />
            <Skeleton className="h-12 w-36" />
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-64 w-full max-w-[320px]" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="size-40" />
        </div>
      </div>
    </div>
  );
}
