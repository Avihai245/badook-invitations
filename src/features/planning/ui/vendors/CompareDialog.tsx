'use client';

import { Badge, Button, Dialog, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { PlanVendor } from '../../model/plan';
import { Money } from '../Money';
import { cheapestIds } from './helpers';
import { StarsDisplay } from './Stars';

/**
 * Two or more vendors of one category side by side: price (the lowest, when they differ, calmly marked),
 * what is included, rating, payment terms and notes. A real table (a row per question, a column per vendor)
 * that scrolls sideways on a phone.
 */
export function CompareDialog({
  open,
  onOpenChange,
  vendors,
  onOpenVendor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: PlanVendor[];
  onOpenVendor: (vendor: PlanVendor) => void;
}) {
  const { t, fmt } = useUi();
  const C = t.planning.vendors.compare;
  const cheapest = cheapestIds(vendors);
  const category = vendors[0]?.category ? t.planning.categories[vendors[0].category] : '';
  const text = (value: string | null) =>
    value ? (
      <span className="whitespace-pre-line">{value}</span>
    ) : (
      <span className="text-muted">{C.empty}</span>
    );

  const rows: { key: string; label: string; cell: (v: PlanVendor) => React.ReactNode }[] = [
    {
      key: 'price',
      label: C.price,
      cell: (v) =>
        v.quoteAmount === null ? (
          <span className="text-muted">{C.noPrice}</span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Money value={v.quoteAmount} className="text-[15px] font-bold" />
            {cheapest.has(v.id) ? <Badge variant="live">{C.cheapest}</Badge> : null}
          </span>
        ),
    },
    { key: 'included', label: C.included, cell: (v) => text(v.included) },
    { key: 'rating', label: C.rating, cell: (v) => <StarsDisplay value={v.rating} /> },
    { key: 'terms', label: C.terms, cell: (v) => text(v.paymentTerms) },
    { key: 'notes', label: C.notes, cell: (v) => text(v.notes) },
    { key: 'status', label: C.status, cell: (v) => t.planning.vendors.statuses[v.status] },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={C.title}
      description={fmt(C.description, { category, n: vendors.length })}
      closeLabel={C.close}
      className="sm:max-w-[860px]"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t.planning.common.close}
        </Button>
      }
    >
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[460px] border-separate border-spacing-0 text-start text-[13.5px]">
          <caption className="sr-only">{C.caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-[22%] border-b border-line p-2 text-start font-semibold text-muted"
              >
                <span className="sr-only">{C.vendor}</span>
              </th>
              {vendors.map((v) => (
                <th key={v.id} scope="col" className="border-b border-line p-2 text-start align-bottom">
                  <button
                    type="button"
                    onClick={() => onOpenVendor(v)}
                    aria-label={fmt(C.details, { name: v.name })}
                    className="min-h-11 text-start text-[14.5px] font-bold hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {v.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="border-b border-line p-2 text-start align-top text-[12.5px] font-semibold text-muted"
                >
                  {row.label}
                </th>
                {vendors.map((v) => (
                  <td
                    key={v.id}
                    className={cn(
                      'border-b border-line p-2 align-top',
                      row.key === 'price' && cheapest.has(v.id) && 'bg-success-bg text-success',
                    )}
                  >
                    {row.cell(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
