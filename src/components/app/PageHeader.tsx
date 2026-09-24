import type { ReactNode } from 'react';
import { cn } from './utils';

/**
 * The host app's heading scale — two sizes, used the same way everywhere:
 * - `screen`: a top-level screen's h1 (my invitations, the gallery, the plan, the account) and an
 *   invitation's name in its header — the display serif, 26px on phones and 30px from 640px;
 * - `section`: the h1 of a page inside an invitation (overview, guests, RSVPs, sharing), under the
 *   invitation's header — 22px bold.
 */
export const PAGE_TITLE = {
  screen: 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.01em] text-balance sm:text-[30px]',
  section: 'text-[22px] leading-tight font-bold tracking-[-0.01em] text-balance',
} as const;

export type PageTitleSize = keyof typeof PAGE_TITLE;

export function PageTitle({
  children,
  size = 'screen',
  id,
  className,
}: {
  children: ReactNode;
  size?: PageTitleSize;
  id?: string;
  className?: string;
}) {
  return (
    <h1 id={id} className={cn(PAGE_TITLE[size], className)}>
      {children}
    </h1>
  );
}

/**
 * The head of an app page (§9B `.page-head`): the title with the area's "?" beside it, one muted line
 * under it, and the page's actions at the inline-end (under the title on phones).
 */
export function PageHeader({
  title,
  size = 'screen',
  help,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  size?: PageTitleSize;
  /** the area's "?" (<AreaHelp> / HelpFor) */
  help?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="max-w-2xl min-w-0">
        <div className="flex items-center gap-1.5">
          <PageTitle size={size}>{title}</PageTitle>
          {help}
        </div>
        {description != null ? (
          <p
            className={cn(
              'text-pretty text-muted',
              size === 'screen' ? 'mt-1.5 text-[14.5px]' : 'mt-1 text-[14px]',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions != null ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
