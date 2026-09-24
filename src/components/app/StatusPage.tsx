import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';
import { cn } from './utils';

/**
 * A whole page that says where things stand when there's nothing else to show — "not found",
 * "something went wrong": the brand (a way home), an illustration, a small code line, the title, one
 * or two sentences and the ways back. Server or client (no hooks); every string comes from props.
 */
export function StatusPage({
  brand,
  homeHref,
  illustration,
  code,
  title,
  description,
  actions,
  footer,
  className,
}: {
  /** the brand's name next to its mark (a link to `homeHref`) */
  brand: string;
  homeHref: string;
  /** ~132px, decorative */
  illustration?: ReactNode;
  /** a small line above the title, e.g. "Error 404" */
  code?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** under the actions, small (e.g. an error reference) */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative isolate flex min-h-dvh flex-col overflow-hidden bg-canvas', className)}>
      <div
        aria-hidden
        className="list-hero absolute inset-x-0 top-0 -z-10 h-[58%] rounded-b-[40px] border-b border-brand-line sm:rounded-b-[72px]"
      />
      <div className="mx-auto flex w-full max-w-[1100px] items-center px-5 py-5 sm:px-8">
        <Link href={homeHref} className="rounded-btn text-[19px]">
          <BrandLogo label={brand} />
        </Link>
      </div>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0"
      >
        <div className="site-rise w-full max-w-[540px] rounded-[28px] border border-brand-line bg-surface/95 px-6 py-8 text-center shadow-[0_30px_80px_-40px_rgba(60,35,15,0.55)] backdrop-blur sm:px-10 sm:py-10">
          {illustration != null ? (
            <div aria-hidden className="list-hero-art mx-auto size-[132px] [&>svg]:size-full">
              {illustration}
            </div>
          ) : null}
          {code != null ? (
            <p className="mt-3 text-[12px] font-bold tracking-[.14em] text-brand uppercase">{code}</p>
          ) : null}
          <h1 className="mt-2 font-display text-[28px] leading-tight font-bold tracking-[-0.01em] text-balance sm:text-[32px]">
            {title}
          </h1>
          {description != null ? (
            <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-relaxed text-pretty text-muted">
              {description}
            </p>
          ) : null}
          {actions != null ? (
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">{actions}</div>
          ) : null}
          {footer != null ? <div className="mt-6 text-[12.5px] text-faint">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
