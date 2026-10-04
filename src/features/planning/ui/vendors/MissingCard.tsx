'use client';

import { CircleCheck, Plus } from 'lucide-react';
import { Button, Card, CardTitle } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { CategoryKey } from '../../model/categories';
import type { MissingRow } from './helpers';

/**
 * "What is missing": the event's required categories with no closed vendor, and the others with vendors
 * still in progress — each with a quick "add vendor" that opens the form with the category chosen.
 */
export function MissingCard({ rows, onAdd }: { rows: MissingRow[]; onAdd: (category: CategoryKey) => void }) {
  const { t, fmt, plural, number } = useUi();
  const M = t.planning.vendors.missing;
  return (
    <Card padding="md" asChild>
      <section aria-labelledby="vendors-missing-title">
        <CardTitle as="h2" id="vendors-missing-title" className="mb-1">
          {M.title}
        </CardTitle>
        <p className="mb-3 text-[13.5px] text-muted">{M.body}</p>
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-[14px] font-medium text-success">
            <CircleCheck aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            {M.allClosed}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const name = t.planning.categories[row.category];
              const open = row.inProgress.length;
              return (
                <li
                  key={row.category}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{name}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      {open > 0
                        ? `${plural(M.inProgress, open, { n: number(open) })}: ${row.inProgress.map((v) => v.name).join(', ')}`
                        : M.noVendor}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Plus />}
                    className="min-h-11"
                    aria-label={fmt(M.addFor, { category: name })}
                    onClick={() => onAdd(row.category)}
                  >
                    {M.add}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
}
