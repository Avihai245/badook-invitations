'use client';

import { Compass, Maximize2, Route as RouteIcon, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { planSize, type Point } from '@/features/seating/geometry';
import type { GuidePageData } from '../../server/pages';
import {
  entranceUp,
  HallLandmark,
  HallTableGlyph,
  hallBox,
  pointsBox,
  roundedPath,
  turnedView,
  type TableLook,
} from '../hall';
import { fill, useDayText } from '../guest-text';
import { useCompass } from './useCompass';

/**
 * The guest's map (read-only): the hall as the host drew it — the floor plan, the landmarks, every
 * table with its number and no names — turned so the entrance is at the bottom, the guest's table
 * highlighted and pulsing, and the way from the entrance drawn around the tables. "Turn the map with
 * my phone" follows the compass (iPhones ask first); without motion (prefers-reduced-motion) the way
 * is simply there.
 */

const OTHER: TableLook = {
  fill: '#ffffff',
  stroke: '#a8a29e',
  text: '#57534e',
  chairs: '#f5f5f4',
  chairStroke: '#d6d3d1',
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function GuideMap({
  data,
  accent,
  accentInk,
}: {
  data: GuidePageData;
  accent: string;
  accentInk: string;
}) {
  const { t, number } = useDayText();
  const m = t.guide.map;
  const reduced = usePrefersReducedMotion();
  const compass = useCompass();
  const target = data.table ? data.hall.tables.find((x) => x.id === data.table!.id) : undefined;
  const route = data.route;
  const [view, setView] = useState<'route' | 'hall'>(route ? 'route' : 'hall');
  const [replay, setReplay] = useState(0);

  const entrance: Point | null = useMemo(() => {
    if (route) return route.points[0]!;
    const door = data.hall.landmarks.find((l) => l.kind === 'entrance');
    return door ? { x: door.x, y: door.y } : null;
  }, [route, data.hall.landmarks]);
  const hall = useMemo(() => hallBox(data.hall), [data.hall]);
  const base = useMemo(() => entranceUp(entrance, hall), [entrance, hall]);

  // the compass: the heading when it was turned on is "forward" (the guest faces into the hall)
  const [forward, setForward] = useState<number | null>(null);
  useEffect(() => {
    if (compass.state !== 'on') setForward(null);
    else if (forward === null && compass.heading !== null) setForward(compass.heading);
  }, [compass.state, compass.heading, forward]);
  const turning = compass.state === 'on' && compass.heading !== null && forward !== null;
  const angle = turning ? base - (compass.heading! - forward!) : base;

  const focus = useMemo(() => {
    if (view === 'route' && route && target)
      return pointsBox([...route.points, { x: target.x, y: target.y }], 2.5, 9);
    return hall;
  }, [view, route, target, hall]);
  const vb = turnedView(focus, turning ? null : angle);
  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  const fs = Math.min(1.1, Math.max(0.32, vb.w / 26));
  const size = planSize(data.hall);
  const path = route ? roundedPath(route.points) : '';

  const look: TableLook = {
    fill: accent,
    stroke: accent,
    text: accentInk,
    chairs: accent,
    chairStroke: accent,
  };
  const label = target
    ? fill(route ? m.label : m.labelNoRoute, { number: target.number })
    : t.guide.map.noPlan;

  return (
    <section
      aria-labelledby="guide-map"
      className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <h2 id="guide-map" className="text-[15px] font-bold">
          {m.title}
        </h2>
        {route ? (
          <span className="text-[12.5px] text-muted" data-testid="guide-distance">
            {fill(m.distance, { meters: number(Math.max(1, Math.round(route.length))) })}
          </span>
        ) : null}
      </div>
      <div className="relative bg-[#f4f2ee]" style={{ touchAction: 'manipulation' }}>
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="block h-auto max-h-[62dvh] w-full"
          role="img"
          aria-label={label}
          data-testid="guide-map"
          data-angle={Math.round(angle)}
        >
          <g
            transform={`rotate(${angle} ${cx} ${cy})`}
            style={
              turning && !reduced ? ({ transition: 'transform 120ms linear' } as CSSProperties) : undefined
            }
          >
            {size ? (
              <rect x={0} y={0} width={size.w} height={size.h} fill="#ffffff" />
            ) : (
              <rect x={hall.x} y={hall.y} width={hall.w} height={hall.h} rx={0.4} fill="#ffffff" />
            )}
            {data.hall.planUrl && size ? (
              // the host's floor plan, under the tables
              <image
                href={data.hall.planUrl}
                x={0}
                y={0}
                width={size.w}
                height={size.h}
                preserveAspectRatio="none"
                opacity={0.9}
              />
            ) : null}
            {data.hall.landmarks.map((l) => (
              <HallLandmark
                key={l.id}
                landmark={l}
                label={l.label || m.landmarks[l.kind]}
                upright={angle}
                fontSize={fs * 0.9}
              />
            ))}
            {data.hall.tables.map((x) => {
              const mine = x.id === target?.id;
              const tfs = Math.min(fs, Math.max(0.3, Math.min(x.w, x.h) * (x.shape === 'round' ? 0.5 : 0.8)));
              return (
                <g key={x.id} data-table-number={x.number} data-mine={mine ? '' : undefined}>
                  {mine ? (
                    <circle
                      cx={x.x}
                      cy={x.y}
                      r={Math.hypot(x.w, x.h) / 2 + 0.7}
                      fill="none"
                      stroke={accent}
                      strokeWidth={0.18}
                      className="day-pulse"
                    />
                  ) : null}
                  <HallTableGlyph
                    table={x}
                    look={mine ? look : OTHER}
                    upright={angle}
                    strokeWidth={mine ? 2.5 : 1.25}
                  >
                    <text
                      fontSize={mine ? tfs * 1.15 : tfs}
                      fontWeight={mine ? 800 : 600}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={mine ? accentInk : OTHER.text}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {x.number}
                    </text>
                  </HallTableGlyph>
                </g>
              );
            })}
            {route ? (
              <g key={replay} style={{ pointerEvents: 'none' }}>
                <path
                  d={path}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={path}
                  pathLength={1}
                  fill="none"
                  stroke={accent}
                  strokeWidth={0.24}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="day-route-draw"
                  data-testid="guide-route"
                />
                {reduced ? null : (
                  <circle
                    r={0.28}
                    fill={accent}
                    stroke="#ffffff"
                    strokeWidth={0.08}
                    className="day-route-walker"
                  >
                    <animateMotion dur="3.2s" begin="2s" repeatCount="indefinite" path={path} />
                  </circle>
                )}
              </g>
            ) : null}
            {entrance ? (
              <g transform={`translate(${entrance.x} ${entrance.y})`}>
                <circle r={0.42} fill="#1c1917" stroke="#ffffff" strokeWidth={0.12} />
                <circle r={0.14} fill="#ffffff" />
                <text
                  transform={`rotate(${-angle}) translate(0 ${-0.75 - fs * 0.4})`}
                  fontSize={fs * 0.85}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#1c1917"
                  stroke="#ffffff"
                  strokeWidth={fs * 0.22}
                  paintOrder="stroke"
                >
                  {m.youAreHere}
                </text>
              </g>
            ) : null}
          </g>
        </svg>
      </div>
      {!route && target ? <p className="px-4 pt-2.5 text-[13px] text-muted">{m.noRoute}</p> : null}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        {compass.supported ? (
          <button
            type="button"
            aria-pressed={compass.state === 'on'}
            onClick={() => (compass.state === 'on' ? compass.stop() : void compass.start())}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
            data-testid="guide-compass"
          >
            <Compass aria-hidden className="size-[18px]" />
            {compass.state === 'on' ? m.turnOff : m.turnOn}
          </button>
        ) : null}
        {route ? (
          <button
            type="button"
            onClick={() => setView((v) => (v === 'route' ? 'hall' : 'route'))}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold"
            aria-pressed={view === 'hall'}
          >
            {view === 'route' ? (
              <Maximize2 aria-hidden className="size-4" />
            ) : (
              <RouteIcon aria-hidden className="size-4" />
            )}
            {view === 'route' ? m.whole : m.title}
          </button>
        ) : null}
        {route && !reduced ? (
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13.5px] font-semibold text-muted hover:text-ink"
          >
            <RotateCcw aria-hidden className="size-4" />
            {m.replay}
          </button>
        ) : null}
      </div>
      {compass.state === 'on' ? (
        <p className="px-4 pb-3 text-[12.5px] text-muted" role="status">
          {m.turnHelp}
        </p>
      ) : compass.state === 'denied' || compass.state === 'unavailable' ? (
        <p className="px-4 pb-3 text-[12.5px] text-warning" role="status">
          {compass.state === 'denied' ? m.turnDenied : m.turnUnavailable}
        </p>
      ) : null}
    </section>
  );
}
