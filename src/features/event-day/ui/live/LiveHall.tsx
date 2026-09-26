'use client';

import {
  AlarmClock,
  ArrowLeftRight,
  BarChart3,
  Combine,
  History,
  LayoutGrid,
  Map as MapIcon,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  Undo2,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaHelp,
  Badge,
  Button,
  Card,
  CardTitle,
  Hint,
  Input,
  KpiCard,
  PageHeader,
  Segmented,
  cn,
  useToast,
} from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { useLiveRefresh } from '@/lib/live/client';
import { EVENT_DAY } from '../../config';
import {
  HEAT,
  arrivalTimeline,
  halfEmptyAlerts,
  knownZone,
  mergeSuggestions,
  released,
  tableFills,
  type TableFill,
} from '../../live';
import type { Party, SeatingChange, Totals } from '../../model';
import type { DayView, NotifyOutcome } from '../../server/host-api';
import { HistoryList } from '../HistoryList';
import { dayApi, type ReseatAnswer } from '../host-api';
import { NoticesDialog } from '../NoticesDialog';
import { useNotifyOutcome } from '../useNotifyOutcome';
import { HeatMap } from './HeatMap';
import { ArriveDialog, MergeDialog, MoveDialog, type ReseatContext } from './ReseatDialogs';
import { StationCard } from './StationCard';
import { PartyRow, TableSheet } from './TableSheet';
import { Timeline } from './Timeline';

type View = 'map' | 'tables' | 'arrivals';
type Sheet = { tableId: string } | { unseated: true };
type Action =
  | { kind: 'arrive'; party: Party }
  | { kind: 'move'; party: Party }
  | { kind: 'merge'; from: TableFill; into: string | null };

type HelpKey = Exclude<keyof ReturnType<typeof useUi>['t']['eventDay']['help'], 'title'>;
const HELP: { key: HelpKey; icon: LucideIcon }[] = [
  { key: 'kpis', icon: Users },
  { key: 'map', icon: MapIcon },
  { key: 'tables', icon: LayoutGrid },
  { key: 'arrivals', icon: BarChart3 },
  { key: 'alerts', icon: TriangleAlert },
  { key: 'suggestions', icon: Sparkles },
  { key: 'move', icon: ArrowLeftRight },
  { key: 'merge', icon: Combine },
  { key: 'history', icon: History },
  { key: 'station', icon: ScanLine },
  { key: 'rotate', icon: RefreshCw },
];

/**
 * The invitation's "Event day" tab (feature `checkin`): who arrived — overall, per table on the hall's
 * map, over time — tables still half empty 45 minutes after the start, merges to suggest, the entrance
 * stations' link, checking a family in from here, moving a family or merging a table (with its
 * history and undo), and telling the moved families their new table. Stays current by itself (a live
 * hint from every station, polling while that is down). Mobile first: the host holds it at the event.
 */
export function LiveHall({ initial, planBase }: { initial: DayView; planBase: string | null }) {
  const ui = useUi();
  const { t, fmt, plural, number, date } = ui;
  const E = t.eventDay;
  const { toast } = useToast();
  const report = useNotifyOutcome();
  const [view, setView] = useState<DayView>(initial);
  const [mode, setMode] = useState<View>(initial.hall.tables.length ? 'map' : 'tables');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [notices, setNotices] = useState<{ only: string[] | null } | null>(null);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(initial.now);
  const id = view.id;
  const zone = knownZone(view.invitation.timezone);
  const time = (at: string | number) => date(at, { hour: '2-digit', minute: '2-digit', timeZone: zone });

  // the clock: the alerts and suggestions start 45 minutes after the start without a reload
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const busy = useRef(false);
  const again = useRef(false);
  const reload = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        const res = await dayApi.view(id);
        if (res.status === 401) return window.location.assign(loginUrl());
        // switched off meanwhile (another window, the plan): the page says so
        if (res.status === 403 || res.status === 404) return window.location.reload();
        if (res.ok && res.body?.view) setView(res.body.view);
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [id]);
  const live = useLiveRefresh(view.realtime, () => void reload(), EVENT_DAY.pollHostMs);

  const isReleased = released(view.startMs, now);
  const fills = useMemo(() => tableFills(view.hall.tables, view.parties, isReleased), [view, isReleased]);
  const alerts = halfEmptyAlerts(fills, view.startMs, now);
  const suggestions = useMemo(() => mergeSuggestions(fills, isReleased), [fills, isReleased]);
  const bars = useMemo(() => arrivalTimeline(view.parties), [view.parties]);
  const recent = useMemo(
    () =>
      view.parties
        .flatMap((p) => p.checkins.map((c) => ({ ...c, party: p })))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [view.parties],
  );
  const unseated = useMemo(
    () =>
      view.parties.filter((p) => !p.table && ((p.status === 'confirmed' && p.seats > 0) || p.arrived > 0)),
    [view.parties],
  );
  const planUrl = view.hall.background && planBase ? `${planBase}/${view.hall.background.path}` : null;
  const guide = view.features.seating_guide.on;
  const ctx: ReseatContext = {
    id,
    fills,
    released: isReleased,
    told: view.told,
    canNotify: guide,
    notifyReady: view.notifyReady,
  };

  // ── what the buttons do ──
  const patch = (party: Party, totals: Totals) =>
    setView((v) => ({
      ...v,
      parties: v.parties.map((p) => (p.unitId === party.unitId ? party : p)),
      totals,
    }));

  const undoArrival = async (checkinId: string) => {
    const res = await dayApi.undoArrival(id, checkinId);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body?.party) return toast({ variant: 'danger', title: E.errors.failed });
    patch(res.body.party, res.body.totals);
    toast({ variant: 'success', title: E.recent.undone });
  };

  const arrive = async (party: Party, count: number) => {
    const res = await dayApi.arrive(id, party.unitId, count);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return false;
    }
    const body = res.body;
    if (!res.ok || !body?.party) {
      toast({ variant: 'danger', title: res.status === 0 ? E.errors.offline : E.errors.failed });
      return false;
    }
    patch(body.party, body.totals);
    toast({
      variant: 'success',
      title: fmt(E.arrive.done, { name: party.name }),
      action: {
        label: E.recent.undo,
        altText: E.recent.undoHint,
        onClick: () => void undoArrival(body.checkinId),
      },
    });
    return true;
  };

  const afterChange = (change: SeatingChange, notified: NotifyOutcome | null) => {
    const manual = report(notified, change);
    if (manual) setNotices({ only: manual });
    void reload();
  };

  const undoQuick = async (change: SeatingChange, notify: boolean) => {
    const res = await dayApi.undoChange(id, change.id, { notify });
    if (res.status === 401) return window.location.assign(loginUrl());
    const body = res.body;
    if (!res.ok || !body?.change) {
      const code = body?.code;
      const h = E.history.errors;
      return toast({
        variant: 'danger',
        title:
          code === 'full'
            ? fmt(h.full, { table: body?.table ?? '' })
            : code === 'stale' || code === 'number_taken' || code === 'already'
              ? h[code]
              : h.failed,
      });
    }
    toast({ variant: 'success', title: E.history.undid });
    afterChange(body.change, body.notified ?? null);
  };

  const reseated = (answer: ReseatAnswer, notify: boolean) => {
    const a = action;
    setAction(null);
    setSheet(null);
    const change = answer.change;
    const first = change.units.find((u) => u.to);
    const title =
      a?.kind === 'merge'
        ? fmt(E.merge.done, { from: a.from.table.number, into: first?.to?.number ?? '' })
        : fmt(E.move.done, {
            name: a?.kind === 'move' ? a.party.name : (first?.name ?? ''),
            number: first?.to?.number ?? '',
          });
    toast({
      variant: 'success',
      title,
      action: {
        label: E.history.undo,
        altText: E.history.undoHint,
        onClick: () => void undoQuick(change, notify),
      },
    });
    afterChange(change, answer.notified);
  };

  const rotate = async () => {
    const res = await dayApi.rotate(id);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return false;
    }
    if (!res.ok || !res.body?.view) {
      toast({ variant: 'danger', title: E.errors.failed });
      return false;
    }
    setView(res.body.view);
    return true;
  };

  // ── what the screen shows ──
  const withGuests = fills.filter((f) => f.expected > 0);
  const fullTables = withGuests.filter((f) => f.arrived >= f.expected).length;
  const last = recent[0] ?? null;
  const partiesAt = (tableId: string) => view.parties.filter((p) => p.table?.id === tableId);
  const sheetFill =
    sheet && 'tableId' in sheet ? (fills.find((f) => f.table.id === sheet.tableId) ?? null) : null;
  const q = query.trim().toLowerCase();
  const found = q
    ? view.parties
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.people.some((n) => n.toLowerCase().includes(q)) ||
            (/^\d{2,}$/.test(q) && !!p.phoneTail?.endsWith(q)),
        )
        .slice(0, 30)
    : [];
  const bar = (value: number, of: number, color: string = HEAT.steps[3].fill) => (
    <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-subtle">
      <span
        className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${of > 0 ? Math.min(100, (value / of) * 100) : 0}%`, background: color }}
      />
    </span>
  );

  const helpLabels: Record<HelpKey, string> = {
    kpis: E.kpi.label,
    map: E.views.map,
    tables: E.views.tables,
    arrivals: E.views.arrivals,
    alerts: E.alerts.title,
    suggestions: E.suggestions.title,
    move: E.sheet.move,
    merge: E.sheet.mergeInto,
    history: E.history.title,
    station: E.station.title,
    rotate: E.station.rotate,
  };
  const help = (
    <AreaHelp
      label={t.common.helpLabel}
      title={E.help.title}
      items={HELP.map(({ key, icon: Icon }) => ({
        icon: <Icon />,
        label: helpLabels[key],
        text: E.help[key],
      }))}
    />
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" data-testid="live-hall">
      <PageHeader
        size="section"
        title={E.title}
        help={help}
        description={E.subtitle}
        actions={
          guide ? (
            <Hint text={E.notices.buttonHint}>
              <Button
                variant="secondary"
                icon={<Send className="icon-dir" />}
                onClick={() => setNotices({ only: null })}
                data-testid="live-notices"
              >
                {E.notices.button}
              </Button>
            </Hint>
          ) : null
        }
      />
      <p
        className="mt-3 flex flex-wrap items-center gap-2 text-[13px]"
        data-testid="live-status"
        data-status={live}
      >
        <Badge variant={live === 'live' ? 'live' : 'neutral'}>
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              live === 'live' ? 'bg-success motion-safe:animate-pulse' : 'bg-faint',
            )}
          />
          {live === 'live' ? E.live : E.polling}
        </Badge>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label={E.kpi.label}>
        <KpiCard
          label={E.kpi.arrived}
          icon={<UserCheck />}
          value={<span data-testid="kpi-arrived">{number(view.totals.arrived)}</span>}
          sub={
            <>
              {fmt(E.kpi.of, { n: number(view.totals.expected) })}
              {bar(view.totals.arrived, view.totals.expected)}
            </>
          }
        />
        <KpiCard
          label={E.kpi.families}
          icon={<Users />}
          value={number(view.totals.arrivedParties)}
          sub={
            <>
              {fmt(E.kpi.of, { n: number(view.totals.parties) })}
              {bar(view.totals.arrivedParties, view.totals.parties)}
            </>
          }
        />
        <KpiCard
          label={E.kpi.tablesFull}
          icon={<LayoutGrid />}
          value={number(fullTables)}
          sub={
            <>
              {fmt(E.kpi.of, { n: number(withGuests.length) })}
              {bar(fullTables, withGuests.length)}
            </>
          }
        />
        <KpiCard
          label={E.kpi.last}
          icon={<AlarmClock />}
          value={last ? time(last.at) : E.kpi.none}
          sub={
            last ? (
              <span className="block truncate">
                <bdi>{last.party.name}</bdi>
              </span>
            ) : undefined
          }
        />
      </div>

      {alerts.length ? (
        <section
          className="mt-4 rounded-card border border-[#fcd34d] bg-warning-bg p-4"
          aria-labelledby="live-alerts-title"
          data-testid="live-alerts"
        >
          <h2 id="live-alerts-title" className="flex items-center gap-2 text-[15px] font-bold text-warning">
            <TriangleAlert aria-hidden className="size-4" />
            {E.alerts.title}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {alerts.map((f) => (
              <li key={f.table.id}>
                <button
                  type="button"
                  onClick={() => setSheet({ tableId: f.table.id })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#fcd34d] bg-surface px-3 py-1.5 text-[13px] font-semibold hover:bg-subtle"
                  data-alert-table={f.table.number}
                >
                  {fmt(E.alerts.item, {
                    number: f.table.number,
                    arrived: number(f.arrived),
                    expected: number(f.expected),
                  })}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card padding="lg" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented<View>
              value={mode}
              onValueChange={setMode}
              label={E.views.label}
              options={[
                { value: 'map', label: E.views.map, icon: <MapIcon /> },
                { value: 'tables', label: E.views.tables, icon: <LayoutGrid /> },
                { value: 'arrivals', label: E.views.arrivals, icon: <BarChart3 /> },
              ]}
            />
          </div>
          {mode === 'map' ? (
            <HeatMap
              hall={view.hall}
              planUrl={planUrl}
              fills={fills}
              onTable={(tableId) => setSheet({ tableId })}
            />
          ) : mode === 'tables' ? (
            <div data-testid="live-tables">
              <Input
                type="search"
                icon={<Search />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={E.tables.searchPlaceholder}
                aria-label={E.tables.search}
                data-testid="live-search"
              />
              {q ? (
                found.length ? (
                  <ul className="mt-2">
                    {found.map((p) => (
                      <PartyRow
                        key={p.unitId}
                        party={p}
                        told={view.told[p.unitId]}
                        showTable
                        onArrive={() => setAction({ kind: 'arrive', party: p })}
                        onMove={() => setAction({ kind: 'move', party: p })}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-[13px] text-muted">{E.tables.noResults}</p>
                )
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {fills.map((f) => {
                    const alert = alerts.includes(f);
                    return (
                      <li key={f.table.id}>
                        <button
                          type="button"
                          onClick={() => setSheet({ tableId: f.table.id })}
                          className="w-full rounded-card border border-line bg-surface px-3.5 py-3 text-start transition-colors hover:bg-subtle"
                          data-live-table={f.table.number}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[14.5px] font-bold">
                              {alert ? (
                                <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-warning" />
                              ) : null}
                              <span className="truncate">
                                {fmt(E.tables.row, { number: f.table.number })}
                                {f.table.label ? (
                                  <span className="font-normal text-muted"> · {f.table.label}</span>
                                ) : null}
                              </span>
                            </span>
                            <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                              {f.expected
                                ? fmt(E.tables.arrived, {
                                    arrived: number(f.arrived),
                                    expected: number(f.expected),
                                  })
                                : E.tables.empty}
                            </span>
                          </span>
                          {bar(f.arrived, f.expected, f.over ? HEAT.over.stroke : undefined)}
                          <span className="mt-1.5 flex flex-wrap gap-x-2 text-[12px] text-muted">
                            <span>{plural(E.tables.families, f.parties, { n: number(f.parties) })}</span>
                            {f.over ? (
                              <span className="font-semibold text-danger">{E.tables.over}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {unseated.length ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setSheet({ unseated: true })}
                        className="w-full rounded-card border border-dashed border-line-strong bg-canvas px-3.5 py-3 text-start transition-colors hover:bg-subtle"
                        data-live-table="none"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[14.5px] font-bold">{E.tables.noTable}</span>
                          <span className="text-[12px] text-muted">
                            {plural(E.tables.families, unseated.length, { n: number(unseated.length) })}
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          ) : (
            <div data-testid="live-arrivals">
              <h2 className="text-[15px] font-bold">{E.timeline.title}</h2>
              <Timeline bars={bars} bucketMinutes={EVENT_DAY.timelineBucketMinutes} timeZone={zone} />
            </div>
          )}
        </Card>

        <div className="grid min-w-0 gap-5">
          {view.hall.tables.length ? (
            <Card padding="lg" data-testid="live-suggestions">
              <CardTitle as="h2" className="mb-1 flex items-center gap-2">
                <Sparkles aria-hidden className="size-4 text-brand-deep" />
                {E.suggestions.title}
              </CardTitle>
              {!isReleased ? (
                <p className="text-[13px] text-muted">{E.suggestions.before}</p>
              ) : !suggestions.length ? (
                <p className="text-[13px] text-muted">{E.suggestions.none}</p>
              ) : (
                <ul className="mt-2 flex flex-col">
                  {suggestions.map((s) => (
                    <li
                      key={s.from.table.id}
                      className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                      data-suggestion={`${s.from.table.number}-${s.into.table.number}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold">
                          {fmt(E.suggestions.item, {
                            from: s.from.table.number,
                            fromPeople: number(s.from.load),
                            into: s.into.table.number,
                            intoPeople: number(s.into.load),
                          })}
                        </p>
                        <p className="text-[12px] text-muted">
                          {fmt(E.suggestions.after, {
                            after: number(s.after),
                            capacity: number(s.into.table.capacity),
                          })}
                        </p>
                      </div>
                      <Hint
                        text={fmt(E.suggestions.mergeHint, {
                          from: s.from.table.number,
                          into: s.into.table.number,
                        })}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Combine />}
                          onClick={() => setAction({ kind: 'merge', from: s.from, into: s.into.table.id })}
                        >
                          {E.suggestions.merge}
                        </Button>
                      </Hint>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card padding="lg" data-testid="live-recent">
            <CardTitle as="h2" className="mb-1">
              {E.recent.title}
            </CardTitle>
            {recent.length ? (
              <ul className="flex flex-col">
                {recent.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                    data-recent={c.party.name}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">
                        <bdi>{c.party.name}</bdi>
                        {c.party.table ? (
                          <span className="ms-2 text-[12px] font-normal text-muted">
                            {fmt(E.tables.row, { number: c.party.table.number })}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-muted">
                        {fmt(E.recent.item, {
                          count: plural(t.common.people, c.count, { n: number(c.count) }),
                          time: time(c.at),
                          station: c.station === 'host' ? E.recent.host : c.station,
                        })}
                      </p>
                    </div>
                    <Hint text={E.recent.undoHint}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Undo2 className="icon-dir" />}
                        onClick={() => void undoArrival(c.id)}
                        data-undo-checkin={c.id}
                      >
                        {E.recent.undo}
                      </Button>
                    </Hint>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">{E.recent.empty}</p>
            )}
          </Card>

          <StationCard station={view.station} slug={view.invitation.slug} onRotate={rotate} />

          <Card padding="lg" data-testid="live-history">
            <CardTitle as="h2" className="mb-1">
              {E.history.title}
            </CardTitle>
            <HistoryList
              id={id}
              changes={view.changes}
              told={view.told}
              canNotify={guide}
              notifyReady={view.notifyReady}
              onUndone={afterChange}
              limit={5}
            />
          </Card>
        </div>
      </div>

      {sheet ? (
        <TableSheet
          fill={sheetFill}
          parties={'tableId' in sheet ? partiesAt(sheet.tableId) : unseated}
          told={view.told}
          onClose={() => setSheet(null)}
          onArrive={(party) => setAction({ kind: 'arrive', party })}
          onMove={(party) => setAction({ kind: 'move', party })}
          onMerge={(from) => setAction({ kind: 'merge', from, into: null })}
        />
      ) : null}
      {action?.kind === 'arrive' ? (
        <ArriveDialog
          party={action.party}
          onClose={() => setAction(null)}
          onConfirm={(n) => arrive(action.party, n)}
        />
      ) : action?.kind === 'move' ? (
        <MoveDialog ctx={ctx} party={action.party} onClose={() => setAction(null)} onDone={reseated} />
      ) : action?.kind === 'merge' ? (
        <MergeDialog
          ctx={ctx}
          from={action.from}
          into={action.into}
          parties={partiesAt(action.from.table.id)}
          onClose={() => setAction(null)}
          onDone={reseated}
        />
      ) : null}
      {guide ? (
        <NoticesDialog
          id={id}
          open={!!notices}
          onOpenChange={(o) => !o && setNotices(null)}
          only={notices?.only ?? null}
          onChanged={() => void reload()}
        />
      ) : null}
    </div>
  );
}
