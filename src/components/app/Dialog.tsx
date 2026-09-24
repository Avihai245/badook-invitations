'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { useDir, type Dir } from './direction';
import { IconButton } from './IconButton';
import { cn } from './utils';

export type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (rendered via `Dialog.Trigger asChild`). */
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions row, end-aligned (put the primary action last). */
  footer?: ReactNode;
  /** When set, shows a close (X) button with this aria-label. Esc and overlay click always close. */
  closeLabel?: string;
  /** Next to the close button: the dialog's "?" (what each of its controls does). */
  help?: ReactNode;
  /** Direction of the portalled dialog. Defaults to the nearest `DirProvider`, then `<html dir>`. */
  dir?: Dir;
  className?: string;
};

/**
 * Modal dialog (§9B.2): max 560px, radius 16, shadow-lg, padding 24, title 18px/700, optional
 * description and footer. Radix Dialog (focus trap, Esc/overlay close, scroll lock); the dialog is
 * nested in the scrollable overlay so tall content scrolls instead of being clipped.
 */
export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  closeLabel,
  help,
  dir: dirProp,
  className,
}: DialogProps) {
  const dir = useDir(dirProp);
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          className={cn(
            'fixed inset-0 z-[66] grid place-items-center overflow-y-auto bg-[rgba(28,25,23,0.4)] p-4 sm:p-6',
            // motion-safe: a data-state selector would out-specify motion-reduce:animate-none.
            'motion-safe:data-[state=open]:animate-app-fade-in motion-safe:data-[state=closed]:animate-app-fade-out',
          )}
        >
          <RadixDialog.Content
            className={cn(
              // min-w-0: a grid item may not grow past the screen because of a wide child
              'relative w-full max-w-[560px] min-w-0 rounded-dialog bg-surface p-5 shadow-lg outline-none sm:p-6',
              'motion-safe:data-[state=open]:animate-app-dialog-in motion-safe:data-[state=closed]:animate-app-dialog-out',
              className,
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <RadixDialog.Title className="text-[18px] leading-snug font-bold">{title}</RadixDialog.Title>
                {description != null && (
                  <RadixDialog.Description className="mt-1 text-[14px] text-muted">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              {closeLabel || help != null ? (
                <div className="-me-2 -mt-1.5 flex shrink-0 items-center gap-0.5">
                  {help}
                  {closeLabel && (
                    <RadixDialog.Close asChild>
                      <IconButton label={closeLabel}>
                        <X />
                      </IconButton>
                    </RadixDialog.Close>
                  )}
                </div>
              ) : null}
            </div>
            {children != null && <div className="mt-5">{children}</div>}
            {footer != null && (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>
            )}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
