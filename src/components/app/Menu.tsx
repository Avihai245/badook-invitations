'use client';

import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { useDir, type Dir } from './direction';
import { cn, iconSlot } from './utils';

export type MenuItem =
  | {
      type?: 'item';
      label: ReactNode;
      /** 16px icon at the inline-start. */
      icon?: ReactNode;
      onSelect?: () => void;
      /** Renders the item as a Next link. */
      href?: string;
      danger?: boolean;
      disabled?: boolean;
    }
  | { type: 'separator' };

export type MenuProps = {
  /** The trigger, usually an `<IconButton label="…">` (⋯). */
  trigger: ReactElement;
  items: readonly MenuItem[];
  align?: 'start' | 'center' | 'end';
  dir?: Dir;
  className?: string;
};

const item = cn(
  'flex h-9 cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[14px] outline-none select-none',
  'data-[highlighted]:bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
);

/**
 * Dropdown menu (card ⋯ menus, list items): surface, radius 12, shadow-lg, 36px items with an icon
 * slot, danger items in red. Radix DropdownMenu — roving focus, typeahead, Esc, RTL-aware.
 */
export function Menu({ trigger, items, align = 'end', dir: dirProp, className }: MenuProps) {
  const dir = useDir(dirProp);
  return (
    <DropdownMenu.Root dir={dir} modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-[70] min-w-[190px] rounded-card border border-line bg-surface p-1 text-ink shadow-lg',
            'motion-safe:data-[state=open]:animate-app-fade-in',
            className,
          )}
        >
          <div dir={dir}>
            {items.map((entry, i) => {
              if (entry.type === 'separator')
                return <DropdownMenu.Separator key={`sep-${i}`} className="mx-1 my-1 h-px bg-line" />;
              const content = (
                <>
                  {entry.icon != null ? (
                    <span
                      aria-hidden
                      className={cn(iconSlot, 'text-muted [&_svg]:size-4', entry.danger && 'text-danger')}
                    >
                      {entry.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                </>
              );
              return (
                <DropdownMenu.Item
                  key={i}
                  disabled={entry.disabled}
                  onSelect={entry.onSelect}
                  asChild={!!entry.href}
                  className={cn(item, entry.danger && 'text-danger')}
                >
                  {entry.href ? <Link href={entry.href}>{content}</Link> : content}
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
