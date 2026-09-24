'use client';

import { Tooltip } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { useDir } from './direction';
import { DisabledTrigger } from './Hint';
import { cn, iconSlot } from './utils';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** Accessible name (aria-label) — required: the button shows only an icon. */
  label: string;
  /** The icon (18px in md, 16px in sm; add `icon-dir` to mirror directional icons in RTL). */
  children: ReactNode;
  /** md = 36×36 (§9B.2), sm = 28×28 for dense places (toasts, table rows). */
  size?: 'sm' | 'md';
  /** Also show `label` in a tooltip on hover/focus. */
  tooltip?: boolean;
  tooltipSide?: 'top' | 'bottom';
  /** With `tooltip`: what the tooltip says while the button is disabled (why), e.g. "Nothing to undo". */
  disabledTooltip?: string;
};

/** app.html `.icon-btn`: muted icon, subtle background + ink on hover, `aria-pressed` = on state. */
export function IconButton({
  label,
  children,
  size = 'md',
  tooltip = false,
  tooltipSide = 'bottom',
  disabledTooltip,
  className,
  type = 'button',
  disabled,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      className={cn(
        iconSlot,
        'rounded-btn text-muted transition-colors duration-150 motion-reduce:transition-none',
        'aria-pressed:bg-subtle aria-pressed:text-ink',
        size === 'md' ? 'size-9 [&_svg]:size-[18px]' : 'size-7 [&_svg]:size-4',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-subtle hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  if (!tooltip) return button;
  return (
    <WithTooltip label={disabled && disabledTooltip ? disabledTooltip : label} side={tooltipSide}>
      {disabled ? (
        // a disabled button gets no pointer events: the wrapper takes the hover (not a tab stop)
        <DisabledTrigger focusable={false} className="rounded-btn">
          {button}
        </DisabledTrigger>
      ) : (
        button
      )}
    </WithTooltip>
  );
}

/** Radix tooltip around the button; the content is portalled, so it takes `dir` from useDir(). */
function WithTooltip({
  label,
  side,
  children,
}: {
  label: string;
  side: 'top' | 'bottom';
  children: ReactNode;
}) {
  const dir = useDir();
  return (
    <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            dir={dir}
            className={cn(
              'z-[60] rounded-md bg-ink px-2 py-1 text-[12px] font-medium text-white shadow-md select-none',
              'motion-safe:animate-app-fade-in motion-safe:data-[state=closed]:animate-app-fade-out',
            )}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
