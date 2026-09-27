'use client';

import Link from 'next/link';
import { useId } from 'react';
import {
  Badge,
  Card,
  cn,
  DataTable,
  EmptyState,
  Hint,
  type BadgeVariant,
  type DataTableColumn,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { INVITATION_SORTS, INVITATION_STATUSES } from '../../lists';
import type { InvitationList, InvitationQuery, InvitationRow } from '../../server/core-db';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { ClearFilters, FilterDate, FilterSelect } from '../core/Filters.client';
import { Pager } from '../core/Pager.client';
import { useQueryUpdater } from '../core/query';
import { ScrollArea } from '../core/ScrollArea.client';
import { SearchBox } from '../core/SearchBox.client';

const FILTERS = ['q', 'status', 'eventType', 'template', 'lang', 'from', 'to', 'sort'] as const;
const LANGS = ['he', 'en', 'ru', 'ar', 'fr', 'es', 'am'] as const;
/** Designs shown as counts on top (the rest: "and N more"). */
const TOP_TEMPLATES = 8;

/** An invitation's status pill (a draft is the neutral pill: the 'draft' pill's grey on grey is under 4.5:1). */
export const STATUS_BADGE: Record<InvitationRow['status'], BadgeVariant> = {
  draft: 'neutral',
  published: 'live',
  archived: 'warning',
};

/** A count on top that is also a filter: pressed while the list shows only its kind. */
function CountChip({
  label,
  n,
  pressed,
  onClick,
  help,
}: {
  label: string;
  n: number;
  pressed: boolean;
  onClick(): void;
  help: string;
}) {
  const { number } = useAdminUi();
  return (
    <Hint text={help}>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors',
          pressed ? 'border-ink bg-inverse text-white' : 'border-line bg-surface hover:bg-subtle',
        )}
      >
        <span className="max-w-[160px] truncate">{label}</span>
        <span className={cn('font-semibold tabular-nums', pressed ? 'text-white' : 'text-ink')}>
          {number(n)}
        </span>
      </button>
    </Hint>
  );
}

/**
 * The invitations — "how many were created": the counts on top by status, event and design (each a
 * filter), search, filters and a sort in the address, 50 a page; a table from 768px, cards on phones.
 * The owner's email comes masked from the server for roles without users.pii.
 */
export function InvitationsScreen({
  data,
  query,
  templates,
}: {
  data: InvitationList;
  query: InvitationQuery;
  templates: Record<string, string>;
}) {
  const { t, fmt, plural, number, date, can } = useAdminUi();
  const { t: app } = useUi();
  const I = t.invitations;
  const helpId = useId();
  const { set } = useQueryUpdater();
  const filtered = FILTERS.some((k) => k !== 'sort' && query[k as keyof InvitationQuery] !== undefined);
  const eventName = (e: string) => (app.eventTypes as Record<string, string>)[e] ?? e;
  const templateName = (id: string) => templates[id] ?? id;
  const title = (row: InvitationRow) => row.title ?? I.untitled;
  const toggle = (key: 'status' | 'eventType' | 'template', value: string) =>
    set({ [key]: query[key] === value ? null : value });

  const templateCounts = Object.entries(data.counts.template).sort((a, b) => b[1] - a[1]);
  const eventCounts = Object.entries(data.counts.eventType).sort((a, b) => b[1] - a[1]);

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      key: 'invitation',
      header: I.columns.invitation,
      cell: (row) => (
        <span className="flex min-w-[170px] flex-col">
          <Link
            href={`/app/admin/invitations/${row.id}`}
            className="font-semibold underline-offset-2 hover:underline"
            data-testid="admin-invitation-link"
          >
            {title(row)}
          </Link>
          <span className="text-[12px] text-muted">{eventName(row.eventType)}</span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: I.columns.owner,
      cell: (row) => (
        <span className="flex max-w-[200px] flex-col">
          <Link
            href={`/app/admin/users/${row.owner.id}`}
            className="truncate underline-offset-2 hover:underline"
          >
            {row.owner.name ?? t.users.noName}
          </Link>
          <span dir="ltr" className="truncate text-start text-[12px] text-muted">
            {row.owner.email}
          </span>
        </span>
      ),
    },
    {
      key: 'template',
      hideBelow: '2xl',
      header: I.columns.template,
      cell: (row) => <span className="whitespace-nowrap">{templateName(row.templateId)}</span>,
    },
    {
      key: 'status',
      header: I.columns.status,
      cell: (row) => <Badge variant={STATUS_BADGE[row.status]}>{I.status[row.status]}</Badge>,
    },
    {
      key: 'event',
      header: I.columns.event,
      cell: (row) => (
        <span className="whitespace-nowrap">{row.eventDate ? date(row.eventDate) : I.noDate}</span>
      ),
    },
    {
      key: 'created',
      hideBelow: '2xl',
      header: I.columns.created,
      cell: (row) => <span className="whitespace-nowrap">{date(row.createdAt)}</span>,
    },
    {
      key: 'published',
      hideBelow: '2xl',
      header: I.columns.published,
      cell: (row) => (
        <span className="whitespace-nowrap">{row.publishedAt ? date(row.publishedAt) : I.never}</span>
      ),
    },
    { key: 'guests', header: I.columns.guests, numeric: true, cell: (row) => number(row.guests) },
    {
      key: 'rsvps',
      header: I.columns.rsvps,
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmt(I.rsvpsCell, {
            yes: number(row.rsvps.yes),
            no: number(row.rsvps.no),
            people: number(row.rsvps.people),
          })}
        </span>
      ),
    },
    { key: 'whatsapp', header: I.columns.whatsapp, numeric: true, cell: (row) => number(row.messages) },
    { key: 'visits', header: I.columns.visits, numeric: true, cell: (row) => number(row.visits) },
  ];

  return (
    <>
      <AdminPageHeader
        title={I.title}
        intro={I.intro}
        actions={
          <p className="text-[13px] text-muted tabular-nums" data-testid="admin-invitations-total">
            {plural(I.count, data.total, { count: number(data.total) })}
          </p>
        }
      />

      <Card padding="md" className="mb-4" data-testid="admin-invitation-counts">
        <h2 className="text-[15px] font-bold">{I.counts.title}</h2>
        <p className="text-[13px] text-muted">{fmt(I.counts.total, { n: number(data.counts.total) })}</p>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <h3 className="mb-1.5 text-[12px] font-semibold text-muted">{I.counts.status}</h3>
            <div className="flex flex-wrap gap-1.5">
              {INVITATION_STATUSES.map((s) => (
                <CountChip
                  key={s}
                  label={I.status[s]}
                  n={data.counts.status[s] ?? 0}
                  pressed={query.status === s}
                  onClick={() => toggle('status', s)}
                  help={I.counts.filterHelp}
                />
              ))}
            </div>
          </div>
          {eventCounts.length ? (
            <div>
              <h3 className="mb-1.5 text-[12px] font-semibold text-muted">{I.counts.eventType}</h3>
              <div className="flex flex-wrap gap-1.5">
                {eventCounts.map(([e, n]) => (
                  <CountChip
                    key={e}
                    label={eventName(e)}
                    n={n}
                    pressed={query.eventType === e}
                    onClick={() => toggle('eventType', e)}
                    help={I.counts.filterHelp}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {templateCounts.length ? (
            <div>
              <h3 className="mb-1.5 text-[12px] font-semibold text-muted">{I.counts.template}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {templateCounts.slice(0, TOP_TEMPLATES).map(([id, n]) => (
                  <CountChip
                    key={id}
                    label={templateName(id)}
                    n={n}
                    pressed={query.template === id}
                    onClick={() => toggle('template', id)}
                    help={I.counts.filterHelp}
                  />
                ))}
                {templateCounts.length > TOP_TEMPLATES ? (
                  <span className="text-[12.5px] text-muted">
                    {fmt(I.counts.more, { n: number(templateCounts.length - TOP_TEMPLATES) })}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SearchBox
            label={I.search.label}
            placeholder={I.search.placeholder}
            initial={query.q ?? ''}
            helpId={helpId}
            testId="admin-invitations-search"
          />
          <FilterSelect
            label={I.filters.sort}
            param="sort"
            value={query.sort ?? 'newest'}
            options={INVITATION_SORTS.map((s) => ({ value: s, label: I.sort[s] }))}
            testId="admin-invitations-sort"
          />
        </div>
        <p id={helpId} className="text-[12.5px] text-muted">
          {I.search.help}
          {can('users.pii') ? '' : ` ${t.common.maskedHelp}`}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <FilterSelect
            label={I.filters.status}
            param="status"
            value={query.status}
            anyLabel={I.filters.any}
            options={INVITATION_STATUSES.map((s) => ({ value: s, label: I.status[s] }))}
            testId="admin-invitations-status"
          />
          <FilterSelect
            label={I.filters.eventType}
            param="eventType"
            value={query.eventType}
            anyLabel={I.filters.any}
            options={Object.keys(app.eventTypes).map((e) => ({ value: e, label: eventName(e) }))}
            testId="admin-invitations-event"
          />
          <FilterSelect
            label={I.filters.template}
            param="template"
            value={query.template}
            anyLabel={I.filters.any}
            options={Object.entries(templates)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, name]) => ({ value: id, label: name }))}
            testId="admin-invitations-template"
          />
          <FilterSelect
            label={I.filters.lang}
            param="lang"
            value={query.lang}
            anyLabel={I.filters.any}
            options={LANGS.map((l) => ({ value: l, label: I.languages[l] ?? l }))}
            testId="admin-invitations-lang"
          />
          <FilterDate
            label={I.filters.from}
            param="from"
            value={query.from}
            max={query.to}
            testId="admin-invitations-from"
          />
          <FilterDate
            label={I.filters.to}
            param="to"
            value={query.to}
            min={query.from}
            testId="admin-invitations-to"
          />
        </div>
        <div>
          <ClearFilters params={FILTERS} active={filtered} />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState title={filtered ? t.kit.noResults : I.empty} titleAs="h2" />
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <ScrollArea label={I.title}>
              <DataTable
                caption={I.title}
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.id}
                rowData={(row) => ({ 'data-invitation': row.id })}
              />
            </ScrollArea>
          </Card>
          <ul className="flex flex-col gap-2 md:hidden" data-testid="admin-invitations-cards">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/app/admin/invitations/${row.id}`}
                  className="block rounded-card border border-line bg-surface p-4 shadow-sm transition-colors hover:bg-row-hover"
                  data-invitation={row.id}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{title(row)}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {eventName(row.eventType)} · {templateName(row.templateId)}
                      </span>
                    </span>
                    <Badge variant={STATUS_BADGE[row.status]}>{I.status[row.status]}</Badge>
                  </span>
                  <span className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-muted">
                    <span>
                      {I.columns.guests}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.guests)}
                      </span>
                    </span>
                    <span>
                      {I.columns.rsvps}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.rsvps.yes)}/{number(row.rsvps.yes + row.rsvps.no)}
                      </span>
                    </span>
                    <span>
                      {I.columns.whatsapp}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.messages)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-[12px] text-muted">
                    {row.owner.name ?? t.users.noName} · {I.columns.created} {date(row.createdAt)}
                    {row.eventDate ? ` · ${I.columns.event} ${date(row.eventDate)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} />
    </>
  );
}
