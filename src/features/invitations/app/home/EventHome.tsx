'use client';

import {
  ArrowRight,
  ChartColumn,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  ListChecks,
  Plus,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, CountUp, cn, useToast } from '@/components/app';
import { track } from '@/features/analytics/track';
import { taskTitle } from '@/features/planning/model/task-text';
import { systemText } from '@/features/planning/model/system-text';
import { BudgetGauge } from '@/features/planning/ui/BudgetGauge';
import { DemoVideo } from '@/features/site/DemoVideo.client';
import { openHelp } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { TOOLS, type ToolKey } from '../../lib/tools';
import { hostsLine } from '../../lib/text';
import type { EventHomeData } from '../../server/event-home';
import { HelpFor } from '../HelpFor';
import { TOOL_ICONS } from '../tools/ToolsPicker';
import { ToolsDialog } from '../tools/ToolsDialog';
import { journey, type Journey, type JourneyStep, type StepKey } from './journey';
import { Tour } from './Tour';

/**
 * The event's home (UX report §4.1), built for a host who has never used an app like this: one column,
 * read top to bottom — the event (its poster, names, date and how far it is), then "your path": the steps
 * the tools the host chose call for (journey.ts), the current one open with a single big button, the
 * done ones folded under a ✓, the later ones a line each. Then how it's going — only the widgets that
 * have something to show (the replies after sending, the budget once there is one, this week's tasks) —
 * and "need something else?": the tools the host didn't ask for, a tap away. No dashboard of zeros.
 */
export function EventHome({
  data,
  tourDone = false,
  poster = null,
}: {
  data: EventHomeData;
  /** the account has seen the tour (on any device) */
  tourDone?: boolean;
  /** the invitation's poster, drawn on the server (app/ItemPoster) */
  poster?: ReactNode;
}) {
  const { t } = useUi();
  const id = data.item.id;
  const tools = data.caps.tools;
  const path = journey(id, data.facts, new Set(tools));
  const offered = offeredTools(data);
  const missing = offered.filter((k) => !tools.includes(k));
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    // the sidebar's "add tools" (?tools=1) opens the tools straight away
    const url = new URL(window.location.href);
    // straight in from the list (one event): counted as entering it
    if (url.searchParams.get('via') === 'single')
      track('event_enter', { invitationId: id, props: { via: 'redirect' } });
    if (url.searchParams.has('tools')) setToolsOpen(true);
    if (url.searchParams.has('tools') || url.searchParams.has('via')) {
      url.searchParams.delete('tools');
      url.searchParams.delete('via');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    track('home_view', {
      invitationId: id,
      props: {
        tools: tools.join(','),
        step: path.current?.key ?? 'none',
        done: path.done,
        total: path.total,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, [id]);
  const rsvp = tools.includes('invite') && (data.item.sent > 0 || data.item.responses > 0);
  const budget = tools.includes('plan') && !!data.planning?.budget && data.planning.budget.total > 0;
  const tasks = tools.includes('plan') && !!data.planning?.planned;
  const widgets = [rsvp, budget, tasks].filter(Boolean).length;
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 pt-5 pb-16 sm:px-6 sm:pt-6">
      <Tour seenOnAccount={tourDone} />
      <Hero data={data} poster={poster} />
      <JourneyCard id={id} path={path} data={data} />
      {widgets ? (
        <section aria-labelledby="home-progress">
          <h2 id="home-progress" className="text-[16px] font-bold">
            {t.eventHome.progressTitle}
          </h2>
          <div
            className={cn(
              'mt-3 grid gap-4',
              widgets > 1 && 'md:grid-cols-2',
              widgets > 2 && 'xl:grid-cols-3',
            )}
          >
            {rsvp ? <RsvpWidget data={data} /> : null}
            {budget ? <BudgetWidget data={data} /> : null}
            {tasks ? <TasksWidget data={data} /> : null}
          </div>
        </section>
      ) : null}
      {missing.length ? <MoreTools missing={missing} onOpen={() => setToolsOpen(true)} /> : null}
      {/* a brand-new event (a draft, nobody on the list yet): the 45-second tour of everything */}
      {data.item.status === 'draft' && !data.item.guests && tools.includes('invite') ? (
        <details className="group max-w-[720px]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-brand-line bg-surface px-4 py-2 text-[14px] font-semibold text-brand-deep hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
            {t.start.video.cta}
          </summary>
          <DemoVideo className="mt-3" />
        </details>
      ) : null}
      <nav className="flex flex-wrap gap-2 lg:hidden" aria-label={t.workspace.nav.more}>
        {data.caps.insights ? (
          <Button variant="secondary" icon={<ChartColumn />} asChild>
            <Link href={`/app/invitations/${id}/insights`}>{t.workspace.nav.items.insights}</Link>
          </Button>
        ) : null}
        <Button variant="secondary" icon={<Settings />} asChild>
          <Link href={`/app/invitations/${id}/settings`}>{t.workspace.nav.items.settings}</Link>
        </Button>
        <Button variant="secondary" icon={<Plus />} onClick={() => setToolsOpen(true)}>
          {t.eventHome.tools.manage}
        </Button>
      </nav>
      <ToolsDialog
        id={id}
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        current={tools}
        offered={offered}
        locked={lockedTools(data)}
        source="home"
      />
    </div>
  );
}

/** The tools this event can have (offered here, or with an upgrade). */
function offeredTools(data: EventHomeData): ToolKey[] {
  const c = data.caps;
  return TOOLS.filter(
    (k) =>
      k === 'invite' ||
      (k === 'plan' && c.planning) ||
      (k === 'seating' && c.seating !== null) ||
      (k === 'day' && (c.eventDay !== null || c.gallery)),
  );
}

/** The tools only a higher package opens. */
function lockedTools(data: EventHomeData): ToolKey[] {
  const c = data.caps;
  return [
    ...(c.seating === 'plan' ? (['seating'] as const) : []),
    ...(c.eventDay === 'plan' && !c.gallery ? (['day'] as const) : []),
  ];
}

function Hero({ data, poster }: { data: EventHomeData; poster: ReactNode }) {
  const { t, locale, date, plural, number } = useUi();
  const H = t.eventHome.hero;
  const { toast } = useToast();
  const { item } = data;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const live = item.status === 'published';
  const copy = () =>
    navigator.clipboard.writeText(data.url).then(
      () => toast({ title: H.copied, variant: 'success' }),
      () => toast({ title: t.share.copyFailed, variant: 'danger' }),
    );
  const when =
    data.daysLeft > 0
      ? plural(H.daysLeft, data.daysLeft, { n: number(data.daysLeft) })
      : data.daysLeft === 0
        ? H.today
        : plural(H.past, -data.daysLeft, { n: number(-data.daysLeft) });

  return (
    <section
      className="home-hero relative overflow-hidden rounded-[24px] border border-brand-line p-4 sm:p-6"
      aria-label={H.label}
      data-testid="home-hero"
    >
      <div aria-hidden className="home-hero-glow pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-4 sm:gap-6">
        {poster}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-brand-deep">
            {t.eventTypes[item.eventType]}
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[12.5px] font-bold',
                data.daysLeft >= 0 && data.daysLeft <= 7
                  ? 'bg-brand-deep text-white dark:text-[#1c1917]'
                  : 'bg-surface/85 text-brand-deep',
              )}
              data-testid="home-countdown"
            >
              {when}
            </span>
          </p>
          <h1
            className="mt-1 truncate text-[24px] leading-tight font-extrabold tracking-tight sm:text-[32px]"
            lang={loc}
          >
            <bdi>{name}</bdi>
          </h1>
          <p className="mt-1 text-[14px] text-ink/70" suppressHydrationWarning>
            {date(item.date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          {data.caps.tools.includes('invite') ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {live ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-3 py-1 text-[12.5px] font-semibold text-success">
                    <Check aria-hidden className="size-3.5" strokeWidth={3} />
                    {H.live}
                  </span>
                  <Button variant="secondary" size="sm" icon={<Copy />} onClick={() => void copy()}>
                    {H.copy}
                  </Button>
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
                    <a href={`/i/${item.slug}`} target="_blank" rel="noreferrer">
                      {t.workspace.openInvitation}
                    </a>
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center rounded-full bg-surface/85 px-3 py-1 text-[12.5px] font-semibold text-muted">
                  {H.notLive}
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="self-start">
          <HelpFor area="overview" />
        </div>
      </div>
    </section>
  );
}

/** The guide's article for each step (the help panel opens on it). */
const STEP_ARTICLE: Record<StepKey, string> = {
  invitation: 'publish-and-share',
  guests: 'import-guests',
  send: 'whatsapp-sending',
  rsvp: 'rsvp-and-notifications',
  plan: 'tasks',
  seating: 'seating',
  day: 'event-day',
};

function useStepText() {
  const { t, plural, number } = useUi();
  const S = t.eventHome.journey.steps;
  return (s: JourneyStep) => {
    const words = (
      S[s.key] as Record<
        string,
        { title: string | { one: string; other: string }; body: string; cta: string }
      >
    )[s.variant]!;
    const title =
      typeof words.title === 'string' ? words.title : plural(words.title, s.n ?? 0, { n: number(s.n ?? 0) });
    return { title, body: words.body, cta: words.cta };
  };
}

/** "Your path": the steps, the current one open with its one button. */
function JourneyCard({ id, path, data }: { id: string; path: Journey; data: EventHomeData }) {
  const { t, fmt, number } = useUi();
  const J = t.eventHome.journey;
  const pct = path.total ? Math.round((path.done / path.total) * 100) : 0;
  return (
    <section
      aria-labelledby="home-journey-title"
      data-testid="home-journey"
      className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="home-journey-title" className="text-[19px] font-extrabold sm:text-[21px]">
          {J.title}
        </h2>
        <p className="text-[13.5px] font-semibold text-muted" data-testid="home-journey-progress">
          {fmt(J.progress, { done: number(path.done), total: number(path.total) })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={path.total}
        aria-valuenow={path.done}
        aria-label={J.label}
        className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"
      >
        <span
          className="block h-full rounded-full bg-linear-to-l from-brand to-brand-deep transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      {path.current ? null : <AllDone id={id} past={data.daysLeft < 0} />}
      <ol className="mt-4 flex flex-col gap-2" aria-label={J.label}>
        {path.steps.map((s, i) => (
          <li key={s.key}>
            {s.state === 'current' ? (
              <CurrentStep id={id} step={s} n={i + 1} />
            ) : (
              <StepRow id={id} step={s} n={i + 1} />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function AllDone({ id, past }: { id: string; past: boolean }) {
  const { t } = useUi();
  const J = t.eventHome.journey;
  const words: { title: string; body: string; cta?: string } = past ? J.past : J.allDone;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-success-bg p-4" data-testid="home-all-done">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white dark:text-success-bg"
      >
        <Check className="size-5" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-bold">{words.title}</p>
        <p className="mt-0.5 text-[13.5px] text-muted">{words.body}</p>
        {words.cta ? (
          <Link
            href={`/app/invitations/${id}/responses`}
            className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-deep hover:underline"
          >
            {words.cta}
            <ArrowRight aria-hidden className="icon-dir size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** The step to do now: big, in the brand's color, with one button (and, sometimes, a second way). */
function CurrentStep({ id, step, n }: { id: string; step: JourneyStep; n: number }) {
  const { t, number } = useUi();
  const J = t.eventHome.journey;
  const text = useStepText()(step);
  const Icon = TOOL_ICONS[step.tool];
  const take = () => {
    track('step_click', {
      invitationId: id,
      props: { step: step.key, variant: step.variant, source: 'home' },
    });
    if (step.key === 'invitation' && step.variant !== 'done') track('publish_open', { invitationId: id });
  };
  return (
    <div
      data-testid="home-next"
      data-step={step.key}
      data-action={`${step.key}:${step.variant}`}
      aria-current="step"
      className={cn(
        'relative overflow-hidden rounded-[20px] p-4 text-white shadow-[0_24px_48px_-28px_rgba(60,35,15,0.9)] sm:p-6',
        step.key === 'send' || (step.key === 'rsvp' && step.variant === 'remind')
          ? 'bg-linear-to-br from-[#0f7d41] to-[#0b5c30]'
          : step.key === 'day'
            ? 'bg-linear-to-br from-[#b4572f] via-brand-deep to-[#5b3a1f]'
            : 'bg-linear-to-br from-brand to-brand-deep',
      )}
    >
      <span aria-hidden className="home-next-shine pointer-events-none absolute inset-0" />
      <div className="relative flex flex-wrap items-center gap-4 sm:gap-5">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-white/15 ring-1 ring-white/25 sm:size-14 [&_svg]:size-6 sm:[&_svg]:size-7"
        >
          <Icon strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="text-[12.5px] font-bold tracking-wide text-white/80">
            {number(n)} · {J.now}
          </p>
          <h3 className="mt-0.5 text-[20px] leading-snug font-extrabold sm:text-[24px]">{text.title}</h3>
          <p className="mt-1 text-[14.5px] text-white/90">{text.body}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 max-sm:w-full">
          <Link
            href={step.href}
            onClick={take}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-white px-5 text-[15.5px] font-bold text-[#1c1917] shadow-lg transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            {text.cta}
            <ArrowRight aria-hidden className="icon-dir size-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              track('help_open', { invitationId: id, props: { step: step.key } });
              openHelp({ article: STEP_ARTICLE[step.key] });
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-1.5 text-[13px] font-semibold text-white/90 hover:bg-white/10"
          >
            <CircleHelp aria-hidden className="size-4" />
            {J.howTo}
          </button>
        </div>
      </div>
      {step.alt ? (
        <Link
          href={step.alt.href}
          onClick={() =>
            track('step_click', {
              invitationId: id,
              props: { step: step.key, variant: step.alt!.key, source: 'home' },
            })
          }
          className="relative mt-3 inline-flex text-[13.5px] font-semibold text-white underline decoration-white/50 underline-offset-4 hover:decoration-white"
        >
          {J.alt[step.alt.key]}
        </Link>
      ) : null}
    </div>
  );
}

/** A step that isn't the current one: done (✓), to do, or waiting for something before it. */
function StepRow({ id, step, n }: { id: string; step: JourneyStep; n: number }) {
  const { t, number } = useUi();
  const J = t.eventHome.journey;
  const text = useStepText()(step);
  const done = step.state === 'done';
  const waiting = step.state === 'waiting';
  return (
    <Link
      href={step.href}
      data-step={step.key}
      data-state={step.state}
      onClick={() =>
        track('step_click', {
          invitationId: id,
          props: { step: step.key, variant: step.variant, source: 'home' },
        })
      }
      className={cn(
        'group flex items-center gap-3 rounded-[16px] border px-3 py-3 transition-colors sm:px-4',
        done
          ? 'border-transparent bg-success-bg/50 hover:bg-success-bg'
          : 'border-line bg-surface hover:bg-subtle',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-bold',
          done
            ? 'bg-success text-white dark:text-success-bg'
            : waiting
              ? 'bg-subtle text-faint'
              : 'bg-brand-soft text-brand-deep',
        )}
      >
        {done ? <Check className="size-4.5" strokeWidth={3} /> : number(n)}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-bold', waiting && 'text-ink/70')}>{text.title}</span>
        {done ? null : <span className="mt-0.5 block text-[13px] text-muted">{text.body}</span>}
      </span>
      {done ? (
        <span className="shrink-0 text-[12.5px] font-semibold text-success">{J.done}</span>
      ) : waiting ? (
        <span className="shrink-0 rounded-full bg-subtle px-2.5 py-0.5 text-[12px] font-semibold text-muted">
          {J.later}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-deep max-sm:hidden">
          {text.cta}
          <ArrowRight aria-hidden className="icon-dir size-3.5" />
        </span>
      )}
    </Link>
  );
}

/** The tools the host didn't ask for: a tap away, never in the way. */
function MoreTools({ missing, onOpen }: { missing: ToolKey[]; onOpen: () => void }) {
  const { t } = useUi();
  const T = t.eventHome.tools;
  return (
    <section
      aria-labelledby="home-more-tools"
      className="rounded-[20px] border border-dashed border-line-strong p-4 sm:p-5"
      data-testid="home-more-tools"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="home-more-tools" className="text-[15.5px] font-bold">
            {T.add}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{T.addBody}</p>
        </div>
        <Button variant="secondary" icon={<Plus />} onClick={onOpen} data-testid="home-add-tools">
          {T.manage}
        </Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {missing.map((k) => {
          const Icon = TOOL_ICONS[k];
          return (
            <li key={k}>
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink/80 hover:border-brand hover:text-brand-deep"
              >
                <Icon aria-hidden className="size-4" strokeWidth={1.8} />
                {T.items[k].title}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Widget({
  title,
  icon,
  href,
  cta,
  children,
  testId,
}: {
  title: string;
  icon: ReactNode;
  href: string;
  cta: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid={testId}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <span aria-hidden className="text-brand-deep [&_svg]:size-[18px]">
          {icon}
        </span>
        {title}
      </h2>
      <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
      <Link
        href={href}
        className="self-start rounded-btn text-[13px] font-semibold text-brand-deep hover:underline"
      >
        {cta}
      </Link>
    </Card>
  );
}

function BudgetWidget({ data }: { data: EventHomeData }) {
  const { t } = useUi();
  const W = t.eventHome.widgets.budget;
  const base = `/app/invitations/${data.item.id}`;
  const b = data.planning?.budget;
  return (
    <Widget
      title={W.title}
      icon={<Wallet />}
      href={b ? `${base}/plan/budget` : data.planning?.planned ? `${base}/plan/budget` : `${base}/plan`}
      cta={b ? W.open : W.set}
      testId="home-budget"
    >
      {b && b.total > 0 ? (
        <BudgetGauge size="md" total={b.total} committed={b.committed} paid={b.paid} planned={b.planned} />
      ) : (
        <p className="py-6 text-center text-[13.5px] text-muted">{W.none}</p>
      )}
    </Widget>
  );
}

/** The replies as a ring: coming, not coming, not answered — numbers and a legend beside the color. */
function RsvpWidget({ data }: { data: EventHomeData }) {
  const { t, plural, number, fmt } = useUi();
  const W = t.eventHome.widgets.rsvp;
  const r = data.rsvp;
  const parts = [
    { key: 'coming', label: W.coming, n: r.coming, color: 'var(--color-success)' },
    { key: 'declined', label: W.declined, n: r.declined, color: 'var(--color-faint)' },
    { key: 'waiting', label: W.waiting, n: r.notAnswered, color: 'var(--color-brand-line)' },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  const size = 132;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const gap = total > 1 ? 3 : 0;
  let offset = 0;
  return (
    <Widget
      title={W.title}
      icon={<Users />}
      href={`/app/invitations/${data.item.id}/responses`}
      cta={W.open}
      testId="home-rsvp"
    >
      {total === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-muted">{W.empty}</p>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-center gap-5">
          <div className="relative" style={{ width: size, height: size }}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              role="img"
              aria-label={fmt(W.aria, {
                coming: number(r.coming),
                declined: number(r.declined),
                waiting: number(r.notAnswered),
              })}
              className="-rotate-90"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-subtle)"
                strokeWidth={stroke}
              />
              {parts.map((p) => {
                if (!p.n) return null;
                const len = (p.n / total) * circ;
                const seg = (
                  <circle
                    key={p.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${Math.max(0, len - gap)} ${circ}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return seg;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
              <span className="text-[30px] leading-none font-extrabold">
                <CountUp value={r.coming} format={number} />
              </span>
              <span className="mt-1 text-[11.5px] font-semibold text-muted">{W.coming}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-[13px]">
            {parts.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="text-muted">{p.label}</span>
                <span className="font-bold">{number(p.n)}</span>
              </li>
            ))}
            {r.comingPeople ? (
              <li className="text-[12px] text-muted">
                {plural(W.people, r.comingPeople, { n: number(r.comingPeople) })}
              </li>
            ) : null}
            {r.comingFromLink ? (
              <li className="text-[12px] text-muted">
                {plural(W.fromLink, r.comingFromLink, { n: number(r.comingFromLink) })}
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </Widget>
  );
}

/** The plan, by this week: what's due now and what comes next — not the whole plan's open tasks. */
function TasksWidget({ data }: { data: EventHomeData }) {
  const { t, locale, plural, number, fmt } = useUi();
  const W = t.eventHome.widgets.tasks;
  const base = `/app/invitations/${data.item.id}`;
  const p = data.planning;
  if (!p?.planned) return null;
  const { done, total, week, next } = p.tasks;
  const nextTitle = next
    ? (taskTitle(next, { templateKey: p.templateKey }, locale) ??
      (next.systemKey ? systemText(t, next.systemKey, p.confirmed).title : ''))
    : null;
  return (
    <Widget
      title={W.title}
      icon={<ListChecks />}
      href={`${base}/plan/tasks`}
      cta={W.open}
      testId="home-tasks"
    >
      <div className="flex w-full flex-col gap-3">
        <p className="text-[22px] leading-tight font-extrabold">
          {week ? plural(W.week, week, { n: number(week) }) : W.weekNone}
        </p>
        {nextTitle ? (
          <div>
            <p className="text-[12px] font-semibold text-muted">{W.nextUp}</p>
            <p className="mt-1 rounded-[12px] bg-subtle px-3 py-2 text-[13.5px]">
              <bdi>{nextTitle}</bdi>
            </p>
          </div>
        ) : null}
        <p className="text-[12.5px] text-muted">
          {fmt(W.progress, { done: number(done), total: number(total) })}
        </p>
      </div>
    </Widget>
  );
}
