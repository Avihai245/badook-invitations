'use client';

import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useFieldControl } from './Field';
import { cn, iconSlot } from './utils';

// app.html `.input/.select/.textarea`: 40px, radius 10, 1px line, surface, 0 12px, 14px;
// focus = ink border + 3px ring (no outline); invalid = danger border (+ danger ring on focus).
const control = cn(
  'w-full rounded-input border bg-surface text-[14px] text-ink placeholder:text-faint',
  'transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none focus:outline-hidden',
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
);
const stateClass = (invalid: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(185,28,28,0.12)]'
    : 'border-line focus:border-ink focus:shadow-ring';

/**
 * How a control whose `dir` differs from the layout (e.g. `dir="ltr"` email/phone/URL in the Hebrew
 * UI) aligns its text: `match-parent` (default) keeps it on the layout's start edge — right in RTL —
 * while characters still flow LTR; `start` uses the control's own start edge (left for LTR data).
 */
export type TextAlignMode = 'match-parent' | 'start';

// `text-align: match-parent` is not supported by Chromium, so: when the control's direction differs
// from its parent's, align to its own END — which is the parent's start edge.
const matchParent = '[:dir(rtl)>&:dir(ltr)]:text-end [:dir(ltr)>&:dir(rtl)]:text-end';

export type InputProps = ComponentProps<'input'> & {
  invalid?: boolean;
  /** Leading icon at the inline-start (16px, faint) — e.g. search. */
  icon?: ReactNode;
  textAlign?: TextAlignMode;
  /** Class for the wrapper rendered when `icon` is set. */
  wrapperClassName?: string;
};

export function Input({
  invalid,
  icon,
  textAlign = 'match-parent',
  className,
  wrapperClassName,
  dir,
  ...props
}: InputProps) {
  const { invalid: isInvalid, controlProps } = useFieldControl(props, invalid);
  const input = (
    <input
      dir={dir}
      {...props}
      {...controlProps}
      className={cn(
        control,
        stateClass(isInvalid),
        'h-10 px-3',
        icon != null && 'ps-[34px]',
        dir && textAlign === 'match-parent' && matchParent,
        className,
      )}
    />
  );
  if (icon == null) return input;
  return (
    // With an icon, the wrapper takes the input's `dir` so the icon and the padding share one start edge.
    <div dir={dir} className={cn('relative', wrapperClassName)}>
      <span
        aria-hidden
        className={cn(
          iconSlot,
          'pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-faint [&_svg]:size-4',
        )}
      >
        {icon}
      </span>
      {input}
    </div>
  );
}

export type SelectProps = ComponentProps<'select'> & {
  invalid?: boolean;
  textAlign?: TextAlignMode;
  wrapperClassName?: string;
};

/** Native select (keeps the OS picker) with the input look and a chevron at the inline-end. */
export function Select({
  invalid,
  textAlign = 'match-parent',
  className,
  wrapperClassName,
  dir,
  children,
  ...props
}: SelectProps) {
  const { invalid: isInvalid, controlProps } = useFieldControl(props, invalid);
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        dir={dir}
        {...props}
        {...controlProps}
        className={cn(
          control,
          stateClass(isInvalid),
          'h-10 cursor-pointer appearance-none ps-3 pe-9 disabled:cursor-not-allowed',
          dir && textAlign === 'match-parent' && matchParent,
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.75}
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export type TextareaProps = ComponentProps<'textarea'> & {
  invalid?: boolean;
  textAlign?: TextAlignMode;
};

/** app.html `.textarea`: min-height 88, padding 10px 12px, vertical resize. */
export function Textarea({ invalid, textAlign = 'match-parent', className, dir, ...props }: TextareaProps) {
  const { invalid: isInvalid, controlProps } = useFieldControl(props, invalid);
  return (
    <textarea
      dir={dir}
      {...props}
      {...controlProps}
      className={cn(
        control,
        stateClass(isInvalid),
        'block min-h-[88px] resize-y px-3 py-2.5',
        dir && textAlign === 'match-parent' && matchParent,
        className,
      )}
    />
  );
}
