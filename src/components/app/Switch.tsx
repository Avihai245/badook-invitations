'use client';

import { useState, type ComponentProps } from 'react';
import { cn } from './utils';

export type SwitchProps = Omit<ComponentProps<'button'>, 'onChange' | 'value' | 'children' | 'aria-label'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Accessible name (aria-label). Pass `aria-labelledby` as well to point at a visible label. */
  label: string;
};

/**
 * app.html `.switch`: 36×20 track (line-strong off, ink on), 16px white knob. The knob sits at the
 * inline-start and moves to the inline-END when on — via `inset-inline-start`, so it mirrors in RTL.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  label,
  disabled,
  className,
  onClick,
  ...props
}: SwitchProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const on = checked ?? uncontrolled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (checked === undefined) setUncontrolled(!on);
        onCheckedChange?.(!on);
      }}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none',
        on ? 'bg-ink' : 'bg-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
          'transition-[inset-inline-start] duration-150 motion-reduce:transition-none',
          on ? 'start-[18px]' : 'start-0.5',
        )}
      />
    </button>
  );
}
