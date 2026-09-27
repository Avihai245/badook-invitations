'use client';

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  MessageSquareReply,
  Search,
  Timer,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Hint,
  Input,
  KpiCard,
  Segmented,
  Select,
  cn,
} from '@/components/app';
import { AdminPageHeader } from '@/features/admin/ui/AdminShell.client';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import { TICKET_CATEGORIES, TICKETS } from '../config';
import type {
  AdminSupportList,
  AdminSupportSummary,
  AdminTicketItem,
  InboxQuery,
  InboxScope,
} from '../types';
import { inboxHref } from './query';
import { AdminStatusBadge, PriorityBadge, duration } from './shared';

const TABS = ['open', 'waiting', 'closed', 'all'] as const;
/** An open ticket waiting longer than this is late (its waiting time turns red). */
const LATE_MS = 24 * 3_600_000;

/**
 * /app/admin/support: the inbox — the numbers, the tabs (waiting for the team / for the customer /
 * closed / all) with their counts, filters (whose, type, priority), a search, and the tickets with the
 * latest activity first and how long each has been waiting. The console's live channel refreshes it
 * when a ticket opens or a customer answers.
 */
export function SupportInbox({
  query,
  list,
  summary,
  replyTime,
}: {
  query: InboxQuery;
  list: AdminSupportList;
  summary: AdminSupportSummary | null;
  /** the median time to the team's first answer over the last 30 days */
  replyTime: { medianMinutes: number | null; answered: number } | null;
}) {
  const { t, fmt, number } = useAdminUi();
  const s = t.support;
  const router = useRouter();
  const [search, setSearch] = useState(query.q);
  useEffect(() => setSearch(query.q), [query.q]);
  const go = (patch: Partial<InboxQuery>) => router.push(inboxHref(query, patch));
  const filtered = query.scope !== 'all' || !!query.category || !!query.priority || !!query.q;
  const pageSize = TICKETS.pageSize;
  const pages = Math.max(1, Math.ceil(list.total / pageSize));
  const from = list.total ? (query.page - 1) * pageSize + 1 : 0;
  const to = Math.min(list.total, query.page * pageSize);

  return (
    <>
      <AdminPageHeader title={s.title} intro={s.intro} />
      {summary ? <Numbers summary={summary} replyMinutes={replyTime?.medianMinutes ?? null} /> : null}

      <nav
        aria-label={s.tabs.label}
        className="grid grid-cols-2 gap-2 sm:flex sm:gap-1 sm:overflow-x-auto sm:border-b sm:border-line"
        data-testid="inbox-tabs"
      >
        {TABS.map((tab) => {
          const active = query.status === tab;
          return (
            <Link
              key={tab}
              href={inboxHref(query, { status: tab })}
              aria-current={active ? 'page' : undefined}
              data-testid={`inbox-tab-${tab}`}
              className={cn(
                'flex min-w-0 items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-[13.5px] transition-colors',
                'sm:-mb-px sm:shrink-0 sm:justify-start sm:rounded-none sm:border-0 sm:border-b-2 sm:px-3 sm:py-2.5 sm:text-[14px] sm:whitespace-nowrap',
                active
                  ? 'border-brand bg-brand-soft font-semibold text-ink sm:border-brand sm:bg-transparent'
                  : 'border-line bg-surface font-medium text-muted hover:text-ink sm:border-transparent sm:bg-transparent',
              )}
            >
              <span className="min-w-0 truncate">{s.tabs[tab]}</span>
              <span
                data-testid={`inbox-count-${tab}`}
                className={cn(
                  'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold tabular-nums',
                  active ? 'bg-inverse text-white' : 'bg-subtle text-ink',
                )}
              >
                {number(list.counts[tab])}
              </span>
            </Link>
          );
        })}
      </nav>

      <div
        role="search"
        aria-label={s.filters.label}
        className="mt-4 grid grid-cols-2 items-end gap-3 xl:flex xl:flex-wrap"
      >
        <Field label={s.filters.scope} className="col-span-2 xl:col-span-1">
          <Segmented<InboxScope>
            value={query.scope}
            onValueChange={(scope) => go({ scope })}
            options={(['all', 'mine', 'unassigned'] as const).map((v) => ({
              value: v,
              label: s.filters.scopes[v],
            }))}
          />
        </Field>
        <Field label={s.filters.category} className="xl:w-[190px]">
          <Select
            value={query.category ?? ''}
            onChange={(e) => go({ category: (e.target.value || null) as InboxQuery['category'] })}
            data-testid="inbox-category"
          >
            <option value="">{s.filters.allCategories}</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {s.categories[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={s.filters.priority} className="xl:w-[170px]">
          <Select
            value={query.priority ?? ''}
            onChange={(e) => go({ priority: (e.target.value || null) as InboxQuery['priority'] })}
          >
            <option value="">{s.filters.allPriorities}</option>
            <option value="high">{s.priority.high}</option>
            <option value="normal">{s.priority.normal}</option>
          </Select>
        </Field>
        <form
          className="col-span-2 flex items-end gap-2 xl:min-w-[280px] xl:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim() });
          }}
        >
          <Field label={s.filters.search} className="min-w-0 flex-1">
            <Input
              type="search"
              value={search}
              maxLength={100}
              icon={<Search />}
              placeholder={s.filters.searchPlaceholder}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="inbox-search"
            />
          </Field>
          <Hint text={s.filters.searchHelp}>
            <Button type="submit" variant="secondary">
              {s.filters.submit}
            </Button>
          </Hint>
          {filtered ? (
            <Hint text={s.filters.clearHelp}>
              <Button
                variant="ghost"
                onClick={() => go({ scope: 'all', category: null, priority: null, q: '' })}
              >
                {s.filters.clear}
              </Button>
            </Hint>
          ) : null}
        </form>
      </div>

      <div className="mt-4">
        {list.items.length ? (
          <>
            <InboxTable items={list.items} />
            <ul
              className="flex flex-col gap-3 lg:hidden"
              aria-label={s.list.caption}
              data-testid="inbox-cards"
            >
              {list.items.map((item) => (
                <InboxCard key={item.id} item={item} />
              ))}
            </ul>
          </>
        ) : (
          <Card>
            <EmptyState
              titleAs="h2"
              illustration={<Inbox strokeWidth={1.25} className="text-brand" />}
              title={filtered ? s.list.emptyFiltered : s.list.empty}
            />
          </Card>
        )}
      </div>

      {list.total > pageSize ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted tabular-nums">
            {fmt(s.list.shown, { from: number(from), to: number(to), total: number(list.total) })}
          </p>
          <div className="flex gap-2">
            <Hint text={s.list.previousHelp}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronRight className="icon-dir" />}
                disabled={query.page <= 1}
                onClick={() => router.push(inboxHref(query, { page: query.page - 1 }))}
              >
                {t.common.previous}
              </Button>
            </Hint>
            <Hint text={s.list.nextHelp}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft className="icon-dir" />}
                disabled={query.page >= pages}
                onClick={() => router.push(inboxHref(query, { page: query.page + 1 }))}
              >
                {t.common.next}
              </Button>
            </Hint>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Numbers({ summary, replyMinutes }: { summary: AdminSupportSummary; replyMinutes: number | null }) {
  const { t, fmt, locale, number, plural } = useAdminUi();
  const k = t.support.kpi;
  const oldest = summary.oldestOpenAt
    ? fmt(k.oldest, { time: duration(locale, Date.now() - Date.parse(summary.oldestOpenAt)) })
    : null;
  return (
    <section
      aria-label={k.label}
      className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      data-testid="support-kpis"
    >
      <KpiCard
        icon={<Inbox />}
        label={k.open}
        value={number(summary.open)}
        sub={
          <span suppressHydrationWarning>
            {[
              oldest,
              summary.unassigned ? plural(k.unassigned, summary.unassigned) : null,
              summary.highOpen ? plural(k.high, summary.highOpen) : null,
            ]
              .filter(Boolean)
              .join(' · ') || k.openHelp}
          </span>
        }
      />
      <KpiCard
        icon={<MessageSquareReply />}
        label={k.waiting}
        value={number(summary.waiting)}
        sub={fmt(k.waitingHelp, { days: TICKETS.autoCloseDays })}
      />
      <KpiCard icon={<Clock />} label={k.today} value={number(summary.openedToday)} sub={k.todayHelp} />
      <KpiCard
        icon={<Timer />}
        label={k.firstReply}
        value={
          replyMinutes === null ? (
            <span className="text-[20px] text-muted">{k.none}</span>
          ) : (
            duration(locale, replyMinutes * 60_000)
          )
        }
        sub={k.firstReplyHelp}
      />
    </section>
  );
}

/** How long it has been waiting: an open ticket for the team (late after a day), an answered one since. */
function Waiting({ item }: { item: AdminTicketItem }) {
  const { t, fmt, locale, relative } = useAdminUi();
  const s = t.support.list;
  if (!item.waitingSince) return <span className="text-muted">—</span>;
  const ms = Date.now() - Date.parse(item.waitingSince);
  return item.status === 'open' ? (
    <span
      suppressHydrationWarning
      className={cn('font-medium tabular-nums', ms > LATE_MS ? 'text-danger' : 'text-ink')}
      data-late={ms > LATE_MS ? '1' : undefined}
    >
      {fmt(s.waitingOpen, { time: duration(locale, ms) })}
    </span>
  ) : (
    <span suppressHydrationWarning className="text-muted">
      {fmt(s.waitingAnswered, { when: relative(item.waitingSince) })}
    </span>
  );
}

function Customer({ item }: { item: AdminTicketItem }) {
  const { t } = useAdminUi();
  const { name, email } = item.customer;
  return (
    <span className="flex min-w-0 flex-col">
      {name ? (
        <span className="truncate font-medium">
          <bdi>{name}</bdi>
        </span>
      ) : null}
      {email ? (
        <span
          dir="ltr"
          className={cn('truncate text-start rtl:text-end', name ? 'text-[12px] text-muted' : 'font-medium')}
        >
          {email}
        </span>
      ) : null}
      {!name && !email ? <span className="text-muted">{t.support.list.noName}</span> : null}
    </span>
  );
}

function InboxTable({ items }: { items: AdminTicketItem[] }) {
  const { t, fmt, relative } = useAdminUi();
  const s = t.support;
  const router = useRouter();
  return (
    <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-sm lg:block">
      <table className="w-full border-collapse text-[13.5px]" data-testid="inbox-table">
        <caption className="sr-only">{s.list.caption}</caption>
        <thead>
          <tr className="text-start">
            {[
              s.list.subject,
              s.list.customer,
              s.list.category,
              s.list.assignee,
              s.list.status,
              s.list.waiting,
              s.list.activity,
            ].map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-line bg-canvas px-3 py-2.5 text-start font-semibold whitespace-nowrap text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {items.map((item) => {
            const href = `/app/admin/support/${item.id}`;
            return (
              <tr
                key={item.id}
                data-testid="inbox-row"
                data-ticket={item.number}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('a')) router.push(href);
                }}
                className="cursor-pointer transition-colors hover:bg-row-hover has-[:focus-visible]:bg-row-hover"
              >
                <td className="max-w-[340px] border-b border-line px-3 py-3 align-middle">
                  <Link href={href} className="block truncate font-semibold text-ink hover:underline">
                    <bdi>{item.subject}</bdi>
                  </Link>
                  <span className="mt-0.5 block text-[12px] text-muted tabular-nums">
                    {fmt(s.list.number, { n: item.number })} · {s.sources[item.source]}
                  </span>
                </td>
                <td className="max-w-[220px] border-b border-line px-3 py-3 align-middle">
                  <Customer item={item} />
                </td>
                <td className="border-b border-line px-3 py-3 align-middle whitespace-nowrap">
                  {s.categories[item.category]}
                </td>
                <td className="max-w-[180px] border-b border-line px-3 py-3 align-middle">
                  {item.assignee ? (
                    <span dir="ltr" className="block truncate text-start">
                      {item.assignee.email}
                    </span>
                  ) : (
                    <span className="text-muted">{s.list.unassigned}</span>
                  )}
                </td>
                <td className="border-b border-line px-3 py-3 align-middle">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <AdminStatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                  </span>
                </td>
                <td className="border-b border-line px-3 py-3 align-middle whitespace-nowrap">
                  <Waiting item={item} />
                </td>
                <td className="border-b border-line px-3 py-3 align-middle whitespace-nowrap text-muted">
                  <time dateTime={item.lastActivityAt} suppressHydrationWarning>
                    {relative(item.lastActivityAt)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InboxCard({ item }: { item: AdminTicketItem }) {
  const { t, fmt, relative } = useAdminUi();
  const s = t.support;
  return (
    <li>
      <Link
        href={`/app/admin/support/${item.id}`}
        data-testid="inbox-card"
        data-ticket={item.number}
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-sm transition-colors hover:bg-row-hover"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-[15px] font-semibold break-words">
            <bdi>{item.subject}</bdi>
          </span>
          <span className="shrink-0 text-[12px] text-muted tabular-nums">
            {fmt(s.list.number, { n: item.number })}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge status={item.status} />
          <PriorityBadge priority={item.priority} />
          <span className="text-[12px] text-muted">
            {s.categories[item.category]} · {s.sources[item.source]}
          </span>
        </span>
        <span className="flex items-center gap-2 text-[13px]">
          <UserRound aria-hidden className="size-4 shrink-0 text-muted" />
          <Customer item={item} />
        </span>
        <span className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <Waiting item={item} />
          <time dateTime={item.lastActivityAt} suppressHydrationWarning className="text-muted">
            {relative(item.lastActivityAt)}
          </time>
        </span>
      </Link>
    </li>
  );
}
