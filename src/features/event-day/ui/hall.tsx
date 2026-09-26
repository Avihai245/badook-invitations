import { memo, type ReactNode } from 'react';
import {
  bounds,
  CHAIR_RADIUS,
  chairPositions,
  planSize,
  union,
  type Point,
  type Rect,
} from '@/features/seating/geometry';
import type { Landmark } from '@/features/seating/model';
import type { Hall, HallTable } from '../model';

/**
 * Drawing the hall for the event day's pages (SVG, meters — like the seating editor): the guest's
 * map to their table and the host's live heatmap. No hooks: pages compose these inside their own
 * <svg>. Text stays upright whatever the table's turn and the map's (`upright`: the map's own turn).
 */

/** Everything there is to draw: the plan (when there is one) and every table and landmark, with room around. */
export function hallBox(
  hall: Pick<Hall, 'background' | 'metersPerPixel' | 'tables' | 'landmarks'>,
  margin = 1.2,
): Rect {
  const size = planSize(hall);
  let box: Rect | null = size ? { x: 0, y: 0, w: size.w, h: size.h } : null;
  for (const t of hall.tables) box = union(box, bounds(t));
  for (const m of hall.landmarks) box = union(box, bounds(m));
  if (!box) return { x: 0, y: 0, w: 20, h: 14 };
  return size ? box : { x: box.x - margin, y: box.y - margin, w: box.w + 2 * margin, h: box.h + 2 * margin };
}

/** A box around some points, at least `min` meters on each side. */
export function pointsBox(points: readonly Point[], pad: number, min = 8): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  let w = Math.max(...xs) + pad - x0;
  let h = Math.max(...ys) + pad - y0;
  const grow = (v: number) => Math.max(0, min - v) / 2;
  const gx = grow(w);
  const gy = grow(h);
  w += 2 * gx;
  h += 2 * gy;
  return { x: x0 - gx, y: y0 - gy, w, h };
}

/**
 * The view box that shows `box` turned by `deg` around its center: tight for quarter turns; for any
 * other angle — or `null`, a map that follows the phone — the whole circle around it (it never clips,
 * nor jumps in size while it turns).
 */
export function turnedView(box: Rect, deg: number | null): { x: number; y: number; w: number; h: number } {
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const quarter = deg !== null && Math.abs(((deg % 90) + 90) % 90) < 0.01;
  let w: number;
  let h: number;
  if (quarter) {
    const odd = Math.round(deg! / 90) % 2 !== 0;
    w = odd ? box.h : box.w;
    h = odd ? box.w : box.h;
  } else {
    w = h = Math.hypot(box.w, box.h);
  }
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/**
 * The turn that puts the entrance at the bottom of the map, looking into the hall (a quarter turn, so
 * a plan's own writing is never at an odd angle).
 */
export function entranceUp(entrance: Point | null, box: Rect): number {
  if (!entrance) return 0;
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const dx = c.x - entrance.x;
  const dy = c.y - entrance.y;
  if (Math.hypot(dx, dy) < 0.5) return 0;
  // the direction into the hall, turned to point up (screen up is -y; SVG turns clockwise)
  const deg = -90 - (Math.atan2(dy, dx) * 180) / Math.PI;
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
}

/** A smooth line through the points (round corners of up to `radius` meters). */
export function roundedPath(points: readonly Point[], radius = 0.8): string {
  if (points.length < 2) return '';
  const p = points;
  let d = `M ${p[0]!.x} ${p[0]!.y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const lab = Math.hypot(b.x - a.x, b.y - a.y);
    const lbc = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, lab / 2, lbc / 2);
    const s = { x: b.x + ((a.x - b.x) / (lab || 1)) * r, y: b.y + ((a.y - b.y) / (lab || 1)) * r };
    const e = { x: b.x + ((c.x - b.x) / (lbc || 1)) * r, y: b.y + ((c.y - b.y) / (lbc || 1)) * r };
    d += ` L ${round(s.x)} ${round(s.y)} Q ${b.x} ${b.y} ${round(e.x)} ${round(e.y)}`;
  }
  const last = p[p.length - 1]!;
  return `${d} L ${last.x} ${last.y}`;
}

const round = (v: number) => Math.round(v * 100) / 100;

export interface TableLook {
  fill: string;
  stroke: string;
  text: string;
  chairs: string;
  chairStroke: string;
}

/**
 * One table: its chairs, the table, and its label (children, drawn upright at its center). `upright`:
 * the map's own turn, undone for the label.
 */
export const HallTableGlyph = memo(function HallTableGlyph({
  table,
  look,
  upright = 0,
  strokeWidth = 1.5,
  children,
}: {
  table: HallTable;
  look: TableLook;
  upright?: number;
  strokeWidth?: number;
  children?: ReactNode;
}) {
  const round = table.shape === 'round';
  return (
    <g transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}>
      {chairPositions(table).map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={CHAIR_RADIUS}
          fill={look.chairs}
          stroke={look.chairStroke}
          strokeWidth={0.04}
        />
      ))}
      {round ? (
        <circle
          r={table.w / 2}
          fill={look.fill}
          stroke={look.stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect
          x={-table.w / 2}
          y={-table.h / 2}
          width={table.w}
          height={table.h}
          rx={0.08}
          fill={look.fill}
          stroke={look.stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <g transform={`rotate(${-table.rotation - upright})`} style={{ pointerEvents: 'none' }}>
        {children}
      </g>
    </g>
  );
});

const LANDMARK_LOOK: Record<Landmark['kind'], { fill: string; stroke: string; text: string }> = {
  stage: { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' },
  dance: { fill: '#e0f2fe', stroke: '#0284c7', text: '#075985' },
  bar: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  buffet: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  entrance: { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' },
  exit: { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' },
};

/** A landmark (stage, dance floor, bar…) with its name, upright. */
export const HallLandmark = memo(function HallLandmark({
  landmark,
  label,
  upright = 0,
  fontSize,
}: {
  landmark: Landmark;
  label: string;
  upright?: number;
  fontSize: number;
}) {
  const c = LANDMARK_LOOK[landmark.kind];
  // the label fits the landmark's shorter side when the map turns it
  const room = Math.min(landmark.w, landmark.h) * 0.62;
  const fs = Math.max(
    0.22,
    Math.min(fontSize, room, (Math.max(landmark.w, landmark.h) / Math.max(1, label.length)) * 1.5),
  );
  return (
    <g transform={`translate(${landmark.x} ${landmark.y})`}>
      <g transform={`rotate(${landmark.rotation})`}>
        <rect
          x={-landmark.w / 2}
          y={-landmark.h / 2}
          width={landmark.w}
          height={landmark.h}
          rx={0.15}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={1.25}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <text
        transform={`rotate(${-upright})`}
        fontSize={fs}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.text}
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
});
