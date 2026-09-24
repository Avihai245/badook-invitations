'use client';

import { CircleHelp } from 'lucide-react';
import { Popover, Tooltip } from 'radix-ui';
import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { useDir } from './direction';
import { cn } from './utils';

/** What every <AreaHelp> card ends with (the host app: a way to ask the support assistant). */
const AreaFooter = createContext<ReactNode>(null);

/** Wrap a group of hinted buttons (the host app mounts one for all its pages). */
export function HintProvider({
  children,
  areaFooter = null,
}: {
  children: ReactNode;
  areaFooter?: ReactNode;
}) {
  return (
    <AreaFooter.Provider value={areaFooter}>
      <Tooltip.Provider delayDuration={250} skipDelayDuration={200}>
        {children}
      </Tooltip.Provider>
    </AreaFooter.Provider>
  );
}

/**
 * What a button does, on hover and keyboard focus: a dark bubble next to it (Radix Tooltip). The
 * trigger keeps its own accessible name; the explanation is its description. Touch devices get the
 * same text from the area's <AreaHelp>.
 */
export function Hint({
  text,
  children,
  side = 'top',
}: {
  text: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const dir = useDir();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          dir={dir}
          className="z-[80] max-w-[280px] rounded-[10px] bg-ink px-3 py-2 text-[12.5px] leading-[1.45] text-white shadow-lg data-[state=delayed-open]:animate-app-fade-in motion-reduce:animate-none"
        >
          {text}
          <Tooltip.Arrow className="fill-ink" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export interface AreaHelpItem {
  icon?: ReactNode;
  label: ReactNode;
  text: ReactNode;
}

/**
 * "What does each button here do?" — a ? button that opens a card listing the area's buttons with
 * an explanation each. Works the same with a mouse, a keyboard and a finger.
 */
export function AreaHelp({
  label,
  title,
  items,
  className,
}: {
  /** the ? button's accessible name, e.g. "הסבר על הכפתורים" */
  label: string;
  title: ReactNode;
  items: readonly AreaHelpItem[];
  className?: string;
}) {
  const dir = useDir();
  const footer = useContext(AreaFooter);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-testid="area-help"
          className={cn(
            'inline-grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            className,
          )}
        >
          <CircleHelp aria-hidden size={18} strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir={dir}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          // fits the room on screen: the list scrolls, the title and the footer stay in view
          className="z-[70] flex max-h-[min(70dvh,var(--radix-popover-content-available-height))] w-[min(360px,calc(100vw-24px))] flex-col rounded-[14px] border border-line bg-surface p-4 shadow-lg outline-none data-[state=open]:animate-app-dialog-in motion-reduce:animate-none"
        >
          <p className="shrink-0 text-[14px] font-bold">{title}</p>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                {item.icon ? (
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-subtle text-ink [&_svg]:size-[15px]"
                  >
                    {item.icon}
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{item.label}</span>
                  <span className="block text-[12.5px] leading-[1.5] text-muted">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
          {footer ? <div className="mt-3 shrink-0 border-t border-line pt-3">{footer}</div> : null}
          <Popover.Arrow className="fill-surface" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
