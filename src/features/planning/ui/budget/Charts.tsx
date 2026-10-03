'use client';

import { ChartColumn, Table2 } from 'lucide-react';
import { useState } from 'react';
import { Bars, Button, Card, CardTitle, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryRows } from '../../model/budget-view';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';

type Metric = 'planned' | 'committed' | 'paid';
const METRICS: Metric[] = ['planned', 'committed', 'paid'];

/** The budget by category: bars of one number at a time (planned, committed or paid), or the same numbers as a table. */
export function Charts({ past }: { past: boolean }) {
  const { t, locale } = useUi();
  const T = t.planning.budget;
  const C = T.chart;
  const { view } = usePlan();
  const [metric, setMetric] = useState<Metric>('committed');
  const [table, setTable] = useState(false);
  const rows = categoryRows(view).map((r) => ({
    id: r.category.id,
    name: r.category.name ?? (r.category.key ? t.planning.categories[r.category.key] : ''),
    totals: r.totals,
  }));
  if (rows.length === 0) return null;
  const compact = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const shown = metric === 'planned' && past ? 'committed' : metric;

  return (
    <Card padding="lg" data-testid="budget-chart">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <CardTitle as="h2" className="mb-0">
          {C.title}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          icon={table ? <ChartColumn /> : <Table2 />}
          onClick={() => setTable((x) => !x)}
          aria-pressed={table}
        >
          {table ? C.showChart : C.showTable}
        </Button>
      </div>
      <p className="mb-3 text-[12.5px] text-muted">{C.caption}</p>
      {table ? (
        <div className="max-h-[420px] overflow-auto rounded-input border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{C.table}</caption>
            <thead className="sticky top-0 bg-subtle text-start">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">
                  {C.category}
                </th>
                {METRICS.map((m) => (
                  <th key={m} scope="col" className="px-3 py-2 text-end font-semibold">
                    {T.kpi[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-start font-normal">
                    {r.name}
                  </th>
                  {METRICS.map((m) => (
                    <td key={m} className="px-3 py-1.5 text-end">
                      <Money value={r.totals[m]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Segmented<Metric>
            label={C.metric}
            value={shown}
            onValueChange={setMetric}
            options={METRICS.filter((m) => !(past && m === 'planned')).map((m) => ({
              value: m,
              label: T.kpi[m],
            }))}
          />
          <Bars
            labelWidth={112}
            rows={[...rows]
              .sort((a, b) => b.totals[shown] - a.totals[shown])
              .map((r) => ({ key: r.id, label: r.name, value: r.totals[shown] }))}
            formatValue={(v) => <bdi dir="ltr">{compact.format(v)}</bdi>}
          />
        </div>
      )}
    </Card>
  );
}
