'use client';

import {
  Armchair,
  ChartColumn,
  Check,
  ChevronLeft,
  ClipboardList,
  DoorOpen,
  ExternalLink,
  Film,
  House,
  Images,
  Lightbulb,
  ListChecks,
  Lock,
  Maximize2,
  MessageCircleQuestion,
  Palette,
  PartyPopper,
  Send,
  Settings,
  Share2,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as RadixDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Badge, BrandLogo, Button, cn, useDir } from '@/components/app';
import { openSupport } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import { getTemplate } from '../../templates/registry';
import { CountdownChip, daysUntilEvent, useToday } from '../countdown';
import { TemplatePoster } from '../TemplatePoster';
import { publishHref } from './paths';
import {
  NAV_PATHS,
  STAGES,
  navKeyOf,
  stageItems,
  stageOf,
  stageStatus,
  type NavKey,
  type StageFacts,
  type StageKey,
  type StageStatus,
  type WorkspaceCaps,
} from './stages';

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  home: House,
  tasks: ListChecks,
  budget: Wallet,
  vendors: Store,
  ideas: Lightbulb,
  design: Palette,
  guests: Users,
  share: Share2,
  responses: ClipboardList,
  seating: Armchair,
  live: DoorOpen,
  gallery: Images,
  film: Film,
  insights: ChartColumn,
  settings: Settings,
};

export const STAGE_ICONS: Record<StageKey, LucideIcon> = {
  plan: ClipboardList,
  invite: Send,
  arrange: Armchair,
  celebrate: PartyPopper,
};

export interface EventSpaceData {
  item: InvitationSummary;
  caps: WorkspaceCaps;
  /** the plan's open tasks (null: no plan yet, or no planning) and the seating's numbers */
  plan: { open: number } | null;
  seating: { tables: number; unseated: number } | null;
}

/** The facts the stages' badges read; the days to the event only once the visitor's own today is known. */
function useStageFacts(d: EventSpaceData): StageFacts | null {
  const today = useToday();
  if (!today) return null;
  return {
    status: d.item.status,
    guests: d.item.guests,
    sent: d.item.sent,
    daysLeft: daysUntilEvent(d.item.date, today),
    plan: d.plan,
    seating: d.seating,
  };
}

function useStatusLabel() {
  const { t, plural, number } = useUi();
  const S = t.workspace.nav.status;
  return (s: StageStatus): string | null => {
    switch (s.kind) {
      case 'done':
        return S.done;
      case 'open':
        return plural(S.open, s.n, { n: number(s.n) });
      case 'notStarted':
        return S.notStarted;
      case 'draft':
        return S.draft;
      case 'toSend':
        return plural(S.toSend, s.n, { n: number(s.n) });
      case 'startsIn':
        return plural(S.startsIn, s.n, { n: number(s.n) });
      case 'today':
        return S.today;
      case 'none':
        return null;
    }
  };
}

/** A stage's badge: ✓ when done, the open count, "draft", or the days to the event. */
function StatusPill({ status, active }: { status: StageStatus; active?: boolean }) {
  const label = useStatusLabel()(status);
  if (!label) return null;
  const done = status.kind === 'done';
  return (
    <span
      className={cn(
        'ms-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap tabular-nums',
        done
          ? 'bg-success-bg text-success'
          : status.kind === 'startsIn' || status.kind === 'notStarted'
            ? 'bg-subtle text-muted'
            : status.kind === 'today'
              ? 'bg-brand text-white'
              : active
                ? 'bg-brand text-white'
                : 'bg-brand-soft text-brand-deep',
      )}
    >
      {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
      {label}
    </span>
  );
}

/** The stage's number in a circle: a check when it's done, the brand's color when it's where the host is. */
function StageMark({
  stage,
  status,
  current,
}: {
  stage: StageKey;
  status: StageStatus | null;
  current: boolean;
}) {
  const { number } = useUi();
  const done = status?.kind === 'done';
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular-nums',
        done
          ? 'bg-success text-white dark:text-success-bg'
          : current
            ? 'bg-brand text-white'
            : 'bg-subtle text-muted ring-1 ring-line',
      )}
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : number(STAGES.indexOf(stage) + 1)}
    </span>
  );
}

function itemHref(id: string, key: NavKey) {
  return `/app/invitations/${id}${NAV_PATHS[key]}`;
}

/** One screen in the navigation: its icon and name, "on a higher plan" with a lock, "full screen" for the editor. */
function NavItem({
  id,
  navKey,
  current,
  locked = false,
  onNavigate,
  size = 'md',
}: {
  id: string;
  navKey: NavKey;
  current: boolean;
  locked?: boolean;
  onNavigate?: () => void;
  size?: 'md' | 'lg';
}) {
  const { t } = useUi();
  const N = t.workspace.nav;
  const Icon = NAV_ICONS[navKey];
  return (
    <Link
      href={itemHref(id, navKey)}
      aria-current={current ? 'page' : undefined}
      data-nav={navKey}
      onClick={onNavigate}
      title={navKey === 'design' ? N.fullScreen : locked ? N.upgrade : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-[10px] px-2.5 font-medium transition-colors motion-reduce:transition-none',
        size === 'lg' ? 'h-12 text-[15px]' : 'h-9 text-[13.5px]',
        current
          ? 'bg-brand-soft font-semibold text-brand-deep'
          : 'text-ink/75 hover:bg-subtle hover:text-ink',
      )}
    >
      {current && size === 'md' ? (
        <span aria-hidden className="absolute inset-y-2 -start-3 w-[3px] rounded-e-full bg-brand" />
      ) : null}
      <Icon aria-hidden className="size-[17px] shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{N.items[navKey]}</span>
      {locked ? <Lock aria-hidden className="size-3.5 shrink-0 text-faint" /> : null}
      {navKey === 'design' ? (
        <Maximize2 aria-hidden className="size-3.5 shrink-0 text-faint group-hover:text-muted" />
      ) : null}
      {locked ? <span className="sr-only">({N.upgrade})</span> : null}
    </Link>
  );
}

const lockedOf = (key: NavKey, caps: WorkspaceCaps) =>
  (key === 'seating' && caps.seating === 'plan') || (key === 'live' && caps.eventDay === 'plan');

/**
 * From 1024px, inside an event, the app's sidebar is the event's: back to every event, the event itself
 * (its poster, names and countdown), its home, the four stages with their screens and each stage's
 * status, then insights, the event's settings, help and the account.
 */
export function EventSidebar({ data, account }: { data: EventSpaceData; account: ReactNode }) {
  const { t, locale } = useUi();
  const N = t.workspace.nav;
  const { item, caps } = data;
  const path = usePathname();
  const current = navKeyOf(path, item.id);
  const currentStage = stageOf(current);
  const facts = useStageFacts(data);
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];

  return (
    <aside
      aria-label={N.label}
      className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex"
      data-testid="event-sidebar"
    >
      <div className="px-5 pt-5">
        <Link href="/app/invitations" className="inline-block rounded-btn text-[19px]">
          <BrandLogo label={t.brand} />
        </Link>
        <Link
          href="/app/invitations"
          className="mt-4 flex items-center gap-1 rounded-btn text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="icon-dir size-4" />
          {N.allEvents}
        </Link>
        <Link
          href={itemHref(item.id, 'home')}
          className="mt-2.5 flex items-center gap-3 rounded-[14px] border border-brand-line bg-linear-to-br from-brand-soft/80 to-surface p-2.5 transition-shadow hover:shadow-sm"
        >
          <EventThumb item={item} className="w-[42px]" />
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-bold" lang={loc}>
              <bdi>{name}</bdi>
            </span>
            <span className="mt-0.5 block">
              <CountdownChip date={item.date} />
            </span>
          </span>
        </Link>
      </div>

      <nav
        aria-label={N.label}
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3"
      >
        <NavItem id={item.id} navKey="home" current={current === 'home'} />
        {STAGES.map((stage) => {
          const items = stageItems(stage, caps);
          if (!items.length) return null;
          const status = facts ? stageStatus(stage, facts) : null;
          const here = currentStage === stage;
          return (
            <section key={stage} className="mt-2.5" aria-labelledby={`stage-${stage}`} data-stage={stage}>
              <h2
                id={`stage-${stage}`}
                className={cn(
                  'flex items-center gap-2 px-2 pb-1 text-[12.5px] font-bold',
                  here ? 'text-ink' : 'text-muted',
                )}
              >
                <StageMark stage={stage} status={status} current={here} />
                {N.stages[stage]}
                {status ? <StatusPill status={status} active={here} /> : null}
              </h2>
              <ul className="ms-3 flex flex-col gap-0.5 border-s border-line ps-2">
                {items.map((key) => (
                  <li key={key}>
                    <NavItem
                      id={item.id}
                      navKey={key}
                      current={current === key}
                      locked={lockedOf(key, caps)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-line px-3 pt-2 pb-3">
        {caps.insights ? <NavItem id={item.id} navKey="insights" current={current === 'insights'} /> : null}
        <NavItem id={item.id} navKey="settings" current={current === 'settings'} />
        <button
          type="button"
          data-tour="help"
          onClick={() => openSupport()}
          className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium text-ink/75 transition-colors hover:bg-subtle hover:text-ink"
        >
          <MessageCircleQuestion aria-hidden className="size-[17px] shrink-0" strokeWidth={1.8} />
          {t.shell.nav.help}
        </button>
        <div className="mt-2">{account}</div>
      </div>
    </aside>
  );
}

function EventThumb({ item, className }: { item: InvitationSummary; className?: string }) {
  const { locale, date } = useUi();
  const template = getTemplate(item.templateId)?.manifest;
  if (!template) return null;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const primary = item.hosts.primary[loc] ?? item.hosts.primary[item.defaultLocale] ?? '';
  const secondary = item.hosts.secondary?.[loc] ?? item.hosts.secondary?.[item.defaultLocale] ?? null;
  return (
    <TemplatePoster
      template={template}
      locale={loc}
      text={{
        eyebrow: null,
        primary,
        secondary,
        date: date(item.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
      }}
      joiner={item.hosts.joiner?.[loc] || '&'}
      className={cn('shrink-0 rounded-[9px]! shadow-[0_8px_16px_-10px_rgba(60,35,15,0.7)]!', className)}
    />
  );
}

/**
 * The top of every screen in an event: a strip no taller than 72px — the poster, names, date and
 * countdown, whether it's live, and the main action (publish, or open the invitation).
 */
export function EventBar({ item }: { item: InvitationSummary }) {
  const { t, locale, date } = useUi();
  const w = t.workspace;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const live = item.status === 'published';
  const archived = item.status === 'archived';
  return (
    <header
      className="flex min-h-[64px] items-center gap-3 border-b border-line bg-surface/85 px-4 py-2 backdrop-blur sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:max-h-[72px]"
      data-testid="event-bar"
    >
      <EventThumb item={item} className="w-[34px] lg:hidden" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[16px] font-bold sm:text-[17px]" lang={loc}>
            <bdi>{name}</bdi>
          </span>
          <Badge variant={live ? 'live' : archived ? 'neutral' : 'draft'} className="shrink-0">
            {t.status[item.status]}
          </Badge>
          {live && item.unpublishedChanges ? (
            <Badge variant="warning" className="shrink-0 max-sm:hidden">
              {t.status.unpublishedChanges}
            </Badge>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
          <span suppressHydrationWarning className="truncate">
            {date(item.date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </span>
          <CountdownChip date={item.date} className="max-sm:hidden" />
        </p>
      </div>
      {archived ? null : (
        <div className="flex shrink-0 items-center gap-2">
          {live ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<ExternalLink className="icon-dir" />}
              asChild
              className="max-sm:px-2.5"
            >
              <a href={`/i/${item.slug}`} target="_blank" rel="noreferrer" aria-label={w.openInvitation}>
                <span className="max-sm:hidden">{w.openInvitation}</span>
              </a>
            </Button>
          ) : null}
          {!live || item.unpublishedChanges ? (
            <Button size="sm" icon={<Send className="icon-dir" />} asChild>
              <Link href={publishHref(item.id)}>{live ? t.editor.publishChanges : w.publish}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </header>
  );
}

/**
 * Phones and tablets, inside an event: the bottom bar is the event's — its home and the four stages; a
 * stage opens a sheet with its screens (and its status). Insights and the settings are in the home's sheet.
 */
export function EventBottomBar({ data }: { data: EventSpaceData }) {
  const { t, fmt } = useUi();
  const N = t.workspace.nav;
  const { item, caps } = data;
  const path = usePathname();
  const current = navKeyOf(path, item.id);
  const currentStage = stageOf(current);
  const facts = useStageFacts(data);
  const [sheet, setSheet] = useState<StageKey | 'more' | null>(null);
  const stages = STAGES.filter((s) => stageItems(s, caps).length);
  const statusLabel = useStatusLabel();

  return (
    <>
      <nav
        aria-label={N.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.25)] backdrop-blur lg:hidden"
        data-testid="event-bottom-bar"
      >
        <div className="flex h-16 items-stretch ps-1 pe-[76px]">
          <BarButton
            icon={House}
            label={N.items.home}
            active={current === 'home' || current === 'insights' || current === 'settings'}
            href={itemHref(item.id, 'home')}
          />
          {stages.map((s) => {
            const status = facts ? stageStatus(s, facts) : null;
            return (
              <BarButton
                key={s}
                icon={STAGE_ICONS[s]}
                label={N.stages[s]}
                active={currentStage === s}
                dot={status?.kind === 'open' || status?.kind === 'toSend' || status?.kind === 'today'}
                onClick={() => setSheet(s)}
                expanded={sheet === s}
              />
            );
          })}
        </div>
      </nav>
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        title={sheet && sheet !== 'more' ? N.stages[sheet] : N.more}
        description={sheet && sheet !== 'more' ? N.stageHint[sheet] : undefined}
        closeLabel={t.common.close}
      >
        {sheet && sheet !== 'more' ? (
          <>
            {facts ? (
              <p className="mb-2 px-1 text-[13px] font-semibold text-muted">
                {statusLabel(stageStatus(sheet, facts))}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1" aria-label={fmt(N.menu, { stage: N.stages[sheet] })}>
              {stageItems(sheet, caps).map((key) => (
                <li key={key}>
                  <NavItem
                    id={item.id}
                    navKey={key}
                    current={current === key}
                    locked={lockedOf(key, caps)}
                    onNavigate={() => setSheet(null)}
                    size="lg"
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Sheet>
    </>
  );
}

function BarButton({
  icon: Icon,
  label,
  active,
  href,
  onClick,
  dot = false,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  href?: string;
  onClick?: () => void;
  dot?: boolean;
  expanded?: boolean;
}) {
  const cls = cn(
    'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
    active ? 'text-brand-deep' : 'text-muted hover:text-ink',
  );
  const inner = (
    <>
      {active ? <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" /> : null}
      <span className="relative">
        <Icon aria-hidden className="size-[22px]" strokeWidth={1.75} />
        {dot ? (
          <span
            aria-hidden
            className="absolute -end-1 -top-0.5 size-2.5 rounded-full bg-brand-strong ring-2 ring-surface"
          />
        ) : null}
      </span>
      {label}
    </>
  );
  return href ? (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={expanded} className={cls}>
      {inner}
    </button>
  );
}

/** A sheet from the bottom of the screen (phones): Radix Dialog, a handle, the title and the content. */
function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  const dir = useDir();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          className="fixed inset-0 z-[66] bg-[rgba(28,25,23,0.4)] motion-safe:data-[state=open]:animate-app-fade-in lg:hidden"
        >
          <RadixDialog.Content className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[24px] bg-surface px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-lg outline-none motion-safe:data-[state=open]:animate-app-dialog-in">
            <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line-strong" />
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <RadixDialog.Title className="text-[18px] font-bold">{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="text-[13px] text-muted">
                    {description}
                  </RadixDialog.Description>
                ) : null}
              </div>
              <RadixDialog.Close className="rounded-btn px-2 py-1 text-[13px] font-semibold text-muted hover:text-ink">
                {closeLabel}
              </RadixDialog.Close>
            </div>
            <div className="mt-3">{children}</div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
