'use client';

import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Copy,
  ListChecks,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Palette,
  Plus,
  PencilLine,
  Share2,
  Users,
} from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import { UpgradeDialog, upgradeReason, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import {
  Badge,
  Button,
  cn,
  Hint,
  IconButton,
  Menu,
  PageTitle,
  useToast,
  type BadgeVariant,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import { hostApi, loginUrl } from '../api';
import { CountdownChip, daysUntilEvent, useToday } from '../countdown';
import { HelpFor } from '../HelpFor';
import { track } from '@/features/analytics/track';
import { TOOLS, type ToolKey } from '../../lib/tools';
import { journey, type HomeFacts, type JourneyStep } from '../home/journey';
import { TOOL_ICONS } from '../tools/ToolsPicker';
import { DemoVideo } from '@/features/site/DemoVideo.client';
import { FollowUpDialog, followUpTypes } from './FollowUpDialog';

const BADGE: Record<InvitationSummary['status'], BadgeVariant> = {
  draft: 'draft',
  published: 'live',
  archived: 'neutral',
};

/**
 * §9B.3-A: the host's home base — a greeting with their invitations at a glance, then one card per
 * invitation (its poster, where it stands, the next step and its main places one tap away); the
 * archive; and an empty state that teaches the whole flow.
 */
/** An event's budget as its card shows it (a tiny gauge): only for events with a plan and a total. */
export type CardBudget = { total: number; committed: number; paid: number; planned: number };
/** The plan's numbers the card's path reads (null: no planning for the event). */
export type CardPlanning = HomeFacts['planning'];

/** The list with every event (a host with one event is otherwise sent straight into it). */
const LIST_ALL = '/app/invitations?all=1';

export function InvitationsList({
  items,
  name,
  budgets = {},
  tools = {},
  planning = {},
  days = {},
  posters = {},
}: {
  items: InvitationSummary[];
  name: string | null;
  budgets?: Record<string, CardBudget>;
  /** each event's tools (invitations/lib/tools) */
  tools?: Record<string, ToolKey[]>;
  planning?: Record<string, CardPlanning>;
  /** the days to each event as the server saw them (until the visitor's own day is known) */
  days?: Record<string, number>;
  /** each invitation's poster, drawn on the server (app/ItemPoster) */
  posters?: Record<string, ReactNode>;
}) {
  const { t, fmt, plural, number } = useUi();
  const router = useRouter();
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<InvitationSummary | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
  const [, startTransition] = useTransition();
  const today = useToday();

  const active = items.filter((i) => i.status !== 'archived');
  const archived = items.filter((i) => i.status === 'archived');
  const visible = showArchived ? archived : active;
  useEffect(() => track('list_view', { props: { events: active.length } }), [active.length]);

  async function act(id: string, url: string, body: unknown, done: (res: Record<string, unknown>) => string) {
    setBusy(id);
    const res = await hostApi<Record<string, unknown>>(url, { method: 'POST', body });
    setBusy(null);
    if (res.status === 401) return router.push(loginUrl());
    const limit = upgradeReason(res.status, res.body);
    if (limit) return setUpgrade(limit);
    if (!res.ok || !res.body) return void toast({ title: t.common.error, variant: 'danger' });
    toast({ title: done(res.body), variant: 'success' });
    // the full list stays in view (with one event left, the bare list would go straight into it)
    startTransition(() => router.replace(LIST_ALL));
  }
  const duplicate = (id: string) =>
    act(id, `/api/invitations/${id}/duplicate`, {}, (b) => fmt(t.list.duplicated, { slug: String(b.slug) }));
  const archive = (id: string, on: boolean) =>
    act(id, `/api/invitations/${id}/archive`, { archived: on }, () =>
      on ? t.list.archived : t.list.unarchived,
    );

  const responses = active.reduce((n, i) => n + i.responses, 0);
  const attending = active.reduce((n, i) => n + i.attending, 0);
  // the replies only once there are some
  const summary = active.length
    ? [
        plural(t.list.active, active.length, { n: number(active.length) }),
        ...(responses
          ? [
              plural(t.list.responsesTotal, responses, { n: number(responses) }),
              plural(t.list.attendingTotal, attending, { n: number(attending) }),
            ]
          : []),
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-5 pb-16 sm:px-6 sm:pt-8">
      <section className="list-hero relative overflow-hidden rounded-[24px] border border-brand-line px-5 py-6 sm:px-8 sm:py-7">
        <EnvelopeDecor />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-brand-deep">
              {name ? (
                // the name isolated: a Latin name keeps the comma on the Hebrew side ("שלום, Avihai")
                <>
                  {t.list.greeting.split('{name}')[0]}
                  <bdi>{name}</bdi>
                  {t.list.greeting.split('{name}')[1]}
                </>
              ) : (
                t.list.greetingNoName
              )}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <PageTitle>
                {showArchived
                  ? plural(t.list.showArchived, archived.length, { n: archived.length })
                  : t.list.title}
              </PageTitle>
              <HelpFor area="list" />
            </div>
            {summary.length ? (
              <ul aria-label={t.list.statsLabel} className="mt-3 flex flex-wrap gap-2">
                {summary.map((line) => (
                  <li
                    key={line}
                    className="rounded-full border border-brand-line bg-surface/80 px-3 py-1 text-[13px] font-medium text-ink backdrop-blur"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-muted">{t.list.summaryEmpty}</p>
            )}
          </div>
          {showArchived ? (
            <Hint text={t.list.hideArchivedHint}>
              <Button variant="secondary" onClick={() => setShowArchived(false)}>
                {t.list.hideArchived}
              </Button>
            </Hint>
          ) : archived.length ? (
            <Hint text={t.list.archiveHint}>
              <Button variant="ghost" icon={<Archive />} onClick={() => setShowArchived(true)}>
                {plural(t.list.showArchived, archived.length, { n: archived.length })}
              </Button>
            </Hint>
          ) : null}
        </div>
      </section>

      {visible.length ? (
        <ul className={cn('mt-6 grid grid-cols-1 gap-4 lg:gap-5', 'lg:grid-cols-2 min-[1900px]:grid-cols-3')}>
          {visible.map((item, i) => (
            <li
              key={item.id}
              className="site-rise"
              style={{ '--rise-delay': `${Math.min(i, 6) * 60}ms` } as CSSProperties}
            >
              <InvitationCard
                budget={budgets[item.id] ?? null}
                poster={posters[item.id] ?? null}
                item={item}
                busy={busy === item.id}
                tools={tools[item.id] ?? ['invite']}
                planning={planning[item.id] ?? null}
                daysLeft={today ? daysUntilEvent(item.date, today) : (days[item.id] ?? 30)}
                onDuplicate={() => void duplicate(item.id)}
                onArchive={(on) => void archive(item.id, on)}
                onFollowUp={() => setFollowUp(item)}
              />
            </li>
          ))}
          {showArchived ? null : (
            <li>
              <NewEventCard />
            </li>
          )}
        </ul>
      ) : showArchived ? (
        <p className="mt-10 text-center text-muted">{t.list.archivedEmpty}</p>
      ) : (
        <EmptyList />
      )}
      {followUp ? <FollowUpDialog item={followUp} onClose={() => setFollowUp(null)} /> : null}
      {upgrade ? <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}

/**
 * No events yet: what Badook is (the demo video), one inviting first step, then the event's four stages —
 * planning, inviting, arranging, celebrating — so the whole product is in view before the first click.
 */
function EmptyList() {
  const { t } = useUi();
  const T = t.eventHome.tools;
  return (
    <section
      className="mt-6 overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm"
      data-testid="list-empty"
    >
      <div className="grid items-center gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="max-w-[52ch]">
          <h2 className="font-display text-[28px] leading-tight font-bold text-balance sm:text-[34px]">
            {t.list.emptyTitle}
          </h2>
          <p className="mt-2 text-[15.5px] text-pretty text-muted">{t.list.emptyBody}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* the three-screen start (onboarding/StartWizard); or straight to the designs */}
            <Button asChild size="lg" icon={<Plus />}>
              <Link href="/app/invitations/new">{t.list.emptyStart}</Link>
            </Button>
            <Link
              href="/app/invitations/new?gallery=1"
              className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand-deep underline-offset-4 hover:underline"
            >
              <Palette aria-hidden className="size-4" />
              {t.list.emptyCta}
            </Link>
          </div>
        </div>
        <DemoVideo />
      </div>
      <div className="border-t border-line bg-canvas/70 px-6 py-7 sm:px-10">
        <h3 className="text-[14px] font-bold">{T.title}</h3>
        <p className="mt-1 text-[13px] text-muted">{T.body}</p>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {TOOLS.map((tool, i) => {
            const Icon = TOOL_ICONS[tool];
            return (
              <li
                key={tool}
                className="site-rise relative"
                style={{ '--rise-delay': `${i * 90}ms` } as CSSProperties}
              >
                <span className="relative flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep ring-4 ring-canvas">
                  <Icon aria-hidden className="size-5" />
                </span>
                <p className="mt-3 text-[14.5px] font-bold">{T.items[tool].title}</p>
                <p className="mt-1 text-[13px] text-pretty text-muted">{T.items[tool].body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function InvitationCard({
  item,
  budget = null,
  poster = null,
  busy,
  tools,
  planning,
  daysLeft,
  onDuplicate,
  onArchive,
  onFollowUp,
}: {
  item: InvitationSummary;
  budget?: CardBudget | null;
  poster?: ReactNode;
  busy: boolean;
  tools: ToolKey[];
  planning: CardPlanning;
  /** the days to the event (the visitor's own day once known) */
  daysLeft: number;
  onDuplicate: () => void;
  onArchive: (archived: boolean) => void;
  /** a save-the-date → its full invitation */
  onFollowUp: () => void;
}) {
  const { t, locale, date, number, plural, fmt } = useUi();
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const base = `/app/invitations/${item.id}`;
  const archived = item.status === 'archived';
  const invite = tools.includes('invite');
  const path = archived ? null : journey(item.id, cardFacts(item, daysLeft, planning), new Set(tools));
  const next = path?.current ?? null;
  const shortDate = date(item.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const enter = (via: 'card' | 'button') => track('event_enter', { invitationId: item.id, props: { via } });
  const used = budget && budget.committed > 0 ? Math.round((budget.committed / budget.total) * 100) : null;
  const NextIcon = next ? TOOL_ICONS[next.tool] : null;

  return (
    <article
      aria-busy={busy || undefined}
      data-testid="event-card"
      className="group/card relative flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-brand-line hover:shadow-[0_18px_40px_-24px_rgba(60,35,15,0.45)] motion-reduce:transition-none"
    >
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        <Link href={base} tabIndex={-1} aria-hidden className="relative block w-[84px] shrink-0 sm:w-[104px]">
          {poster ?? <div className="aspect-[9/16] rounded-[14px] bg-subtle" />}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-brand-deep">
                {t.eventTypes[item.eventType]}
                {archived ? null : <CountdownChip date={item.date} />}
              </p>
              <h2 className="mt-1.5 text-[19px] leading-snug font-extrabold sm:text-[21px]">
                {/* the whole card opens the event: this link stretches over it */}
                <Link
                  href={base}
                  lang={loc}
                  onClick={() => enter('card')}
                  className="line-clamp-2 rounded-[4px] after:absolute after:inset-0 after:content-[''] hover:underline"
                  data-testid="event-card-link"
                >
                  {name}
                </Link>
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                <span dir="ltr" className="tabular-nums">
                  {shortDate}
                </span>
                {invite || archived ? (
                  <Badge variant={BADGE[item.status]}>{t.status[item.status]}</Badge>
                ) : null}
                {invite && item.status === 'published' && item.unpublishedChanges ? (
                  <Badge variant="warning">{t.status.unpublishedChanges}</Badge>
                ) : null}
              </p>
            </div>
            <div className="relative z-10">
              <Menu
                trigger={
                  <IconButton label={t.common.more} size="sm" disabled={busy} className="-me-1 -mt-0.5">
                    <MoreHorizontal />
                  </IconButton>
                }
                items={[
                  { label: t.list.menu.open, icon: <ArrowRight className="icon-dir" />, href: base },
                  ...(invite
                    ? [
                        { label: t.list.menu.edit, icon: <PencilLine />, href: `${base}/edit` },
                        { label: t.list.menu.guests, icon: <Users />, href: `${base}/guests` },
                      ]
                    : []),
                  ...(invite && item.status === 'published'
                    ? [{ label: t.list.menu.share, icon: <Share2 />, href: `${base}/share` }]
                    : []),
                  ...(invite && (item.status !== 'draft' || item.responses > 0)
                    ? [{ label: t.list.menu.responses, icon: <ListChecks />, href: `${base}/responses` }]
                    : []),
                  ...(item.eventType === 'save_the_date' && !archived && followUpTypes(item).length
                    ? [{ label: t.list.menu.followUp, icon: <MailPlus />, onSelect: onFollowUp }]
                    : []),
                  { label: t.list.menu.duplicate, icon: <Copy />, onSelect: onDuplicate },
                  { type: 'separator' },
                  archived
                    ? {
                        label: t.list.menu.unarchive,
                        icon: <ArchiveRestore />,
                        onSelect: () => onArchive(false),
                      }
                    : { label: t.list.menu.archive, icon: <Archive />, onSelect: () => onArchive(true) },
                ]}
              />
            </div>
          </div>

          {path && path.total ? (
            <div className="mt-auto pt-4" data-testid="card-path">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px]">
                <span className="font-semibold text-ink/80">
                  {fmt(t.list.pathProgress, { done: number(path.done), total: number(path.total) })}
                </span>
                {invite && item.guests ? (
                  <span className="font-semibold text-success">
                    {fmt(t.list.repliedOf, { n: number(item.responses), total: number(item.guests) })}
                  </span>
                ) : used !== null ? (
                  <span className="font-semibold text-muted" data-testid="card-glance">
                    {fmt(t.list.budgetUsed, { pct: number(used) })}
                  </span>
                ) : null}
              </div>
              <span aria-hidden className="mt-2 block h-2 overflow-hidden rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full bg-linear-to-l from-brand to-brand-deep"
                  style={{ width: `${Math.max(4, (path.done / path.total) * 100)}%` }}
                />
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {path ? (
        <div className="relative z-10 px-4 pb-4 sm:px-5">
          {next && NextIcon ? (
            <Link
              href={next.href}
              data-next-step={next.key}
              title={t.list.nextHint}
              onClick={() =>
                track('step_click', {
                  invitationId: item.id,
                  props: { step: next.key, variant: next.variant, source: 'list' },
                })
              }
              className={cn(
                'group/next flex items-center gap-3 rounded-[16px] border p-3 transition-colors',
                next.variant === 'changes'
                  ? 'border-warning-line bg-warning-bg hover:bg-[#fef3c7] dark:hover:bg-warning-line'
                  : 'border-brand-line bg-brand-soft/50 hover:bg-brand-soft',
              )}
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-surface text-brand-deep shadow-xs [&_svg]:size-[18px]"
              >
                <NextIcon strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold text-brand-deep">
                  {t.list.nextLabel}
                  <span className="sr-only">: </span>
                </span>
                <span className="block truncate text-[14px] font-bold text-ink">{stepTitle(next)}</span>
              </span>
              <ArrowRight
                aria-hidden
                className="icon-dir size-4 shrink-0 text-brand-deep transition-transform group-hover/next:-translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          ) : (
            <p className="flex items-center gap-2 rounded-[16px] bg-success-bg px-3 py-3 text-[13.5px] font-semibold text-success">
              <Check aria-hidden className="size-4" strokeWidth={3} />
              {t.list.nothingNext}
            </p>
          )}
        </div>
      ) : null}

      <div className="relative z-10 mt-auto flex items-center justify-end gap-2 border-t border-line bg-canvas/50 px-4 py-3 sm:px-5">
        {archived ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<ArchiveRestore />}
            onClick={() => onArchive(false)}
            disabled={busy}
          >
            {t.list.menu.unarchive}
          </Button>
        ) : (
          <Link
            href={base}
            onClick={() => enter('button')}
            data-testid="event-enter"
            className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-[12px] bg-brand-deep px-5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-brand-strong dark:text-[#1c1917]"
          >
            <EnterLabel label={t.list.enter} pending={t.list.opening} />
          </Link>
        )}
      </div>
    </article>
  );

  function stepTitle(s: JourneyStep): string {
    const words = (
      t.eventHome.journey.steps[s.key] as Record<string, { title: string | { one: string; other: string } }>
    )[s.variant]!;
    return typeof words.title === 'string'
      ? words.title
      : plural(words.title, s.n ?? 0, { n: number(s.n ?? 0) });
  }
}

/** Inside the "open the event" link: a spinner and "opening…" from the click until the event is there. */
function EnterLabel({ label, pending }: { label: string; pending: string }) {
  const { pending: loading } = useLinkStatus();
  return loading ? (
    <>
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      <span role="status">{pending}</span>
    </>
  ) : (
    <>
      {label}
      <ArrowRight aria-hidden className="icon-dir size-4" />
    </>
  );
}

/** What the list knows of an event, as the path's facts (the replies counted on the list; no seating). */
function cardFacts(item: InvitationSummary, daysLeft: number, planning: CardPlanning): HomeFacts {
  return {
    daysLeft,
    status: item.status,
    unpublishedChanges: item.unpublishedChanges,
    guests: item.guests,
    sent: item.sent,
    notAnswered: Math.max(0, item.guests - item.responses),
    unmatched: 0,
    responses: item.responses,
    planning,
    seating: null,
    eventDay: false,
    gallery: false,
  };
}

/** The last card: a new event — an invitation, a plan or the seating, whatever the host needs. */
function NewEventCard() {
  const { t } = useUi();
  return (
    <Link
      href="/app/invitations/new"
      data-testid="new-event-card"
      className="flex h-full min-h-[148px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line-strong p-5 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-deep"
      >
        <Plus className="size-5" />
      </span>
      <span className="text-[15.5px] font-bold">{t.list.newCard.title}</span>
      <span className="text-[13px] text-muted">{t.list.newCard.body}</span>
    </Link>
  );
}

/** The header's corner: an envelope with a heart seal and a few sparkles (decorative). */
function EnvelopeDecor() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 160"
      className="list-hero-art pointer-events-none absolute end-[260px] top-1/2 w-[190px] -translate-y-1/2 opacity-90 max-lg:hidden"
    >
      <g transform="rotate(-8 110 80)">
        <rect x="40" y="42" width="140" height="92" rx="10" fill="#fff" stroke="#ead8c0" strokeWidth="2" />
        <path d="M42 48l68 48 68-48" fill="none" stroke="#ead8c0" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="110" cy="96" r="15" fill="#a0703f" />
        <path
          d="M110 104c-6-4.5-9-7.6-9-11a4.6 4.6 0 0 1 9-1.6 4.6 4.6 0 0 1 9 1.6c0 3.4-3 6.5-9 11z"
          fill="#fff"
          opacity=".9"
        />
      </g>
      <path d="M36 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#e7a977" className="list-hero-spark" />
      <path
        d="M196 120l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"
        fill="#a0703f"
        className="list-hero-spark [animation-delay:1.2s]"
      />
    </svg>
  );
}
