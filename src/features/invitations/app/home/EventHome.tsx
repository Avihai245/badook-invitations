'use client';

import {
  ArrowRight,
  ChartColumn,
  Check,
  Copy,
  ExternalLink,
  ListChecks,
  Settings,
  Share2,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, cn, useToast } from '@/components/app';
import { taskTitle } from '@/features/planning/model/task-text';
import { systemText } from '@/features/planning/model/system-text';
import { BudgetGauge } from '@/features/planning/ui/BudgetGauge';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { EventHomeData } from '../../server/event-home';
import { getTemplate } from '../../templates/registry';
import { TemplatePoster } from '../TemplatePoster';
import { STAGE_ICONS } from '../workspace/EventSpace';
import {
  NAV_PATHS,
  STAGES,
  stageItems,
  stageStatus,
  type StageKey,
  type StageStatus,
} from '../workspace/stages';
import { alsoWorth, getNextAction, type HomeAction } from './next-action';
import { Tour } from './Tour';

/**
 * The event's home (UX report §4.1, stage 2): replaces the overview. A countdown hero with the event's
 * poster; the one next step (lib: next-action); three widgets — the budget's gauge, the RSVPs' ring and
 * the tasks' progress; the road through the four stages; and up to three "also worth doing".
 */
export function EventHome({ data }: { data: EventHomeData }) {
  const { t } = useUi();
  const H = t.eventHome;
  const id = data.item.id;
  const next = getNextAction(id, data.facts);
  const more = alsoWorth(id, data.facts);
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 pt-5 pb-16 sm:px-6 sm:pt-6">
      <Tour />
      <Hero data={data} />
      <NextCard action={next} label={H.next} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={H.road.label}>
        <RsvpWidget data={data} />
        {data.caps.planning ? <BudgetWidget data={data} /> : null}
        {data.caps.planning ? <TasksWidget data={data} /> : null}
      </section>
      <Road data={data} />
      {more.length ? (
        <section aria-labelledby="home-also">
          <h2 id="home-also" className="text-[16px] font-bold">
            {H.also}
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {more.map((a) => (
              <li key={a.key}>
                <SmallAction action={a} />
              </li>
            ))}
          </ul>
        </section>
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
      </nav>
    </div>
  );
}

/** Days, hours and minutes to the event's start — ticking once the browser knows its own now. */
function useCountdown(startsAt: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return null;
  const ms = Math.max(0, startsAt - now);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

function Hero({ data }: { data: EventHomeData }) {
  const { t, locale, date, plural, number } = useUi();
  const H = t.eventHome.hero;
  const { toast } = useToast();
  const { item } = data;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const template = getTemplate(item.templateId)?.manifest;
  const left = useCountdown(data.startsAt);
  const live = item.status === 'published';
  const copy = () =>
    navigator.clipboard.writeText(data.url).then(
      () => toast({ title: H.copied, variant: 'success' }),
      () => toast({ title: t.share.copyFailed, variant: 'danger' }),
    );

  return (
    <section
      className="home-hero relative overflow-hidden rounded-[28px] border border-brand-line p-5 sm:p-8"
      aria-label={H.label}
      data-testid="home-hero"
    >
      <div aria-hidden className="home-hero-glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-wrap items-center gap-6 sm:gap-8">
        {template ? (
          <TemplatePoster
            template={template}
            locale={loc}
            text={{
              eyebrow: null,
              primary: item.hosts.primary[loc] ?? item.hosts.primary[item.defaultLocale] ?? name,
              secondary: item.hosts.secondary?.[loc] ?? item.hosts.secondary?.[item.defaultLocale] ?? null,
              date: date(item.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
            }}
            joiner={item.hosts.joiner?.[loc] || '&'}
            className="w-[96px] shrink-0 rotate-[-3deg] rounded-[16px]! shadow-[0_24px_40px_-20px_rgba(60,35,15,0.75)]! ring-4 ring-white/85 sm:w-[124px] dark:ring-line-strong"
          />
        ) : null}
        <div className="min-w-0 flex-1 basis-[260px]">
          <p className="text-[13.5px] font-semibold text-brand-deep">{t.eventTypes[item.eventType]}</p>
          <h1
            className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight sm:text-[38px]"
            lang={loc}
          >
            <bdi>{name}</bdi>
          </h1>
          <p className="mt-1.5 text-[14px] text-ink/70" suppressHydrationWarning>
            {date(item.date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {live ? (
              <>
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
              <span className="inline-flex items-center rounded-full bg-surface/80 px-3 py-1 text-[12.5px] font-semibold text-muted">
                {H.notLive}
              </span>
            )}
          </div>
        </div>
        {/* the countdown: days big, then hours and minutes */}
        <div className="flex shrink-0 items-end gap-3 max-sm:w-full max-sm:justify-center" aria-live="off">
          {data.daysLeft > 0 ? (
            left ? (
              <>
                <CountBlock value={number(left.days)} label={plural(H.days, left.days)} big />
                <CountBlock value={number(left.hours)} label={plural(H.hours, left.hours)} />
                <CountBlock value={number(left.minutes)} label={H.minutes} />
              </>
            ) : (
              <CountBlock value={number(data.daysLeft)} label={plural(H.days, data.daysLeft)} big />
            )
          ) : data.daysLeft === 0 ? (
            <p className="text-[28px] font-extrabold text-brand-deep sm:text-[34px]">{H.today}</p>
          ) : (
            <p className="text-[16px] font-bold text-muted">
              {plural(H.past, -data.daysLeft, { n: number(-data.daysLeft) })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function CountBlock({ value, label, big = false }: { value: string; label: string; big?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-[18px] bg-surface/85 shadow-[0_10px_30px_-18px_rgba(60,35,15,0.6)] backdrop-blur',
        big ? 'min-w-[104px] px-4 py-3' : 'min-w-[68px] px-3 py-2.5',
      )}
    >
      <span className={cn('leading-none font-extrabold tracking-tight', big ? 'text-[48px]' : 'text-[26px]')}>
        {value}
      </span>
      <span className="mt-1 text-[12px] font-semibold text-muted">{label}</span>
    </div>
  );
}

function useActionText() {
  const { t, plural, number } = useUi();
  const A = t.eventHome.actions;
  return (a: HomeAction) => {
    const words = A[a.key];
    const title =
      typeof words.title === 'string' ? words.title : plural(words.title, a.n ?? 0, { n: number(a.n ?? 0) });
    return { title, body: words.body, cta: words.cta };
  };
}

const ACTION_ICON: Record<HomeAction['key'], ReactNode> = {
  budget: <Wallet />,
  planSetup: <ListChecks />,
  publish: <Share2 />,
  publishChanges: <Share2 />,
  guests: <Users />,
  send: <Share2 />,
  matchReplies: <Users />,
  remind: <Users />,
  seating: <Sparkles />,
  gallery: <Sparkles />,
  eventDay: <Sparkles />,
  film: <Sparkles />,
  insights: <ChartColumn />,
  tasks: <ListChecks />,
  allSet: <Check />,
};

/** The one next step: a big card with its single action. */
function NextCard({ action, label }: { action: HomeAction; label: string }) {
  const text = useActionText()(action);
  return (
    <section
      aria-labelledby="home-next"
      data-testid="home-next"
      data-action={action.key}
      className={cn(
        'relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_24px_48px_-28px_rgba(60,35,15,0.9)] sm:p-7',
        action.tone === 'whatsapp'
          ? 'bg-linear-to-br from-[#0f7d41] to-[#0b5c30]'
          : action.tone === 'celebrate'
            ? 'bg-linear-to-br from-[#b4572f] via-brand-deep to-[#5b3a1f]'
            : action.tone === 'calm'
              ? 'bg-linear-to-br from-[#3a3330] to-[#1c1917]'
              : 'bg-linear-to-br from-brand to-brand-deep',
      )}
    >
      <span aria-hidden className="home-next-shine pointer-events-none absolute inset-0" />
      <div className="relative flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-white/15 ring-1 ring-white/25 [&_svg]:size-7"
        >
          {ACTION_ICON[action.key]}
        </span>
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="text-[12.5px] font-bold tracking-wide text-white/75 uppercase">{label}</p>
          <h2 id="home-next" className="mt-1 text-[22px] leading-snug font-extrabold sm:text-[26px]">
            {text.title}
          </h2>
          <p className="mt-1 text-[14.5px] text-white/85">{text.body}</p>
        </div>
        <Link
          href={action.href}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[14px] bg-white px-5 text-[15px] font-bold text-ink shadow-lg transition-transform hover:-translate-y-0.5 motion-reduce:transition-none max-sm:w-full max-sm:justify-center"
        >
          {text.cta}
          <ArrowRight aria-hidden className="icon-dir size-4" />
        </Link>
      </div>
    </section>
  );
}

function SmallAction({ action }: { action: HomeAction }) {
  const text = useActionText()(action);
  return (
    <Link
      href={action.href}
      data-also={action.key}
      className="group flex h-full items-start gap-3 rounded-[18px] border border-line bg-surface p-4 shadow-xs transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-soft text-brand-deep [&_svg]:size-5"
      >
        {ACTION_ICON[action.key]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold">{text.title}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted">{text.body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-deep">
          {text.cta}
          <ArrowRight aria-hidden className="icon-dir size-3.5" />
        </span>
      </span>
    </Link>
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
              <span className="text-[30px] leading-none font-extrabold">{number(r.coming)}</span>
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

function TasksWidget({ data }: { data: EventHomeData }) {
  const { t, locale, plural, number, fmt } = useUi();
  const W = t.eventHome.widgets.tasks;
  const base = `/app/invitations/${data.item.id}`;
  const p = data.planning;
  if (!p?.planned)
    return (
      <Widget title={W.title} icon={<ListChecks />} href={`${base}/plan`} cta={W.setup} testId="home-tasks">
        <p className="py-6 text-center text-[13.5px] text-muted">{W.none}</p>
      </Widget>
    );
  const { done, total, week, next } = p.tasks;
  const pct = total ? Math.round((done / total) * 100) : 0;
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
        <div>
          <p className="text-[34px] leading-none font-extrabold">{number(pct)}%</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            {fmt(W.progress, { done: number(done), total: number(total) })}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={W.title}
          className="h-2.5 overflow-hidden rounded-full bg-subtle"
        >
          <span
            className="block h-full rounded-full bg-linear-to-l from-brand to-brand-deep transition-[width] duration-700 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        {week ? (
          <p className="text-[13px] font-semibold text-brand-deep">
            {plural(W.week, week, { n: number(week) })}
          </p>
        ) : null}
        {nextTitle ? (
          <p className="rounded-[12px] bg-subtle px-3 py-2 text-[13px]">
            <bdi>{nextTitle}</bdi>
          </p>
        ) : null}
      </div>
    </Widget>
  );
}

function useStatusText() {
  const { t, plural, number } = useUi();
  const S = t.workspace.nav.status;
  return (s: StageStatus): string | null =>
    s.kind === 'done'
      ? S.done
      : s.kind === 'open'
        ? plural(S.open, s.n, { n: number(s.n) })
        : s.kind === 'notStarted'
          ? S.notStarted
          : s.kind === 'draft'
            ? S.draft
            : s.kind === 'toSend'
              ? plural(S.toSend, s.n, { n: number(s.n) })
              : s.kind === 'startsIn'
                ? plural(S.startsIn, s.n, { n: number(s.n) })
                : s.kind === 'today'
                  ? S.today
                  : null;
}

/** The four stages as a road: each with its status, a tap away. */
function Road({ data }: { data: EventHomeData }) {
  const { t, number } = useUi();
  const N = t.workspace.nav;
  const statusText = useStatusText();
  const facts = {
    status: data.item.status,
    guests: data.item.guests,
    sent: data.item.sent,
    daysLeft: data.daysLeft,
    plan: data.planning?.planned
      ? { open: Math.max(0, data.planning.tasks.total - data.planning.tasks.done) }
      : null,
    seating: data.facts.seating,
  };
  const stages = STAGES.filter((s) => stageItems(s, data.caps).length);
  const firstOpen = stages.find((s) => stageStatus(s, facts).kind !== 'done');
  return (
    <section aria-labelledby="home-road" data-testid="home-road">
      <h2 id="home-road" className="text-[16px] font-bold">
        {t.eventHome.road.title}
      </h2>
      <ol className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stages.map((s: StageKey, i) => {
          const status = stageStatus(s, facts);
          const done = status.kind === 'done';
          const current = s === firstOpen;
          const Icon = STAGE_ICONS[s];
          const first = stageItems(s, data.caps)[0]!;
          return (
            <li key={s} className="relative">
              <Link
                href={`/app/invitations/${data.item.id}${NAV_PATHS[first]}`}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex h-full items-start gap-3 rounded-[18px] border p-4 transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  current ? 'border-brand bg-brand-soft/60 shadow-sm' : 'border-line bg-surface',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold',
                    done
                      ? 'bg-success text-white dark:text-success-bg'
                      : current
                        ? 'bg-brand text-white'
                        : 'bg-subtle text-muted',
                  )}
                >
                  {done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-muted">{number(i + 1)}</span>
                  <span className="block text-[15px] font-bold">{N.stages[s]}</span>
                  <span className="block text-[12.5px] text-muted">{N.stageHint[s]}</span>
                  <span
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
                      done
                        ? 'bg-success-bg text-success'
                        : current
                          ? 'bg-brand text-white'
                          : 'bg-subtle text-muted',
                    )}
                  >
                    {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
                    {statusText(status)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
