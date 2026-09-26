'use client';

import { ArrowRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { Button, Checkbox, Hint, Segmented } from '@/components/app';
import { intlLocale } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';

export interface TableCard {
  unitId: string;
  name: string;
  seats: number;
  table: { number: number; label: string | null };
  /** its entrance code as a QR (SVG, generated on the server), when the event checks guests in */
  qr: string | null;
}

type Order = 'name' | 'table';

/**
 * Table cards to print (/app/invitations/[id]/seating/cards): a card per family with its name and its
 * table's number — A–Z for the table at the entrance, or grouped by table — and, when the event checks
 * guests in at the door, the family's entrance code on it (scanned at the station like the one on
 * their phone). "Print / Save as PDF" opens the browser's print window; the cards are cut along the
 * dashed lines.
 */
export function TableCards({
  id,
  title,
  subtitle,
  cards,
  codes,
}: {
  id: string;
  title: string;
  subtitle: string;
  cards: readonly TableCard[];
  /** the event checks guests in: the entrance code can go on the cards */
  codes: boolean;
}) {
  const { t, fmt, plural, number, locale, date } = useUi();
  const C = t.eventDay.cards;
  const [order, setOrder] = useState<Order>('name');
  const [qr, setQr] = useState(codes);
  const collator = useMemo(() => new Intl.Collator(intlLocale(locale), { sensitivity: 'base' }), [locale]);
  const byName = useMemo(
    () => [...cards].sort((a, b) => collator.compare(a.name, b.name)),
    [cards, collator],
  );
  const byTable = useMemo(() => {
    const groups = new Map<number, TableCard[]>();
    for (const c of byName) groups.set(c.table.number, [...(groups.get(c.table.number) ?? []), c]);
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [byName]);

  const card = (c: TableCard) => (
    <li
      key={c.unitId}
      className="flex min-h-[34mm] break-inside-avoid items-center gap-3 border border-dashed border-line-strong bg-white p-3"
      data-card={c.name}
      data-card-table={c.table.number}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-tight font-bold">
          <bdi>{c.name}</bdi>
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted">{plural(C.seats, c.seats, { n: number(c.seats) })}</p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold text-muted">{C.table}</span>
          <span className="text-[30px] leading-none font-bold tabular-nums">{c.table.number}</span>
        </p>
        {c.table.label ? <p className="mt-0.5 truncate text-[11.5px] text-muted">{c.table.label}</p> : null}
      </div>
      {qr && c.qr ? (
        <div
          aria-hidden
          className="size-[24mm] shrink-0 [&>svg]:size-full"
          // generated on the server from the family's code (no user markup)
          dangerouslySetInnerHTML={{ __html: c.qr }}
        />
      ) : null}
    </li>
  );

  return (
    <div className="table-cards min-h-dvh bg-canvas print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 10mm; }
@media print { html, body { background: #fff !important; } }`}</style>
      <div className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Button variant="ghost" size="sm" icon={<ArrowRight className="icon-dir rotate-180" />} asChild>
            <Link href={`/app/invitations/${id}/seating`}>{C.back}</Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted">{C.sort}</span>
            <Segmented
              label={C.sort}
              value={order}
              onValueChange={setOrder}
              options={[
                { value: 'name', label: C.byName },
                { value: 'table', label: C.byTable },
              ]}
            />
          </div>
          {codes ? (
            <Hint text={C.qrHint}>
              <span>
                <Checkbox label={C.qr} checked={qr} onCheckedChange={setQr} />
              </span>
            </Hint>
          ) : null}
          <Hint text={C.printHint}>
            <Button
              icon={<Printer />}
              onClick={() => window.print()}
              className="ms-auto"
              data-testid="cards-print"
            >
              {C.print}
            </Button>
          </Hint>
        </div>
      </div>

      <main className="mx-auto max-w-[1100px] px-4 py-6 print:max-w-none print:p-0">
        <header className="mb-4">
          <h1 className="text-[22px] font-bold">
            {C.title} · <bdi>{title}</bdi>
          </h1>
          <p className="text-[13px] text-muted">
            {subtitle} ·{' '}
            {fmt(C.generated, {
              date: date(new Date(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            })}
          </p>
        </header>
        {!cards.length ? (
          <p className="text-[14px] text-muted">{C.empty}</p>
        ) : order === 'name' ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3" data-testid="cards">
            {byName.map(card)}
          </ul>
        ) : (
          <div data-testid="cards">
            {byTable.map(([n, list]) => (
              <Fragment key={n}>
                <h2 className="mt-5 mb-2 break-after-avoid text-[16px] font-bold first:mt-0">
                  {fmt(C.tableHeading, { number: n })}
                </h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3">{list.map(card)}</ul>
              </Fragment>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
