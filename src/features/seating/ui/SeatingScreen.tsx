'use client';

import { CircleAlert, FileSpreadsheet, LoaderCircle, Printer, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Hint, PageHeader, Segmented, cn, useToast } from '@/components/app';
import { hostApi } from '@/features/invitations/app/api';
import { commit, createHistory, redo, undo, type History } from '@/features/invitations/editor/history';
import { useUi } from '@/lib/i18n/client';
import { applySolution, solverInput } from '../auto';
import { calibrate, normalizeRotation, planScale, rescalePlan, type Point } from '../geometry';
import {
  type LandmarkKind,
  type Plan,
  type PlanBackground,
  type SeatingSettings,
  type SeatingState,
  type TableShape,
  type UnitInfo,
} from '../model';
import {
  addLandmark,
  addRule,
  addTable,
  assign,
  canSeat,
  dropStale,
  duplicateTable,
  moveItems,
  occupancy as occupancyOf,
  removeItems,
  removeRule,
  seatingStats,
  setUnitSettings,
  unassign,
  unitsAt,
  unitsById,
  updateLandmark,
  updateTable,
  type TablePatch,
} from '../plan';
import type { SolverProgress, SolverResult } from '../solver';
import { AutoDialog, AutoResult, AutoUpgrade, runSolver } from './auto';
import { CanvasToolbar, SeatingHelp } from './CanvasToolbar';
import { AddGuestsPicker, RulesDialog, SeatPicker, UnitDialog } from './dialogs';
import { GuestsPanel, listedUnits } from './GuestsPanel';
import { LandmarkInspector, TableInspector } from './Inspector';
import { PlanFileError, preparePlanFile, renderStoredPdf, uploadTo } from './plan-file';
import { LineLengthDialog, PlanDialog, type PlanBusy } from './PlanDialog';
import { SeatingCanvas, type CanvasControls } from './SeatingCanvas';
import { useSeatingSave, type SaveStatus } from './useSeatingSave';

export type AutoAccess = 'on' | 'plan' | 'off';

type DialogState =
  | { kind: 'seat'; unitId: string }
  | { kind: 'add'; tableId: string }
  | { kind: 'unit'; unitId: string }
  | { kind: 'rules' }
  | { kind: 'plan' }
  | { kind: 'line'; a: Point; b: Point }
  | { kind: 'auto' }
  | { kind: 'upgrade' }
  | null;

type Drag = { unitId: string; x: number; y: number; over: { tableId: string; ok: boolean } | null };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * The seating screen (/app/invitations/[id]/seating): the map of the hall — floor plan, tables,
 * landmarks — beside the guest list, with undo / redo, autosave, the automatic seating (feature
 * `seating_auto`), print and Excel. On phones the map and the list are two views of one screen, and the
 * whole editor can go full screen.
 */
export function SeatingScreen({
  id,
  initial,
  auto,
  autoPackage,
  planBase,
}: {
  id: string;
  initial: SeatingState;
  auto: AutoAccess;
  /** the package (and its plan) that has the automatic seating, for the upgrade prompt */
  autoPackage: { name: string; plan: string };
  planBase: string;
}) {
  const { t, fmt, plural, number } = useUi();
  const s = t.seating;
  const { toast } = useToast();

  const [units, setUnits] = useState<UnitInfo[]>(initial.units);
  const [venue, setVenue] = useState(initial.venue);
  const byId = useMemo(() => unitsById(units), [units]);
  const [history, setHistory] = useState<History<Plan>>(() =>
    createHistory(dropStale(initial.plan, unitsById(initial.units))),
  );
  const plan = history.present;
  const update = useCallback(
    (fn: (p: Plan) => Plan, key: string | null = null) =>
      setHistory((h) => {
        const next = fn(h.present);
        return next === h.present ? h : commit(h, next, { key });
      }),
    [],
  );

  const onServerPlan = useCallback(
    (next: Plan, merged: boolean) => {
      setHistory(createHistory(next));
      if (merged) toast({ title: s.save.merged });
    },
    [toast, s.save.merged],
  );
  const onUnits = useCallback((state: SeatingState) => {
    setUnits(state.units);
    setVenue(state.venue);
  }, []);
  const save = useSeatingSave({ id, initial, plan, onServerPlan, onUnits });

  const [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tab, setTab] = useState<'map' | 'guests'>('map');
  const [full, setFull] = useState(false);
  const [snap, setSnap] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [showPending, setShowPending] = useState(plan.layout.settings.includePending);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState<PlanBusy>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [converting, setConverting] = useState<'working' | 'failed' | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const cancelRun = useRef<(() => void) | null>(null);
  const controls = useRef<CanvasControls>(null);

  const taken = useMemo(() => occupancyOf(plan, byId), [plan, byId]);
  const stats = useMemo(() => seatingStats(plan, units), [plan, units]);
  const tablesById = useMemo(() => new Map(plan.tables.map((x) => [x.id, x])), [plan.tables]);
  const names = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const numbers = useMemo(() => new Map(plan.tables.map((x) => [x.id, x.number])), [plan.tables]);
  const bg = plan.layout.background;
  const planUrl = bg && bg.type !== 'application/pdf' && planBase ? `${planBase}/${bg.path}` : null;
  const usingVenue = !!bg && !!venue?.plan && plan.layout.source === 'partner';

  // ── undo / redo from the keyboard (not while typing in a field) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        setHistory(undo);
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        setHistory(redo);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // full screen: Esc leaves it; the page behind doesn't scroll
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !dialog && setFull(false);
    window.addEventListener('keydown', onKey);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
    };
  }, [full, dialog]);

  // a venue's PDF plan becomes an image the first time (the server has no PDF renderer)
  const convertingRef = useRef(false);
  useEffect(() => {
    if (!bg || bg.type !== 'application/pdf' || convertingRef.current || !planBase) return;
    convertingRef.current = true;
    setConverting('working');
    void (async () => {
      try {
        const image = await renderStoredPdf(`${planBase}/${bg.path}`);
        const stored = await storePlan(image.blob, image.type);
        const widthM = venue?.widthMeters ?? null;
        setHistory((h) =>
          createHistory({
            ...h.present,
            layout: {
              ...h.present.layout,
              background: { path: stored, type: image.type, width: image.width, height: image.height },
              metersPerPixel: widthM ? widthM / image.width : h.present.layout.metersPerPixel,
            },
          }),
        );
        setConverting(null);
      } catch {
        setConverting('failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per PDF plan
  }, [bg?.path, bg?.type]);

  /** Uploads a plan image; returns its path in storage. */
  const storePlan = async (blob: Blob, type: string, onProgress?: (p: number) => void): Promise<string> => {
    const res = await hostApi<{ ok: boolean; path: string; url: string; code?: string }>(
      `/api/invitations/${id}/seating/upload`,
      { method: 'POST', body: { contentType: type, size: blob.size } },
    );
    if (!res.ok || !res.body?.ok)
      throw new PlanFileError(res.status === 413 ? 'too_large' : res.status === 415 ? 'bad_type' : 'failed');
    await uploadTo(res.body.url, blob, type, onProgress);
    return res.body.path;
  };

  // ── tables, landmarks ──
  const select = (ids: string[]) => {
    setSelection(ids);
    setTableError(null);
  };
  const addTableAt = (shape: TableShape) => {
    const at = controls.current?.center() ?? null;
    let created = '';
    update((p) => {
      const r = addTable(p, shape, at);
      created = r.id;
      return r.plan;
    });
    queueMicrotask(() => created && select([created]));
  };
  const addLandmarkAt = (kind: LandmarkKind) => {
    const at = controls.current?.center() ?? null;
    let created = '';
    update((p) => {
      const r = addLandmark(p, kind, at);
      created = r.id;
      return r.plan;
    });
    queueMicrotask(() => created && select([created]));
  };
  const patchTable = (tableId: string, patch: TablePatch) => {
    const r = updateTable(plan, byId, tableId, patch);
    if (!r.ok) {
      setTableError(
        r.reason === 'number_taken'
          ? fmt(s.inspector.numberTaken, { number: r.number })
          : fmt(s.inspector.belowSeated, { seated: r.seated }),
      );
      return;
    }
    setTableError(null);
    update(
      (p) => {
        const next = updateTable(p, byId, tableId, patch);
        return next.ok ? next.plan : p;
      },
      `table:${tableId}:${Object.keys(patch).join(',')}`,
    );
  };
  const removeSelected = (ids: readonly string[]) => {
    if (!ids.length) return;
    const first = plan.tables.find((x) => ids.includes(x.id));
    update((p) => removeItems(p, new Set(ids)));
    setSelection([]);
    toast({
      title:
        ids.length === 1 && first
          ? fmt(s.toasts.removed.one, { number: first.number })
          : plural(s.toasts.removed, ids.length),
      action: { label: s.toasts.undo, altText: s.toasts.undo, onClick: () => setHistory(undo) },
    });
  };
  const nudge = (ids: readonly string[], dx: number, dy: number) => {
    const moves = new Map<string, Point>();
    for (const x of [...plan.tables, ...plan.layout.landmarks])
      if (ids.includes(x.id)) moves.set(x.id, { x: x.x + dx, y: x.y + dy });
    update((p) => moveItems(p, moves), `nudge:${ids.join(',')}`);
  };
  const rotateItems = (ids: readonly string[], degrees: number) =>
    update(
      (p) => ({
        ...p,
        tables: p.tables.map((x) =>
          ids.includes(x.id) ? { ...x, rotation: normalizeRotation(x.rotation + degrees) } : x,
        ),
        layout: {
          ...p.layout,
          landmarks: p.layout.landmarks.map((x) =>
            ids.includes(x.id) ? { ...x, rotation: normalizeRotation(x.rotation + degrees) } : x,
          ),
        },
      }),
      `rotate:${ids.join(',')}`,
    );

  // ── seating people ──
  const seat = (unitId: string, tableId: string): boolean => {
    const check = canSeat(plan, byId, unitId, tableId);
    const unit = byId.get(unitId);
    if (!check.ok) {
      if (check.reason === 'full')
        toast({
          variant: 'danger',
          title: fmt(s.blocked.full, {
            number: check.table.number,
            free: check.free,
            name: unit?.name ?? '',
            needed: check.needed,
          }),
        });
      else if (check.reason === 'declined')
        toast({ variant: 'danger', title: fmt(s.blocked.declined, { name: unit?.name ?? '' }) });
      return false;
    }
    const moved = !!plan.assignments[unitId] && plan.assignments[unitId]!.tableId !== tableId;
    update((p) => assign(p, byId, unitId, tableId).plan);
    const table = tablesById.get(tableId);
    toast({
      variant: 'success',
      title: fmt(moved ? s.blocked.moved : s.blocked.seated, {
        name: unit?.name ?? '',
        number: table?.number ?? '',
      }),
    });
    return true;
  };

  // dragging a family from the list onto a table
  const overTable = (x: number, y: number, unitId: string) => {
    const el = document.elementFromPoint(x, y)?.closest<SVGGElement>('[data-table-id]');
    const tableId = el?.dataset.tableId;
    return tableId ? { tableId, ok: canSeat(plan, byId, unitId, tableId).ok } : null;
  };

  // ── the floor plan ──
  const commitBackground = (
    background: PlanBackground | null,
    source: Plan['layout']['source'],
    mpp: number | null,
  ) => update((p) => ({ ...p, layout: { ...p.layout, background, source, metersPerPixel: mpp } }));
  const onPlanFile = async (file: File) => {
    setPlanError(null);
    setPlanBusy(
      /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
        ? { kind: 'rendering' }
        : { kind: 'uploading', percent: 0 },
    );
    try {
      const image = await preparePlanFile(file);
      setPlanBusy({ kind: 'uploading', percent: 0 });
      const path = await storePlan(image.blob, image.type, (percent) =>
        setPlanBusy({ kind: 'uploading', percent }),
      );
      commitBackground({ path, type: image.type, width: image.width, height: image.height }, 'upload', null);
      setDialog(null);
      toast({ variant: 'success', title: s.toasts.uploaded });
    } catch (err) {
      const code = err instanceof PlanFileError ? err.code : 'failed';
      setPlanError(
        code === 'too_large'
          ? s.plan.tooLarge
          : code === 'bad_type'
            ? s.plan.badType
            : code === 'pdf'
              ? s.plan.pdfFailed
              : s.plan.failed,
      );
    } finally {
      setPlanBusy(null);
    }
  };
  const useVenuePlan = () => {
    if (!venue?.plan) return;
    const v = venue.plan;
    commitBackground(v, 'partner', venue.widthMeters && v.width ? venue.widthMeters / v.width : null);
    convertingRef.current = false;
    setDialog(null);
  };
  const rescaleTo = (next: number | null) => {
    const current = planScale(plan.layout);
    if (!next || !current) {
      toast({ variant: 'danger', title: s.plan.lineTooShort });
      return;
    }
    update((p) => {
      const scaled = rescalePlan(p, next / current);
      return { ...scaled, layout: { ...scaled.layout, metersPerPixel: next } };
    });
    toast({ variant: 'success', title: s.plan.calibratedToast });
  };

  // ── the automatic seating ──
  const run = (seed = Math.floor(Math.random() * 2 ** 31)) => {
    if (!plan.tables.length) {
      setAutoError(s.auto.noTables);
      return;
    }
    const input = solverInput(plan, units, seed);
    if (!input.units.length) {
      setAutoError(s.auto.noUnits);
      return;
    }
    setAutoError(null);
    setRunning(true);
    setProgress(null);
    // a safety net for slow devices: a very large event stops after 10 s with the best found so far
    input.options.maxMs = 10_000;
    cancelRun.current = runSolver(input, {
      progress: setProgress,
      done: (r) => {
        setRunning(false);
        cancelRun.current = null;
        update((p) => applySolution(p, units, r));
        setResult(r);
        setDialog(null);
        setTab('map');
      },
      error: () => {
        setRunning(false);
        cancelRun.current = null;
        setAutoError(s.auto.failed);
      },
    });
  };
  const openAuto = () => {
    if (auto === 'plan') setDialog({ kind: 'upgrade' });
    else {
      setAutoError(null);
      setDialog({ kind: 'auto' });
    }
  };
  const setSettings = (patch: Partial<SeatingSettings>) =>
    update(
      (p) => ({ ...p, layout: { ...p.layout, settings: { ...p.layout.settings, ...patch } } }),
      'settings',
    );

  // print and Excel read what is saved: wait for the last change to be stored first
  const statusRef = useRef<SaveStatus>(save.status);
  statusRef.current = save.status;
  const whenSaved = async () => {
    for (let i = 0; i < 40 && statusRef.current !== 'saved'; i++) {
      if (statusRef.current === 'failed' || statusRef.current === 'over') break;
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  const selectedTable = selection.length === 1 ? tablesById.get(selection[0]!) : undefined;
  const selectedLandmark =
    selection.length === 1 ? plan.layout.landmarks.find((m) => m.id === selection[0]) : undefined;
  const unseatedCandidates = (tableId: string) =>
    listedUnits(plan, units, showPending).filter(
      (u) =>
        u.status !== 'declined' &&
        (!plan.assignments[u.id] || plan.assignments[u.id]!.tableId === tableId) &&
        !unitsAt(plan, tableId).includes(u.id),
    );
  const lockedCount = plan.tables.filter((x) => x.locked).length;
  const notCalibrated = !!bg?.width && !plan.layout.metersPerPixel;

  const saveLine: Record<SaveStatus, string> = {
    saved: s.save.saved,
    pending: s.save.saving,
    saving: s.save.saving,
    failed: s.save.failed,
    over: fmt(s.save.over, { number: save.overTable ?? '' }),
  };

  const autoButton =
    auto === 'off' ? null : (
      <Hint
        text={
          auto === 'plan' ? fmt(s.actions.autoLockedHint, { package: autoPackage.name }) : s.actions.autoHint
        }
      >
        <Button icon={<Sparkles />} onClick={openAuto} data-testid="auto-seat">
          {s.actions.auto}
        </Button>
      </Hint>
    );

  const editorHeight = full ? 'min-h-0 flex-1' : 'h-[72dvh] min-h-[460px] lg:h-[min(76dvh,860px)]';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <PageHeader
        size="section"
        title={s.title}
        description={s.subtitle}
        help={<SeatingHelp />}
        actions={
          <>
            {autoButton}
            <Hint text={s.actions.printHint}>
              <Button
                variant="secondary"
                icon={<Printer />}
                onClick={async () => {
                  await whenSaved();
                  window.open(`/app/invitations/${id}/seating/print`, '_blank', 'noopener');
                }}
                data-testid="print"
              >
                {s.actions.print}
              </Button>
            </Hint>
            <Hint text={s.actions.excelHint}>
              <Button
                variant="secondary"
                icon={<FileSpreadsheet />}
                onClick={async () => {
                  await whenSaved();
                  window.location.assign(`/api/invitations/${id}/seating/export`);
                }}
                data-testid="excel"
              >
                {s.actions.excel}
              </Button>
            </Hint>
          </>
        }
      />

      {/* where things stand */}
      <div
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]"
        aria-label={s.summary.label}
        data-testid="seating-summary"
      >
        <span className="font-semibold">
          {fmt(s.summary.seated, {
            seated: number(stats.seatedConfirmed),
            confirmed: number(stats.confirmed),
          })}
        </span>
        <span className="text-muted">
          {plural(s.summary.tables, plan.tables.length, { seats: number(stats.seats) })}
        </span>
        <span className={stats.unseatedUnits ? 'text-warning' : 'text-success'}>
          {stats.unseatedUnits ? plural(s.summary.unseated, stats.unseatedUnits) : s.summary.allSeated}
        </span>
        <span
          role="status"
          className={cn(
            'ms-auto flex items-center gap-1.5 text-[12.5px]',
            save.status === 'failed' || save.status === 'over' ? 'text-danger' : 'text-muted',
          )}
        >
          {save.status === 'saving' || save.status === 'pending' ? (
            <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
          ) : null}
          {saveLine[save.status]}
          {save.status === 'failed' ? (
            <Button size="sm" variant="ghost" onClick={save.retry}>
              {s.save.retry}
            </Button>
          ) : null}
        </span>
      </div>

      {/* what needs attention */}
      <div className="mt-2 flex flex-col gap-2">
        {stats.over.slice(0, 3).map((x) => (
          <p
            key={x.id}
            className="flex items-start gap-2 rounded-card border border-[#fecaca] bg-danger-bg px-3 py-2 text-[13px] text-danger"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {fmt(s.warnings.over, { number: x.number, seated: taken.get(x.id) ?? 0, capacity: x.capacity })}
          </p>
        ))}
        {stats.declinedSeated.length ? (
          <p className="flex flex-wrap items-center gap-2 rounded-card border border-[#fde68a] bg-warning-bg px-3 py-2 text-[13px] text-warning">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {plural(s.warnings.declined, stats.declinedSeated.length)}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                update((p) => unassign(p, stats.declinedSeated));
                toast({ title: plural(s.toasts.declinedFreed, stats.declinedSeated.length) });
              }}
            >
              {s.warnings.declinedFix}
            </Button>
          </p>
        ) : null}
        {notCalibrated && !converting ? (
          <p className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-info-bg px-3 py-2 text-[13px] text-ink/80">
            {s.warnings.notCalibrated}
            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'plan' })}>
              {s.warnings.calibrateNow}
            </Button>
          </p>
        ) : null}
        {converting ? (
          <p
            role="status"
            className={cn(
              'rounded-card border px-3 py-2 text-[13px]',
              converting === 'failed'
                ? 'border-[#fecaca] bg-danger-bg text-danger'
                : 'border-line bg-info-bg',
            )}
          >
            {converting === 'failed' ? s.warnings.convertFailed : s.warnings.converting}
          </p>
        ) : null}
      </div>

      {/* phones: the map or the list */}
      <div className="mt-3 lg:hidden">
        <Segmented
          label={s.mobileTabs.label}
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'map', label: s.mobileTabs.map },
            { value: 'guests', label: `${s.mobileTabs.guests} (${number(stats.unseatedUnits)})` },
          ]}
          fullWidth
        />
      </div>

      <div
        className={cn(
          'flex flex-col overflow-hidden border-line bg-surface',
          full ? 'fixed inset-0 z-50 h-dvh' : 'mt-3 rounded-card border shadow-sm',
        )}
        data-testid="seating-editor"
      >
        {full ? (
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
            <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{s.title}</p>
            <div className="lg:hidden">
              <Segmented
                label={s.mobileTabs.label}
                value={tab}
                onValueChange={setTab}
                options={[
                  { value: 'map', label: s.mobileTabs.map },
                  { value: 'guests', label: s.mobileTabs.guests },
                ]}
              />
            </div>
            {autoButton ? <div className="max-sm:hidden">{autoButton}</div> : null}
            <Button size="sm" variant="secondary" onClick={() => setFull(false)}>
              {s.actions.exitFullScreen}
            </Button>
          </div>
        ) : null}
        <div className={cn('grid min-h-0 lg:grid-cols-[340px_minmax(0,1fr)]', editorHeight)}>
          <aside
            className={cn('min-h-0 border-line lg:border-e', tab === 'guests' ? 'block' : 'max-lg:hidden')}
          >
            <GuestsPanel
              id={id}
              plan={plan}
              units={units}
              tablesById={tablesById}
              showPending={showPending}
              onShowPending={setShowPending}
              onSeat={(unitId) => setDialog({ kind: 'seat', unitId })}
              onUnseat={(unitId) => update((p) => unassign(p, [unitId]))}
              onSettings={(unitId) => setDialog({ kind: 'unit', unitId })}
              onRules={() => setDialog({ kind: 'rules' })}
              onShowTable={(tableId) => {
                select([tableId]);
                setTab('map');
                const x = tablesById.get(tableId);
                if (x) controls.current?.reveal({ x: x.x, y: x.y });
              }}
              onDragStart={(unitId, x, y) => setDrag({ unitId, x, y, over: null })}
              onDragMove={(x, y) => setDrag((d) => (d ? { ...d, x, y, over: overTable(x, y, d.unitId) } : d))}
              onDragEnd={(x, y, cancelled) => {
                const d = drag;
                setDrag(null);
                if (!d || cancelled) return;
                const target = overTable(x, y, d.unitId);
                if (target) seat(d.unitId, target.tableId);
              }}
            />
          </aside>
          <div className={cn('flex min-h-0 min-w-0 flex-col', tab === 'map' ? 'flex' : 'max-lg:hidden')}>
            <CanvasToolbar
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              snap={snap}
              full={full}
              onAddTable={addTableAt}
              onAddLandmark={addLandmarkAt}
              onUndo={() => setHistory(undo)}
              onRedo={() => setHistory(redo)}
              onZoom={(f) => controls.current?.zoom(f)}
              onFit={() => controls.current?.fit()}
              onSnap={setSnap}
              onPlan={() => {
                setPlanError(null);
                setDialog({ kind: 'plan' });
              }}
              onFull={setFull}
            />
            <div className="relative min-h-0 flex-1">
              <SeatingCanvas
                plan={plan}
                occupancy={taken}
                planUrl={planUrl}
                selection={selection}
                snap={snap}
                dropTarget={drag?.over ?? null}
                calibrating={calibrating}
                controls={controls}
                onSelect={select}
                onMove={(moves) => update((p) => moveItems(p, moves))}
                onNudge={nudge}
                onRotate={rotateItems}
                onDelete={removeSelected}
                onOpenTable={(tableId) => setDialog({ kind: 'add', tableId })}
                onCalibrated={(a, b) => setDialog({ kind: 'line', a, b })}
              />
              {calibrating ? (
                <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-[#bfdbfe] bg-info-bg px-3 py-2 text-[13px] shadow-sm sm:inset-x-auto sm:start-3">
                  {s.canvas.calibrating}
                  <Button size="sm" variant="secondary" onClick={() => setCalibrating(false)}>
                    {s.canvas.calibrateCancel}
                  </Button>
                </div>
              ) : null}
              {result && !calibrating ? (
                <AutoResult
                  result={result}
                  names={names}
                  numbers={numbers}
                  onRerun={() => run()}
                  onUndo={() => {
                    setHistory(undo);
                    setResult(null);
                  }}
                  onClose={() => setResult(null)}
                />
              ) : null}
              {selectedTable ? (
                <TableInspector
                  table={selectedTable}
                  seated={taken.get(selectedTable.id) ?? 0}
                  people={unitsAt(plan, selectedTable.id).flatMap((uid) =>
                    byId.get(uid) ? [byId.get(uid)!] : [],
                  )}
                  error={tableError}
                  onPatch={(patch) => patchTable(selectedTable.id, patch)}
                  onDuplicate={() => {
                    let created = '';
                    update((p) => {
                      const r = duplicateTable(p, selectedTable.id);
                      created = r?.id ?? '';
                      return r?.plan ?? p;
                    });
                    queueMicrotask(() => created && select([created]));
                  }}
                  onRemove={() => removeSelected([selectedTable.id])}
                  onAddGuests={() => setDialog({ kind: 'add', tableId: selectedTable.id })}
                  onUnseat={(unitId) => update((p) => unassign(p, [unitId]))}
                  onClose={() => select([])}
                />
              ) : selectedLandmark ? (
                <LandmarkInspector
                  landmark={selectedLandmark}
                  onPatch={(patch) =>
                    update(
                      (p) => updateLandmark(p, selectedLandmark.id, patch),
                      `landmark:${selectedLandmark.id}`,
                    )
                  }
                  onRemove={() => removeSelected([selectedLandmark.id])}
                  onClose={() => select([])}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {drag ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed z-[90] rounded-full px-3 py-1.5 text-[13px] font-semibold shadow-lg',
            drag.over
              ? drag.over.ok
                ? 'bg-success text-white'
                : 'bg-danger text-white'
              : 'bg-ink text-white',
          )}
          // follows the pointer: physical screen coordinates
          style={{ left: 0, top: 0, transform: `translate(${drag.x + 14}px, ${drag.y + 14}px)` }}
        >
          {byId.get(drag.unitId)?.name} · {number(byId.get(drag.unitId)?.seats ?? 0)}
        </div>
      ) : null}

      {dialog?.kind === 'seat' && byId.get(dialog.unitId) ? (
        <SeatPicker
          unit={byId.get(dialog.unitId)!}
          tables={plan.tables}
          occupancy={taken}
          current={plan.assignments[dialog.unitId]?.tableId ?? null}
          onPick={(tableId) => seat(dialog.unitId, tableId) && setDialog(null)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'add' && tablesById.get(dialog.tableId) ? (
        <AddGuestsPicker
          table={tablesById.get(dialog.tableId)!}
          seated={taken.get(dialog.tableId) ?? 0}
          candidates={unseatedCandidates(dialog.tableId)}
          plan={plan}
          onAdd={(unitId) => seat(unitId, dialog.tableId)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'unit' && byId.get(dialog.unitId) ? (
        <UnitDialog
          unit={byId.get(dialog.unitId)!}
          plan={plan}
          units={listedUnits(plan, units, true)}
          onSettings={(patch) =>
            update((p) => setUnitSettings(p, dialog.unitId, patch), `unit:${dialog.unitId}`)
          }
          onAddRule={(rule) => update((p) => addRule(p, rule))}
          onRemoveRule={(ruleId) => update((p) => removeRule(p, ruleId))}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'rules' ? (
        <RulesDialog
          rules={plan.rules}
          units={units}
          onRemove={(ruleId) => update((p) => removeRule(p, ruleId))}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'plan' ? (
        <PlanDialog
          layout={plan.layout}
          planUrl={planUrl}
          venue={venue}
          usingVenue={usingVenue}
          busy={planBusy}
          error={planError}
          onFile={(file) => void onPlanFile(file)}
          onUseVenue={useVenuePlan}
          onRemove={() => {
            commitBackground(null, 'none', null);
            setDialog(null);
          }}
          onDrawLine={() => {
            setDialog(null);
            setSelection([]);
            setTab('map');
            setCalibrating(true);
          }}
          onWidth={(meters) => {
            rescaleTo(bg?.width ? meters / bg.width : null);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'line' ? (
        <LineLengthDialog
          onApply={(meters) => {
            const current = planScale(plan.layout);
            rescaleTo(current ? calibrate(dialog.a, dialog.b, meters, current) : null);
            setCalibrating(false);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'auto' ? (
        <AutoDialog
          settings={plan.layout.settings}
          lockedTables={lockedCount}
          running={running}
          progress={progress}
          error={autoError}
          onSettings={setSettings}
          onRun={() => run()}
          onCancel={() => {
            cancelRun.current?.();
            cancelRun.current = null;
            setRunning(false);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'upgrade' ? (
        <AutoUpgrade
          packageName={autoPackage.name}
          planName={autoPackage.plan}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
