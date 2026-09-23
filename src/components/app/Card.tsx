import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './utils';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

// sm = `.pcard` 16px · md = `.kpi/.bars` 18px · lg = share cards 20px.
const PADDING: Record<CardPadding, string> = { none: '', sm: 'p-4', md: 'p-[18px]', lg: 'p-5' };

export type CardProps = ComponentProps<'div'> & {
  padding?: CardPadding;
  /** `info` = the blue tip card (info-bg + #BFDBFE border). */
  tone?: 'default' | 'info';
  /** Render the single child (e.g. `<section>`, `<article>`) with the card styles. */
  asChild?: boolean;
};

/** app.html `.card`: surface, 1px line border, radius 12, shadow-sm. */
export function Card({
  padding = 'none',
  tone = 'default',
  asChild = false,
  className,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      className={cn(
        'rounded-card border shadow-sm',
        tone === 'info' ? 'border-[#bfdbfe] bg-info-bg' : 'border-line bg-surface',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
}

export type CardTitleProps = Omit<ComponentProps<'h3'>, 'ref'> & { as?: 'h2' | 'h3' | 'h4' | 'div' };

/** Panel card title (app.html `.pcard h3`): 13px/700 muted, letter-spacing .02em, 12px below. */
export function CardTitle({ as: Comp = 'h3', className, ...props }: CardTitleProps) {
  return (
    <Comp className={cn('mb-3 text-[13px] font-bold tracking-[.02em] text-muted', className)} {...props} />
  );
}
