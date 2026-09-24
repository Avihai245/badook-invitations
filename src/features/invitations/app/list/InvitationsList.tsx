'use client';

import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Copy,
  FileSpreadsheet,
  ListChecks,
  MailPlus,
  MessageCircle,
  MoreHorizontal,
  Palette,
  PencilLine,
  Send,
  Share2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UpgradeDialog, upgradeReason, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { useState, useTransition, type CSSProperties } from 'react';
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
import { getTemplate, TEMPLATE_IDS } from '../../templates/registry';
import { hostApi, loginUrl } from '../api';
import { CountdownChip, daysUntilEvent, useToday } from '../countdown';
import { HelpFor } from '../HelpFor';
import { TemplatePoster } from '../TemplatePoster';
import { publishHref } from '../workspace/paths';
import { FollowUpDialog, followUpTypes } from './FollowUpDialog';

const BADGE: Record<InvitationSummary['status'], BadgeVariant> = {
  draft: 'draft',
  published: 'live',
  archived: 'neutral',
};

type NextStep = { key: 'publish' | 'republish' | 'import' | 'send' | 'track'; href: string; n?: number };

/**
 * What the host would do next with this invitation: publish, upload the guest list, send it on
 * WhatsApp, then follow the replies. After the event only the replies are left to look at.
 */
export function nextStep(
  item: InvitationSummary,
  { past = false }: { past?: boolean } = {},
): NextStep | null {
  const base = `/app/invitations/${item.id}`;
  if (item.status === 'archived') return null;
  if (past) return item.responses ? { key: 'track', href: `${base}/responses` } : null;
  if (item.status === 'draft') return { key: 'publish', href: publishHref(item.id) };
  if (item.unpublishedChanges) return { key: 'republish', href: publishHref(item.id) };
  if (item.guests > item.sent)
    return { key: 'send', href: `${base}/guests?send=1`, n: item.guests - item.sent };
  if (item.guests === 0 && item.responses === 0) return { key: 'import', href: `${base}/guests?import=1` };
  return { key: 'track', href: `${base}/responses` };
}

/**
 * §9B.3-A: the host's home base — a greeting with their invitations at a glance, then one card per
 * invitation (its poster, where it stands, the next step and its main places one tap away); the
 * archive; and an empty state that teaches the whole flow.
 */
export function InvitationsList({ items, name }: { items: InvitationSummary[]; name: string | null }) {
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

  async function act(id: string, url: string, body: unknown, done: (res: Record<string, unknown>) => string) {
    setBusy(id);
    const res = await hostApi<Record<string, unknown>>(url, { method: 'POST', body });
    setBusy(null);
    if (res.status === 401) return router.push(loginUrl());
    const limit = upgradeReason(res.status, res.body);
    if (limit) return setUpgrade(limit);
    if (!res.ok || !res.body) return void toast({ title: t.common.error, variant: 'danger' });
    toast({ title: done(res.body), variant: 'success' });
    startTransition(() => router.refresh());
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
    <div className="mx-auto max-w-[1200px] px-4 pt-5 pb-16 sm:px-6 sm:pt-8">
      <section className="list-hero relative overflow-hidden rounded-[24px] border border-brand-line px-5 py-6 sm:px-8 sm:py-7">
        <EnvelopeDecor />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-brand-deep">
              {name ? fmt(t.list.greeting, { name }) : t.list.greetingNoName}
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
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          {visible.map((item, i) => (
            <li
              key={item.id}
              className="site-rise"
              style={{ '--rise-delay': `${Math.min(i, 6) * 60}ms` } as CSSProperties}
            >
              <InvitationCard
                item={item}
                busy={busy === item.id}
                past={today ? daysUntilEvent(item.date, today) < 0 : false}
                onDuplicate={() => void duplicate(item.id)}
                onArchive={(on) => void archive(item.id, on)}
                onFollowUp={() => setFollowUp(item)}
              />
            </li>
          ))}
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

/** No invitations yet: an inviting first step, then the four steps of the whole flow. */
function EmptyList() {
  const { t, fmt, number } = useUi();
  const steps: [keyof typeof t.list.steps, LucideIcon][] = [
    ['design', Palette],
    ['details', PencilLine],
    ['guests', FileSpreadsheet],
    ['send', MessageCircle],
  ];
  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm">
      <div className="grid items-center gap-6 px-6 py-8 sm:px-10 sm:py-10 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="max-w-[48ch]">
          <h2 className="font-display text-[26px] leading-tight font-bold text-balance sm:text-[30px]">
            {t.list.emptyTitle}
          </h2>
          <p className="mt-2 text-[15px] text-pretty text-muted">{t.list.emptyBody}</p>
          <Button asChild size="lg" icon={<Palette />} className="mt-6">
            <Link href="/app/invitations/new">{t.list.emptyCta}</Link>
          </Button>
        </div>
        <div aria-hidden className="list-hero-art mx-auto w-[150px] max-md:order-first md:w-[200px]">
          <EnvelopeArt />
        </div>
      </div>
      <div className="border-t border-line bg-canvas/70 px-6 py-7 sm:px-10">
        <h3 className="text-[12.5px] font-bold tracking-[.06em] text-muted">{t.list.steps.title}</h3>
        <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {steps.map(([key, Icon], i) => {
            const step = t.list.steps[key] as { title: string; body: string };
            return (
              <li
                key={key}
                className="site-rise relative"
                style={{ '--rise-delay': `${i * 90}ms` } as CSSProperties}
              >
                {i < steps.length - 1 ? (
                  // the path to the next step (wide screens)
                  <span
                    aria-hidden
                    className="absolute top-[21px] start-14 -end-2 hidden border-t-2 border-dashed border-brand-line lg:block"
                  />
                ) : null}
                <span className="relative flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep ring-4 ring-canvas">
                  <Icon aria-hidden className="size-5" />
                  <span
                    aria-hidden
                    className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white"
                  >
                    {number(i + 1)}
                  </span>
                </span>
                <p className="mt-3 text-[14.5px] font-bold">
                  <span className="sr-only">{number(i + 1)}. </span>
                  {step.title}
                </p>
                <p className="mt-1 text-[13px] text-pretty text-muted">
                  {fmt(step.body, { n: number(TEMPLATE_IDS.length) })}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function InvitationCard({
  item,
  busy,
  past,
  onDuplicate,
  onArchive,
  onFollowUp,
}: {
  item: InvitationSummary;
  busy: boolean;
  /** the event's day has passed (the visitor's own day) */
  past: boolean;
  onDuplicate: () => void;
  onArchive: (archived: boolean) => void;
  /** a save-the-date → its full invitation */
  onFollowUp: () => void;
}) {
  const { t, locale, date, number, plural, fmt } = useUi();
  const template = getTemplate(item.templateId)?.manifest;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const primary = item.hosts.primary[loc] ?? item.hosts.primary[item.defaultLocale] ?? '';
  const secondary = item.hosts.secondary?.[loc] ?? item.hosts.secondary?.[item.defaultLocale] ?? null;
  const base = `/app/invitations/${item.id}`;
  const archived = item.status === 'archived';
  const next = nextStep(item, { past });
  const shortDate = date(item.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const sentShare = item.guests ? Math.min(1, item.sent / item.guests) : 0;

  const actions: { key: string; href: string; icon: LucideIcon; label: string }[] = [
    { key: 'guests', href: `${base}/guests`, icon: Users, label: t.list.actions.guests },
    { key: 'responses', href: `${base}/responses`, icon: ListChecks, label: t.list.actions.responses },
    { key: 'share', href: `${base}/share`, icon: Share2, label: t.list.actions.share },
    { key: 'edit', href: `${base}/edit`, icon: PencilLine, label: t.list.actions.edit },
  ];

  return (
    <article
      aria-busy={busy || undefined}
      className="group/card flex h-full flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-brand-line hover:shadow-[0_18px_40px_-24px_rgba(60,35,15,0.45)] motion-reduce:transition-none"
    >
      <div className="flex gap-4 p-3 sm:p-4">
        <Link href={base} tabIndex={-1} aria-hidden className="relative block w-[88px] shrink-0 sm:w-[112px]">
          {template ? (
            // the invitation's own names and date on its design (the event type as the opening line)
            <TemplatePoster
              template={template}
              locale={loc}
              text={{
                eyebrow: t.eventTypes[item.eventType],
                primary: primary || name,
                secondary,
                date: shortDate,
              }}
              joiner={item.hosts.joiner?.[loc] || '&'}
              className="rounded-[14px]! transition-transform duration-300 group-hover/card:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0 sm:rounded-[16px]!"
            />
          ) : (
            <div className="aspect-[9/16] rounded-[14px] bg-subtle" />
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-brand-deep">
                {t.eventTypes[item.eventType]}
                {archived ? null : <CountdownChip date={item.date} />}
              </p>
              <h2 className="mt-1 truncate text-[17px] leading-snug font-bold sm:text-[18px]">
                <Link href={base} lang={loc} className="rounded-[4px] hover:underline">
                  {name}
                </Link>
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                <span dir="ltr" className="tabular-nums">
                  {shortDate}
                </span>
                <Badge variant={BADGE[item.status]}>{t.status[item.status]}</Badge>
                {item.status === 'published' && item.unpublishedChanges ? (
                  <Badge variant="warning">{t.status.unpublishedChanges}</Badge>
                ) : null}
              </p>
            </div>
            <Menu
              trigger={
                <IconButton label={t.common.more} size="sm" disabled={busy} className="-me-1 mt-px">
                  <MoreHorizontal />
                </IconButton>
              }
              items={[
                { label: t.list.menu.edit, icon: <PencilLine />, href: `${base}/edit` },
                { label: t.list.menu.guests, icon: <Users />, href: `${base}/guests` },
                ...(item.status === 'published'
                  ? [{ label: t.list.menu.share, icon: <Share2 />, href: `${base}/share` }]
                  : []),
                ...(item.status !== 'draft' || item.responses > 0
                  ? [{ label: t.list.menu.responses, icon: <ListChecks />, href: `${base}/responses` }]
                  : []),
                ...(item.eventType === 'save_the_date' && !archived && followUpTypes(item.templateId).length
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

          {archived ? null : (
            <div className="mt-3">
              {item.guests ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-medium">
                      {fmt(t.list.progress.sent, { sent: number(item.sent), guests: number(item.guests) })}
                    </span>
                    {item.attending ? (
                      <span className="font-semibold text-success">
                        {fmt(t.list.progress.attending, { attending: number(item.attending) })}
                      </span>
                    ) : null}
                  </div>
                  <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-subtle">
                    <span
                      className="block h-full rounded-full bg-linear-to-l from-[#25d366] to-[#128c4a]"
                      style={{ width: `${sentShare * 100}%` }}
                    />
                  </span>
                </>
              ) : (
                <p className="text-[12.5px] text-muted">
                  {item.responses
                    ? plural(t.list.stats, item.responses, {
                        responses: number(item.responses),
                        attending: number(item.attending),
                      })
                    : t.list.progress.noGuests}
                </p>
              )}
            </div>
          )}

          {next ? (
            <Hint text={t.list.nextHint}>
              <Link
                href={next.href}
                data-next-step={next.key}
                className={cn(
                  'mt-3 inline-flex max-w-full items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  next.key === 'republish'
                    ? 'bg-warning-bg text-warning hover:bg-[#fef3c7]'
                    : 'bg-brand-soft text-brand-deep hover:bg-brand hover:text-white',
                )}
              >
                {next.key === 'send' ? (
                  <Send aria-hidden className="icon-dir size-3.5 shrink-0" />
                ) : next.key === 'import' ? (
                  <FileSpreadsheet aria-hidden className="size-3.5 shrink-0" />
                ) : null}
                <span className="truncate">
                  {next.key === 'send'
                    ? plural(t.list.next.send, next.n ?? 0, { n: number(next.n ?? 0) })
                    : t.list.next[next.key]}
                </span>
                <ArrowRight aria-hidden className="icon-dir size-3.5 shrink-0" />
              </Link>
            </Hint>
          ) : null}
        </div>
      </div>

      <div className="mt-auto border-t border-line bg-canvas/60 px-2 py-2 sm:px-3">
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
          <div
            role="group"
            aria-label={fmt(t.list.actions.label, { name })}
            className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-1"
          >
            {actions.map(({ key, href, icon: Icon, label }) => (
              <Link
                key={key}
                href={href}
                data-quick={key}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 text-center text-[11.5px] leading-tight font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:text-[12.5px]',
                  key === 'guests'
                    ? 'bg-[#e6f6ec] text-[#0f6b39] hover:bg-[#d4efdf]'
                    : 'text-ink/75 hover:bg-subtle hover:text-ink',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.9} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
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

/** Empty-state illustration: an envelope with a seal (decorative, 120×120). */
function EnvelopeArt() {
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <rect x="14" y="30" width="92" height="64" rx="8" fill="#F5F0E8" stroke="#D6CFC4" strokeWidth="2" />
      <path d="M16 34 60 66l44-32" stroke="#D6CFC4" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="60" cy="66" r="13" fill="#731F2E" />
      <circle cx="60" cy="66" r="9" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
    </svg>
  );
}
