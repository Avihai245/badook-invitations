'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { useDir, type Dir } from './direction';
import { IconButton } from './IconButton';
import { cn } from './utils';

export type DrawerProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (rendered via `Dialog.Trigger asChild`). */
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  /** aria-label of the close button (required — no built-in strings). */
  closeLabel: string;
  children?: ReactNode;
  /** Sticky footer (actions), end-aligned. */
  footer?: ReactNode;
  /** Next to the close button: the panel's "?" (what each of its controls does). */
  help?: ReactNode;
  /**
   * Direction of the portalled panel. Defaults to the nearest `DirProvider`, then `<html dir>`.
   * The panel is attached to the inline-END edge: right in LTR, left in RTL.
   */
  dir?: Dir;
  className?: string;
};

/**
 * Side sheet (§9B.2): 480px (full width on mobile) from the inline-end, overlay rgba(28,25,23,.4),
 * title + close button; 200ms slide/fade, none under prefers-reduced-motion. Radix Dialog underneath
 * (focus trap, Esc/overlay close, scroll lock). The panel is nested in the overlay, which carries
 * `dir`, so `inset-inline-end` resolves against the right direction whatever `<html dir>` says.
 */
export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel,
  children,
  footer,
  help,
  dir: dirProp,
  className,
}: DrawerProps) {
  const dir = useDir(dirProp);
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          className={cn(
            'fixed inset-0 z-[66] bg-[rgba(28,25,23,0.4)]',
            // motion-safe: a data-state selector would out-specify motion-reduce:animate-none.
            'motion-safe:data-[state=open]:animate-app-fade-in motion-safe:data-[state=closed]:animate-app-fade-out',
          )}
        >
          <RadixDialog.Content
            className={cn(
              'slide-from-end absolute inset-y-0 end-0 flex w-full max-w-[480px] flex-col bg-surface shadow-lg outline-none',
              'motion-safe:data-[state=open]:animate-app-drawer-in motion-safe:data-[state=closed]:animate-app-drawer-out',
              className,
            )}
          >
            <div className="flex items-start gap-3 border-b border-line py-4 ps-5 pe-3">
              <div className="min-w-0 flex-1 pt-1">
                <RadixDialog.Title className="text-[18px] leading-snug font-bold">{title}</RadixDialog.Title>
                {description != null && (
                  <RadixDialog.Description className="mt-0.5 text-[13px] text-muted">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {help}
                <RadixDialog.Close asChild>
                  <IconButton label={closeLabel}>
                    <X />
                  </IconButton>
                </RadixDialog.Close>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
            {footer != null && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
                {footer}
              </div>
            )}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
