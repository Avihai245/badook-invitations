'use client';

import type { ReactNode } from 'react';
import { Field, Input } from '@/components/app';

/** A shekel amount the host types (kept as text while they type; model/budget-view parseAmount reads it). */
export function MoneyField({
  label,
  value,
  onChange,
  error,
  help,
  disabled,
  onBlur,
  placeholder = '0',
  unit = '₪',
  className,
}: {
  label: ReactNode;
  value: string;
  onChange: (text: string) => void;
  error?: ReactNode;
  help?: ReactNode;
  disabled?: boolean;
  onBlur?: () => void;
  placeholder?: string;
  /** the sign before the number: ₪, or % for a rate */
  unit?: string;
  className?: string;
}) {
  return (
    <Field label={label} error={error} help={help} className={className}>
      <Input
        dir="ltr"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        icon={<span className="text-[13px] font-semibold text-muted">{unit}</span>}
      />
    </Field>
  );
}

/** A whole number (guests, tables). */
export function CountField({
  label,
  value,
  onChange,
  error,
  disabled,
  onBlur,
  className,
}: {
  label: ReactNode;
  value: string;
  onChange: (text: string) => void;
  error?: ReactNode;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
}) {
  return (
    <Field label={label} error={error} className={className}>
      <Input
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder="0"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </Field>
  );
}

/** A whole number from what was typed; '' is nothing (null), anything else that is not 0…max is undefined. */
export function parseCount(text: string, max: number): number | null | undefined {
  const s = text.trim();
  if (s === '') return null;
  if (!/^\d{1,6}$/.test(s)) return undefined;
  const n = Number(s);
  return n <= max ? n : undefined;
}
