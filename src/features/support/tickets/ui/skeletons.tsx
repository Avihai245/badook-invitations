import { Skeleton } from '@/components/app';

/** Loading placeholders shaped like the customer's support screens (skeletons, never a spinner). */

const Line = ({ w, h = 12, className }: { w: number | string; h?: number; className?: string }) => (
  <Skeleton shape="line" width={w} height={h} className={className} />
);

/** /app/support: the title and a few tickets. */
export function TicketListSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Line w={140} h={30} />
          <Line w={360} className="mt-3 max-w-full" />
        </div>
        <Skeleton width={130} height={40} radius={8} />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
            <div className="min-w-0 flex-1">
              <Line w="55%" h={14} />
              <Line w="35%" className="mt-2" />
            </div>
            <Skeleton width={84} height={22} radius={999} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** /app/support/new: the title and the form. */
export function NewTicketSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <Line w={90} />
      <Line w={240} h={30} className="mt-4" />
      <Line w={320} className="mt-3 max-w-full" />
      <div className="mt-6 flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
        <Skeleton height={40} radius={10} />
        <Skeleton height={40} radius={10} />
        <Skeleton height={150} radius={10} />
        <Skeleton width={150} height={40} radius={8} />
      </div>
    </div>
  );
}

/** /app/support/:id: the subject, the conversation and the answer box. */
export function TicketSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <Line w={90} />
      <Line w="60%" h={24} className="mt-4" />
      <Line w={220} className="mt-3" />
      <div className="mt-8 flex flex-col gap-3">
        <Skeleton width="70%" height={64} radius={18} className="self-end" />
        <Skeleton width="62%" height={88} radius={18} />
      </div>
      <Skeleton height={170} radius={12} className="mt-6" />
    </div>
  );
}
