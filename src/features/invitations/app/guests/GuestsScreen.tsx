'use client';

import {
  Armchair,
  CalendarClock,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  Languages,
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
  Hint,
  IconButton,
  Input,
  Menu,
  PageTitle,
  type BadgeVariant,
  type DataTableColumn,
  cn,
  useToast,
} from '@/components/app';
import { UpgradeDialog, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { NoticesDialog } from '@/features/event-day/ui/NoticesDialog';
import { guestLocale } from '@/features/whatsapp/languages';
import { fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { Locale } from '../../contracts/types';
import { hostApi, loginUrl } from '../api';
import { GUEST_MESSAGE } from '../../lib/event-phrases';
import { whatsappCapable } from '../../lib/guest-import';
import { nativeName } from '../../lib/locales';
import {
  ATTENTION_FILTERS,
  formatIls,
  guestLink,
  guestPhone,
  LIST_FILTERS,
  matchesListFilter,
  peopleSummary,
  sendFailure,
  whatsappReach,
  type ListFilter,
} from '../../lib/guest-list';
import { guestState, matchesGuestSearch, wasSent, type GuestState } from '../../lib/guest-status';
import type { GuestRecord, GuestsPageData } from '../../server/guests';
import { AnswerDialog, AttendanceCell } from './Attendance';
import { GuestDialog } from './GuestDialog';
import { GuestsGuide } from './GuestsStart';
import { downloadSample, ImportDialog } from './ImportDialog';
import { OwnSendQueue, UnmatchedReplies } from './ReplyMatch';
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
  | { kind: 'answer'; guest: GuestRecord }
  | { kind: 'delete'; ids: string[] }
  | { kind: 'whatsapp' }
  | { kind: 'upgrade'; reason: UpgradeReason }
  | null;

/** The dialog a deep link opens: /app/invitations/<id>/guests?import=1 or ?send=1. */
export type GuestsDeepLink = 'import' | 'send' | null;

/**
 * The guest list (/app/invitations/[id]/guests): upload it from Excel/CSV or add guests by hand, a
 * personal link per guest (their name greets them, the RSVP form comes prefilled and the reply is
 * linked to them), send on WhatsApp or from the host's own, and follow each guest — sent, delivered,
 * read, opened, coming or not. Refreshes itself while open.
 */
export function GuestsScreen({
  data,
  open = null,
  tables = false,
}: {
  data: GuestsPageData;
  open?: GuestsDeepLink;
  /** the event tells guests their table (seating_guide): "send guests their table" in the menu */
  tables?: boolean;
}) {
  const { t, number, plural, locale } = useUi();
  const g = t.guests;
  const fmt = format;
  const router = useRouter();
  const { toast } = useToast();
  const [guests, setGuests] = useState(data.guests);
  useEffect(() => setGuests(data.guests), [data.guests]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(() =>
    open === 'import'
      ? { kind: 'import' }
      : open === 'send' && data.whatsapp.configured
        ? { kind: 'whatsapp' }
        : null,
  );
  const [, startRefresh] = useTransition();
  const [tablesOpen, setTablesOpen] = useState(false);
  // ?send=1 without the system's number: the host's own WhatsApp, one guest after another
  const [ownOpen, setOwnOpen] = useState(open === 'send' && !data.whatsapp.configured);

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
  // a deep link opened its dialog: a reload shouldn't open it again
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('import') && !url.searchParams.has('send')) return;
    url.searchParams.delete('import');
    url.searchParams.delete('send');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  const unmatched = useMemo(() => {
    const onList = new Set(guests.map((x) => x.id));
    return data.replies.filter((r) => !r.guestId || !onList.has(r.guestId));
  }, [guests, data.replies]);
  // the list in people — what the seating and the event day count; a "coming" reply from the general
  // link that isn't matched yet is coming too
  const people = useMemo(() => {
    const p = peopleSummary(guests);
    const fromLink = unmatched.reduce((n, r) => n + (r.attending ? r.adults + r.children : 0), 0);
    return { ...p, coming: p.coming + fromLink };
  }, [guests, unmatched]);
  // how many guests each filter shows (the summary's numbers are the filters)
  const counts = useMemo(
    () =>
      Object.fromEntries(
        LIST_FILTERS.map((f) => [f, guests.filter((x) => matchesListFilter(x, f)).length]),
      ) as Record<ListFilter, number>,
    [guests],
  );
  const shownFilters = LIST_FILTERS.filter(
    (f) => !ATTENTION_FILTERS.includes(f) || counts[f] > 0 || filter === f,
  );
  const rows = useMemo(
    () => guests.filter((x) => matchesListFilter(x, filter) && matchesGuestSearch(x, query)),
    [guests, filter, query],
  );
  const languages = { locales: data.locales, defaultLocale: data.locale };
  const linkOf = (x: GuestRecord) => guestLink(data.publicBaseUrl, data.slug, x, languages);
  // a language per guest: shown once the invitation has several languages (or a guest has one)
  const showLanguage = data.locales.length > 1 || guests.some((x) => x.language);

  // "send on WhatsApp to all guests": who is left, what it costs, or why it can't start
  const reachable = guests.filter((x) => whatsappReach(x) === 'ok');
  const unsent = reachable.filter((x) => x.sendStatus !== 'queued' && !wasSent(x)).length;
  const price = formatIls(data.whatsapp.priceIls, locale);
  const sendBlocked = !data.whatsapp.configured
    ? g.sendBlocked.notConfigured
    : !data.published
      ? g.sendBlocked.notPublished
      : !guests.length
        ? g.sendBlocked.empty
        : !reachable.length
          ? g.sendBlocked.noMobile
          : null;
  // until the system's number is connected, the host's own WhatsApp is the way: a queue, one by one
  const ownQueue = guests.filter((x) => whatsappCapable(x.phone) && !wasSent(x) && x.sendStatus !== 'queued');
  const own = !data.whatsapp.configured;
  const sendHint = own
    ? ownQueue.length
      ? plural(g.own.hint, ownQueue.length, { n: number(ownQueue.length) })
      : g.own.none
    : !unsent
      ? g.start.allSent
      : plural(data.unlimited ? g.start.sendHintUnlimited : g.start.sendHint, unsent, {
          n: number(unsent),
          price,
          credits: number(data.credits),
        });

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

  /** "Send from my WhatsApp": wa.me with the message in the guest's language, then marked as sent. */
  const sendOwn = (x: GuestRecord) => {
    if (!x.phone) return;
    const l = guestLocale(x.language, languages);
    const values = data.own[l] ?? data.own[data.locale];
    const text = fmt(GUEST_MESSAGE[l], {
      name: x.name,
      hosts: values?.hosts ?? '',
      event: values?.event ?? '',
      date: values?.date ?? '',
      url: linkOf(x),
    });
    window.open(
      `https://wa.me/${x.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
    if (x.sendStatus === 'none' || x.sendStatus === 'failed') void mark([x.id], true, true);
  };

  /** The language some guests read the invitation in (null: the invitation's default). */
  const setLanguage = async (ids: string[], language: Locale | null) => {
    const res = await hostApi<{ updated: number }>(`/api/invitations/${data.id}/guests/language`, {
      method: 'POST',
      body: { ids, language },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: g.toast.error, variant: 'danger' });
    setGuests((list) => list.map((x) => (ids.includes(x.id) ? { ...x, language } : x)));
    toast({ title: plural(g.language.changed, ids.length, { n: number(ids.length) }), variant: 'success' });
    refresh();
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
      title: plural(g.toast.deleted, res.body?.deleted ?? ids.length, {
        n: number(res.body?.deleted ?? ids.length),
      }),
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

  /** Where the invitation got to — the answer itself has its own column ("Attending"): a guest who
   * answered through a link saw the invitation; one the host answered for may never have been sent it. */
  const inviteState = (x: GuestRecord): GuestState => {
    const s = guestState(x);
    if (s !== 'attending' && s !== 'declined') return s;
    return x.openedAt || x.response?.source !== 'host' ? 'opened' : x.sendStatus;
  };
  const stateLabel = (x: GuestRecord) => {
    const s = inviteState(x);
    if (s === 'sent' && x.sendChannel === 'manual') return g.status.manual;
    return g.status[s];
  };

  /** The line under the status: why WhatsApp didn't reach them, a retry on its way, or no WhatsApp. */
  const detailOf = (x: GuestRecord): { text: string; title?: string; tone: 'danger' | 'muted' } | null => {
    if (x.sendStatus === 'failed' && !wasSent(x))
      return { text: g.failure[sendFailure(x.sendError)], title: x.sendError ?? undefined, tone: 'danger' };
    if (x.sendStatus === 'queued' && x.retryAt) return { text: g.reach.retry, tone: 'muted' };
    const reach = whatsappReach(x);
    if (reach === 'landline' || reach === 'optedOut') return { text: g.reach[reach], tone: 'muted' };
    return null;
  };

  const statusOf = (x: GuestRecord) => {
    const detail = detailOf(x);
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Badge variant={STATE_BADGE[inviteState(x)]}>{stateLabel(x)}</Badge>
        {detail ? (
          <span
            className={`max-w-[240px] truncate text-[11.5px] ${detail.tone === 'danger' ? 'text-danger' : 'text-muted'}`}
            title={detail.title ?? detail.text}
            data-guest-detail=""
          >
            {detail.text}
          </span>
        ) : null}
      </span>
    );
  };
  /** The guest's language, changed in place (the invitation's languages; the default first). */
  const languageOf = (x: GuestRecord) => {
    const foreign = x.language && !data.locales.includes(x.language) ? x.language : null;
    return (
      <span className="inline-flex flex-col items-start gap-0.5" onClick={(e) => e.stopPropagation()}>
        <select
          aria-label={fmt(g.language.of, { name: x.name })}
          value={x.language ?? ''}
          onChange={(e) => void setLanguage([x.id], (e.target.value || null) as Locale | null)}
          data-guest-language={x.id}
          className="h-8 max-w-[180px] cursor-pointer rounded-btn border border-line bg-surface ps-2 pe-1 text-[12.5px] text-ink hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand"
        >
          <option value="">{fmt(g.language.default, { language: nativeName(data.locale) })}</option>
          {data.locales.map((l) => (
            <option key={l} value={l} lang={l}>
              {nativeName(l)}
            </option>
          ))}
          {foreign ? (
            <option value={foreign} lang={foreign}>
              {nativeName(foreign)}
            </option>
          ) : null}
        </select>
        {foreign ? (
          <span className="max-w-[200px] text-[11.5px] text-warning">
            {fmt(g.language.missing, {
              language: t.editor.languageIn[foreign],
              fallback: t.editor.languageIn[data.locale],
            })}
          </span>
        ) : null}
      </span>
    );
  };
  /** coming / not coming / no reply — a button: the host sets it (AnswerDialog) */
  const replyOf = (x: GuestRecord) => (
    <AttendanceCell guest={x} onOpen={() => setDialog({ kind: 'answer', guest: x })} />
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
          // wa.me only opens a chat with a number that has WhatsApp
          ...(whatsappCapable(x.phone)
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
          {guestPhone(x.phone) || '—'}
        </span>
      ),
    },
    {
      key: 'party',
      header: g.columns.party,
      numeric: true,
      cell: (x) => (x.partySize ? number(x.partySize) : '—'),
    },
    { key: 'reply', header: g.columns.reply, cell: replyOf },
    { key: 'status', header: g.columns.status, cell: statusOf },
    ...(showLanguage ? [{ key: 'language', header: g.columns.language, cell: languageOf }] : []),
    {
      key: 'actions',
      header: <span className="sr-only">{g.columns.actions}</span>,
      width: 96,
      align: 'end',
      cell: actionsOf,
    },
  ];

  const h = g.help;
  const helpItems = [
    { icon: <Upload />, label: g.actions.import, text: h.import },
    { icon: <UserPlus />, label: g.actions.addManual, text: h.add },
    { icon: <Send />, label: g.actions.whatsappAll, text: h.whatsapp },
    { icon: <Search />, label: g.search, text: h.search },
    { icon: <Filter />, label: g.filters.label, text: h.filters },
    { icon: <CheckCheck />, label: g.answer.column, text: h.answer },
    { icon: <CheckSquare />, label: h.selectLabel, text: h.select },
    { icon: <Link2 />, label: g.actions.copyLink, text: h.copyLink },
    { icon: <MessageCircle />, label: g.actions.sendOwn, text: h.sendOwn },
    { icon: <MailCheck />, label: g.actions.markSent, text: h.markSent },
    { icon: <X />, label: g.actions.unmarkSent, text: h.unmarkSent },
    { icon: <PencilLine />, label: g.actions.edit, text: h.edit },
    { icon: <Languages />, label: g.language.label, text: h.language },
    { icon: <PartyPopper />, label: g.greeting.edit, text: h.greeting },
    { icon: <Trash2 />, label: g.actions.delete, text: h.delete },
    { icon: <Download />, label: g.actions.export, text: h.export },
    { icon: <FileSpreadsheet />, label: g.actions.sample, text: h.sample },
    ...(tables
      ? [{ icon: <Armchair />, label: t.eventDay.notices.button, text: t.eventDay.notices.buttonHint }]
      : []),
    { icon: <Send />, label: g.columns.status, text: h.status },
  ];

  const openImport = () => setDialog({ kind: 'import' });
  const openAdd = () => setDialog({ kind: 'add' });
  const sample = () => downloadSample(g.sample, 'guests-sample.csv');

  return (
    <>
      <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-2xl min-w-0">
            <div className="flex items-center gap-1">
              <PageTitle size="section">{g.title}</PageTitle>
              <AreaHelp label={t.common.helpLabel} title={h.title} items={helpItems} />
            </div>
            <p className="mt-1 text-[14px] text-muted">{g.subtitle}</p>
          </div>
          <Menu
            align="end"
            trigger={
              <IconButton label={g.actions.more} className="shrink-0 border border-line bg-surface shadow-sm">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              {
                label: g.actions.export,
                icon: <Download />,
                onSelect: () => window.location.assign(`/api/invitations/${data.id}/guests/export`),
              },
              { label: g.actions.sample, icon: <FileSpreadsheet />, onSelect: sample },
              {
                label: g.greeting.edit,
                icon: <PartyPopper />,
                onSelect: () => router.push(`/app/invitations/${data.id}/edit`),
              },
              ...(tables
                ? [
                    {
                      label: t.eventDay.notices.button,
                      icon: <Armchair />,
                      onSelect: () => setTablesOpen(true),
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {!data.published ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] text-warning">
            {g.notPublished}
            <Link href={`/app/invitations/${data.id}/edit`} className="font-semibold underline">
              {g.publish}
            </Link>
          </p>
        ) : null}

        {guests.length ? (
          <>
            {/* who is coming, in people — and the two things to do: add guests, send */}
            <Card padding="md" className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="min-w-0" data-testid="guests-summary">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[20px] font-extrabold leading-tight">
                  <span>{plural(g.summary.coming, people.coming, { n: number(people.coming) })}</span>
                  <span className="text-[15px] font-semibold text-muted">
                    {fmt(g.summary.invited, { n: number(people.invited) })}
                  </span>
                  <Hint text={g.summary.hint}>
                    <button
                      type="button"
                      aria-label={g.summary.hint}
                      className="self-center text-faint hover:text-ink"
                    >
                      <Info aria-hidden className="size-4" />
                    </button>
                  </Hint>
                </p>
                <p className="mt-1 text-[13.5px] text-muted">
                  {[
                    people.waiting
                      ? plural(g.summary.waiting, people.waiting, { n: number(people.waiting) })
                      : null,
                    people.declined
                      ? plural(g.summary.declined, people.declined, { n: number(people.declined) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                <div className="flex flex-wrap gap-2" data-testid="guests-actions">
                  <Menu
                    align="end"
                    trigger={
                      <Button variant="secondary" icon={<UserPlus />}>
                        {g.actions.add}
                        <ChevronDown aria-hidden className="size-4 opacity-60" />
                      </Button>
                    }
                    items={[
                      { label: g.actions.import, icon: <Upload />, onSelect: openImport },
                      { label: g.actions.addManual, icon: <UserPlus />, onSelect: openAdd },
                    ]}
                  />
                  <Button
                    icon={own ? <MessageCircle /> : <Send />}
                    onClick={() => (own ? setOwnOpen(true) : setDialog({ kind: 'whatsapp' }))}
                    disabled={own ? !ownQueue.length : !!sendBlocked}
                    className="bg-[#0f7d41] text-white hover:bg-[#0c6a37] dark:text-white"
                  >
                    {own ? g.own.cta : g.actions.whatsappAll}
                  </Button>
                  {/* the WhatsApp section: every approved message now, and the smart scheduling */}
                  <Button asChild variant="secondary" icon={<CalendarClock />}>
                    <Link href={`/app/invitations/${data.id}/guests/whatsapp`} data-testid="guests-messages">
                      {t.waMessages.open}
                    </Link>
                  </Button>
                </div>
                <p className="max-w-[440px] text-[12.5px] text-muted sm:text-end">
                  {(own ? (ownQueue.length ? null : g.own.none) : sendBlocked) ?? sendHint}
                </p>
              </div>
            </Card>

            <UnmatchedReplies id={data.id} replies={unmatched} guests={guests} onChanged={refresh} />

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
                {/* the summary's numbers are the filters: how many guests each one shows */}
                <div
                  role="radiogroup"
                  aria-label={g.filters.label}
                  className="flex w-full flex-wrap gap-1.5"
                  data-testid="guest-filters"
                >
                  {shownFilters.map((f) => {
                    const on = filter === f;
                    const attention = ATTENTION_FILTERS.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-filter={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                          on
                            ? 'border-ink bg-ink text-white dark:text-[#1c1917]'
                            : attention
                              ? 'border-warning-line bg-warning-bg text-warning hover:border-warning'
                              : 'border-line bg-surface text-ink/80 hover:border-line-strong',
                        )}
                      >
                        {g.filters[f]}
                        <span
                          className={cn(
                            'rounded-full px-1.5 text-[11.5px] tabular-nums',
                            on ? 'bg-white/20' : 'bg-subtle text-muted',
                          )}
                        >
                          {number(counts[f])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selected.size ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-soft/60 px-3 py-2 text-[13px]">
                  <span className="font-semibold">
                    {plural(g.actions.selected, selected.size, { n: number(selected.size) })}
                  </span>
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
                  {showLanguage ? (
                    <Menu
                      trigger={
                        <Button size="sm" variant="secondary" icon={<Languages />}>
                          {g.language.bulk}
                        </Button>
                      }
                      items={[
                        {
                          label: fmt(g.language.default, { language: nativeName(data.locale) }),
                          onSelect: () => void setLanguage([...selected], null),
                        },
                        ...data.locales.map((l) => ({
                          label: nativeName(l),
                          onSelect: () => void setLanguage([...selected], l),
                        })),
                      ]}
                    />
                  ) : null}
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
                            {guestPhone(x.phone) || '—'}
                          </span>
                          {x.group ? ` · ${x.group}` : ''}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                          {replyOf(x)}
                          {statusOf(x)}
                        </div>
                        {showLanguage ? <div className="mt-1.5">{languageOf(x)}</div> : null}
                      </div>
                      {actionsOf(x)}
                    </li>
                  ))
                ) : (
                  <li className="py-8 text-center text-muted">{g.noMatches}</li>
                )}
              </ul>
            </Card>
          </>
        ) : (
          <GuestsGuide onImport={openImport} onAdd={openAdd} onSample={sample} />
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
          locales={data.locales}
          defaultLocale={data.locale}
          onClose={() => setDialog(null)}
          onLimit={(reason) => setDialog({ kind: 'upgrade', reason })}
          onSaved={(saved) => {
            if (saved)
              setGuests((list) =>
                list.some((x) => x.id === saved.id)
                  ? list.map((x) => (x.id === saved.id ? saved : x))
                  : [...list, saved],
              );
            setDialog(null);
            toast({ title: g.toast.saved, variant: 'success' });
            refresh();
          }}
        />
      ) : null}
      {dialog?.kind === 'answer' ? (
        <AnswerDialog
          invitationId={data.id}
          guest={dialog.guest}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setGuests((list) => list.map((x) => (x.id === saved.id ? saved : x)));
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
      {dialog?.kind === 'upgrade' ? (
        <UpgradeDialog reason={dialog.reason} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={plural(g.confirmDelete.title, dialog.ids.length, { n: number(dialog.ids.length) })}
          description={plural(g.confirmDelete.body, dialog.ids.length)}
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
      {tables ? <NoticesDialog id={data.id} open={tablesOpen} onOpenChange={setTablesOpen} /> : null}
      <OwnSendQueue open={ownOpen} onOpenChange={setOwnOpen} queue={ownQueue} onSend={sendOwn} />
    </>
  );
}
