'use client';

import { useId, type ReactNode } from 'react';
import { rovingKeyDown } from './roving';
import { cn } from './utils';

export type L10nTabsOption<V extends string> = {
  value: V;
  /** Short tab text, e.g. `עב` / `EN`. */
  label: ReactNode;
  /** Shows the amber dot: this locale has no translation yet. */
  missing?: boolean;
  /** Full accessible name, e.g. "English". */
  ariaLabel?: string;
  /** `lang` of the label so screen readers pronounce it right. */
  lang?: string;
};

export type L10nTabsProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  options: readonly L10nTabsOption<V>[];
  /** Accessible name of the group, e.g. "שפת השדה". */
  label: string;
  /** Tooltip + screen-reader text for the missing dot, e.g. "חסר תרגום". */
  missingLabel?: string;
  className?: string;
};

/**
 * Tiny locale switch beside a field label (app.html `.l10n-tabs`): 22px tabs, 11px/600, subtle track
 * (radius 6, padding 2); active = surface + shadow-sm. A 5px warning dot sits at the tab's top
 * inline-end when that locale is missing.
 */
export function L10nTabs<V extends string>({
  value,
  onValueChange,
  options,
  label,
  missingLabel,
  className,
}: L10nTabsProps<V>) {
  const missingId = useId();
  const tabStop = options.some((o) => o.value === value) ? value : options[0]?.value;
  const anyMissing = options.some((o) => o.missing);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={rovingKeyDown}
      className={cn('inline-flex shrink-0 gap-0.5 rounded-[6px] bg-subtle p-0.5', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            aria-describedby={option.missing && missingLabel ? missingId : undefined}
            lang={option.lang}
            title={option.missing ? missingLabel : undefined}
            tabIndex={option.value === tabStop ? 0 : -1}
            data-roving-item=""
            onClick={() => {
              if (!checked) onValueChange(option.value);
            }}
            className={cn(
              'relative h-[22px] rounded-[4px] px-2 text-[11px] font-semibold transition-colors duration-150 motion-reduce:transition-none',
              checked ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.missing && (
              <span aria-hidden className="absolute end-[3px] top-[3px] size-[5px] rounded-full bg-warning" />
            )}
          </button>
        );
      })}
      {anyMissing && missingLabel && (
        <span id={missingId} hidden>
          {missingLabel}
        </span>
      )}
    </div>
  );
}
