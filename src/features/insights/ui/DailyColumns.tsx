'use client';

import { useEffect, useRef, useState } from 'react';
import { useUi } from '@/lib/i18n/client';

const H = 170;
const LEFT = 30;
const RIGHT = 8;
const TOP = 10;
const BOTTOM = 24;

/** Chart chrome (the app's hairlines and muted ink — see features/event-day/ui/live/Timeline.tsx). */
const GRID = '#e7e5e4';
const BASELINE = '#d6d3d1';
const AXIS_TEXT = '#78716c';

export interface DailyPoint {
  day: string;
  value: number;
}

/**
 * One count per day as thin columns (a single series — no legend box; the title names it): a rounded
 * top growing from one baseline, hairline gridlines, clean ticks, a tooltip on each column (and on
 * keyboard focus, the whole day's slot is the target), and the same numbers as a table for screen
 * readers. Drawn at the width it has. `color`: the series' mark color (the text stays in ink).
 */
export function DailyColumns({
  points,
  color,
  hover: hoverColor,
  title,
  dayLabel,
  tooltip,
  tableCaption,
  tableDay,
}: {
  points: readonly DailyPoint[];
  color: string;
  hover: string;
  title: string;
  /** a day's short label under the axis ("17.6") */
  dayLabel(day: string): string;
  /** a column's tooltip ("17 June: 12") */
  tooltip(point: DailyPoint): string;
  tableCaption: string;
  tableDay: string;
}) {
  const { number } = useUi();
  const [hover, setHover] = useState<number | null>(null);
  const figure = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = figure.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => el.clientWidth && setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(1, ...points.map((p) => p.value));
  const step =
    max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 25 : max <= 250 ? 50 : 100;
  const top = Math.ceil(max / step) * step;
  const plotW = Math.max(40, W - LEFT - RIGHT);
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.min(24, Math.max(2, slot - 2));
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 48))));
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const tip = hover !== null ? points[hover] : null;
  const tipAt = hover !== null ? ((LEFT + hover * slot + slot / 2) / W) * 100 : 0;
  return (
    <div ref={figure} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={H}
        className="block w-full"
        role="img"
        aria-label={title}
        style={{ direction: 'ltr' }}
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
                {number(v)}
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
            <g
              key={p.day}
              tabIndex={0}
              role="img"
              aria-label={tooltip(p)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
              className="outline-none"
            >
              {/* the hit area: the whole day's slot */}
              <rect x={LEFT + i * slot} y={TOP} width={slot} height={plotH} fill="transparent" />
              {p.value > 0 ? (
                <path
                  d={`M ${x} ${TOP + plotH} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + barW - r} Q ${x + barW} ${y} ${x + barW} ${y + r} V ${TOP + plotH} Z`}
                  fill={hover === i ? hoverColor : color}
                />
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  x={LEFT + i * slot + slot / 2}
                  y={H - 7}
                  fontSize={11}
                  textAnchor="middle"
                  fill={AXIS_TEXT}
                >
                  {dayLabel(p.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {tip ? (
        <div
          role="status"
          className="pointer-events-none absolute top-1 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] whitespace-nowrap text-white shadow-lg"
          style={{ left: `${tipAt}%`, transform: `translateX(-${tipAt}%)` }}
        >
          {tooltip(tip)}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{tableDay}</th>
            <th scope="col">{title}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{dayLabel(p.day)}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
