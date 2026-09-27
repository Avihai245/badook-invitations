'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAdminUi } from '../AdminUi.client';

const H = 150;
const LEFT = 38;
const RIGHT = 6;
const TOP = 10;
const BOTTOM = 22;

/** The chart's chrome: the app's hairlines and muted ink (features/insights/ui/DailyColumns.tsx). */
const GRID = '#e7e5e4';
const BASELINE = '#d6d3d1';
const AXIS_TEXT = '#78716c';
/** One series: the validated first slot (blue), a darker step on hover. */
export const SERIES = { color: '#2a78d6', hover: '#1c5cab' };

export interface DayPoint {
  /** YYYY-MM-DD (Israel's day) */
  day: string;
  value: number;
}

/** A clean step for the axis: 1, 2 or 5 × a power of ten, about four gridlines up to `max`. */
export function niceStep(max: number, lines = 4): number {
  const raw = Math.max(1, max / lines);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

/**
 * One count per day as thin columns (a single series: the title names it, no legend box) — a rounded
 * top on one baseline, hairline gridlines at clean steps, a tooltip on the day under the pointer. The
 * chart is one tab stop: the arrow keys move between days (the tooltip follows, and is announced), and
 * the same numbers are a table for screen readers. Time runs left to right in both languages, like the
 * app's other charts. Drawn at the width it has.
 */
export function DayChart({
  points,
  title,
  testId,
}: {
  points: readonly DayPoint[];
  title: string;
  testId?: string;
}) {
  const { t, number, fmt, date } = useAdminUi();
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => el.clientWidth && setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...points.map((p) => p.value));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const plotW = Math.max(40, W - LEFT - RIGHT);
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.min(24, Math.max(2, slot - 2));
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 52))));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const short = (day: string) => date(day, { day: 'numeric', month: 'numeric' });
  const long = (day: string) => date(day, { day: 'numeric', month: 'long' });
  const tip = active !== null ? points[active] : null;
  const tipText = tip ? fmt(t.overview.charts.bar, { date: long(tip.day), n: number(tip.value) }) : '';
  const tipAt = active !== null ? ((LEFT + active * slot + slot / 2) / W) * 100 : 0;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    const at = active ?? last;
    const next =
      e.key === 'ArrowRight'
        ? Math.min(last, at + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <div className="relative" data-testid={testId}>
      <div
        ref={box}
        role="group"
        aria-label={title}
        aria-roledescription="chart"
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? points.length - 1)}
        onBlur={() => setActive(null)}
        className="rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          height={H}
          className="block w-full"
          aria-hidden
          style={{ direction: 'ltr' }}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((v) => {
            const y = TOP + plotH - (v / top) * plotH;
            return (
              <g key={v}>
                <line
                  x1={LEFT}
                  x2={W - RIGHT}
                  y1={y}
                  y2={y}
                  stroke={v === 0 ? BASELINE : GRID}
                  strokeWidth={1}
                />
                <text
                  x={LEFT - 6}
                  y={y}
                  fontSize={11}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill={AXIS_TEXT}
                >
                  {number(v, { notation: 'compact', maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const hgt = (p.value / top) * plotH;
            const x = LEFT + i * slot + (slot - barW) / 2;
            const y = TOP + plotH - hgt;
            const r = Math.min(4, barW / 2, hgt);
            return (
              <g key={p.day} onPointerEnter={() => setActive(i)}>
                {/* the hit area: the whole day's slot */}
                <rect x={LEFT + i * slot} y={TOP} width={slot} height={plotH} fill="transparent" />
                {p.value > 0 ? (
                  <path
                    d={`M ${x} ${TOP + plotH} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + barW - r} Q ${x + barW} ${y} ${x + barW} ${y + r} V ${TOP + plotH} Z`}
                    fill={active === i ? SERIES.hover : SERIES.color}
                  />
                ) : null}
                {/* labels counted back from today, so today always has one */}
                {(points.length - 1 - i) % labelEvery === 0 ? (
                  <text
                    x={LEFT + i * slot + slot / 2}
                    y={H - 6}
                    fontSize={11}
                    textAnchor="middle"
                    fill={AXIS_TEXT}
                  >
                    {short(p.day)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {tip ? (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-[10px] bg-inverse px-3 py-1.5 text-[12.5px] whitespace-nowrap text-white shadow-lg"
          style={{ left: `${tipAt}%`, transform: `translateX(-${tipAt}%)` }}
        >
          {tipText}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {tipText}
      </p>
      <table className="sr-only">
        <caption>{fmt(t.overview.charts.table, { title })}</caption>
        <thead>
          <tr>
            <th scope="col">{t.overview.charts.day}</th>
            <th scope="col">{title}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{long(p.day)}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
