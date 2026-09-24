import { KpiCard, Skeleton } from '@/components/app';

/**
 * Loading placeholders shaped like each screen (§9B.3-H: skeletons, never a page spinner) — the
 * routes' loading.tsx files render these while the page's data loads. Decorative: the wrapper is
 * `aria-busy`.
 */

const Line = ({ w, h = 12, className }: { w: number | string; h?: number; className?: string }) => (
  <Skeleton shape="line" width={w} height={h} className={className} />
);

/** The head of a screen: title (screen size) and one line. */
function ScreenHead({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Line w={220} h={30} />
        <Line w={320} className="mt-3 max-w-full" />
      </div>
      {actions ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} width={130} height={40} radius={8} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** /app/invitations: the greeting header, then invitation cards (two columns on wide screens). */
export function ListSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-5 pb-16 sm:px-6 sm:pt-8">
      <div className="list-hero rounded-[24px] border border-brand-line px-5 py-6 sm:px-8 sm:py-7">
        <Line w={110} h={14} />
        <Line w={220} h={30} className="mt-3" />
        <div className="mt-4 flex gap-2">
          <Skeleton width={130} height={28} radius={999} />
          <Skeleton width={96} height={28} radius={999} />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-sm">
      <div className="flex gap-4 p-3 sm:p-4">
        <Skeleton className="aspect-[9/16] w-[88px]! sm:w-[112px]!" height="auto" radius={16} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
          <Line w={70} h={10} />
          <Line w="70%" h={18} />
          <Line w="45%" h={10} />
          <Skeleton height={6} radius={999} className="mt-2" />
          <Skeleton width={180} height={28} radius={999} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 border-t border-line px-3 py-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={36} radius={10} />
        ))}
      </div>
    </div>
  );
}

/** /app/invitations/new: the head, the event-type chips and the posters. */
export function GallerySkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <ScreenHead actions={1} />
      <div className="mt-5 flex gap-2 overflow-hidden">
        {[64, 84, 90, 70, 96, 88, 76].map((w, i) => (
          <Skeleton key={i} width={w} height={36} radius={999} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[9/16]" height="auto" radius={24} />
            <Line w="60%" h={14} className="mt-3" />
            <Line w="40%" h={10} className="mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** An invitation's header and tabs (while the workspace layout loads). */
export function WorkspaceHeaderSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6">
      <Line w={90} h={12} />
      <div className="list-hero mt-2.5 rounded-[24px] border border-brand-line px-4 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-center gap-4">
          <Skeleton className="aspect-[9/16] w-[60px]! sm:w-[78px]!" height="auto" radius={14} />
          <div className="flex-1">
            <Line w={120} h={12} />
            <Line w={240} h={28} className="mt-2 max-w-full" />
            <Line w={180} h={12} className="mt-2" />
          </div>
        </div>
        <div className="mt-5 flex gap-1.5 overflow-hidden pb-4 sm:pb-5">
          {[70, 190, 110, 70, 120].map((w, i) => (
            <Skeleton key={i} width={w} height={40} radius={999} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A page inside an invitation: its section title and one line. */
function SectionHead({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Line w={160} h={22} />
        <Line w={280} className="mt-2.5 max-w-full" />
      </div>
      {actions ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} width={140} height={40} radius={8} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** /app/invitations/[id]: five numbers, the two big cards, the steps and the link. */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <SectionHead />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <KpiCard
            key={i}
            label={<Skeleton className="h-3 w-16" />}
            loading
            className={i === 4 ? 'max-sm:col-span-2' : undefined}
          />
        ))}
      </div>
      <Line w={140} h={16} className="mt-8" />
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[18px] border border-line bg-surface p-6 shadow-sm">
            <Skeleton width={48} height={48} radius={14} />
            <Line w="65%" h={18} className="mt-4" />
            <Line w="90%" className="mt-3" />
            <Line w="75%" className="mt-2" />
            <Skeleton width={150} height={48} radius={8} className="mt-5" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-card border border-line bg-surface shadow-sm">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 border-b border-line px-5 py-3.5 last:border-b-0"
            >
              <Skeleton shape="circle" width={36} />
              <div className="flex-1">
                <Line w="40%" h={13} />
                <Line w="60%" h={10} className="mt-2" />
              </div>
              <Skeleton width={80} height={28} radius={8} />
            </div>
          ))}
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <Line w={120} h={16} />
          <Skeleton height={40} radius={10} className="mt-4" />
          <Line w={110} className="mt-4" />
        </div>
      </div>
    </div>
  );
}

/** /app/invitations/[id]/responses: head, 4 KPI cards, 2 bar cards, the replies. */
export function ResponsesSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <SectionHead actions={2} />
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

/** /app/invitations/[id]/share: head, the guests card, then the message and preview cards. */
export function ShareSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <SectionHead />
      <Skeleton className="mt-4 h-[74px] w-full" />
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

/** The full-screen editor: its top bar, the rail and the form, the canvas with the phone. */
export function EditorSkeleton() {
  return (
    <div aria-busy="true" className="flex h-dvh flex-col bg-canvas">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Skeleton width={36} height={36} radius={8} />
        <div>
          <Line w={160} h={14} />
          <Line w={90} h={9} className="mt-1.5" />
        </div>
        <div className="mx-auto hidden gap-2 lg:flex">
          <Skeleton width={150} height={34} radius={8} />
        </div>
        <div className="ms-auto flex gap-2 lg:ms-0">
          <Skeleton width={36} height={36} radius={8} />
          <Skeleton width={88} height={32} radius={8} />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[64px_360px_minmax(0,1fr)] xl:grid-cols-[280px_400px_minmax(0,1fr)]">
        <div className="hidden flex-col gap-1.5 border-e border-line bg-surface p-3 lg:flex">
          <Skeleton height={32} radius={8} />
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} height={36} radius={8} className="mt-1" />
          ))}
        </div>
        <div className="flex flex-col gap-4 border-line p-5 lg:border-e">
          <Line w={140} h={18} />
          <Line w="80%" h={10} />
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <Line w={90} h={10} />
              <Skeleton height={40} radius={10} />
              <Skeleton height={40} radius={10} />
            </div>
          ))}
        </div>
        <div className="hidden items-center justify-center bg-canvas-editor bg-[radial-gradient(#D6D3D1_1px,transparent_1px)] [background-size:16px_16px] lg:flex">
          <Skeleton width={280} height={580} radius={44} className="bg-surface/80! shadow-lg" />
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-line bg-surface lg:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={44} height={30} radius={8} />
        ))}
      </div>
    </div>
  );
}

/** /app/billing: head, the current plan with three numbers, the plans and the credit packs. */
export function BillingSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 sm:px-6">
      <ScreenHead />
      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-sm">
        <Line w={90} h={12} />
        <Line w={140} h={26} className="mt-2" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <KpiCard key={i} label={<Skeleton className="h-3 w-20" />} loading />
          ))}
        </div>
      </div>
      <Line w={120} h={20} className="mt-10" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={300} radius={16} />
        ))}
      </div>
    </div>
  );
}

/** /app/account: head, the profile form, the plan and password cards, the danger zone. */
export function AccountSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[760px] px-4 pt-8 pb-16 sm:px-6">
      <ScreenHead />
      <div className="mt-6 flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-sm">
        <Line w={70} h={16} />
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Line w={80} h={10} />
            <Skeleton height={40} radius={10} className="mt-2" />
          </div>
        ))}
        <Skeleton width={110} height={40} radius={8} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} height={120} radius={12} />
        ))}
      </div>
      <Skeleton height={150} radius={12} className="mt-8" />
    </div>
  );
}
