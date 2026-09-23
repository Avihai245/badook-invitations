'use client';

import type { ReactNode } from 'react';
import { useFieldContext } from './Field';
import { rovingKeyDown } from './roving';
import { cn, iconSlot } from './utils';

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  /** 14px icon before the label. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Accessible name when the label is not descriptive enough (e.g. "EN"). */
  ariaLabel?: string;
};

export type SegmentedProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  options: readonly SegmentedOption<V>[];
  /** Accessible name of the group. Inside a `<Field>` the field label is used when omitted. */
  label?: string;
  /** Stretch to the container width with equal items (app.html "כותרת" field). */
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * app.html `.seg`: subtle track (radius 8, padding 3, gap 2), 28px items, 13px muted; the active item
 * is surface + shadow-sm + ink/600. Radiogroup semantics; arrow keys follow the visual order (RTL-aware).
 */
export function Segmented<V extends string>({
  value,
  onValueChange,
  options,
  label,
  fullWidth = false,
  disabled = false,
  className,
}: SegmentedProps<V>) {
  const field = useFieldContext();
  const enabled = options.filter((o) => !o.disabled && !disabled);
  const tabStop = enabled.some((o) => o.value === value) ? value : enabled[0]?.value;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={label ? undefined : field?.labelId}
      aria-describedby={field?.describedBy}
      aria-disabled={disabled || undefined}
      onKeyDown={rovingKeyDown}
      className={cn(
        fullWidth ? 'flex w-full' : 'inline-flex',
        'gap-[2px] rounded-btn bg-subtle p-[3px]',
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const off = disabled || option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            disabled={off}
            tabIndex={option.value === tabStop ? 0 : -1}
            data-roving-item=""
            onClick={() => {
              if (!checked) onValueChange(option.value);
            }}
            className={cn(
              'inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[6px] px-2.5 text-[13px] whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
              fullWidth && 'flex-1',
              checked ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted',
              off ? 'cursor-not-allowed opacity-50' : !checked && 'hover:text-ink',
            )}
          >
            {option.icon != null && (
              <span aria-hidden className={cn(iconSlot, '[&_svg]:size-3.5')}>
                {option.icon}
              </span>
            )}
            <StableWeight>{option.label}</StableWeight>
          </button>
        );
      })}
    </div>
  );
}

/** Reserves the semibold width so switching the active item never shifts its neighbours. */
export function StableWeight({ children }: { children: ReactNode }) {
  return (
    <span className="grid justify-items-center">
      <span className="col-start-1 row-start-1">{children}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
        {children}
      </span>
    </span>
  );
}
