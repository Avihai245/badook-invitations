'use client';

import { ChevronsUp, History, X } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, EmptyState, Hint } from '@/components/app';
import type { AuditPage, AuditQuery } from '../../server/core-db';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { FilterSelect } from '../core/Filters.client';
import { useQueryUpdater } from '../core/query';
import { TimeAgo } from '../core/TimeAgo.client';
import { describeAudit } from './describe';

/** The action filter's choices: each area (all its actions), then each action on record. */
const AREAS = ['users', 'invitations', 'staff', 'support', 'finance', 'partners', 'system'] as const;
const TARGETS = ['user', 'invitation', 'ticket', 'staff', 'payment', 'partner', 'system'] as const;

/**
 * The record of actions, newest first, a page at a time (by id): each entry in words — who did what
 * to whom, the reason, when — with a link to what it was about. Filters: who, the action (or its
 * area), the kind of target; a link from a user's page shows only what was done about them.
 */
export function AuditScreen({
  data,
  query,
  aboutName,
}: {
  data: AuditPage;
  query: AuditQuery;
  /** the one target the list is about (from a user's page), in words */
  aboutName: string | null;
}) {
  const ui = useAdminUi();
  const { t, fmt, number } = ui;
  const A = t.audit;
  const { set, pending } = useQueryUpdater();
  const filtered = !!(query.actor || query.action || query.targetType || query.targetId);
  const actions = [
    ...AREAS.map((a) => ({ value: a, label: A.areas[a] ?? a })),
    ...data.actions.map((a) => ({ value: a, label: A.actions[a] ?? a })),
  ];

  return (
    <>
      <AdminPageHeader title={A.title} intro={A.intro} />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <FilterSelect
          label={A.filters.actor}
          param="actor"
          value={query.actor}
          anyLabel={A.filters.anyone}
          options={data.actors.map((a) => ({
            value: a.id,
            label: a.name ? `${a.name} (${a.email})` : a.email,
          }))}
          testId="admin-audit-actor"
          className="min-w-[200px]"
        />
        <FilterSelect
          label={A.filters.action}
          param="action"
          value={query.action}
          anyLabel={A.filters.anything}
          options={actions}
          testId="admin-audit-action"
          className="min-w-[200px]"
        />
        <FilterSelect
          label={A.filters.target}
          param="targetType"
          value={query.targetType}
          anyLabel={A.filters.anyTarget}
          options={TARGETS.map((x) => ({ value: x, label: A.targets[x] ?? x }))}
          testId="admin-audit-target"
        />
        {query.targetId ? (
          <Hint text={A.filters.aboutHelp}>
            <Button
              variant="secondary"
              size="sm"
              icon={<X />}
              onClick={() => set({ targetId: null, targetType: null })}
              className="h-10"
            >
              {fmt(A.filters.about, { name: aboutName ?? query.targetId })}
            </Button>
          </Hint>
        ) : null}
        {filtered ? (
          <Hint text={t.kit.clearFiltersHelp}>
            <Button
              variant="ghost"
              size="sm"
              icon={<X />}
              onClick={() =>
                set({ actor: null, action: null, targetType: null, targetId: null, before: null })
              }
              className="h-10"
            >
              {t.kit.clearFilters}
            </Button>
          </Hint>
        ) : null}
      </div>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState title={filtered ? A.noResults : A.empty} titleAs="h2" />
        </Card>
      ) : (
        <Card className="overflow-hidden" aria-busy={pending || undefined}>
          <ol className="divide-y divide-line" data-testid="admin-audit-list">
            {data.rows.map((row) => {
              const line = describeAudit(row, ui);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
                  data-action={row.action}
                >
                  <span className="shrink-0 text-[12.5px] text-muted sm:w-[140px]">
                    <TimeAgo at={row.at} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[13.5px] [overflow-wrap:anywhere]"
                      data-testid="admin-audit-text"
                    >
                      {line.href ? (
                        <Link href={line.href} className="underline-offset-2 hover:underline">
                          {line.text}
                        </Link>
                      ) : (
                        line.text
                      )}
                    </span>
                    {line.detail ? (
                      <span className="block text-[12.5px] text-muted">{line.detail}</span>
                    ) : null}
                    {line.reason ? (
                      <span className="block text-[12.5px] text-muted" data-testid="admin-audit-reason">
                        {fmt(A.reason, { reason: line.reason })}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <nav aria-label={t.kit.pagesLabel} className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {query.before ? (
          <Hint text={A.newerHelp}>
            <Button variant="secondary" size="sm" icon={<ChevronsUp />} onClick={() => set({ before: null })}>
              {A.newer}
            </Button>
          </Hint>
        ) : (
          <span />
        )}
        {data.next ? (
          <Hint text={fmt(A.olderHelp, { n: number(query.limit ?? 50) })}>
            <Button
              variant="secondary"
              size="sm"
              icon={<History />}
              disabled={pending}
              onClick={() => set({ before: String(data.next) })}
              data-testid="admin-audit-older"
            >
              {A.older}
            </Button>
          </Hint>
        ) : null}
      </nav>
      <p className="mt-3 text-[12px] text-muted">{A.kept}</p>
    </>
  );
}
