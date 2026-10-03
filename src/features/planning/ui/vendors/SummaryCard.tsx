'use client';

import { PartyPopper } from 'lucide-react';
import { Card, CardTitle } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { PlanItem, PlanVendor } from '../../model/plan';
import { Money } from '../Money';
import { vendorCost } from './helpers';
import { Stars } from './Stars';

/**
 * After the event: the vendors that were booked, what they cost, and a rating to give each (a way to
 * remember whom to recommend). No reminders: it is a summary, and rating is the host's to do or not.
 */
export function SummaryCard({
  booked,
  items,
  onRate,
  onOpen,
}: {
  booked: PlanVendor[];
  items: readonly PlanItem[];
  onRate: (vendor: PlanVendor, rating: number | null) => void;
  onOpen: (vendor: PlanVendor) => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const S = t.planning.vendors.summary;
  const unrated = booked.filter((v) => v.rating === null).length;
  const costs = booked.map((v) => vendorCost(v, items) ?? 0);
  const total = costs.reduce((a, b) => a + b, 0);
  return (
    <Card padding="md" asChild>
      <section aria-labelledby="vendors-summary-title">
        <CardTitle as="h2" id="vendors-summary-title" className="mb-1 flex items-center gap-2">
          <PartyPopper aria-hidden className="size-4" strokeWidth={1.75} />
          {S.title}
        </CardTitle>
        <p className="text-[13.5px] text-muted">{S.body}</p>
        {booked.length === 0 ? (
          <p className="mt-3 text-[14px]">{S.none}</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line">
              {booked.map((v, i) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1">
                  <button
                    type="button"
                    onClick={() => onOpen(v)}
                    className="min-h-11 min-w-0 text-start focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <span className="block truncate text-[14.5px] font-semibold">{v.name}</span>
                    <span className="block text-[12.5px] text-muted">
                      {v.category ? t.planning.categories[v.category] : null}
                      {v.category && costs[i] ? ' · ' : null}
                      {costs[i] ? <Money value={costs[i]!} /> : null}
                    </span>
                  </button>
                  <Stars
                    value={v.rating}
                    label={fmt(S.rate, { name: v.name })}
                    onChange={(rating) => onRate(v, rating)}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[14px]">
              <span className="text-muted">
                {unrated > 0 ? plural(S.unrated, unrated, { n: number(unrated) }) : S.allRated}
              </span>
              <span className="font-semibold">
                {S.total}: <Money value={total} />
              </span>
            </p>
          </>
        )}
      </section>
    </Card>
  );
}
