'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { cn } from './utils';

export type DataTableAlign = 'start' | 'center' | 'end';

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Defaults to `center` for numeric columns, else `start`. */
  align?: DataTableAlign;
  /** Tabular digits + centered (app.html `.num`). */
  numeric?: boolean;
  /** Cell renderer; without it the cell shows `row[key]` when it is a string or number. */
  cell?: (row: T, index: number) => ReactNode;
  /** Column width (px number or any CSS length). */
  width?: number | string;
  /** Extra classes for this column's cells (e.g. truncation). */
  className?: string;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T, index: number) => string | number;
  /**
   * Makes rows clickable: the whole row with a pointer, and a real button in the row's first cell for
   * keyboards and screen readers (Tab, then Enter/Space).
   */
  onRowClick?: (row: T, index: number) => void;
  /** The accessible name of a clickable row's button, e.g. "פרטי התשובה של דנה כהן" (default: its cell). */
  rowLabel?: (row: T, index: number) => string;
  /** Rendered in a full-width cell when `rows` is empty (e.g. `<EmptyState>`). */
  empty?: ReactNode;
  /** Shows skeleton rows instead of data. */
  loading?: boolean;
  skeletonRows?: number;
  /** Visually hidden table caption (accessible name). */
  caption?: ReactNode;
  /** `data-*` attributes for a row (tests, styling hooks). */
  rowData?: (row: T, index: number) => Record<`data-${string}`, string>;
  className?: string;
};

const ALIGN: Record<DataTableAlign, string> = { start: 'text-start', center: 'text-center', end: 'text-end' };

function defaultCell<T>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/**
 * Data table (app.html responses table): 13px; header row on the canvas bg, th 600 muted, 10px 12px;
 * td 12px padding; 1px line row borders; hover tint; numeric columns centered + tabular. Scrolls
 * horizontally inside its own box on narrow screens.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowLabel,
  empty,
  loading = false,
  skeletonRows = 5,
  caption,
  rowData,
  className,
}: DataTableProps<T>) {
  const alignOf = (c: DataTableColumn<T>) => ALIGN[c.align ?? (c.numeric ? 'center' : 'start')];
  const widthOf = (c: DataTableColumn<T>): CSSProperties | undefined =>
    c.width !== undefined ? { width: c.width } : undefined;
  const cellOf = (c: DataTableColumn<T>, row: T, index: number) =>
    c.cell ? c.cell(row, index) : defaultCell(row, c.key);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]" aria-busy={loading || undefined}>
        {caption != null && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={widthOf(c)}
                className={cn(
                  'border-b border-line bg-canvas px-3 py-2.5 font-semibold whitespace-nowrap text-muted',
                  alignOf(c),
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {loading ? (
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((c, ci) => (
                  <td key={c.key} className="border-b border-line p-3 align-middle">
                    <Skeleton
                      shape="line"
                      width={c.numeric ? 20 : ci === 0 ? '70%' : '50%'}
                      height={10}
                      className={cn(c.numeric && 'mx-auto')}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                {...rowData?.(row, index)}
                // the pointer: anywhere on the row (the button below is the row for keyboards and AT)
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                className={cn(
                  'transition-colors duration-100 hover:bg-row-hover motion-reduce:transition-none',
                  onRowClick && 'cursor-pointer has-[:focus-visible]:bg-row-hover',
                )}
              >
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    style={widthOf(c)}
                    className={cn(
                      'border-b border-line p-3 align-middle',
                      alignOf(c),
                      c.numeric && 'tabular-nums',
                      c.className,
                    )}
                  >
                    {onRowClick && ci === 0 ? (
                      <button
                        type="button"
                        aria-label={rowLabel?.(row, index)}
                        data-row-action=""
                        onClick={(event) => {
                          event.stopPropagation();
                          onRowClick(row, index);
                        }}
                        className="-m-1 max-w-full rounded-[6px] p-1 text-start [font:inherit] text-inherit focus-visible:outline-2 focus-visible:outline-offset-0"
                      >
                        {cellOf(c, row, index)}
                      </button>
                    ) : (
                      cellOf(c, row, index)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
