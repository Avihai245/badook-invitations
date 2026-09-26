'use client';

import { Building2, FileUp, Ruler, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Dialog, Hint, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { planScale } from '../geometry';
import { LIMITS, type Layout, type VenueInfo } from '../model';
import { PLAN_ACCEPT } from './plan-file';

export type PlanBusy = { kind: 'uploading'; percent: number } | { kind: 'rendering' } | null;

/**
 * The floor plan: upload an image or a PDF (its first page), use the venue's plan (a partner venue sent
 * it), remove it — and its scale: draw a line of known length on the map, or type the plan's width.
 */
export function PlanDialog({
  layout,
  planUrl,
  venue,
  usingVenue,
  busy,
  error,
  onFile,
  onUseVenue,
  onRemove,
  onDrawLine,
  onWidth,
  onClose,
}: {
  layout: Layout;
  planUrl: string | null;
  venue: VenueInfo | null;
  usingVenue: boolean;
  busy: PlanBusy;
  error: string | null;
  onFile(file: File): void;
  onUseVenue(): void;
  onRemove(): void;
  onDrawLine(): void;
  onWidth(meters: number): void;
  onClose(): void;
}) {
  const { t, fmt, number } = useUi();
  const p = t.seating.plan;
  const input = useRef<HTMLInputElement>(null);
  const bg = layout.background;
  const scale = planScale(layout);
  const widthM = bg?.width && scale ? Math.round(bg.width * scale * 10) / 10 : null;
  const [width, setWidth] = useState(widthM ? String(widthM) : '');
  const working = busy !== null;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !working && onClose()}
      title={p.title}
      description={p.subtitle}
      closeLabel={t.common.close}
    >
      <div className="flex flex-col gap-4" data-testid="plan-dialog">
        {bg && planUrl ? (
          <div className="overflow-hidden rounded-card border border-line bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element -- a plan from storage, shown as is */}
            <img src={planUrl} alt="" className="mx-auto max-h-[180px] w-auto object-contain" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={PLAN_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="plan-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
          <Button icon={<FileUp />} loading={working} onClick={() => input.current?.click()}>
            {bg ? p.replace : p.upload}
          </Button>
          {bg ? (
            <Hint text={p.removeHint}>
              <Button variant="ghost" icon={<Trash2 />} disabled={working} onClick={onRemove}>
                {p.remove}
              </Button>
            </Hint>
          ) : null}
        </div>
        <p className="-mt-2 text-[12px] text-muted">{p.types}</p>
        {busy ? (
          <p role="status" className="text-[13px] text-muted">
            {busy.kind === 'rendering' ? p.rendering : fmt(p.uploading, { percent: busy.percent })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {venue?.plan ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-brand-soft/60 p-3">
            <Building2 aria-hidden className="size-5 shrink-0 text-brand-deep" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">{fmt(p.venue, { venue: venue.name })}</p>
              <p className="text-[12px] text-muted">{p.venueHint}</p>
            </div>
            {usingVenue ? (
              <span className="text-[12.5px] font-semibold text-brand-deep">{p.current}</span>
            ) : (
              <Button size="sm" variant="secondary" disabled={working} onClick={onUseVenue}>
                {p.useVenue}
              </Button>
            )}
          </div>
        ) : null}

        <section className="border-t border-line pt-3">
          <h3 className="text-[13px] font-bold">{p.scaleTitle}</h3>
          {bg?.width ? (
            <>
              <p className="mt-0.5 text-[12.5px] text-muted" data-testid="plan-scale">
                {layout.metersPerPixel
                  ? fmt(p.calibrated, { meters: number(widthM ?? 0) })
                  : fmt(p.notCalibrated, { meters: LIMITS.assumedPlanWidth })}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Hint text={p.drawLineHint}>
                  <Button variant="secondary" icon={<Ruler />} onClick={onDrawLine} data-testid="draw-line">
                    {p.drawLine}
                  </Button>
                </Hint>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const m = Number(width.replace(',', '.'));
                    if (m > 0 && m <= 5000) onWidth(m);
                  }}
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold text-muted">{p.widthLabel}</span>
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="h-9 w-28"
                      data-testid="plan-width"
                    />
                  </label>
                  <Button type="submit" variant="secondary" size="md">
                    {p.apply}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-muted">{p.noPlanScale}</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}

/** After a line is drawn on the plan: how long is it really? */
export function LineLengthDialog({ onApply, onClose }: { onApply(meters: number): void; onClose(): void }) {
  const { t } = useUi();
  const p = t.seating.plan;
  const [value, setValue] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={p.scaleTitle}
      description={p.drawLineHint}
      closeLabel={t.common.close}
    >
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const m = Number(value.replace(',', '.'));
          if (m > 0 && m <= 5000) onApply(m);
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[13px] font-semibold">{p.lineLength}</span>
          <Input
            autoFocus
            inputMode="decimal"
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="line-length"
          />
        </label>
        <Button type="submit">{p.apply}</Button>
      </form>
    </Dialog>
  );
}
