'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Hint } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';
import { useQueryUpdater } from './query';

/** A list's pages: the previous and the next one, and where we are ("page 2 of 7"). */
export function Pager({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const { t, fmt, number, dir } = useAdminUi();
  const { set, pending } = useQueryUpdater();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && page <= 1) return null;
  const go = (p: number) => set({ page: p > 1 ? String(p) : null });
  // the arrows point the way the pages go in the language's reading order
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <nav aria-label={t.kit.pagesLabel} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <Hint text={t.kit.previousHelp}>
        <Button
          variant="secondary"
          size="sm"
          icon={<Prev />}
          disabled={page <= 1 || pending}
          onClick={() => go(page - 1)}
        >
          {t.common.previous}
        </Button>
      </Hint>
      <p className="text-[13px] text-muted tabular-nums" aria-live="polite">
        {fmt(t.kit.page, { page: number(Math.min(page, pages)), pages: number(pages) })}
      </p>
      <Hint text={t.kit.nextHelp}>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages || pending}
          onClick={() => go(page + 1)}
          className="flex-row-reverse"
          icon={<Next />}
        >
          {t.common.next}
        </Button>
      </Hint>
    </nav>
  );
}
