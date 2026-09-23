'use client';

import type { ComponentProps } from 'react';
import { rovingKeyDown } from './roving';
import { cn } from './utils';

export type ColorSwatchProps = Omit<ComponentProps<'button'>, 'color' | 'children' | 'aria-label'> & {
  /** Any CSS color. */
  color: string;
  /** Accessible name + hover title, e.g. "בורדו". */
  label: string;
  selected?: boolean;
  /** Diameter in px (default 28). */
  size?: number;
};

// Selected = 2px ink ring with a 2px surface gap; the focus outline sits outside the ring.
const swatchClass = (selected: boolean) =>
  cn(
    'inline-block shrink-0 rounded-full border border-black/8 transition-shadow duration-150 motion-reduce:transition-none',
    'focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50',
    selected && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
  );

/** Round color swatch (§9B.2) — a toggle button (`aria-pressed`). Use `SwatchGroup` for single-select. */
export function ColorSwatch({
  color,
  label,
  selected = false,
  size = 28,
  className,
  style,
  type = 'button',
  ...props
}: ColorSwatchProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={cn(swatchClass(selected), className)}
      style={{ backgroundColor: color, width: size, height: size, ...style }}
      {...props}
    />
  );
}

export type SwatchOption<V extends string> = { value: V; color: string; label: string };

export type SwatchGroupProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  options: readonly SwatchOption<V>[];
  /** Accessible name of the group, e.g. "צבע החותם". */
  label: string;
  size?: number;
  className?: string;
};

/** Single-select row of swatches: radiogroup semantics, arrows follow the visual order (RTL-aware). */
export function SwatchGroup<V extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 28,
  className,
}: SwatchGroupProps<V>) {
  const tabStop = options.some((o) => o.value === value) ? value : options[0]?.value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={rovingKeyDown}
      className={cn('flex flex-wrap gap-2.5 p-1', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            tabIndex={option.value === tabStop ? 0 : -1}
            data-roving-item=""
            onClick={() => onValueChange(option.value)}
            className={swatchClass(checked)}
            style={{ backgroundColor: option.color, width: size, height: size }}
          />
        );
      })}
    </div>
  );
}

export type PaletteDotsProps = {
  /** Rendered in this order (start → end): background, accent, ink — as on the gallery cards. */
  palette: { bg: string; accent: string; ink: string };
  /** When set, the dots are exposed as one image with this name; otherwise decorative. */
  label?: string;
  /** Dot diameter in px (default 14). */
  size?: number;
  className?: string;
};

/** Three palette dots (app.html `.swatches`): 14px, 1px rgba(0,0,0,.08) border, gap 4. */
export function PaletteDots({ palette, label, size = 14, className }: PaletteDotsProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 gap-1', className)}
    >
      {[palette.bg, palette.accent, palette.ink].map((color, index) => (
        <span
          key={index}
          className="shrink-0 rounded-full border border-black/8"
          style={{ backgroundColor: color, width: size, height: size }}
        />
      ))}
    </span>
  );
}
