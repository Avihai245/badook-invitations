'use client';

import { planSize } from '@/features/seating/geometry';
import { useUi } from '@/lib/i18n/client';
import { HEAT, heatOf, type TableFill } from '../../live';
import type { Hall } from '../../model';
import { HallLandmark, HallTableGlyph, hallBox } from '../hall';

/**
 * The live hall as a heatmap: every table filled by how much of what it expects arrived — one green,
 * deepening as it fills (a sequential ramp; the step before anyone arrived recedes toward the surface,
 * which is why every table also carries its numbers), red with a "!" when more people arrived than it
 * has seats, grey when nobody is expected. A table is a button: its sheet has the families.
 */
export function HeatMap({
  hall,
  planUrl,
  fills,
  onTable,
}: {
  hall: Hall;
  planUrl: string | null;
  fills: readonly TableFill[];
  onTable(tableId: string): void;
}) {
  const { t, fmt } = useUi();
  const h = t.eventDay.heat;
  const box = hallBox(hall);
  const size = planSize(hall);
  const pad = 0.6;
  const fs = Math.min(0.9, Math.max(0.34, box.w / 34));
  const byTable = new Map(fills.map((f) => [f.table.id, f]));
  if (!hall.tables.length)
    return (
      <p className="rounded-card border border-dashed border-line-strong p-6 text-center text-[13.5px] text-muted">
        {h.noTables}
      </p>
    );
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-card border border-line bg-[#f4f2ee]">
        <svg
          viewBox={`${box.x - pad} ${box.y - pad} ${box.w + 2 * pad} ${box.h + 2 * pad}`}
          className="block h-auto max-h-[70dvh] w-full"
          role="group"
          aria-label={h.mapLabel}
          data-testid="live-heatmap"
        >
          {size ? <rect x={0} y={0} width={size.w} height={size.h} fill="#ffffff" /> : null}
          {planUrl && size ? (
            <image
              href={planUrl}
              x={0}
              y={0}
              width={size.w}
              height={size.h}
              preserveAspectRatio="none"
              opacity={0.55}
            />
          ) : null}
          {hall.landmarks.map((m) => (
            <HallLandmark
              key={m.id}
              landmark={m}
              label={m.label || t.seating.landmarks[m.kind]}
              fontSize={fs}
            />
          ))}
          {hall.tables.map((table) => {
            const f = byTable.get(table.id);
            const c = f ? heatOf(f) : HEAT.none;
            const tfs = Math.min(
              fs,
              Math.max(0.28, Math.min(table.w, table.h) * (table.shape === 'round' ? 0.42 : 0.7)),
            );
            const aria =
              fmt(h.tableAria, {
                number: table.number,
                arrived: f?.arrived ?? 0,
                expected: f?.expected ?? 0,
                capacity: table.capacity,
              }) + (f?.over ? h.overAria : '');
            return (
              <g
                key={table.id}
                role="button"
                tabIndex={0}
                aria-label={aria}
                data-heat-table={table.number}
                data-arrived={f?.arrived ?? 0}
                className="cursor-pointer outline-none focus-visible:[&_circle]:stroke-[#2563eb]"
                onClick={() => onTable(table.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTable(table.id);
                  }
                }}
              >
                <HallTableGlyph
                  table={table}
                  look={{
                    fill: c.fill,
                    stroke: c.stroke,
                    text: c.text,
                    chairs: '#ffffff',
                    chairStroke: '#d6d3d1',
                  }}
                  strokeWidth={1.75}
                >
                  <text
                    y={-tfs * 0.2}
                    fontSize={tfs}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={c.text}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {f?.over ? `${table.number}!` : table.number}
                  </text>
                  <text
                    y={tfs * 0.66}
                    fontSize={tfs * 0.55}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={c.text}
                    direction="ltr"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {f ? `${f.arrived}/${f.expected}` : '0/0'}
                  </text>
                </HallTableGlyph>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption
        className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] text-muted"
        aria-label={h.legend}
      >
        {(
          [
            [HEAT.steps[0], h.zero],
            [HEAT.steps[1], h.third],
            [HEAT.steps[2], h.twoThirds],
            [HEAT.steps[3], h.almost],
            [HEAT.steps[4], h.full],
            [HEAT.over, h.over],
            [HEAT.none, h.none],
          ] as const
        ).map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-full border"
              style={{ background: c.fill, borderColor: c.stroke }}
            />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
