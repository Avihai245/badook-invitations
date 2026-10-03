'use client';

import { Star } from 'lucide-react';
import { cn, rovingKeyDown } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

const FIVE = [1, 2, 3, 4, 5] as const;

/** A rating as it reads: filled stars, for a card or a table (the number is in its label). */
export function StarsDisplay({ value, className }: { value: number | null; className?: string }) {
  const { t, fmt } = useUi();
  const C = t.planning.vendors.card;
  return (
    <span
      role="img"
      aria-label={value ? fmt(C.rated, { n: value }) : C.unrated}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {FIVE.map((n) => (
        <Star
          key={n}
          aria-hidden
          strokeWidth={1.75}
          className={cn('size-3.5', value && n <= value ? 'fill-current text-warning' : 'text-faint')}
        />
      ))}
    </span>
  );
}

/**
 * A rating of one to five stars to give: a radio group (arrows move and choose, in the visual order),
 * every star a 44px target. Choosing the star already chosen takes the rating back.
 */
export function Stars({
  value,
  onChange,
  label,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  /** the group's name (what is being rated) */
  label?: string;
  className?: string;
}) {
  const { t, plural } = useUi();
  const S = t.planning.vendors.stars;
  const tabStop = value ?? 1;
  return (
    <div
      role="radiogroup"
      aria-label={label ?? S.label}
      onKeyDown={rovingKeyDown}
      className={cn('inline-flex items-center', className)}
    >
      {FIVE.map((n) => {
        const checked = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={plural(S.option, n)}
            tabIndex={n === tabStop ? 0 : -1}
            data-roving-item=""
            onClick={() => onChange(checked ? null : n)}
            className="grid size-11 place-items-center rounded-btn text-faint hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus motion-reduce:transition-none"
          >
            <Star
              aria-hidden
              strokeWidth={1.75}
              className={cn('size-6', value && n <= value ? 'fill-current text-warning' : 'text-faint')}
            />
          </button>
        );
      })}
    </div>
  );
}
