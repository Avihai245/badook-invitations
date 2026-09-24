'use client';

import {
  CheckCheck,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Link2,
  MailCheck,
  MessageCircle,
  MoreHorizontal,
  PartyPopper,
  PencilLine,
  Search,
  Send,
  Trash2,
  Upload,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AreaHelp,
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Hint,
  IconButton,
  Input,
  KpiCard,
  Menu,
  Segmented,
  useToast,
  type BadgeVariant,
  type DataTableColumn,
} from '@/components/app';
import { dictFor, fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import { InvitationNav } from '../InvitationNav';
import {
  GUEST_FILTERS,
  displayPhone,
  guestState,
  guestStats,
  matchesGuestFilter,
  matchesGuestSearch,
  type GuestFilter,
  type GuestState,
} from '../../lib/guest-status';
import type { GuestRecord, GuestsPageData } from '../../server/guests';
import { GuestDialog } from './GuestDialog';
import { downloadSample, ImportDialog } from './ImportDialog';
import { WhatsAppDialog } from './WhatsAppDialog';

/** How often the list asks the server for news (opened, replied, delivered) while the tab is visible. */
const REFRESH_MS = 30_000;

const STATE_BADGE: Record<GuestState, BadgeVariant> = {
  attending: 'live',
  declined: 'danger',
  opened: 'info',
  read: 'info',
  delivered: 'neutral',
  sent: 'neutral',
  queued: 'warning',
  failed: 'danger',
  none: 'draft',
};

type DialogState =
  | { kind: 'import' }
  | { kind: 'add' }
  | { kind: 'edit'; guest: GuestRecord }
  | { kind: 'delete'; ids: string[] }
  | { kind: 'whatsapp' }
  | null;

/**
 * The guest list (/app/invitations/[id]/guests): import from Excel/CSV or add by hand, a personal link
 * per guest (their name greets them, the RSVP form comes prefilled and the reply is linked to them),
 * send on WhatsApp or from the host's own, and follow each guest — sent, delivered, read, opened,
 * coming or not. Refreshes itself while open.
 */
export function GuestsScreen({ data }: { data: GuestsPageData }) {
  const { t, number, plural } = useUi();
  const g = t.guests;
  const fmt = format;
  const router = useRouter();
  const { toast } = useToast();
  const [guests, setGuests] = useState(data.guests);
  useEffect(() => setGuests(data.guests), [data.guests]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [, startRefresh] = useTransition();

  const refresh = () => startRefresh(() => router.refresh());
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && refresh();
    const timer = window.setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is stable enough (router)
  }, []);

  const stats = useMemo(() => guestStats(guests), [guests]);
  const rows = useMemo(
    () => guests.filter((x) => matchesGuestFilter(x, filter) && matchesGuestSearch(x, query)),
    [guests, filter, query],
  );
  const linkOf = (x: GuestRecord) => `${data.publicBaseUrl}/i/${data.slug}?g=${x.token}`;

  const copyLink = (x: GuestRecord) =>
    navigator.clipboard.writeText(linkOf(x)).then(
      () => toast({ title: g.toast.copied, variant: 'success' }),
      () => toast({ title: g.toast.error, variant: 'danger' }),
    );

  const mark = async (ids: string[], sent: boolean, quiet = false) => {
    const res = await hostApi(`/api/invitations/${data.id}/guests/sent`, {
      method: 'POST',
      body: { ids, sent },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: g.toast.error, variant: 'danger' });
    if (!quiet) toast({ title: g.toast.marked, variant: 'success' });
    refresh();
  };

  /** "Send from my WhatsApp": wa.me with the message in the invitation's language, then marked as sent. */
  const sendOwn = (x: GuestRecord) => {
    if (!x.phone) return;
    const text = fmt(dictFor(data.own.locale).guests.ownMessage, {
      name: x.name,
      hosts: data.own.hosts,
      event: data.own.event,
      date: data.own.date,
      url: linkOf(x),
    });
    window.open(
      `https://wa.me/${x.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
    if (x.sendStatus === 'none' || x.sendStatus === 'failed') void mark([x.id], true, true);
  };

  const remove = async (ids: string[]) => {
    const res = await hostApi<{ deleted: number }>(`/api/invitations/${data.id}/guests`, {
      method: 'DELETE',
      body: { ids },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: g.toast.error, variant: 'danger' });
    setGuests((list) => list.filter((x) => !ids.includes(x.id)));
    setSelected(new Set());
    setDialog(null);
    toast({
      title: fmt(g.toast.deleted, { n: number(res.body?.deleted ?? ids.length) }),
      variant: 'success',
    });
    refresh();
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = rows.length > 0 && rows.every((x) => selected.has(x.id));
  const toggleAll = () => setSelected(allShown ? new Set() : new Set(rows.map((x) => x.id)));

  const stateLabel = (x: GuestRecord) => {
    const s = guestState(x);
    if (s === 'sent' && x.sendChannel === 'manual') return g.status.manual;
    return g.status[s];
  };

  const statusOf = (x: GuestRecord) => (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge variant={STATE_BADGE[guestState(x)]}>{stateLabel(x)}</Badge>
      {x.sendError && x.sendStatus === 'failed' ? (
        <span className="max-w-[220px] truncate text-[11px] text-danger" title={x.sendError}>
          {x.sendError}
        </span>
      ) : null}
    </span>
  );
  const replyOf = (x: GuestRecord) =>
    x.response ? (
      x.response.attending ? (
        <span className="font-semibold text-success">
          {fmt(g.reply.attending, { n: number(x.response.adults + x.response.children) })}
        </span>
      ) : (
        <span className="text-muted">{g.reply.declined}</span>
      )
    ) : (
      <span className="text-muted">{g.reply.none}</span>
    );
  const actionsOf = (x: GuestRecord) => (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Hint text={g.help.copyLink}>
        <IconButton label={g.actions.copyLink} size="sm" onClick={() => void copyLink(x)}>
          <Link2 />
        </IconButton>
      </Hint>
      <Menu
        align="end"
        trigger={
          <IconButton label={g.actions.more} size="sm">
            <MoreHorizontal />
          </IconButton>
        }
        items={[
          { label: g.actions.copyLink, icon: <Copy />, onSelect: () => void copyLink(x) },
          ...(x.phone
            ? [{ label: g.actions.sendOwn, icon: <MessageCircle />, onSelect: () => sendOwn(x) }]
            : []),
          x.sendChannel === 'manual'
            ? { label: g.actions.unmarkSent, icon: <X />, onSelect: () => void mark([x.id], false) }
            : { label: g.actions.markSent, icon: <MailCheck />, onSelect: () => void mark([x.id], true) },
          {
            label: g.actions.edit,
            icon: <PencilLine />,
            onSelect: () => setDialog({ kind: 'edit', guest: x }),
          },
          { type: 'separator' as const },
          {
            label: g.actions.delete,
            icon: <Trash2 />,
            danger: true,
            onSelect: () => setDialog({ kind: 'delete', ids: [x.id] }),
          },
        ]}
      />
    </div>
  );
  const selectBox = (x: GuestRecord) => (
    <input
      type="checkbox"
      aria-label={fmt(g.actions.selectGuest, { name: x.name })}
      checked={selected.has(x.id)}
      onChange={() => toggle(x.id)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 accent-[var(--color-brand)]"
    />
  );

  const columns: DataTableColumn<GuestRecord>[] = [
    {
      key: 'select',
      width: 44,
      header: (
        <input
          type="checkbox"
          aria-label={g.actions.selectAll}
          checked={allShown}
          onChange={toggleAll}
          className="size-4 accent-[var(--color-brand)]"
        />
      ),
      cell: selectBox,
    },
    {
      key: 'name',
      header: g.columns.name,
      cell: (x) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">
            <bdi>{x.name}</bdi>
          </p>
          {x.group ? <p className="truncate text-[12px] text-muted">{x.group}</p> : null}
        </div>
      ),
    },
    {
      key: 'phone',
      header: g.columns.phone,
      cell: (x) => (
        <span dir="ltr" className="text-muted tabular-nums">
          {displayPhone(x.phone) || '—'}
        </span>
      ),
    },
    {
      key: 'party',
      header: g.columns.party,
      numeric: true,
      cell: (x) => (x.partySize ? number(x.partySize) : '—'),
    },
    { key: 'status', header: g.columns.status, cell: statusOf },
    { key: 'reply', header: g.columns.reply, cell: replyOf },
    {
      key: 'actions',
      header: <span className="sr-only">{g.columns.actions}</span>,
      width: 96,
      align: 'end',
      cell: actionsOf,
    },
  ];

  const helpItems = [
    { icon: <Upload />, label: g.actions.import, text: g.help.import },
    { icon: <UserPlus />, label: g.actions.add, text: g.help.add },
    { icon: <Send />, label: g.actions.whatsapp, text: g.help.whatsapp },
    { icon: <Download />, label: g.actions.export, text: g.help.export },
    { icon: <FileSpreadsheet />, label: g.actions.sample, text: g.help.sample },
    { icon: <Link2 />, label: g.actions.copyLink, text: g.help.copyLink },
    { icon: <MessageCircle />, label: g.actions.sendOwn, text: g.help.sendOwn },
    { icon: <MailCheck />, label: g.actions.markSent, text: g.help.markSent },
    { icon: <Filter />, label: g.filters.label, text: g.help.filters },
    { icon: <CheckCheck />, label: g.columns.status, text: g.help.status },
  ];

  return (
    <>
      <InvitationNav
        id={data.id}
        title={data.title}
        dateLine={data.dateLine}
        published={data.published}
        current="guests"
      />
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-1">
              <h1 className="text-[22px] font-bold tracking-[-.01em]">{g.title}</h1>
              <AreaHelp label={t.common.helpLabel} title={t.common.helpTitle} items={helpItems} />
            </div>
            <p className="mt-1 text-[14px] text-muted">{g.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Hint text={g.help.import}>
              <Button icon={<Upload />} onClick={() => setDialog({ kind: 'import' })}>
                {g.actions.import}
              </Button>
            </Hint>
            <Hint text={g.help.add}>
              <Button variant="secondary" icon={<UserPlus />} onClick={() => setDialog({ kind: 'add' })}>
                {g.actions.add}
              </Button>
            </Hint>
            <Hint text={g.help.whatsapp}>
              <Button
                variant="secondary"
                icon={<Send />}
                onClick={() => setDialog({ kind: 'whatsapp' })}
                disabled={!guests.some((x) => x.phone)}
              >
                {g.actions.whatsapp}
              </Button>
            </Hint>
            <Menu
              align="end"
              trigger={
                <IconButton label={g.actions.more} className="border border-line bg-surface shadow-sm">
                  <MoreHorizontal />
                </IconButton>
              }
              items={[
                {
                  label: g.actions.export,
                  icon: <Download />,
                  onSelect: () => window.location.assign(`/api/invitations/${data.id}/guests/export`),
                },
                {
                  label: g.actions.sample,
                  icon: <FileSpreadsheet />,
                  onSelect: () => downloadSample(g.sample, 'guests-sample.csv'),
                },
              ]}
            />
          </div>
        </div>

        {!data.published ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-[#fde68a] bg-warning-bg px-4 py-3 text-[13px] text-warning">
            {g.notPublished}
            <Link href={`/app/invitations/${data.id}/edit`} className="font-semibold underline">
              {g.publish}
            </Link>
          </p>
        ) : null}

        <Card padding="md" className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
            >
              <PartyPopper className="size-[18px]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold">{g.greeting.title}</p>
              <p className="text-[13px] text-muted">
                {data.greeting
                  ? fmt(g.greeting.on, {
                      text: data.greeting.replaceAll('{guest}', guests[0]?.name ?? t.guests.form.name),
                    })
                  : g.greeting.off}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/invitations/${data.id}/edit`}>{g.greeting.edit}</Link>
          </Button>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label={g.kpi.total} icon={<Users />} value={number(stats.total)} />
          <KpiCard label={g.kpi.sent} icon={<Send />} value={number(stats.sent)} />
          <KpiCard label={g.kpi.opened} icon={<Eye />} value={number(stats.opened)} />
          <KpiCard
            label={g.kpi.attending}
            icon={<CheckCheck />}
            value={number(stats.attending)}
            sub={
              stats.attendingPeople
                ? plural(t.common.people, stats.attendingPeople, { n: number(stats.attendingPeople) })
                : undefined
            }
          />
          <KpiCard label={g.kpi.declined} icon={<UserX />} value={number(stats.declined)} />
          <KpiCard label={g.kpi.pending} icon={<MailCheck />} value={number(stats.pending)} />
        </div>

        {guests.length ? (
          <Card className="mt-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
              <div className="relative min-w-0 flex-1 basis-[220px]">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={g.search}
                  aria-label={g.search}
                  className="ps-9"
                />
              </div>
              <div className="-mx-3 w-[calc(100%+24px)] min-w-0 overflow-x-auto px-3 lg:mx-0 lg:w-auto lg:px-0">
                <Segmented
                  label={g.filters.label}
                  value={filter}
                  onValueChange={setFilter}
                  options={GUEST_FILTERS.map((f) => ({ value: f, label: g.filters[f] }))}
                />
              </div>
            </div>
            {selected.size ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-soft/60 px-3 py-2 text-[13px]">
                <span className="font-semibold">{fmt(g.actions.selected, { n: number(selected.size) })}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Send />}
                  onClick={() => setDialog({ kind: 'whatsapp' })}
                >
                  {g.actions.whatsapp}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<MailCheck />}
                  onClick={() => void mark([...selected], true)}
                >
                  {g.actions.markSent}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Trash2 />}
                  onClick={() => setDialog({ kind: 'delete', ids: [...selected] })}
                >
                  {g.actions.delete}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {g.actions.clearSelection}
                </Button>
              </div>
            ) : null}
            <DataTable
              className="max-md:hidden"
              columns={columns}
              rows={rows}
              getRowKey={(x) => x.id}
              rowData={(x) => ({ 'data-guest-row': x.id })}
              caption={g.title}
              empty={<p className="py-8 text-center text-muted">{g.noMatches}</p>}
            />
            {/* phones: one card per guest instead of a wide table */}
            <ul className="divide-y divide-line md:hidden" aria-label={g.title}>
              {rows.length ? (
                rows.map((x) => (
                  <li key={x.id} data-guest-row={x.id} className="flex items-start gap-3 px-3 py-3">
                    <span className="pt-1">{selectBox(x)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">
                        <bdi>{x.name}</bdi>
                        {x.partySize ? (
                          <span className="ms-1.5 text-[12px] font-normal text-muted">
                            × {number(x.partySize)}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[12px] text-muted">
                        <span dir="ltr" className="tabular-nums">
                          {displayPhone(x.phone) || '—'}
                        </span>
                        {x.group ? ` · ${x.group}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                        {statusOf(x)}
                        {x.response ? replyOf(x) : null}
                      </div>
                    </div>
                    {actionsOf(x)}
                  </li>
                ))
              ) : (
                <li className="py-8 text-center text-muted">{g.noMatches}</li>
              )}
            </ul>
          </Card>
        ) : (
          <Card className="mt-5">
            <EmptyState
              title={g.empty.title}
              description={g.empty.body}
              illustration={<Users className="size-16 text-brand" strokeWidth={1.2} />}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={<Upload />} onClick={() => setDialog({ kind: 'import' })}>
                    {g.actions.import}
                  </Button>
                  <Button variant="secondary" icon={<UserPlus />} onClick={() => setDialog({ kind: 'add' })}>
                    {g.actions.add}
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<FileSpreadsheet />}
                    onClick={() => downloadSample(g.sample, 'guests-sample.csv')}
                  >
                    {g.actions.sample}
                  </Button>
                </div>
              }
            />
          </Card>
        )}
      </div>

      {dialog?.kind === 'import' ? (
        <ImportDialog
          id={data.id}
          maxGuests={data.maxGuests}
          onClose={() => setDialog(null)}
          onImported={(message) => {
            setDialog(null);
            toast({ title: message, variant: 'success' });
            refresh();
          }}
        />
      ) : null}
      {dialog?.kind === 'add' || dialog?.kind === 'edit' ? (
        <GuestDialog
          id={data.id}
          guest={dialog.kind === 'edit' ? dialog.guest : null}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            if (saved) setGuests((list) => list.map((x) => (x.id === saved.id ? saved : x)));
            setDialog(null);
            toast({ title: g.toast.saved, variant: 'success' });
            refresh();
          }}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={fmt(g.confirmDelete.title, { n: number(dialog.ids.length) })}
          description={g.confirmDelete.body}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                {t.common.cancel}
              </Button>
              <Button variant="danger" onClick={() => void remove(dialog.ids)}>
                {g.confirmDelete.confirm}
              </Button>
            </>
          }
        />
      ) : null}
      {dialog?.kind === 'whatsapp' ? (
        <WhatsAppDialog
          data={data}
          guests={guests}
          selected={selected}
          onClose={() => setDialog(null)}
          onDone={() => {
            setSelected(new Set());
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
