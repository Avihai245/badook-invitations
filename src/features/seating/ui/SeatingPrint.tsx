'use client';

import { ArrowRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, Checkbox, Hint, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { guestRows, tableRows } from '../export';
import { contentBounds, itemsBounds, planSize } from '../geometry';
import type { SeatingState } from '../model';
import { occupancy, unitsById } from '../plan';
import { LandmarkGlyph, TableGlyph } from './glyphs';

type Paper = 'A4' | 'A3';
type Orientation = 'portrait' | 'landscape';

/**
 * The print view (/app/invitations/[id]/seating/print): the map of the hall, every guest A→Z with
 * their table number (for the entrance), and the tables with who sits at each — on A4 or A3, portrait
 * or landscape. "Print / Save as PDF" opens the browser's print window.
 */
export function SeatingPrint({
  id,
  state,
  title,
  subtitle,
  planBase,
}: {
  id: string;
  state: SeatingState;
  title: string;
  subtitle: string;
  planBase: string;
}) {
  const { t, fmt, number, locale, date } = useUi();
  const p = t.seating.print;
  const [paper, setPaper] = useState<Paper>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [show, setShow] = useState({ map: true, list: true, byTable: true });
  const { plan, units } = state;
  const byId = useMemo(() => unitsById(units), [units]);
  const taken = useMemo(() => occupancy(plan, byId), [plan, byId]);
  const guests = useMemo(() => guestRows(plan, units, locale), [plan, units, locale]);
  const tables = useMemo(() => tableRows(plan, units, locale), [plan, units, locale]);
  const size = planSize(plan.layout);
  const bg = plan.layout.background;
  // the plan whole; without one, just the tables and marks
  const box = (size ? null : itemsBounds(plan)) ?? contentBounds(plan);
  const planUrl = bg && bg.type !== 'application/pdf' && planBase ? `${planBase}/${bg.path}` : null;
  const columns = (paper === 'A3' ? 1 : 0) + (orientation === 'landscape' ? 3 : 2);
  const pad = 1;

  return (
    <div className="seating-print min-h-dvh bg-canvas print:bg-white">
      <style>{`@page { size: ${paper} ${orientation}; margin: 12mm; }
@media print { html, body { background: #fff !important; } .seating-print section { break-inside: auto; } }`}</style>
      <div className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Button variant="ghost" size="sm" icon={<ArrowRight className="icon-dir rotate-180" />} asChild>
            <Link href={`/app/invitations/${id}/seating`}>{p.back}</Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted">{p.paper}</span>
            <Segmented
              label={p.paper}
              value={paper}
              onValueChange={setPaper}
              options={[
                { value: 'A4', label: 'A4' },
                { value: 'A3', label: 'A3' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted">{p.orientation}</span>
            <Segmented
              label={p.orientation}
              value={orientation}
              onValueChange={setOrientation}
              options={[
                { value: 'portrait', label: p.portrait },
                { value: 'landscape', label: p.landscape },
              ]}
            />
          </div>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">{p.show}</legend>
            {(['map', 'list', 'byTable'] as const).map((k) => (
              <Checkbox
                key={k}
                label={p[k]}
                checked={show[k]}
                onCheckedChange={(v) => setShow({ ...show, [k]: v })}
              />
            ))}
          </fieldset>
          <Hint text={p.printHint}>
            <Button
              icon={<Printer />}
              onClick={() => window.print()}
              className="ms-auto"
              data-testid="print-now"
            >
              {p.print}
            </Button>
          </Hint>
        </div>
      </div>

      <main className="mx-auto max-w-[1100px] px-4 py-6 print:max-w-none print:p-0">
        <header className="mb-4">
          <h1 className="text-[22px] font-bold">
            {p.title} · <bdi>{title}</bdi>
          </h1>
          <p className="text-[13px] text-muted">
            {subtitle} ·{' '}
            {fmt(p.generated, {
              date: date(new Date(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            })}
          </p>
        </header>

        {show.map ? (
          <section
            className="mb-6 break-after-page rounded-card border border-line bg-white p-2 print:border-0 print:p-0"
            data-testid="print-map"
          >
            <svg
              viewBox={`${box.x - pad} ${box.y - pad} ${box.w + 2 * pad} ${box.h + 2 * pad}`}
              className="h-auto max-h-[80vh] w-full print:max-h-[calc(100vh-40mm)]"
              role="img"
              aria-label={t.seating.canvas.label}
            >
              {planUrl && size ? (
                <image href={planUrl} x={0} y={0} width={size.w} height={size.h} preserveAspectRatio="none" />
              ) : null}
              {plan.layout.landmarks.map((m) => (
                <LandmarkGlyph
                  key={m.id}
                  landmark={m}
                  label={m.label || t.seating.landmarks[m.kind]}
                  fontSize={0.9}
                />
              ))}
              {plan.tables.map((x) => (
                <TableGlyph key={x.id} table={x} seated={taken.get(x.id) ?? 0} fontSize={0.7} />
              ))}
            </svg>
          </section>
        ) : null}

        {show.list ? (
          <section className="mb-6 break-after-page" data-testid="print-list">
            <h2 className="mb-2 text-[17px] font-bold">{p.listTitle}</h2>
            {guests.length === 0 ? (
              <p className="text-[13px] text-muted">{p.empty}</p>
            ) : (
              <ol className="gap-x-6 text-[12.5px]" style={{ columnCount: columns }}>
                {guests.map((g) => (
                  <li
                    key={g.unitId}
                    className="flex break-inside-avoid items-baseline gap-2 border-b border-dotted border-line py-1"
                  >
                    <span className="min-w-0 flex-1">
                      <bdi className="font-semibold">{g.name}</bdi>
                      {g.seats > 1 ? <span className="text-muted"> ({number(g.seats)})</span> : null}
                      {g.people.length > 1 ? (
                        <span className="block text-[11px] leading-snug text-muted">
                          {g.people.join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {g.table ? (
                        fmt(p.table, { number: g.table })
                      ) : (
                        <span className="font-normal text-muted">{p.noTable}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {show.byTable ? (
          <section data-testid="print-tables">
            <h2 className="mb-2 text-[17px] font-bold">{p.tablesTitle}</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {tables.map((r) => (
                <div
                  key={r.table.id}
                  className="break-inside-avoid rounded-[10px] border border-line bg-white p-2.5"
                >
                  <p className="flex items-baseline justify-between gap-2 text-[13.5px] font-bold">
                    <span>
                      {fmt(p.table, { number: r.table.number })}
                      {r.table.label ? (
                        <span className="font-normal text-muted"> · {r.table.label}</span>
                      ) : null}
                    </span>
                    <span className="text-[12px] font-semibold text-muted tabular-nums" dir="ltr">
                      {fmt(p.seats, { seated: r.seated, capacity: r.table.capacity })}
                    </span>
                  </p>
                  <ul className="mt-1 text-[12px] leading-snug">
                    {r.units.map((u) => (
                      <li key={u.id}>
                        <bdi>{u.name}</bdi>
                        {u.seats > 1 ? <span className="text-muted"> ({number(u.seats)})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
