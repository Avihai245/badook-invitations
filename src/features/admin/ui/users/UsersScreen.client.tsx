'use client';

import { EyeOff, Gift, Percent, ShieldCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { Badge, Card, DataTable, EmptyState, type DataTableColumn } from '@/components/app';
import { USER_SORTS } from '../../lists';
import type { Paged, UserQuery, UserRow } from '../../server/core-db';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { ClearFilters, FilterSelect, FilterToggle } from '../core/Filters.client';
import { Pager } from '../core/Pager.client';
import { ScrollArea } from '../core/ScrollArea.client';
import { SearchBox } from '../core/SearchBox.client';
import { TimeAgo } from '../core/TimeAgo.client';
import { planLabel, sourceLabel } from './labels';

const FILTERS = ['q', 'source', 'plan', 'discount', 'staff', 'suspended', 'sort'] as const;

/** The badges beside a user's name: staff, suspended, a discount, a plan given as a gift. */
function UserBadges({ row }: { row: UserRow }) {
  const { t, fmt } = useAdminUi();
  return (
    <span className="flex flex-wrap gap-1">
      {row.staffRole ? (
        <Badge variant="info" icon={<ShieldCheck />}>
          {fmt(t.users.staffBadge, { role: t.roles[row.staffRole] })}
        </Badge>
      ) : null}
      {row.suspended ? (
        <Badge variant="danger" icon={<UserX />}>
          {t.users.suspended}
        </Badge>
      ) : null}
      {row.discount?.active ? (
        <Badge variant="warning" icon={<Percent />}>
          {fmt(t.users.discountBadge, { percent: row.discount.percent })}
        </Badge>
      ) : null}
      {row.gift ? (
        <Badge variant="live" icon={<Gift />}>
          {t.users.gift}
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * The users: search (the name — and the email and phone for roles allowed to see them), filters and a
 * sort in the address, 50 a page; a table from 768px, cards on phones. Contact details come masked
 * from the server for roles without users.pii.
 */
export function UsersScreen({ data, query }: { data: Paged<UserRow>; query: UserQuery }) {
  const { t, fmt, plural, number, date, can } = useAdminUi();
  const u = t.users;
  const pii = can('users.pii');
  const helpId = useId();
  const filtered = FILTERS.some((k) => query[k as keyof UserQuery] !== undefined && k !== 'sort');
  const name = (row: UserRow) => row.name ?? u.noName;

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: 'name',
      header: u.columns.name,
      cell: (row) => (
        <span className="flex min-w-[160px] flex-col gap-1">
          <Link
            href={`/app/admin/users/${row.id}`}
            className="font-semibold text-ink underline-offset-2 hover:underline"
            data-testid="admin-user-link"
          >
            {name(row)}
          </Link>
          <UserBadges row={row} />
        </span>
      ),
    },
    {
      key: 'email',
      header: u.columns.email,
      cell: (row) => (
        <span dir="ltr" className="block max-w-[220px] truncate text-start" title={row.email}>
          {row.email}
        </span>
      ),
    },
    {
      key: 'phone',
      header: u.columns.phone,
      cell: (row) =>
        row.phone ? (
          <span dir="ltr" className="whitespace-nowrap">
            {row.phone}
          </span>
        ) : (
          <span className="text-muted">{u.noPhone}</span>
        ),
    },
    {
      key: 'source',
      header: u.columns.source,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap">{sourceLabel(t, row.source)}</span>
          {row.venue ? <span className="text-[12px] text-muted">{row.venue}</span> : null}
        </span>
      ),
    },
    {
      key: 'plan',
      header: u.columns.plan,
      cell: (row) => (
        <span className="flex flex-col whitespace-nowrap">
          <span className="font-medium">{planLabel(t, row.effectivePlan)}</span>
          {row.plan !== 'free' ? (
            <span className="text-[12px] text-muted">
              {row.gift
                ? u.gift
                : row.planStatus === 'active' && row.planRenewsAt
                  ? fmt(u.renews, { date: date(row.planRenewsAt) })
                  : u.planStatus[row.planStatus]}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'credits', header: u.columns.credits, numeric: true, cell: (row) => number(row.credits) },
    {
      key: 'invitations',
      header: u.columns.invitations,
      numeric: true,
      cell: (row) => (
        <span className="whitespace-nowrap">
          {number(row.invitations.active)} / {number(row.invitations.total)}
        </span>
      ),
    },
    { key: 'whatsapp', header: u.columns.whatsapp, numeric: true, cell: (row) => number(row.messagesSent) },
    {
      key: 'joined',
      header: u.columns.joined,
      cell: (row) => <span className="whitespace-nowrap">{date(row.createdAt)}</span>,
    },
    {
      key: 'lastSignIn',
      header: u.columns.lastSignIn,
      cell: (row) =>
        row.lastSignInAt ? (
          <TimeAgo at={row.lastSignInAt} className="whitespace-nowrap" />
        ) : (
          <span className="text-muted">{t.kit.never}</span>
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={u.title}
        intro={u.intro}
        actions={
          <p className="text-[13px] text-muted tabular-nums" data-testid="admin-users-total">
            {plural(u.count, data.total, { count: number(data.total) })}
          </p>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SearchBox
            label={u.search.label}
            placeholder={pii ? u.search.placeholder : u.search.placeholderMasked}
            initial={query.q ?? ''}
            helpId={helpId}
            testId="admin-users-search"
          />
          <FilterSelect
            label={u.filters.source}
            param="source"
            value={query.source}
            anyLabel={u.filters.any}
            options={(['signup', 'google', 'partner'] as const).map((s) => ({
              value: s,
              label: u.sources[s],
            }))}
            testId="admin-users-source"
          />
          <FilterSelect
            label={u.filters.plan}
            param="plan"
            value={query.plan}
            anyLabel={u.filters.any}
            options={(['free', 'pro', 'business'] as const).map((p) => ({ value: p, label: u.plans[p] }))}
            testId="admin-users-plan"
          />
          <FilterSelect
            label={u.filters.sort}
            param="sort"
            value={query.sort ?? 'newest'}
            options={USER_SORTS.map((s) => ({ value: s, label: u.sort[s] }))}
            testId="admin-users-sort"
          />
        </div>
        <p id={helpId} className="flex items-center gap-1.5 text-[12.5px] text-muted">
          {pii ? null : <EyeOff aria-hidden className="size-3.5" />}
          {pii ? u.search.help : u.search.helpMasked}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterToggle
            label={u.filters.discount}
            help={u.filters.toggleHelp}
            param="discount"
            on={!!query.discount}
            testId="admin-users-discount"
          />
          <FilterToggle
            label={u.filters.staff}
            help={u.filters.toggleHelp}
            param="staff"
            on={!!query.staff}
            testId="admin-users-staff"
          />
          <FilterToggle
            label={u.filters.suspended}
            help={u.filters.toggleHelp}
            param="suspended"
            on={!!query.suspended}
            testId="admin-users-suspended"
          />
          <ClearFilters params={FILTERS} active={filtered} />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState title={filtered ? t.kit.noResults : u.empty} titleAs="h2" />
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <ScrollArea label={u.title}>
              <DataTable
                caption={u.title}
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.id}
                rowData={(row) => ({ 'data-user': row.id })}
              />
            </ScrollArea>
          </Card>
          <ul className="flex flex-col gap-2 md:hidden" data-testid="admin-users-cards">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/app/admin/users/${row.id}`}
                  className="block rounded-card border border-line bg-surface p-4 shadow-sm transition-colors hover:bg-row-hover"
                  data-user={row.id}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{name(row)}</span>
                      <span dir="ltr" className="block truncate text-start text-[12.5px] text-muted">
                        {row.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12.5px] font-medium">
                      {planLabel(t, row.effectivePlan)}
                    </span>
                  </span>
                  <span className="mt-2 block">
                    <UserBadges row={row} />
                  </span>
                  <span className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-muted">
                    <span>
                      {u.columns.credits}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.credits)}
                      </span>
                    </span>
                    <span>
                      {u.columns.invitations}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.invitations.total)}
                      </span>
                    </span>
                    <span>
                      {u.columns.whatsapp}
                      <span className="block text-[14px] font-semibold text-ink tabular-nums">
                        {number(row.messagesSent)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 block text-[12px] text-muted">
                    {sourceLabel(t, row.source)}
                    {row.venue ? ` · ${row.venue}` : ''} · {u.columns.joined} {date(row.createdAt)}
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
