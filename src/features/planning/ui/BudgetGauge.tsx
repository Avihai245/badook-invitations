'use client';

import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { shekels } from '../model/budget';
import {
  GAUGE_MAX,
  GAUGE_ZONES,
  gaugeArc,
  gaugePoint,
  readGauge,
  type GaugeInput,
  type GaugeZone,
} from '../model/gauge';
import { Money } from './Money';

export type GaugeSize = 'lg' | 'md' | 'xs';

const SIZES: Record<GaugeSize, { w: number; stroke: number; needle: number }> = {
  lg: { w: 360, stroke: 22, needle: 3.5 },
  md: { w: 240, stroke: 16, needle: 3 },
  xs: { w: 88, stroke: 9, needle: 2 },
};

/** The zone's color (the app's status tokens) and a light step of it for the track. */
const ZONE_COLOR: Record<GaugeZone, string> = {
  safe: 'var(--color-success)',
  close: 'var(--color-warning)',
  over: 'var(--color-danger)',
};
const tint = (c: string) => `color-mix(in oklab, ${c} 24%, var(--color-subtle))`;

const ZONE_ICON = { safe: CircleCheck, close: TriangleAlert, over: CircleAlert } as const;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true;
}

/**
 * A value that follows its target like a spring (from 0 on the first paint, and on every change);
 * immediate when the visitor asked for less motion.
 */
export function useSpring(target: number, { stiffness = 140, damping = 16 } = {}): number {
  const [value, setValue] = useState(0);
  const state = useRef({ x: 0, v: 0 });
  useEffect(() => {
    if (reducedMotion()) {
      state.current = { x: target, v: 0 };
      setValue(target);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = state.current;
      const force = stiffness * (target - s.x) - damping * s.v;
      s.v += force * dt;
      s.x += s.v * dt;
      if (Math.abs(target - s.x) < 0.0005 && Math.abs(s.v) < 0.0005) {
        s.x = target;
        s.v = 0;
        setValue(target);
        return;
      }
      setValue(s.x);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, stiffness, damping]);
  return value;
}

/**
 * The budget as a speedometer (UX report §4.5): a half circle to 130% of the budget — green to 85%,
 * amber to 100%, red past it — with the main needle on what is committed (or paid), a ghost needle on
 * the plan and a thin mark on what is paid. In the middle the percent, what is left (or the overrun) and
 * a sentence with an icon, so the color never carries the meaning alone. It springs from 0 when it
 * appears and moves with every change (still for reduced motion); a needle past the scale's end stops
 * there and trembles. Sizes: lg (the budget screen), md (the event's home), xs (an event's card).
 */
export function BudgetGauge({
  size = 'lg',
  className,
  ...input
}: GaugeInput & { size?: GaugeSize; className?: string }) {
  const { t, dir, fmt, locale, number } = useUi();
  const G = t.planning.budget.gauge;
  const rtl = dir === 'rtl';
  const reading = readGauge(input);
  const needle = useSpring(reading?.needle ?? 0);
  const ghost = useSpring(reading?.ghost ?? 0, { stiffness: 90, damping: 15 });
  if (!reading) return null;

  const { w, stroke, needle: needleWidth } = SIZES[size];
  const pad = stroke / 2 + (size === 'xs' ? 2 : 14);
  const r = w / 2 - pad;
  const geo = { cx: w / 2, cy: w / 2, r };
  const h = w / 2 + (size === 'xs' ? stroke / 2 + 2 : stroke / 2 + 8);
  const zone = reading.zone;
  const color = ZONE_COLOR[zone];
  const Icon = ZONE_ICON[zone];
  const status = G[zone];
  const percentText = `${number(reading.percent)}%`;

  const tip = gaugePoint(needle, { ...geo, r: r - stroke / 2 - (size === 'xs' ? 1 : 6) }, rtl);
  const ghostTip = gaugePoint(ghost, { ...geo, r: r - stroke / 2 - 6 }, rtl);
  const tick = (v: number, inner: number, outer: number) => {
    const a = gaugePoint(v, { ...geo, r: inner }, rtl);
    const b = gaugePoint(v, { ...geo, r: outer }, rtl);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };
  const ticks = size === 'xs' ? [] : Array.from({ length: 14 }, (_, i) => i / 10);
  const labels = size === 'lg' ? [0, 0.5, 1] : size === 'md' ? [0, 1] : [];
  const money = (n: number) => shekels(Math.abs(n), locale);

  return (
    <div
      role="meter"
      aria-label={G.label}
      aria-valuemin={0}
      aria-valuemax={Math.round(GAUGE_MAX * 100)}
      aria-valuenow={Math.min(reading.percent, Math.round(GAUGE_MAX * 100))}
      aria-valuetext={`${fmt(G.valueText, { percent: percentText, status })}. ${
        reading.left >= 0
          ? fmt(G.left, { amount: money(reading.left) })
          : fmt(G.overBy, { amount: money(reading.left) })
      }`}
      data-zone={zone}
      data-testid={`budget-gauge-${size}`}
      className={cn('relative mx-auto flex flex-col items-center', className)}
      style={{ width: '100%', maxWidth: w }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" aria-hidden className="block overflow-visible">
        {/* the zones: a light step of each status color */}
        <path
          d={gaugeArc(0, GAUGE_ZONES.safe, geo, rtl)}
          stroke={tint(ZONE_COLOR.safe)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={gaugeArc(GAUGE_ZONES.safe, GAUGE_ZONES.close, geo, rtl)}
          stroke={tint(ZONE_COLOR.close)}
          strokeWidth={stroke}
          fill="none"
        />
        <path
          d={gaugeArc(GAUGE_ZONES.close, GAUGE_MAX, geo, rtl)}
          stroke={tint(ZONE_COLOR.over)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        {/* what is used, in the zone's color */}
        {needle > 0.002 ? (
          <path
            d={gaugeArc(0, needle, geo, rtl)}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            style={{ transition: 'stroke 300ms' }}
          />
        ) : null}
        {/* what is paid: a thin mark across the arc */}
        {size !== 'xs' && reading.paidMark > 0.005 ? (
          <line
            {...tick(reading.paidMark, r - stroke / 2 - 2, r + stroke / 2 + 2)}
            stroke="var(--color-ink)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        {ticks.map((v, i) => (
          <line
            key={i}
            {...tick(v, r + stroke / 2 + 3, r + stroke / 2 + (i % 5 === 0 ? 10 : 6))}
            stroke="var(--color-line-strong)"
            strokeWidth={i % 5 === 0 ? 1.5 : 1}
          />
        ))}
        {labels.map((v) => {
          const p = gaugePoint(v, { ...geo, r: r + stroke / 2 + 20 }, rtl);
          return (
            <text
              key={v}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted text-[11px] font-semibold"
            >
              {`${number(Math.round(v * 100))}%`}
            </text>
          );
        })}
        {/* the plan: a ghost needle */}
        {size !== 'xs' && reading.ghost > 0 ? (
          <line
            x1={geo.cx}
            y1={geo.cy}
            x2={ghostTip.x}
            y2={ghostTip.y}
            stroke="var(--color-ink)"
            strokeOpacity={0.22}
            strokeWidth={needleWidth}
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
        ) : null}
        {/* the needle */}
        <g
          className={cn(reading.pinned && 'motion-safe:animate-[gauge-tremble_900ms_ease-in-out_infinite]')}
          style={{ transformOrigin: `${geo.cx}px ${geo.cy}px` }}
        >
          <line
            x1={geo.cx}
            y1={geo.cy}
            x2={tip.x}
            y2={tip.y}
            stroke="var(--color-ink)"
            strokeWidth={needleWidth}
            strokeLinecap="round"
          />
          <circle cx={geo.cx} cy={geo.cy} r={needleWidth * 2.4} fill="var(--color-ink)" />
          <circle cx={geo.cx} cy={geo.cy} r={needleWidth} fill="var(--color-surface)" />
        </g>
      </svg>

      {size === 'xs' ? (
        <p className="-mt-1 text-[12px] font-bold" style={{ color }}>
          <span className="sr-only">{status}: </span>
          {percentText}
        </p>
      ) : (
        <div className={cn('flex flex-col items-center text-center', size === 'lg' ? 'mt-2' : 'mt-1')}>
          <p
            className={cn(
              'leading-none font-extrabold tracking-tight',
              size === 'lg' ? 'text-[44px]' : 'text-[30px]',
            )}
          >
            {percentText}
            <span className="sr-only"> {G.ofBudget}</span>
          </p>
          <p className={cn('mt-1.5 font-semibold', size === 'lg' ? 'text-[15px]' : 'text-[13px]')}>
            {reading.left >= 0 ? (
              <>
                {G.left.split('{amount}')[0]}
                <Money value={reading.left} />
                {G.left.split('{amount}')[1]}
              </>
            ) : (
              <span className="text-danger">
                {G.overBy.split('{amount}')[0]}
                <Money value={-reading.left} />
                {G.overBy.split('{amount}')[1]}
              </span>
            )}
          </p>
          <p
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold',
              size === 'lg' ? 'text-[13.5px]' : 'text-[12px]',
              zone === 'safe'
                ? 'bg-success-bg text-success'
                : zone === 'close'
                  ? 'bg-warning-bg text-warning'
                  : 'bg-danger-bg text-danger',
            )}
            role="status"
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {status}
            {reading.pinned ? <span className="sr-only"> ({G.pinned})</span> : null}
          </p>
        </div>
      )}

      {size === 'lg' ? (
        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-4 rounded-full" style={{ background: color }} />
            {G.legendUsed}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-ink/30" />
            {G.legendPlanned}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-ink" />
            {G.legendPaid}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A small half circle for one share (a category's committed against its plan): the zone's color, the
 * percent under it. Springs in like the big one; its meaning is in its label and text, not the color.
 */
export function MiniGauge({ ratio, label, className }: { ratio: number; label: string; className?: string }) {
  const { dir, number } = useUi();
  const rtl = dir === 'rtl';
  const value = useSpring(Math.max(0, Math.min(GAUGE_MAX, ratio)));
  const w = 84;
  const stroke = 8;
  const geo = { cx: w / 2, cy: w / 2, r: w / 2 - stroke / 2 - 1 };
  const zone = ratio > GAUGE_ZONES.close ? 'over' : ratio >= GAUGE_ZONES.safe ? 'close' : 'safe';
  const color = ZONE_COLOR[zone];
  const percent = Math.round(ratio * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={130}
      aria-valuenow={Math.min(percent, 130)}
      aria-valuetext={`${number(percent)}%`}
      className={cn('relative shrink-0', className)}
      style={{ width: w }}
      data-zone={zone}
    >
      <svg viewBox={`0 0 ${w} ${w / 2 + stroke / 2 + 1}`} width={w} aria-hidden className="block">
        <path
          d={gaugeArc(0, GAUGE_MAX, geo, rtl)}
          stroke="var(--color-subtle)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={gaugeArc(GAUGE_ZONES.close, GAUGE_MAX, geo, rtl)}
          stroke={tint(ZONE_COLOR.over)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        {value > 0.002 ? (
          <path
            d={gaugeArc(0, value, geo, rtl)}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <span
        className="absolute inset-x-0 bottom-0 text-center text-[12px] leading-none font-bold"
        aria-hidden
      >
        {number(percent)}%
      </span>
    </div>
  );
}
