import type { ComponentProps, ReactNode } from 'react';
import { cn, iconSlot } from './utils';

export type BadgeVariant = 'draft' | 'live' | 'warning' | 'danger' | 'neutral' | 'info';

// app.html `.b-draft / .b-live / .b-warn / .b-no`.
const VARIANT: Record<BadgeVariant, string> = {
  draft: 'bg-subtle text-muted',
  live: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-subtle text-ink',
  info: 'bg-info-bg text-[#1d4ed8]',
};

export type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant;
  /** 12px icon before the text. */
  icon?: ReactNode;
};

/** Status pill (§9B.2): 22px, 0 8px, 12px/600, radius 999 — draft · live · warning · danger · neutral · info. */
export function Badge({ variant = 'neutral', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold whitespace-nowrap',
        VARIANT[variant],
        className,
      )}
      {...props}
    >
      {icon != null && (
        <span aria-hidden className={cn(iconSlot, '[&_svg]:size-3')}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** Small square tag (app.html `.diet`): 20px, 0 6px, radius 4, subtle, 11px — e.g. dietary chips in tables. */
export function Tag({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-[4px] bg-subtle px-1.5 text-[11px] whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}
