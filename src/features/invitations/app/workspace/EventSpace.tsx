'use client';

import {
  Armchair,
  ChartColumn,
  Check,
  ChevronDown,
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
  Plus,
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
import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, BrandLogo, Button, cn, useDir } from '@/components/app';
import { openHelp } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import { CountdownChip, daysUntilEvent, useToday } from '../countdown';
import { useOpenTools } from './context';
import { publishHref } from './paths';
import {
  NAV_PATHS,
  STAGES,
  navKeyOf,
  stageItems,
  stageOf,
  stageOpenByDefault,
  stageProgress,
  stageStatusSoFar,
  type NavKey,
  type StageFactsSoFar,
  type StageKey,
  type StageProgress,
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
  /** the plan's open tasks and this week's (null: no plan yet, or no planning) and the seating's numbers */
  plan: { open: number; week: number } | null;
  seating: { tables: number; unseated: number } | null;
  /** the invitation's poster, drawn on the server (app/ItemPoster) */
  thumb?: ReactNode;
}

/**
 * The facts the stages' badges read: the server knows them for planning, inviting and arranging; the days
 * to the event ("celebrate") only once the visitor's own today is known.
 */
function useStageFacts(d: EventSpaceData): StageFactsSoFar {
  const today = useToday();
  return {
    status: d.item.status,
    guests: d.item.guests,
    sent: d.item.sent,
    daysLeft: today ? daysUntilEvent(d.item.date, today) : null,
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
      case 'week':
        return plural(S.week, s.n, { n: number(s.n) });
      case 'inProgress':
        return S.inProgress;
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
function StatusPill({ status }: { status: StageStatus }) {
  const label = useStatusLabel()(status);
  if (!label) return null;
  const done = status.kind === 'done';
  return (
    <span
      className={cn(
        'ms-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap tabular-nums',
        done
          ? 'bg-success-bg text-success'
          : status.kind === 'startsIn' || status.kind === 'notStarted' || status.kind === 'inProgress'
            ? 'bg-subtle text-muted'
            : status.kind === 'today'
              ? 'bg-brand-deep text-white dark:text-[#1c1917]'
              : 'bg-brand-soft text-brand-deep',
      )}
    >
      {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
      {label}
    </span>
  );
}

/**
 * A step's circle on the stages' line: a check when the stage is finished, its number in the brand's ring
 * while there's work going on, a plain number before it begins.
 */
function StageMark({ n, progress }: { n: number; progress: StageProgress }) {
  const { number } = useUi();
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular-nums',
        progress === 'done'
          ? 'bg-success text-white dark:text-success-bg'
          : progress === 'active'
            ? 'bg-brand-soft text-brand-deep ring-[1.5px] ring-brand'
            : 'bg-surface text-muted ring-1 ring-line-strong',
      )}
    >
      {progress === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : number(n)}
    </span>
  );
}

/** The list of every event — even for a host with one (the list sends them straight into it otherwise). */
export const ALL_EVENTS = '/app/invitations?all=1';

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
  onLine = false,
}: {
  id: string;
  navKey: NavKey;
  current: boolean;
  locked?: boolean;
  onNavigate?: () => void;
  size?: 'md' | 'lg';
  /** a stage's screen: the "you are here" mark sits on the stages' line */
  onLine?: boolean;
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
        size === 'lg' ? 'h-12 text-[15px]' : 'h-8 text-[13.5px]',
        current
          ? 'bg-brand-soft font-semibold text-brand-deep'
          : 'text-ink/75 hover:bg-subtle hover:text-ink',
      )}
    >
      {current && size === 'md' ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-2 w-[3px] bg-brand',
            onLine ? '-start-[9.5px] rounded-full' : '-start-3 rounded-e-full',
          )}
        />
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

type StagePrefs = Partial<Record<StageKey, boolean>>;
const prefsKey = (id: string) => `badook:stages-open:${id}`;

function readPrefs(id: string): StagePrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(prefsKey(id)) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const prefs: StagePrefs = {};
    for (const s of STAGES) {
      const v = (raw as Record<string, unknown>)[s];
      if (typeof v === 'boolean') prefs[s] = v;
    }
    return prefs;
  } catch {
    return {};
  }
}

/**
 * Which of the sidebar's stages are open: as the host last left each one in this event (this browser),
 * else stageOpenByDefault() — and the stage of the screen they go to always opens, so where they are is
 * never folded away.
 */
function useOpenStages(id: string, facts: StageFactsSoFar, viewing: StageKey | null) {
  const [prefs, setPrefs] = useState<StagePrefs | null>(null);
  useEffect(() => setPrefs(readPrefs(id)), [id]);
  // going to a screen of a stage the host had folded: the fold is forgotten (back to the default)
  useEffect(() => {
    if (viewing) setPrefs((p) => (p?.[viewing] === false ? { ...p, [viewing]: undefined } : p));
  }, [viewing]);
  useEffect(() => {
    if (!prefs) return;
    try {
      window.localStorage.setItem(prefsKey(id), JSON.stringify(prefs));
    } catch {
      // private mode: remembered for this visit only
    }
  }, [id, prefs]);
  const isOpen = (stage: StageKey) => prefs?.[stage] ?? stageOpenByDefault(stage, facts, viewing);
  const toggle = (stage: StageKey) => setPrefs((p) => ({ ...p, [stage]: !isOpen(stage) }));
  return { isOpen, toggle };
}

/**
 * From 1024px, inside an event, the app's sidebar is the event's: back to every event, the event itself
 * (its poster, names and countdown), its home, then the event's stages as numbered steps on one line —
 * each with its status, opening to its screens (useOpenStages: what has work left, and where the host
 * is) — then insights, the event's settings, help and the account.
 */
export function EventSidebar({ data, account }: { data: EventSpaceData; account: ReactNode }) {
  const { t, locale, fmt, number } = useUi();
  const N = t.workspace.nav;
  const { item, caps } = data;
  const path = usePathname();
  const current = navKeyOf(path, item.id);
  const currentStage = stageOf(current, caps);
  const facts = useStageFacts(data);
  const { isOpen, toggle } = useOpenStages(item.id, facts, currentStage);
  // the stages' folding moves only once the host folds one (not while the page settles)
  const [moved, setMoved] = useState(false);
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const stages = STAGES.filter((s) => stageItems(s, caps).length);

  return (
    <aside
      aria-label={N.label}
      className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex"
      data-testid="event-sidebar"
    >
      <div className="px-5 pt-5">
        <Link href={ALL_EVENTS} className="inline-block rounded-btn text-[18px]">
          <BrandLogo label={t.brand} />
        </Link>
        <Link
          href={ALL_EVENTS}
          className="mt-3 flex items-center gap-1 rounded-btn text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="icon-dir size-4" />
          {N.allEvents}
        </Link>
        <Link
          href={itemHref(item.id, 'home')}
          className="mt-2 flex items-center gap-3 rounded-[14px] border border-brand-line bg-linear-to-br from-brand-soft/80 to-surface p-2 transition-shadow hover:shadow-sm"
        >
          <EventThumb thumb={data.thumb} className="w-[36px]" />
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
        className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 pb-2 [scrollbar-width:thin]"
      >
        <NavItem id={item.id} navKey="home" current={current === 'home'} />
        <h2 className="px-2 pt-3 pb-1.5 text-[11.5px] font-semibold text-muted">{N.stagesTitle}</h2>
        <ol className="flex flex-col">
          {stages.map((stage, i) => {
            const items = stageItems(stage, caps);
            const status = stageStatusSoFar(stage, facts);
            const progress = stageProgress(status);
            const here = currentStage === stage;
            const open = isOpen(stage);
            const last = i === stages.length - 1;
            return (
              <li key={stage} className={cn('relative', !last && 'pb-1.5')} data-stage={stage}>
                {last ? null : (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute start-[19px] top-8 bottom-0 w-0.5 rounded-full',
                      progress === 'done' ? 'bg-success/45' : 'bg-line',
                    )}
                  />
                )}
                <h3>
                  <button
                    type="button"
                    id={`stage-${stage}`}
                    aria-expanded={open}
                    aria-controls={`stage-${stage}-screens`}
                    data-stage-toggle={stage}
                    onClick={(e) => {
                      setMoved(true);
                      toggle(stage);
                      // opened near the bottom: its screens come into view instead of below the fold
                      const row = e.currentTarget.closest('li');
                      if (open || !row) return;
                      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                      window.setTimeout(
                        () => row.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' }),
                        still ? 0 : 220,
                      );
                    }}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-[10px] px-2 py-1 text-start text-[13px] font-bold transition-colors hover:bg-subtle',
                      here ? 'text-ink' : 'text-ink/80',
                    )}
                  >
                    <StageMark n={i + 1} progress={progress} />
                    <span className="sr-only">
                      {fmt(N.stepOf, { n: number(i + 1), total: number(stages.length) })}:
                    </span>
                    <span className="min-w-0 leading-tight">{N.stages[stage]}</span>
                    {status ? <StatusPill status={status} /> : <span className="ms-auto" />}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0 text-faint transition-transform duration-200 group-hover:text-muted motion-reduce:transition-none',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                </h3>
                <div
                  id={`stage-${stage}-screens`}
                  inert={!open}
                  className={cn(
                    'grid',
                    // folded: hidden once the fold has closed (visibility waits for the end of the move)
                    open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
                    moved &&
                      'transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none',
                  )}
                >
                  <ul
                    className="flex min-h-0 flex-col gap-0.5 overflow-hidden p-[3px] ps-7"
                    aria-label={fmt(N.menu, { stage: N.stages[stage] })}
                  >
                    {items.map((key) => (
                      <li key={key}>
                        <NavItem
                          id={item.id}
                          navKey={key}
                          current={current === key}
                          locked={lockedOf(key, caps)}
                          onLine
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
        <AddToolsButton />
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-line px-3 pt-2 pb-3">
        {caps.insights ? <NavItem id={item.id} navKey="insights" current={current === 'insights'} /> : null}
        <NavItem id={item.id} navKey="settings" current={current === 'settings'} />
        <button
          type="button"
          data-tour="help"
          onClick={() => openHelp()}
          className="flex h-8 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium text-ink/75 transition-colors hover:bg-subtle hover:text-ink"
        >
          <MessageCircleQuestion aria-hidden className="size-[17px] shrink-0" strokeWidth={1.8} />
          {t.shell.nav.help}
        </button>
        <div className="mt-2">{account}</div>
      </div>
    </aside>
  );
}

/**
 * Under the event's tools: add or remove one (lib/tools) — the dialog opens right here, on any screen
 * of the event. Two lines: what it does, and which tools there are.
 */
function AddToolsButton({ size = 'md', onOpen }: { size?: 'md' | 'lg'; onOpen?: () => void }) {
  const { t } = useUi();
  const N = t.workspace.nav;
  const open = useOpenTools();
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        open();
      }}
      data-add-tools=""
      className={cn(
        'mt-2 flex w-full items-center gap-2.5 rounded-[12px] border border-dashed border-line-strong px-2.5 text-start transition-colors hover:border-brand hover:bg-brand-soft/50',
        size === 'lg' ? 'py-3' : 'py-2',
      )}
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
      >
        <Plus className="size-4" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{N.addTools}</span>
        <span className="block text-[11.5px] leading-snug text-muted">{N.addToolsHint}</span>
      </span>
    </button>
  );
}

function EventThumb({ thumb, className }: { thumb?: ReactNode; className?: string }) {
  if (!thumb) return null;
  return <span className={cn('block shrink-0', className)}>{thumb}</span>;
}

/**
 * The top of every screen in an event: a strip no taller than 72px — the poster, names, date and
 * countdown, whether it's live, and the main action (publish, or open the invitation).
 */
export function EventBar({
  item,
  thumb,
  tools,
}: {
  item: InvitationSummary;
  thumb?: ReactNode;
  /** the event's tools (lib/tools): no invitation, no publish button */
  tools: WorkspaceCaps['tools'];
}) {
  const { t, locale, date } = useUi();
  // the event's home shows all of this in its own hero (and publishing as a step of its path): no strip
  const onHome = navKeyOf(usePathname(), item.id) === 'home';
  const w = t.workspace;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const live = item.status === 'published';
  const archived = item.status === 'archived';
  if (onHome) return null;
  return (
    <header
      className="flex min-h-[64px] items-center gap-3 border-b border-line bg-surface/85 px-4 py-2 backdrop-blur sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:max-h-[72px]"
      data-testid="event-bar"
    >
      <EventThumb thumb={thumb} className="w-[34px] lg:hidden" />
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
          {tools.includes('invite') && (!live || item.unpublishedChanges) ? (
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
 * stage opens a sheet with its screens (and its status). Insights and the settings are linked at the foot of
 * the event's home.
 */
export function EventBottomBar({ data }: { data: EventSpaceData }) {
  const { t, fmt, number } = useUi();
  const N = t.workspace.nav;
  const { item, caps } = data;
  const path = usePathname();
  const current = navKeyOf(path, item.id);
  const currentStage = stageOf(current, caps);
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
            const status = stageStatusSoFar(s, facts);
            return (
              <BarButton
                key={s}
                icon={STAGE_ICONS[s]}
                label={N.stages[s]}
                active={currentStage === s}
                dot={status?.kind === 'open' || status?.kind === 'toSend' || status?.kind === 'today'}
                onClick={() => setSheet(s)}
                expanded={sheet === s}
                stage={s}
              />
            );
          })}
        </div>
      </nav>
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        title={sheet && sheet !== 'more' ? N.stages[sheet] : N.more}
        eyebrow={
          sheet && sheet !== 'more'
            ? fmt(N.stepOf, { n: number(stages.indexOf(sheet) + 1), total: number(stages.length) })
            : undefined
        }
        description={sheet && sheet !== 'more' ? N.stageHint[sheet] : undefined}
        closeLabel={t.common.close}
      >
        {sheet && sheet !== 'more' ? (
          <>
            {(() => {
              const status = stageStatusSoFar(sheet, facts);
              const label = status ? statusLabel(status) : null;
              return label ? <p className="mb-2 px-1 text-[13px] font-semibold text-muted">{label}</p> : null;
            })()}
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
            <AddToolsButton size="lg" onOpen={() => setSheet(null)} />
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
  stage,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  href?: string;
  onClick?: () => void;
  dot?: boolean;
  expanded?: boolean;
  /** the stage whose sheet it opens */
  stage?: StageKey;
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
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      data-stage-button={stage}
      className={cls}
    >
      {inner}
    </button>
  );
}

/** A sheet from the bottom of the screen (phones): Radix Dialog, a handle, the title and the content. */
function Sheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** a line over the title (a stage's "step 2 of 4") */
  eyebrow?: ReactNode;
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
                {eyebrow ? <p className="text-[12px] font-semibold text-brand-deep">{eyebrow}</p> : null}
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
