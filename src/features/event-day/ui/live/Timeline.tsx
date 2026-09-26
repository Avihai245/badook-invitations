'use client';

import { useEffect, useRef, useState } from 'react';
import { useUi } from '@/lib/i18n/client';
import type { TimelineBar } from '../../live';

const H = 190;
const LEFT = 30;
const RIGHT = 8;
const TOP = 10;
const BOTTOM = 24;

/**
 * Arrivals over time: one column per 5 minutes (a single series — no legend box; the title names it),
 * thin columns with a rounded top growing from one baseline, hairline gridlines, a tooltip on each
 * column (and on keyboard focus), and the same numbers as a table for screen readers. Drawn at the
 * width it has (a phone's text is as big as a desktop's).
 */
export function Timeline({
  bars,
  bucketMinutes,
  timeZone,
}: {
  bars: readonly TimelineBar[];
  bucketMinutes: number;
  /** the event's zone (the times on the axis are the venue's) */
  timeZone?: string;
}) {
  const { t, fmt, number, date } = useUi();
  const tl = t.eventDay.timeline;
  const [hover, setHover] = useState<number | null>(null);
  const figure = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = figure.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => el.clientWidth && setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bars.length]);

  if (!bars.length) return <p className="py-6 text-center text-[13px] text-muted">{tl.empty}</p>;
  const max = Math.max(1, ...bars.map((b) => b.people));
  // clean ticks: 0, a round top
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : 25;
  const top = Math.ceil(max / step) * step;
  const plotW = W - LEFT - RIGHT;
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / bars.length;
  const barW = Math.min(24, Math.max(3, slot - 2));
  const time = (ms: number) => date(ms, { hour: '2-digit', minute: '2-digit', timeZone });
  const label = (b: TimelineBar) =>
    fmt(tl.bar, {
      from: time(b.at),
      to: time(b.at + bucketMinutes * 60_000),
      people: number(b.people),
      parties: number(b.parties),
    });
  // a time under every few columns: as many as fit
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(1, Math.floor(plotW / 56))));
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const tip = hover !== null ? bars[hover] : null;
  // the tooltip over its column, kept inside the chart at both ends
  const tipAt = hover !== null ? ((LEFT + hover * slot + slot / 2) / W) * 100 : 0;
  return (
    <figure ref={figure} className="relative m-0">
      <figcaption className="text-[12.5px] text-muted">{tl.caption}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={H}
        className="mt-2 block w-full"
        role="img"
        aria-label={tl.title}
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
                stroke={v === 0 ? '#d6d3d1' : '#e7e5e4'}
                strokeWidth={1}
              />
              <text
                x={LEFT - 6}
                y={y}
                fontSize={11}
                textAnchor="end"
                dominantBaseline="central"
                fill="#78716c"
              >
                {number(v)}
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const hgt = (b.people / top) * plotH;
          const x = LEFT + i * slot + (slot - barW) / 2;
          const y = TOP + plotH - hgt;
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g
              key={b.at}
              tabIndex={0}
              role="img"
              aria-label={label(b)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
              className="outline-none"
            >
              {/* the hit area: the whole column's slot */}
              <rect x={LEFT + i * slot} y={TOP} width={slot} height={plotH} fill="transparent" />
              {b.people > 0 ? (
                <path
                  d={`M ${x} ${TOP + plotH} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + barW - r} Q ${x + barW} ${y} ${x + barW} ${y + r} V ${TOP + plotH} Z`}
                  fill={hover === i ? '#15803d' : '#22c55e'}
                />
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  x={LEFT + i * slot + slot / 2}
                  y={H - 7}
                  fontSize={11}
                  textAnchor="middle"
                  fill="#78716c"
                >
                  {time(b.at)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {tip ? (
        <div
          role="status"
          className="pointer-events-none absolute top-6 rounded-[10px] bg-ink px-3 py-2 text-[12.5px] whitespace-nowrap text-white shadow-lg"
          style={{ left: `${tipAt}%`, transform: `translateX(-${tipAt}%)` }}
        >
          {label(tip)}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{tl.table}</caption>
        <thead>
          <tr>
            <th scope="col">{tl.time}</th>
            <th scope="col">{tl.people}</th>
            <th scope="col">{tl.families}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.at}>
              <td>{time(b.at)}</td>
              <td>{b.people}</td>
              <td>{b.parties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
