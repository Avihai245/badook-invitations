import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/components/app/utils';

/**
 * A block that fades and lifts in as it scrolls into view (site.css `.reveal`), after `delay` ms —
 * staggered lists pass increasing delays. It is only markup: one RevealWatcher on the page (a single
 * client component) watches every `.reveal` block, so a page of ninety of them hydrates none. Without
 * JavaScript, or with reduced motion, it is simply there.
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  return (
    <Tag
      className={cn('reveal', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
