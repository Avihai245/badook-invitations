'use client';

import {
  CalendarPlus,
  ChartColumn,
  Clock,
  Crown,
  Eye,
  Globe,
  Images,
  Link2,
  MailOpen,
  MousePointerClick,
  Navigation,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  AreaHelp,
  Bars,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Hint,
  KpiCard,
  PageHeader,
  Segmented,
  useToast,
} from '@/components/app';
import type { PlanId } from '@/features/billing/plans';
import type { Package } from '@/features/flags/features';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { INSIGHTS } from '../config';
import type { Breakdown } from '../model';
import type { InsightsView } from '../server/api';
import { DailyColumns } from './DailyColumns';

/** The chart colors, validated for this white surface (the dataviz method's slots 1 and 2). */
const VISITS = { color: '#2a78d6', hover: '#1c5cab' };
const REPLIES = { color: '#eb6834', hover: '#c24d1f' };
/** The funnel's ordered steps: one hue, light → dark (validated as an ordinal ramp). */
const FUNNEL_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'] as const;

export interface InsightsPageData {
  id: string;
  /** null while the event doesn't have the feature (off says why) */
  view: InsightsView | null;
  off: { why: 'switched_off' | 'plan'; package: Package; plan: PlanId } | null;
}

type Help = ReturnType<typeof useUi>['t']['insights']['help']['items'];
const HELP_ICONS: Record<keyof Help, LucideIcon> = {
  range: Clock,
  visits: Eye,
  funnel: ChartColumn,
  median: Clock,
  sources: Link2,
  personal: Users,
  privacy: ShieldCheck,
};

/**
 * The invitation's "Insights" tab (feature analytics): how guests use the invitation — visits, the
 * funnel from opening to replying, the median time on the page, by language, source and device, per
 * day, what guests did, the personal links and the live gallery's uploads. Mobile first; one range
 * filter above everything it scopes; charts with a table of the same numbers.
 */
export function InsightsScreen({ initial }: { initial: InsightsPageData }) {
  const { t, fmt, number, plural, date, locale } = useUi();
  const I = t.insights;
  const { toast } = useToast();
  const router = useRouter();
  const id = initial.id;
  const [view, setView] = useState<InsightsView | null>(initial.view);
  const [range, setRange] = useState<number>(initial.view?.range ?? 30);
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState(false);
  const [busy, setBusy] = useState(false);

  const percent = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
        style: 'percent',
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const pct = (v: number) => percent.format(v);

  const load = useCallback(
    async (r: number) => {
      setLoading(true);
      const res = await hostApi<{ view?: InsightsView }>(`/api/invitations/${id}/insights?range=${r}`);
      setLoading(false);
      if (res.status === 401) return window.location.assign(loginUrl());
      if (!res.ok || !res.body?.view) return toast({ title: t.common.error, variant: 'danger' });
      setView(res.body.view);
    },
    [id, t.common.error, toast],
  );

  const switchFeature = async (off: boolean) => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${id}/features`, {
      method: 'PATCH',
      body: { feature: 'analytics', off },
    });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: t.common.error, variant: 'danger' });
    toast({ title: off ? I.off.switchedOff : I.off.switchedOn, variant: 'success' });
    router.refresh();
  };

  const help = (
    <AreaHelp
      label={t.common.helpLabel}
      title={I.help.title}
      items={(Object.keys(I.help.items) as (keyof Help)[]).map((key) => {
        const Icon = HELP_ICONS[key];
        return { icon: <Icon />, label: I.help.items[key].label, text: I.help.items[key].text };
      })}
    />
  );
  const header = <PageHeader size="section" title={I.title} help={help} description={I.subtitle} />;

  // ── off: switched off by the host (a way back), or not in the plan ──
  if (!view) {
    const off = initial.off;
    return (
      <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" data-testid="insights-off">
        {header}
        {off?.why === 'plan' ? (
          <Card padding="lg" className="mt-6 flex flex-col items-start gap-3 border-brand-line bg-brand-soft">
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-full bg-surface text-brand-deep"
            >
              <Crown className="size-5" />
            </span>
            <p className="max-w-[60ch] text-[14px] text-muted">{I.off.body}</p>
            <Button icon={<Sparkles />} asChild>
              <Link href={`/app/billing?plan=${off.plan}`}>{t.liveGallery.plans[off.plan]}</Link>
            </Button>
          </Card>
        ) : (
          <EmptyState
            className="mt-6 py-14"
            illustration={<InsightsArt />}
            title={I.off.title}
            description={I.off.body}
            action={
              <Hint text={I.hints.switchOn}>
                <Button icon={<ChartColumn />} loading={busy} onClick={() => void switchFeature(false)}>
                  {I.off.cta}
                </Button>
              </Hint>
            }
          />
        )}
      </div>
    );
  }

  const v = view;
  const T = v.totals;
  const dayLabel = (day: string) =>
    date(`${day}T12:00:00Z`, { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const dayLong = (day: string) =>
    date(`${day}T12:00:00Z`, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const duration = (sec: number) => {
    if (sec < 60) return fmt(I.duration.seconds, { s: number(sec) });
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s
      ? fmt(I.duration.minutesSeconds, { m: number(m), s: number(s) })
      : fmt(I.duration.minutes, { m: number(m) });
  };
  const rangeFilter = (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Hint text={I.hints.range}>
        <span>
          <Segmented
            label={I.range.label}
            value={String(range)}
            onValueChange={(value) => {
              const r = Number(value);
              setRange(r);
              void load(r);
            }}
            options={INSIGHTS.ranges.map((r) => ({
              value: String(r),
              label: I.range[String(r) as '7' | '30' | '0'],
            }))}
          />
        </span>
      </Hint>
      <span className="text-[12.5px] text-muted">
        {dayLong(v.from)} – {dayLong(v.to)}
      </span>
    </div>
  );

  // ── not published yet ──
  if (v.status === 'draft') {
    return (
      <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" data-testid="insights-screen">
        {header}
        <EmptyState
          className="mt-6 py-14"
          illustration={<InsightsArt />}
          title={I.empty.draftTitle}
          description={I.empty.draftBody}
          action={
            <Hint text={I.hints.publish}>
              <Button asChild>
                <Link href={`/app/invitations/${id}/edit?publish=1`}>{I.empty.draftCta}</Link>
              </Button>
            </Hint>
          }
        />
        <p className="mx-auto mt-4 max-w-[70ch] text-center text-[12.5px] text-muted">{I.privacy}</p>
      </div>
    );
  }

  const label = (entry: Record<string, string>, key: string) => entry[key] ?? key.toUpperCase();
  const breakdownRows = (rows: Breakdown[], names: Record<string, string>) =>
    rows.map((r) => ({
      key: r.key,
      label: (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate">{label(names, r.key)}</span>
          {r.sent ? (
            <span className="truncate text-[11.5px] text-muted">
              {plural(I.breakdown.replies, r.sent, { n: number(r.sent) })}
            </span>
          ) : null}
        </span>
      ),
      value: r.visits,
    }));

  const empty = T.visits === 0;
  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" data-testid="insights-screen">
      {header}
      {rangeFilter}

      <div
        className={
          loading ? 'opacity-60 transition-opacity motion-reduce:transition-none' : 'transition-opacity'
        }
        aria-busy={loading || undefined}
      >
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label={I.kpi.label}>
          <KpiCard label={I.kpi.visits} value={number(T.visits)} sub={I.kpi.visitsSub} icon={<Eye />} />
          <KpiCard
            label={I.kpi.opened}
            value={number(T.opened)}
            sub={T.visits ? fmt(I.kpi.ofVisits, { p: pct(T.opened / T.visits) }) : undefined}
            icon={<MailOpen />}
          />
          <KpiCard
            label={I.kpi.replied}
            value={number(T.rsvpSent)}
            sub={T.visits ? fmt(I.kpi.ofVisits, { p: pct(T.rsvpSent / T.visits) }) : undefined}
            icon={<Users />}
          />
          <KpiCard
            label={I.kpi.median}
            value={v.medianSeconds === null ? I.kpi.none : duration(v.medianSeconds)}
            sub={v.medianSeconds === null ? undefined : I.kpi.medianSub}
            icon={<Clock />}
          />
        </div>

        {empty ? (
          <EmptyState
            className="mt-6 rounded-card border border-dashed border-line-strong py-12"
            illustration={<InsightsArt />}
            title={I.empty.noneTitle}
            description={I.empty.noneBody}
          />
        ) : (
          <>
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
              <Card padding="lg" data-testid="insights-funnel">
                <CardTitle as="h2" className="mb-1">
                  {I.funnel.title}
                </CardTitle>
                <p className="mb-4 text-[12.5px] text-muted">{I.funnel.caption}</p>
                <ol className="flex flex-col gap-3.5">
                  {v.funnel.map((step, i) => (
                    <li key={step.key} data-step={step.key}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
                        <span className="font-semibold">{I.funnel.steps[step.key]}</span>
                        <span className="tabular-nums">
                          <strong className="font-semibold">{number(step.count)}</strong>{' '}
                          <span className="text-muted">
                            · {pct(step.ofVisits)}
                            {i > 0 ? ` ${fmt(I.funnel.ofPrevious, { p: pct(step.ofPrevious) })}` : ''}
                          </span>
                        </span>
                      </div>
                      <span aria-hidden className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-subtle">
                        <span
                          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                          style={{
                            width: `${Math.max(step.count ? 2 : 0, step.ofVisits * 100)}%`,
                            background: FUNNEL_RAMP[i],
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card padding="lg" data-testid="insights-daily">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <CardTitle as="h2">{I.daily.title}</CardTitle>
                  <Hint text={I.hints.table}>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={table ? <ChartColumn /> : <Table2 />}
                      onClick={() => setTable((x) => !x)}
                      aria-pressed={table}
                    >
                      {table ? I.daily.showChart : I.daily.showTable}
                    </Button>
                  </Hint>
                </div>
                <p className="mb-3 text-[12.5px] text-muted">{I.daily.caption}</p>
                {table ? (
                  <div className="max-h-[360px] overflow-auto rounded-input border border-line">
                    <table className="w-full text-[13px]">
                      <caption className="sr-only">{I.daily.table}</caption>
                      <thead className="sticky top-0 bg-subtle text-start">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-start font-semibold">
                            {I.daily.day}
                          </th>
                          <th scope="col" className="px-3 py-2 text-end font-semibold">
                            {I.daily.visits}
                          </th>
                          <th scope="col" className="px-3 py-2 text-end font-semibold">
                            {I.daily.replies}
                          </th>
                          <th scope="col" className="px-3 py-2 text-end font-semibold">
                            {I.daily.personal}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.series.map((p) => (
                          <tr key={p.day} className="border-t border-line">
                            <td className="px-3 py-1.5">{dayLong(p.day)}</td>
                            <td className="px-3 py-1.5 text-end tabular-nums">{number(p.visits)}</td>
                            <td className="px-3 py-1.5 text-end tabular-nums">{number(p.replies)}</td>
                            <td className="px-3 py-1.5 text-end tabular-nums">{number(p.personal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid gap-5">
                    <section aria-label={I.daily.visits}>
                      <h3 className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-[3px]"
                          style={{ background: VISITS.color }}
                        />
                        {I.daily.visits}
                      </h3>
                      <DailyColumns
                        points={v.series.map((p) => ({ day: p.day, value: p.visits }))}
                        color={VISITS.color}
                        hover={VISITS.hover}
                        title={I.daily.visits}
                        dayLabel={dayLabel}
                        tooltip={(p) => fmt(I.daily.bar, { date: dayLong(p.day), n: number(p.value) })}
                        tableCaption={I.daily.table}
                        tableDay={I.daily.day}
                      />
                    </section>
                    <section aria-label={I.daily.replies}>
                      <h3 className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-[3px]"
                          style={{ background: REPLIES.color }}
                        />
                        {I.daily.replies}
                      </h3>
                      <DailyColumns
                        points={v.series.map((p) => ({ day: p.day, value: p.replies }))}
                        color={REPLIES.color}
                        hover={REPLIES.hover}
                        title={I.daily.replies}
                        dayLabel={dayLabel}
                        tooltip={(p) => fmt(I.daily.bar, { date: dayLong(p.day), n: number(p.value) })}
                        tableCaption={I.daily.table}
                        tableDay={I.daily.day}
                      />
                    </section>
                  </div>
                )}
              </Card>
            </div>

            <div className="mt-5 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Card padding="md" data-testid="insights-sources">
                <Bars
                  title={I.breakdown.source}
                  titleAs="h2"
                  labelWidth={132}
                  rows={breakdownRows(v.bySource, I.breakdown.sources)}
                  formatValue={number}
                />
              </Card>
              <Card padding="md" data-testid="insights-languages">
                <Bars
                  title={I.breakdown.lang}
                  titleAs="h2"
                  labelWidth={132}
                  rows={breakdownRows(v.byLang, I.breakdown.langs)}
                  formatValue={number}
                />
              </Card>
              <Card padding="md" data-testid="insights-devices">
                <Bars
                  title={I.breakdown.device}
                  titleAs="h2"
                  labelWidth={132}
                  rows={breakdownRows(v.byDevice, I.breakdown.devices)}
                  formatValue={number}
                />
              </Card>
            </div>

            <Card padding="lg" className="mt-5" data-testid="insights-actions">
              <CardTitle as="h2" className="mb-3">
                {I.actions.title}
              </CardTitle>
              <ul className="grid gap-2.5 text-[13.5px] sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ['calendar', CalendarPlus, T.calendar],
                    ['map', Navigation, T.map],
                    ['gallery', Images, T.gallery],
                    ['langSwitch', Globe, T.langSwitch],
                  ] as const
                ).map(([key, Icon, n]) => (
                  <li key={key} className="flex items-center gap-2.5 rounded-input bg-subtle px-3 py-2.5">
                    <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">{I.actions[key]}</span>
                    <strong className="font-semibold tabular-nums">{number(n)}</strong>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
                {INSIGHTS.milestones.slice(0, 3).map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <ScrollText aria-hidden className="size-3.5" />
                    {fmt(I.actions.depth, { m })}: {number(T.depth[m])}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        <div className="mt-5 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Card padding="lg" data-testid="insights-personal">
            <CardTitle as="h2" className="mb-1 flex items-center gap-2">
              <Link2 aria-hidden className="size-4 text-muted" />
              {I.personal.title}
            </CardTitle>
            <p className="text-[12.5px] text-muted">{I.personal.body}</p>
            {v.personal.guests ? (
              <>
                <p className="mt-3 text-[20px] font-semibold">
                  {fmt(I.personal.opened, {
                    opened: number(v.personal.opened),
                    guests: number(v.personal.guests),
                  })}
                </p>
                <span aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-subtle">
                  <span
                    className="h-full rounded-full"
                    style={{
                      width: `${(v.personal.opened / v.personal.guests) * 100}%`,
                      background: VISITS.color,
                    }}
                  />
                </span>
                <p className="mt-2 text-[12.5px] text-muted">
                  {fmt(I.personal.opens, { n: number(v.personal.opens) })}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-muted">{I.personal.none}</p>
            )}
            <Hint text={I.hints.personal}>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Users />} asChild>
                <Link href={`/app/invitations/${id}/guests`}>{I.personal.cta}</Link>
              </Button>
            </Hint>
          </Card>

          <Card padding="lg" data-testid="insights-replies">
            <CardTitle as="h2" className="mb-1 flex items-center gap-2">
              <MousePointerClick aria-hidden className="size-4 text-muted" />
              {I.replies.title}
            </CardTitle>
            <p className="mt-2 text-[13.5px]">
              {fmt(I.replies.body, {
                total: number(v.responses.total),
                attending: number(v.responses.attending),
              })}
            </p>
            <Hint text={I.hints.replies}>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Users />} asChild>
                <Link href={`/app/invitations/${id}/responses`}>{I.replies.cta}</Link>
              </Button>
            </Hint>
          </Card>

          <Card padding="lg" data-testid="insights-gallery">
            <CardTitle as="h2" className="mb-1 flex items-center gap-2">
              <Images aria-hidden className="size-4 text-muted" />
              {I.gallery.title}
            </CardTitle>
            {v.gallery ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ['photos', v.gallery.images],
                    ['videos', v.gallery.videos],
                    ['uploaders', v.gallery.uploaders],
                  ] as const
                ).map(([key, n]) => (
                  <div key={key} className="rounded-input bg-subtle px-2 py-2.5">
                    <dt className="text-[11.5px] text-muted">{I.gallery[key]}</dt>
                    <dd className="text-[18px] font-semibold">{number(n)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-muted">{I.gallery.none}</p>
            )}
            <Hint text={I.hints.gallery}>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Images />} asChild>
                <Link href={`/app/invitations/${id}/gallery`}>{I.gallery.cta}</Link>
              </Button>
            </Hint>
          </Card>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="flex max-w-[76ch] items-start gap-2 text-[12.5px] text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{I.privacy}</span>
        </p>
        <Hint text={I.hints.switchOff}>
          <Button size="sm" variant="ghost" loading={busy} onClick={() => void switchFeature(true)}>
            {I.off.switchOff}
          </Button>
        </Hint>
      </div>
    </div>
  );
}

/** A small chart over an envelope (decorative). */
function InsightsArt() {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden>
      <circle cx="60" cy="60" r="44" fill="#F6EDE1" />
      <rect x="32" y="40" width="56" height="42" rx="5" fill="#fff" stroke="#A0703F" strokeWidth="2" />
      <path d="M32 44l28 20 28-20" stroke="#A0703F" strokeWidth="2" strokeLinejoin="round" />
      <rect x="40" y="74" width="6" height="14" rx="2" fill="#86b6ef" />
      <rect x="52" y="66" width="6" height="22" rx="2" fill="#5598e7" />
      <rect x="64" y="58" width="6" height="30" rx="2" fill="#2a78d6" />
      <rect x="76" y="70" width="6" height="18" rx="2" fill="#1c5cab" />
    </svg>
  );
}
