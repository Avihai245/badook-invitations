import type { ReactNode } from 'react';
import { cn } from './utils';

export type EmptyStateProps = {
  /** 120×120 illustration slot (an `<svg>` fills it). Decorative. */
  illustration?: ReactNode;
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4';
  /** One line, muted. */
  description?: ReactNode;
  /** CTA slot, e.g. `<Button>`. */
  action?: ReactNode;
  className?: string;
};

/** Centered empty state (§9B.2): 120px illustration + title (16px/700) + one line + CTA. */
export function EmptyState({
  illustration,
  title,
  titleAs: Title = 'h3',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {illustration != null && (
        <div aria-hidden className="mb-4 flex size-[120px] items-center justify-center [&>svg]:size-full">
          {illustration}
        </div>
      )}
      <Title className="text-[16px] font-bold text-balance">{title}</Title>
      {description != null && (
        <p className="mt-1 max-w-[46ch] text-[14px] text-muted text-balance">{description}</p>
      )}
      {action != null && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
