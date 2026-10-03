'use client';

import { ChartColumn, Table2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Bars, Button, Card, CardTitle, Hint } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { shekels } from '../model/budget';
import type { InsightsBudget } from '../server/insights-block';
import { Money } from './Money';

/**
 * The budget on the invitation's insights tab: what was committed in each category, with the planned
 * amount beside it, as bars — and the same numbers as a table (the "show as a table" every chart has).
 */
export function PlanningInsights({ id, data }: { id: string; data: InsightsBudget }) {
  const { t, locale } = useUi();
  const I = t.planning.insights;
  const [table, setTable] = useState(false);
  const name = (r: InsightsBudget['rows'][number]) => r.name ?? (r.key ? t.planning.categories[r.key] : '');
  const rows = data.rows.filter((r) => r.committed > 0 || r.planned > 0);
  return (
    <div className="mx-auto max-w-[1760px] px-4 pb-16 sm:px-6" data-plan-card="insights">
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle as="h2">{I.title}</CardTitle>
            <p className="mt-0.5 text-[13.5px] text-muted">{I.body}</p>
          </div>
          <div className="flex gap-2">
            <Hint text={table ? I.showChart : I.showTable}>
              <Button
                size="sm"
                variant="ghost"
                icon={table ? <ChartColumn /> : <Table2 />}
                aria-pressed={table}
                onClick={() => setTable((x) => !x)}
              >
                {table ? I.showChart : I.showTable}
              </Button>
            </Hint>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/app/invitations/${id}/plan/budget`}>{I.open}</Link>
            </Button>
          </div>
        </div>
        {table ? (
          <div className="max-h-[360px] overflow-auto rounded-input border border-line">
            <table className="w-full text-[13.5px]">
              <caption className="sr-only">{I.caption}</caption>
              <thead className="sticky top-0 bg-subtle text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">
                    {I.category}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">
                    {I.planned}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">
                    {I.committed}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">
                    {I.paid}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <th scope="row" className="px-3 py-2 text-start font-medium">
                      <bdi>{name(r)}</bdi>
                    </th>
                    <td className="px-3 py-2 text-end">
                      <Money value={r.planned} />
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Money value={r.committed} />
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Money value={r.paid} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Bars
            title={I.committed}
            titleAs="h3"
            rows={rows
              .filter((r) => r.committed > 0)
              .sort((a, b) => b.committed - a.committed)
              .map((r) => ({ key: r.id, label: name(r), value: r.committed }))}
            max={Math.max(...rows.map((r) => Math.max(r.committed, r.planned)), 1)}
            formatValue={(n) => shekels(n, locale)}
          />
        )}
      </Card>
    </div>
  );
}
