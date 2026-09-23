'use client';

import {
  Bell,
  Check,
  CircleCheckBig,
  Clock,
  Download,
  Filter,
  Mail,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Badge,
  Bars,
  Button,
  Card,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  Input,
  KpiCard,
  Menu,
  Segmented,
  Tag,
  useToast,
  type DataTableColumn,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import type { DietaryKey } from '../../contracts/types';
import {
  NOTIFY_MODES,
  attendeeName,
  daysUntil,
  dietaryCounts,
  exportFileName,
  matchesSearch,
  questionBreakdown,
  replyDietary,
  responseStats,
  type NotifyMode,
} from '../../lib/responses';
import type { DashboardData, DashboardQuestion, DashboardResponse } from '../../server/responses';

type Status = 'all' | 'attending' | 'declined';

/** How often the dashboard asks the server for new replies while the tab is visible ("live stats"). */
const REFRESH_MS = 30_000;

/**
 * The responses dashboard (§9B.3-G, app-responses.png): KPIs, dietary and custom-question bars, the
 * searchable table and a drawer with the whole reply (delete included); CSV export, notification
 * setting. Refreshes itself while open.
 */
export function ResponsesDashboard({ data }: { data: DashboardData }) {
  const ui = useUi();
  const { t, fmt, plural, number } = ui;
  const r = t.responses;
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [withMessage, setWithMessage] = useState(false);
  const [withDietary, setWithDietary] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notify, setNotify] = useState<NotifyMode>(data.notify);
  const [, startRefresh] = useTransition();
  const { now } = data;

  // live stats: refresh while the tab is visible, and when the host comes back to it
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      startRefresh(() => router.refresh());
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [router]);

  // replies deleted here disappear at once, before the refreshed page arrives
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const list = useMemo(() => data.responses.filter((x) => !removed.has(x.id)), [data.responses, removed]);
  const stats = useMemo(() => responseStats(list, now), [list, now]);
  const questionCols = data.questions.filter((q) => q.type !== 'text').slice(0, 2);
  const rows = useMemo(
    () =>
      list.filter(
        (x) =>
          (status === 'all' || (status === 'attending') === x.attending) &&
          (!withMessage || !!x.message) &&
          (!withDietary || replyDietary(x).length > 0) &&
          matchesSearch(x, query),
      ),
    [list, status, withMessage, withDietary, query],
  );
  const open = list.find((x) => x.id === openId) ?? null;

  const answerLabel = (q: DashboardQuestion, x: DashboardResponse) => {
    if (!x.attending) return '—';
    const v = x.answers[q.id];
    if (q.type === 'boolean') return v === true ? r.yes : r.no;
    const value = v === undefined ? q.options[0]?.value : String(v);
    return q.options.find((o) => o.value === value)?.label ?? '—';
  };
  const dietLabel = (k: DietaryKey) => r.diet[k];

  const saveNotify = async (mode: NotifyMode) => {
    const previous = notify;
    setNotify(mode);
    const res = await hostApi(`/api/invitations/${data.id}/notify`, { method: 'PATCH', body: { mode } });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) {
      setNotify(previous);
      return toast({ title: t.common.error, variant: 'danger' });
    }
    toast({ title: r.notify.saved, variant: 'success' });
  };

  let deadlineValue = r.kpi.none;
  if (data.deadline) {
    const days = daysUntil(data.deadline.endUtc, now);
    deadlineValue = days < 0 ? r.kpi.closed : days === 0 ? r.kpi.today : plural(r.kpi.days, days);
  }

  const columns: DataTableColumn<DashboardResponse>[] = [
    {
      key: 'name',
      header: r.columns.name,
      cell: (x) => <span className="font-semibold whitespace-nowrap">{x.name}</span>,
    },
    {
      key: 'status',
      header: r.columns.status,
      cell: (x) =>
        x.attending ? (
          <Badge variant="live">{r.attending}</Badge>
        ) : (
          <Badge variant="danger">{r.declined}</Badge>
        ),
    },
    { key: 'adults', header: r.columns.adults, numeric: true, cell: (x) => number(x.adults) },
    { key: 'children', header: r.columns.children, numeric: true, cell: (x) => number(x.children) },
    {
      key: 'dietary',
      header: r.columns.dietary,
      cell: (x) => {
        const tags = replyDietary(x);
        return tags.length ? (
          <span className="flex flex-wrap gap-1">
            {tags.map((k) => (
              <Tag key={k}>{dietLabel(k)}</Tag>
            ))}
          </span>
        ) : (
          <span className="text-faint">—</span>
        );
      },
    },
    ...questionCols.map((q): DataTableColumn<DashboardResponse> => ({
      key: `q.${q.id}`,
      header: <span className="line-clamp-1 max-w-[140px]">{q.label}</span>,
      cell: (x) => answerLabel(q, x),
    })),
    {
      key: 'message',
      header: r.columns.message,
      className: 'max-w-[220px]',
      cell: (x) =>
        x.message ? (
          <span className="block truncate" title={x.message}>
            {x.message}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: 'received',
      header: r.columns.received,
      cell: (x) => <span className="whitespace-nowrap text-muted">{x.receivedLabel}</span>,
    },
  ];

  const exportHref = `/api/invitations/${data.id}/responses/export`;
  const breakdowns = data.questions.flatMap((q) => {
    const counts = questionBreakdown(list, q);
    return counts ? [{ q, counts }] : [];
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-[-.01em]">{r.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted">
            <span>{data.title}</span>
            <span aria-hidden>·</span>
            <span>{data.dateLine}</span>
            <span aria-hidden>·</span>
            {data.status === 'published' ? (
              <Badge variant="live" icon={<CircleCheckBig />}>
                {t.status.published}
              </Badge>
            ) : (
              <Badge variant="draft">{t.status[data.status]}</Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Menu
            trigger={
              <Button variant="secondary" icon={<Bell />}>
                {r.notify.label}: {r.notify[notify]}
              </Button>
            }
            items={NOTIFY_MODES.map((mode) => ({
              label: r.notify[mode],
              icon: mode === notify ? <Check /> : <span />,
              onSelect: () => void saveNotify(mode),
            }))}
          />
          <Button variant="secondary" icon={<Share2 />} asChild>
            <Link href={`/app/invitations/${data.id}/share`}>{r.share}</Link>
          </Button>
          <Button icon={<Download />} asChild>
            <a href={exportHref} download={exportFileName(data.slug)}>
              {r.export}
            </a>
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title={r.emptyTitle}
            description={r.emptyBody}
            action={
              <Button icon={<Share2 />} asChild>
                <Link href={`/app/invitations/${data.id}/share`}>{r.share}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              icon={<Users />}
              label={r.kpi.attending}
              value={number(stats.attending)}
              sub={fmt(r.kpi.attendingSub, {
                adults: number(stats.adults),
                children: number(stats.children),
              })}
            />
            <KpiCard
              icon={<Mail />}
              label={r.kpi.responses}
              value={number(stats.responses)}
              sub={fmt(r.kpi.responsesSub, { n: number(stats.newThisWeek) })}
            />
            <KpiCard
              icon={<X />}
              label={r.kpi.declined}
              value={number(stats.declined)}
              sub={fmt(r.kpi.declinedSub, { pct: number(stats.declinedPct) })}
            />
            <KpiCard
              icon={<Clock />}
              label={r.kpi.deadline}
              value={deadlineValue}
              sub={data.deadline?.label}
            />
          </div>

          {data.dietary.length || breakdowns.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.dietary.length ? (
                <Card padding="md">
                  <Bars
                    title={r.dietary}
                    rows={dietaryCounts(list, data.dietary).map((d) => ({
                      key: d.key,
                      label: dietLabel(d.key),
                      value: d.count,
                    }))}
                    formatValue={number}
                  />
                </Card>
              ) : null}
              {breakdowns.map(({ q, counts }) => (
                <Card key={q.id} padding="md">
                  <Bars
                    title={q.label}
                    rows={counts.map((c) => ({
                      key: c.value,
                      label:
                        q.type === 'boolean'
                          ? c.value === 'true'
                            ? r.yes
                            : r.no
                          : (q.options.find((o) => o.value === c.value)?.label ?? c.value),
                      value: c.count,
                    }))}
                    formatValue={number}
                  />
                </Card>
              ))}
            </div>
          ) : null}

          <Card className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  aria-hidden
                  size={16}
                  className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-faint"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={r.search}
                  aria-label={r.search}
                  className="ps-8"
                />
              </div>
              <Segmented
                label={r.statusFilter}
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: 'all', label: r.all },
                  { value: 'attending', label: r.attending },
                  { value: 'declined', label: r.declined },
                ]}
              />
              <Menu
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Filter />}
                    aria-pressed={withMessage || withDietary}
                  >
                    {r.filter}
                    {withMessage || withDietary ? ` (${(withMessage ? 1 : 0) + (withDietary ? 1 : 0)})` : ''}
                  </Button>
                }
                items={[
                  {
                    label: r.withMessage,
                    icon: withMessage ? <Check /> : <span />,
                    onSelect: () => setWithMessage((v) => !v),
                  },
                  {
                    label: r.withDietary,
                    icon: withDietary ? <Check /> : <span />,
                    onSelect: () => setWithDietary((v) => !v),
                  },
                  ...(withMessage || withDietary
                    ? [
                        { type: 'separator' as const },
                        {
                          label: r.clearFilters,
                          icon: <X />,
                          onSelect: () => {
                            setWithMessage(false);
                            setWithDietary(false);
                          },
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <DataTable
              caption={r.tableCaption}
              columns={columns}
              rows={rows}
              getRowKey={(x) => x.id}
              onRowClick={(x) => setOpenId(x.id)}
              empty={<p className="py-10 text-center text-[14px] text-muted">{r.noMatches}</p>}
            />
          </Card>
        </>
      )}

      {open ? (
        <ResponseDrawer
          response={open}
          data={data}
          answerLabel={answerLabel}
          dietLabel={dietLabel}
          onClose={() => setOpenId(null)}
          onDeleted={(deleted) => {
            setOpenId(null);
            setRemoved((ids) => new Set(ids).add(deleted));
            startRefresh(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}

function ResponseDrawer({
  response: x,
  data,
  answerLabel,
  dietLabel,
  onClose,
  onDeleted,
}: {
  response: DashboardResponse;
  data: DashboardData;
  answerLabel: (q: DashboardQuestion, x: DashboardResponse) => string;
  dietLabel: (k: DietaryKey) => string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t, fmt, date } = useUi();
  const r = t.responses;
  const d = r.drawer;
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const when = (iso: string) =>
    date(iso, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: data.timeZone,
    });

  const remove = async () => {
    setDeleting(true);
    const res = await hostApi(`/api/invitations/${data.id}/responses/${x.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: t.common.error, variant: 'danger' });
    setConfirm(false);
    toast({ title: d.deleted, variant: 'success' });
    onDeleted(x.id);
  };

  return (
    <>
      <Drawer
        open
        onOpenChange={(o) => !o && onClose()}
        title={x.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {x.attending ? (
              <Badge variant="live">{r.attending}</Badge>
            ) : (
              <Badge variant="danger">{r.declined}</Badge>
            )}
            <span>{fmt(d.received, { date: when(x.createdAt) })}</span>
            {x.updatedAt !== x.createdAt ? (
              <span>· {fmt(d.updated, { date: when(x.updatedAt) })}</span>
            ) : null}
          </span>
        }
        closeLabel={t.common.close}
        footer={
          <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirm(true)}>
            {d.delete}
          </Button>
        }
      >
        <div className="flex flex-col gap-6 text-[14px]">
          {x.phoneDisplay || x.email ? (
            <section>
              <h3 className="mb-2 text-[13px] font-bold text-muted">{d.contact}</h3>
              <ul className="flex flex-col gap-1">
                {x.phoneDisplay ? (
                  <li>
                    <a className="underline-offset-2 hover:underline" href={`tel:${x.phone}`} dir="ltr">
                      {x.phoneDisplay}
                    </a>
                  </li>
                ) : null}
                {x.email ? (
                  <li>
                    <a className="underline-offset-2 hover:underline" href={`mailto:${x.email}`} dir="ltr">
                      {x.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {x.attendees.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-bold text-muted">{d.guests}</h3>
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {x.attendees.map((a) => (
                  <li key={`${a.kind}-${a.position}`} className="flex flex-col gap-1 px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {attendeeName(a) || (a.kind === 'child' ? d.child : d.adult)}
                      </span>
                      <span className="text-[12px] text-muted">
                        {a.kind === 'child' ? d.child : d.adult}
                        {a.kind === 'child' && a.age != null ? ` · ${fmt(d.age, { n: a.age })}` : ''}
                      </span>
                    </span>
                    {a.dietary.length ? (
                      <span className="flex flex-wrap gap-1">
                        {a.dietary.map((k) => (
                          <Tag key={k}>{dietLabel(k)}</Tag>
                        ))}
                      </span>
                    ) : null}
                    {a.dietaryNotes ? (
                      <span className="text-[13px] text-muted">
                        {fmt(d.notes, { notes: a.dietaryNotes })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {x.attending && data.questions.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-bold text-muted">{d.answers}</h3>
              <dl className="flex flex-col gap-2">
                {data.questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-[13px] text-muted">{q.label}</dt>
                    <dd>{q.type === 'text' ? String(x.answers[q.id] ?? '—') : answerLabel(q, x)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {x.message ? (
            <section>
              <h3 className="mb-2 text-[13px] font-bold text-muted">{d.message}</h3>
              <blockquote className="rounded-card bg-subtle px-3 py-2.5 whitespace-pre-line" lang={x.locale}>
                {x.message}
              </blockquote>
            </section>
          ) : null}

          <p className="text-[13px] text-muted">
            {d.language}: {x.locale === 'he' ? t.common.hebrew : t.common.english}
          </p>
        </div>
      </Drawer>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={fmt(d.deleteTitle, { name: x.name })}
        description={d.deleteBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={deleting}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" icon={<Trash2 />} loading={deleting} onClick={() => void remove()}>
              {t.common.delete}
            </Button>
          </>
        }
      />
    </>
  );
}
