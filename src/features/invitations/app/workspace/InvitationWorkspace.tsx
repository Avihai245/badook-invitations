'use client';

import {
  Armchair,
  ChevronLeft,
  DoorOpen,
  ExternalLink,
  Images,
  LayoutDashboard,
  ListChecks,
  Maximize2,
  MessageCircle,
  PenLine,
  Send,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Badge, Button, cn, PAGE_TITLE } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import { getTemplate } from '../../templates/registry';
import { CountdownChip } from '../countdown';
import { TemplatePoster } from '../TemplatePoster';
import { InWorkspace } from './context';
import { publishHref, workspaceTab, type WorkspaceTab } from './paths';

/**
 * An invitation's workspace (its overview, guests & WhatsApp, RSVPs and sharing): a header with the
 * invitation's poster, names, date and countdown, whether it's live, and the main action (publish, or
 * open it); then its tabs — the guests tab stands out — and "edit the design", which opens the
 * full-screen editor. `seating`: the seating tab — shown when the event has the feature ('on'), or when
 * only the owner's package keeps it off ('plan': the tab offers the package that has it); `eventDay`:
 * the event day's live hall, the same way (feature checkin).
 */
export function InvitationWorkspace({
  item,
  seating = null,
  eventDay = null,
  galleryTab = false,
  children,
}: {
  item: InvitationSummary;
  seating?: 'on' | 'plan' | null;
  eventDay?: 'on' | 'plan' | null;
  /** the live gallery's tab (when this deployment offers it: features/flags) */
  galleryTab?: boolean;
  children: ReactNode;
}) {
  const { t, locale, date, plural, number } = useUi();
  const w = t.workspace;
  const current = workspaceTab(usePathname(), item.id);
  const template = getTemplate(item.templateId)?.manifest;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const primary = item.hosts.primary[loc] ?? item.hosts.primary[item.defaultLocale] ?? '';
  const secondary = item.hosts.secondary?.[loc] ?? item.hosts.secondary?.[item.defaultLocale] ?? null;
  const base = `/app/invitations/${item.id}`;
  const live = item.status === 'published';
  const archived = item.status === 'archived';

  const tabs: { key: WorkspaceTab; href: string; icon: LucideIcon; label: ReactNode; count?: string }[] = [
    { key: 'overview', href: base, icon: LayoutDashboard, label: w.tabs.overview },
    {
      key: 'guests',
      href: `${base}/guests`,
      icon: MessageCircle,
      label: (
        <>
          <span className="sm:hidden">{w.tabs.guestsShort}</span>
          <span className="max-sm:hidden">{w.tabs.guests}</span>
        </>
      ),
      count: item.guests ? plural(w.guestsCount, item.guests, { n: number(item.guests) }) : undefined,
    },
    {
      key: 'responses',
      href: `${base}/responses`,
      icon: ListChecks,
      label: w.tabs.responses,
      count: item.responses
        ? plural(w.responsesCount, item.responses, { n: number(item.responses) })
        : undefined,
    },
    ...(seating
      ? [{ key: 'seating' as const, href: `${base}/seating`, icon: Armchair, label: t.seating.tab }]
      : []),
    ...(eventDay
      ? [{ key: 'live' as const, href: `${base}/live`, icon: DoorOpen, label: t.eventDay.tab }]
      : []),
    { key: 'share', href: `${base}/share`, icon: Share2, label: w.tabs.share },
    ...(galleryTab
      ? [{ key: 'gallery' as const, href: `${base}/gallery`, icon: Images, label: t.liveGallery.tab }]
      : []),
    { key: 'edit', href: `${base}/edit`, icon: PenLine, label: w.tabs.edit },
  ];
  const countOf = (key: WorkspaceTab) =>
    key === 'guests' ? item.guests : key === 'responses' ? item.responses : 0;

  // phones: the tab row scrolls sideways — bring the current tab into view (the row only, not the page)
  const tabRow = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !tab) return;
    const r = tab.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    if (r.left < b.left || r.right > b.right)
      row.scrollBy({ left: r.left + r.width / 2 - (b.left + b.width / 2) });
  }, [current]);

  return (
    <InWorkspace.Provider value>
      <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6">
        <Link
          href="/app/invitations"
          className="inline-flex items-center gap-1 rounded-btn text-[13px] font-medium text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="icon-dir size-4" />
          {w.back}
        </Link>
        <section className="list-hero relative mt-2.5 overflow-hidden rounded-[24px] border border-brand-line px-4 pt-4 sm:px-7 sm:pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-1 basis-[300px] items-center gap-4">
              {template ? (
                <TemplatePoster
                  template={template}
                  locale={loc}
                  text={{
                    eyebrow: null,
                    primary: primary || name,
                    secondary,
                    date: date(item.date, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }),
                  }}
                  joiner={item.hosts.joiner?.[loc] || '&'}
                  className="w-[60px] shrink-0 rounded-[12px]! shadow-[0_12px_24px_-14px_rgba(60,35,15,0.7)]! ring-2 ring-white/80 sm:w-[78px] sm:rounded-[16px]!"
                />
              ) : null}
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-brand-deep">
                  {t.eventTypes[item.eventType]}
                  <CountdownChip date={item.date} />
                </p>
                <p className={cn(PAGE_TITLE.screen, 'mt-1')} lang={loc}>
                  <bdi>{name}</bdi>
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                  {/* the server's and the browser's Intl may punctuate a long date differently ("Thursday, 17
                      June" / "Thursday 17 June"): either is right, and it mustn't fail the page's hydration */}
                  <span suppressHydrationWarning>
                    {date(item.date, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <Badge variant={live ? 'live' : archived ? 'neutral' : 'draft'}>
                    {t.status[item.status]}
                  </Badge>
                  {live && item.unpublishedChanges ? (
                    <Badge variant="warning">{t.status.unpublishedChanges}</Badge>
                  ) : null}
                </p>
              </div>
            </div>
            {archived ? null : (
              // phones: a full-width row under the names
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
                {live ? (
                  <Button variant="secondary" icon={<ExternalLink className="icon-dir" />} asChild>
                    <a href={`/i/${item.slug}`} target="_blank" rel="noreferrer">
                      {w.openInvitation}
                    </a>
                  </Button>
                ) : null}
                {!live || item.unpublishedChanges ? (
                  <Button icon={<Send className="icon-dir" />} asChild>
                    <Link href={publishHref(item.id)}>{live ? t.editor.publishChanges : w.publish}</Link>
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <nav
            ref={tabRow}
            aria-label={w.label}
            className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex w-max gap-1.5 pb-4 sm:pb-5">
              {tabs.map(({ key, href, icon: Icon, label, count }) => {
                const active = current === key;
                const guests = key === 'guests';
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      title={key === 'edit' ? w.editHint : undefined}
                      data-tab={key}
                      className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none sm:h-10 sm:gap-2 sm:px-4 sm:text-[14px]',
                        active
                          ? guests
                            ? 'bg-[#128c4a] text-white shadow-[0_8px_18px_-10px_rgba(18,140,74,0.9)]'
                            : 'bg-ink text-white shadow-sm'
                          : guests
                            ? 'bg-[#e6f6ec] text-[#0f6b39] ring-1 ring-[#bfe6cc] hover:bg-[#d7f0e0]'
                            : 'bg-surface/70 text-ink/75 hover:bg-surface hover:text-ink',
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.9} />
                      {label}
                      {countOf(key) ? (
                        <>
                          <span
                            aria-hidden
                            className={cn(
                              'min-w-5 rounded-full px-1.5 text-center text-[11.5px] leading-5 tabular-nums',
                              active ? 'bg-white/20' : guests ? 'bg-[#0f6b39]/10' : 'bg-ink/8',
                            )}
                          >
                            {number(countOf(key))}
                          </span>
                          <span className="sr-only">({count})</span>
                        </>
                      ) : null}
                      {key === 'edit' ? <Maximize2 aria-hidden className="size-3.5 opacity-60" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </section>
      </div>
      {children}
    </InWorkspace.Provider>
  );
}
