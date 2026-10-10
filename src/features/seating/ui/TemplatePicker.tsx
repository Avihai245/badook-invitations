'use client';

import { ImageUp, LayoutTemplate, PlayCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Button, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { LIMITS } from '../model';
import { HALL_TEMPLATES, tablesFor, templateItems, type HallTemplate } from '../templates';
import { LANDMARK_COLORS } from './glyphs';

/**
 * The empty map's start, for a host without a picture of the hall: pick a ready-made hall (drawn small,
 * as it will look with this many guests) — or upload the venue's own plan (ask the venue for one: any
 * picture or PDF of the room), or watch how the pros do it. Shown over the map while it has no tables
 * and no plan; the picker in the plan dialog reuses its cards.
 */
export function TemplatePicker({
  guests,
  onPick,
  onUpload,
  onLearn,
  onBlank,
  compact = false,
}: {
  /** the seats to plan for (the confirmed guests, else everyone expected) */
  guests: number;
  onPick: (template: HallTemplate) => void;
  onUpload?: () => void;
  onLearn?: () => void;
  /** start from the empty hall instead (tables added one by one) */
  onBlank?: () => void;
  compact?: boolean;
}) {
  const { t, fmt, number } = useUi();
  const T = t.seating.templates;
  return (
    <div
      data-testid="hall-templates"
      className={cn(
        'pointer-events-auto mx-auto w-full rounded-[22px] border border-line bg-surface/95 shadow-lg backdrop-blur',
        compact ? 'p-0 shadow-none' : 'max-w-[760px] p-4 sm:p-6',
      )}
    >
      {compact ? null : (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[18px] font-extrabold">
              <LayoutTemplate aria-hidden className="size-5 text-brand-deep" />
              {T.title}
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">{fmt(T.body, { n: number(guests) })}</p>
          </div>
          {onLearn ? (
            <Button variant="ghost" size="sm" icon={<PlayCircle />} onClick={onLearn}>
              {t.seating.learn.button}
            </Button>
          ) : null}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {HALL_TEMPLATES.map((key) => (
          <li key={key}>
            <button
              type="button"
              data-template={key}
              onClick={() => onPick(key)}
              className="group flex h-full w-full flex-col gap-2 rounded-[16px] border border-line bg-surface p-2.5 text-start transition-[border-color,box-shadow] hover:border-brand hover:shadow-md"
            >
              <TemplateThumb template={key} guests={guests} />
              <span className="px-0.5">
                <span className="block text-[14px] font-bold">{T.items[key].title}</span>
                <span className="block text-[12px] leading-snug text-muted">
                  {fmt(T.items[key].body, { n: number(tablesFor(key, guests)) })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {onUpload ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-subtle px-3.5 py-3">
          <ImageUp aria-hidden className="size-5 shrink-0 text-brand-deep" />
          <p className="min-w-0 flex-1 text-[13px] text-ink/80">{T.upload.body}</p>
          <Button size="sm" variant="secondary" onClick={onUpload}>
            {T.upload.button}
          </Button>
        </div>
      ) : null}
      {onBlank ? (
        <button
          type="button"
          onClick={onBlank}
          className="mx-auto mt-3 block text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          data-testid="hall-blank"
        >
          {T.blank}
        </button>
      ) : null}
    </div>
  );
}

/** A template drawn small: the room, its landmarks and its tables. */
function TemplateThumb({ template, guests }: { template: HallTemplate; guests: number }) {
  const items = useMemo(() => templateItems(template, guests), [template, guests]);
  return (
    <svg
      viewBox={`-0.5 -0.5 ${LIMITS.roomW + 1} ${LIMITS.roomH + 1}`}
      className="aspect-[3/2] w-full rounded-[10px] bg-[#f4efe8] dark:bg-canvas-editor"
      aria-hidden
    >
      <rect
        x={0}
        y={0}
        width={LIMITS.roomW}
        height={LIMITS.roomH}
        rx={0.4}
        fill="var(--color-surface)"
        stroke="#a8977f"
        strokeWidth={0.4}
      />
      {items.landmarks.map((m, i) => (
        <rect
          key={i}
          x={m.x - m.w / 2}
          y={m.y - m.h / 2}
          width={m.w}
          height={m.h}
          rx={0.3}
          fill={LANDMARK_COLORS[m.kind].fill}
          stroke={LANDMARK_COLORS[m.kind].stroke}
          strokeWidth={0.15}
        />
      ))}
      {items.tables.map((tb, i) =>
        tb.shape === 'round' ? (
          <circle key={i} cx={tb.x} cy={tb.y} r={tb.w / 2} fill="#c9a27a" />
        ) : (
          <rect
            key={i}
            x={tb.x - tb.w / 2}
            y={tb.y - tb.h / 2}
            width={tb.w}
            height={tb.h}
            rx={0.15}
            fill="#c9a27a"
          />
        ),
      )}
    </svg>
  );
}
