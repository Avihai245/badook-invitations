'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';

/** Chart chrome: the app's hairlines and muted ink (see features/insights/ui/DailyColumns.tsx). */
const GRID = '#e7e5e4';
const BASELINE = '#d6d3d1';
const AXIS_TEXT = '#78716c';
const TOP = 12;
const BOTTOM = 26;
const RIGHT = 8;
/** the space between two segments of one column: the surface shows through */
const GAP = 2;

export interface ColumnSeries<K extends string> {
  key: K;
  label: string;
  /** the mark's color (text always stays in ink) */
  color: string;
}

export type ColumnRow<K extends string> = { day: string } & Record<K, number>;

/** A clean step for about four gridlines (1, 2, 2.5, 5 × 10ⁿ). */
function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return Math.max(1, m * pow);
  return 10 * pow;
}

/**
 * Columns per day, stacked by series (one series: plain columns, no legend — the title names it).
 * Thin marks (at most 24px, 4px rounded tops) from one baseline, a 2px gap between segments, hairline
 * gridlines at clean steps. One tab stop: arrow keys move across the days (Home, End), the pointer
 * too; the tooltip leads with the values. Under the chart, the same numbers as a table. Drawn at the
 * width it has; time runs left to right in both languages.
 */
export function StackedColumns<K extends string>({
  rows,
  series,
  title,
  dayLabel,
  dayLong,
  format,
  formatAxis = format,
  tableLabel,
  dayHeader,
  totalLabel,
  hint,
  height = 190,
  testId,
}: {
  rows: readonly ColumnRow<K>[];
  /** bottom to top */
  series: readonly ColumnSeries<K>[];
  /** the chart's accessible name */
  title: string;
  /** a day's short label under the axis */
  dayLabel(day: string): string;
  /** a day in the tooltip and the table */
  dayLong(day: string): string;
  format(n: number): string;
  formatAxis?(n: number): string;
  /** the table's toggle and caption */
  tableLabel: string;
  dayHeader: string;
  /** the tooltip's and the table's total, when there are several series */
  totalLabel?: string;
  /** how to move across the days with the keyboard (read out with the chart) */
  hint: string;
  height?: number;
  testId?: string;
}) {
  const { dir } = useAdminUi();
  const hintId = useId();
  const figure = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const el = figure.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => el.clientWidth && setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const H = height;
  const totals = rows.map((r) => series.reduce((a, s) => a + (r[s.key] ?? 0), 0));
  const max = Math.max(0, ...totals);
  const step = max > 0 ? niceStep(max) : 1;
  const top = max > 0 ? Math.ceil(max / step) * step : 4;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const LEFT = Math.max(28, 8 + Math.max(...ticks.map((v) => formatAxis(v).length)) * 6.5);
  const plotW = Math.max(40, W - LEFT - RIGHT);
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / Math.max(1, rows.length);
  const barW = Math.min(24, Math.max(2, slot * 0.72));
  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(plotW / 58))));
  const y = (v: number) => TOP + plotH - (v / top) * plotH;
  const multi = series.length > 1;

  const move = (to: number) => setActive(Math.max(0, Math.min(rows.length - 1, to)));
  const onKey = (e: KeyboardEvent) => {
    const at = active ?? rows.length - 1;
    // the chart runs left to right in both languages
    if (e.key === 'ArrowRight') move(at + 1);
    else if (e.key === 'ArrowLeft') move(at - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(rows.length - 1);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W - LEFT;
    if (x < 0 || x > plotW) return setActive(null);
    move(Math.floor(x / slot));
  };

  const tip = active !== null ? rows[active] : null;
  const tipAt = active !== null ? ((LEFT + active * slot + slot / 2) / W) * 100 : 0;
  return (
    <div data-testid={testId}>
      {multi ? (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div
        ref={figure}
        className="relative rounded-[8px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        tabIndex={0}
        role="group"
        aria-label={title}
        aria-describedby={hintId}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? rows.length - 1)}
        onBlur={() => setActive(null)}
      >
        <span id={hintId} className="sr-only">
          {hint}
        </span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          height={H}
          className="block w-full touch-pan-y"
          aria-hidden
          style={{ direction: 'ltr' }}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? BASELINE : GRID}
                strokeWidth={1}
              />
              <text
                x={LEFT - 6}
                y={y(v)}
                fontSize={11}
                textAnchor="end"
                dominantBaseline="central"
                fill={AXIS_TEXT}
                className="tabular-nums"
              >
                {formatAxis(v)}
              </text>
            </g>
          ))}
          {active !== null ? (
            <rect
              x={LEFT + active * slot}
              y={TOP}
              width={slot}
              height={plotH}
              fill="#1c1917"
              opacity={0.05}
            />
          ) : null}
          {rows.map((r, i) => {
            const x = LEFT + i * slot + (slot - barW) / 2;
            let base = 0;
            const drawn = series.filter((s) => (r[s.key] ?? 0) > 0);
            return (
              <g key={r.day}>
                {drawn.map((s, si) => {
                  const v = r[s.key];
                  const y0 = y(base);
                  base += v;
                  const y1 = y(base);
                  const last = si === drawn.length - 1;
                  // the gap under every segment but the first shows the surface between them
                  const bottom = si === 0 ? y0 : y0 - GAP / 2;
                  const topY = last ? y1 : y1 + GAP / 2;
                  const h = bottom - topY;
                  if (h <= 0.5) return null;
                  const rr = last ? Math.min(4, barW / 2, h) : 0;
                  return (
                    <path
                      key={s.key}
                      d={`M ${x} ${bottom} V ${topY + rr} Q ${x} ${topY} ${x + rr} ${topY} H ${x + barW - rr} Q ${x + barW} ${topY} ${x + barW} ${topY + rr} V ${bottom} Z`}
                      fill={s.color}
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  );
                })}
                {i % labelEvery === 0 ? (
                  <text
                    x={LEFT + i * slot + slot / 2}
                    y={H - 8}
                    fontSize={11}
                    textAnchor="middle"
                    fill={AXIS_TEXT}
                  >
                    {dayLabel(r.day)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div
          role="status"
          className={cn(
            'pointer-events-none absolute top-1 z-10 max-w-[240px] rounded-[10px] bg-inverse px-3 py-2 text-[12.5px] text-white shadow-lg',
            !tip && 'sr-only',
          )}
          style={tip ? { left: `${tipAt}%`, transform: `translateX(-${tipAt}%)` } : undefined}
          dir={dir}
        >
          {tip ? (
            <>
              <span className="block font-semibold">{dayLong(tip.day)}</span>
              {multi ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {[...series].reverse().map((s) => (
                    <li key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                      <span className="font-semibold tabular-nums">{format(tip[s.key] ?? 0)}</span>
                      <span className="text-white/75">{s.label}</span>
                    </li>
                  ))}
                  {totalLabel ? (
                    <li className="mt-0.5 flex gap-2 border-t border-white/20 pt-0.5 whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{format(totals[active!] ?? 0)}</span>
                      <span className="text-white/75">{totalLabel}</span>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <span className="block font-semibold tabular-nums">{format(tip[series[0]!.key] ?? 0)}</span>
              )}
            </>
          ) : null}
        </div>
      </div>
      <details className="group mt-2 text-[13px]">
        <summary className="inline-flex cursor-pointer items-center gap-1 rounded-btn px-1 py-0.5 text-muted hover:text-ink">
          {tableLabel}
        </summary>
        {/* (it scrolls: a region a keyboard can reach) */}
        <div
          role="region"
          aria-label={tableLabel}
          tabIndex={0}
          className="mt-2 max-h-[320px] overflow-auto rounded-[10px] border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">{tableLabel}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 bg-canvas px-3 py-2 text-start font-semibold text-muted"
                >
                  {dayHeader}
                </th>
                {series.map((s) => (
                  <th
                    key={s.key}
                    scope="col"
                    className="sticky top-0 bg-canvas px-3 py-2 text-end font-semibold whitespace-nowrap text-muted"
                  >
                    {s.label}
                  </th>
                ))}
                {multi && totalLabel ? (
                  <th
                    scope="col"
                    className="sticky top-0 bg-canvas px-3 py-2 text-end font-semibold text-muted"
                  >
                    {totalLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.day} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-start font-normal whitespace-nowrap">
                    {dayLong(r.day)}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-end tabular-nums">
                      {format(r[s.key] ?? 0)}
                    </td>
                  ))}
                  {multi && totalLabel ? (
                    <td className="px-3 py-1.5 text-end font-semibold tabular-nums">
                      {format(totals[i] ?? 0)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
