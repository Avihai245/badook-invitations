import type { ReactNode } from 'react';

export type BarsRow = {
  /** Stable key (defaults to the index). */
  key?: string;
  label: ReactNode;
  value: number;
};

export type BarsProps = {
  rows: readonly BarsRow[];
  /** 14px/700 title above the rows. */
  title?: ReactNode;
  titleAs?: 'h2' | 'h3' | 'h4';
  /** Scale maximum (default: the largest value). */
  max?: number;
  /** Formats the number column (default: Intl with western digits). */
  formatValue?: (value: number) => ReactNode;
  /** Width of the label column in px (default 120). */
  labelWidth?: number;
  className?: string;
};

const defaultFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/**
 * Horizontal bar list (app.html `.bars`): rows `120px 1fr 36px`, gap 10, 13px; 8px subtle track,
 * ink fill (radius 999) growing from the inline-START — the track is a flex row, so it mirrors in
 * RTL; number end-aligned, tabular, muted. Wrap in `<Card padding="md">` for the dashboard look.
 */
export function Bars({
  rows,
  title,
  titleAs: Title = 'h3',
  max,
  formatValue,
  labelWidth = 120,
  className,
}: BarsProps) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value));
  return (
    <div className={className}>
      {/* 14px: in app.html the h3 margin (14) collapses with the first row's top margin (10). */}
      {title != null && <Title className="mb-3.5 text-[14px] font-bold">{title}</Title>}
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const pct = top > 0 ? Math.min(100, Math.max(0, (row.value / top) * 100)) : 0;
          return (
            <li
              key={row.key ?? index}
              className="grid items-center gap-2.5 text-[13px]"
              style={{ gridTemplateColumns: `${labelWidth}px minmax(0, 1fr) 36px` }}
            >
              <span className="truncate">{row.label}</span>
              <span aria-hidden className="flex h-2 overflow-hidden rounded-full bg-subtle">
                <span
                  className="h-full rounded-full bg-ink transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-end text-muted tabular-nums">
                {formatValue ? formatValue(row.value) : defaultFormat.format(row.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
