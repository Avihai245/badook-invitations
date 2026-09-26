import { memo } from 'react';
import { CHAIR_RADIUS, chairPositions } from '../geometry';
import type { Landmark, LandmarkKind, SeatingTable } from '../model';

/**
 * How tables and landmarks are drawn (SVG, in meters) — the editor's canvas and the print view share
 * it. Colors say how full a table is: empty (white), some seats taken (sand), full (brand), more
 * people than seats (red).
 */

export type Fill = 'empty' | 'partial' | 'full' | 'over';

export const fillOf = (seated: number, capacity: number): Fill =>
  seated === 0 ? 'empty' : seated > capacity ? 'over' : seated === capacity ? 'full' : 'partial';

const TABLE_COLORS: Record<Fill, { table: string; stroke: string; chair: string; text: string }> = {
  empty: { table: '#ffffff', stroke: '#a8a29e', chair: '#ffffff', text: '#1c1917' },
  partial: { table: '#f6ede1', stroke: '#a0703f', chair: '#ead8c0', text: '#1c1917' },
  full: { table: '#a0703f', stroke: '#7a5230', chair: '#c79a6b', text: '#ffffff' },
  over: { table: '#fef2f2', stroke: '#b91c1c', chair: '#fecaca', text: '#b91c1c' },
};

export const LANDMARK_COLORS: Record<LandmarkKind, { fill: string; stroke: string; text: string }> = {
  stage: { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' },
  dance: { fill: '#e0f2fe', stroke: '#0284c7', text: '#075985' },
  bar: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  buffet: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  entrance: { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' },
  exit: { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' },
};

/** A small padlock (drawn in a 1×1 box). */
function Lock({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} aria-hidden>
      <rect x={-0.5} y={-0.5} width={1} height={1} rx={0.28} fill="#1c1917" />
      <path
        d="M-0.18 -0.02 v-0.12 a0.18 0.18 0 0 1 0.36 0 v0.12"
        fill="none"
        stroke={color}
        strokeWidth={0.09}
      />
      <rect x={-0.24} y={-0.03} width={0.48} height={0.32} rx={0.06} fill={color} />
    </g>
  );
}

/**
 * One table: chairs (the first `seated` filled), the table, its number and "seated/capacity" upright
 * whatever its rotation, and a padlock when locked. `fontSize` in meters (the canvas keeps text
 * readable at any zoom).
 */
export const TableGlyph = memo(function TableGlyph({
  table,
  seated,
  fontSize,
  selected = false,
  drop = null,
  showCount = true,
}: {
  table: SeatingTable;
  seated: number;
  fontSize: number;
  selected?: boolean;
  /** a family dragged over it: fits (true) or not (false) */
  drop?: boolean | null;
  showCount?: boolean;
}) {
  const fill = fillOf(seated, table.capacity);
  const c = TABLE_COLORS[fill];
  const chairs = chairPositions(table);
  const round = table.shape === 'round';
  const fs = Math.min(fontSize, Math.max(0.28, Math.min(table.w, table.h) * (round ? 0.42 : 0.7)));
  const ring = drop === true ? '#15803d' : drop === false ? '#b91c1c' : selected ? '#2563eb' : null;
  const pad = 0.12;
  return (
    <g transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}>
      {chairs.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={CHAIR_RADIUS}
          fill={i < seated ? c.chair : '#ffffff'}
          stroke={i < seated ? c.stroke : '#d6d3d1'}
          strokeWidth={0.04}
        />
      ))}
      {ring ? (
        round ? (
          <circle
            r={table.w / 2 + pad}
            fill="none"
            stroke={ring}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={drop === null ? undefined : '4 3'}
          />
        ) : (
          <rect
            x={-table.w / 2 - pad}
            y={-table.h / 2 - pad}
            width={table.w + 2 * pad}
            height={table.h + 2 * pad}
            rx={0.12}
            fill="none"
            stroke={ring}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={drop === null ? undefined : '4 3'}
          />
        )
      ) : null}
      {round ? (
        <circle
          r={table.w / 2}
          fill={c.table}
          stroke={c.stroke}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect
          x={-table.w / 2}
          y={-table.h / 2}
          width={table.w}
          height={table.h}
          rx={0.08}
          fill={c.table}
          stroke={c.stroke}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <g transform={`rotate(${-table.rotation})`} style={{ pointerEvents: 'none' }}>
        <text
          y={showCount ? -fs * 0.18 : 0}
          fontSize={fs}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          fill={c.text}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {table.number}
        </text>
        {showCount ? (
          <text
            y={fs * 0.62}
            fontSize={fs * 0.52}
            textAnchor="middle"
            dominantBaseline="central"
            fill={c.text}
            opacity={0.85}
            style={{ fontVariantNumeric: 'tabular-nums' }}
            direction="ltr"
          >
            {seated}/{table.capacity}
          </text>
        ) : null}
      </g>
      {table.locked ? (
        <g transform={`rotate(${-table.rotation})`}>
          <Lock
            x={(round ? table.w / 2 : table.w / 2) * 0.72}
            y={-(round ? table.w / 2 : table.h / 2) * 0.72}
            size={Math.max(0.34, fs * 0.55)}
            color="#ffffff"
          />
        </g>
      ) : null}
    </g>
  );
});

/** A landmark: a tinted rectangle with its name. */
export const LandmarkGlyph = memo(function LandmarkGlyph({
  landmark,
  label,
  fontSize,
  selected = false,
}: {
  landmark: Landmark;
  label: string;
  fontSize: number;
  selected?: boolean;
}) {
  const c = LANDMARK_COLORS[landmark.kind];
  const fs = Math.min(fontSize, landmark.h * 0.6, (landmark.w / Math.max(1, label.length)) * 1.6);
  return (
    <g transform={`translate(${landmark.x} ${landmark.y}) rotate(${landmark.rotation})`}>
      <rect
        x={-landmark.w / 2}
        y={-landmark.h / 2}
        width={landmark.w}
        height={landmark.h}
        rx={0.15}
        fill={c.fill}
        stroke={selected ? '#2563eb' : c.stroke}
        strokeWidth={selected ? 2 : 1.25}
        strokeDasharray={selected ? undefined : '6 4'}
        vectorEffect="non-scaling-stroke"
      />
      <text
        fontSize={Math.max(0.2, fs)}
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
