'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './utils';

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** Native checkbox + label (13px), ink accent; the whole row is the click target. */
export function Checkbox({ checked, onCheckedChange, label, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-8 cursor-pointer items-center gap-2 text-[13px]',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="size-4 shrink-0 accent-ink"
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}
