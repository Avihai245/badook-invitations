'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import { useUi } from '@/lib/i18n/client';
import {
  contentBounds,
  fitView,
  pinch,
  planSize,
  snapPoint,
  toWorld,
  zoomAt,
  type Point,
  type View,
} from '../geometry';
import type { Landmark, Plan, SeatingTable } from '../model';
import { LandmarkGlyph, TableGlyph } from './glyphs';

/** What the toolbar asks the canvas to do. */
export interface CanvasControls {
  zoom(factor: number): void;
  fit(): void;
  /** the world point in the middle of the view (where a new table goes) */
  center(): Point;
  /** brings a world point into the middle of the view (a table picked in the guest list) */
  reveal(p: Point): void;
}

type Gesture =
  | { kind: 'drag'; pointerId: number; start: Point; origin: Map<string, Point>; moved: boolean }
  | { kind: 'pan'; pointerId: number; start: Point; view: View; moved: boolean }
  | { kind: 'pinch'; a: Point; b: Point; view: View }
  | { kind: 'calibrate'; pointerId: number; a: Point; b: Point };

const DRAG_THRESHOLD = 4;

/**
 * The seating map (SVG, meters): the floor plan under a grid, the landmarks and the tables. Mouse:
 * drag a table to move it, drag the floor to pan, the wheel zooms. Touch: tap a table to pick it, then
 * drag it; one finger on the floor pans, two fingers pinch. Keyboard: Tab to a table, arrows move it
 * (Shift: bigger steps), R rotates, Delete removes, Enter seats guests there. A family dragged from the
 * guest list shows whether it fits the table under the pointer (`dropTarget`).
 */
export function SeatingCanvas({
  plan,
  occupancy,
  planUrl,
  selection,
  snap,
  dropTarget,
  calibrating,
  controls,
  onSelect,
  onMove,
  onNudge,
  onRotate,
  onDelete,
  onOpenTable,
  onCalibrated,
}: {
  plan: Plan;
  occupancy: ReadonlyMap<string, number>;
  planUrl: string | null;
  selection: readonly string[];
  snap: boolean;
  dropTarget: { tableId: string; ok: boolean } | null;
  calibrating: boolean;
  controls: Ref<CanvasControls>;
  onSelect(ids: string[]): void;
  onMove(moves: Map<string, Point>): void;
  onNudge(ids: readonly string[], dx: number, dy: number): void;
  onRotate(ids: readonly string[], degrees: number): void;
  onDelete(ids: readonly string[]): void;
  onOpenTable(id: string): void;
  onCalibrated(a: Point, b: Point): void;
}) {
  const { t, fmt: f } = useUi();
  const s = t.seating;
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 20, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitted = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [preview, setPreviewState] = useState<Map<string, Point> | null>(null);
  // the latest drag positions for the pointer's release (state lags a render behind)
  const previewRef = useRef<Map<string, Point> | null>(null);
  const setPreview = (next: Map<string, Point> | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const selected = useMemo(() => new Set(selection), [selection]);

  const bounds = useMemo(() => contentBounds(plan), [plan]);
  const fit = useCallback(() => {
    if (size.w > 0 && size.h > 0) setView(fitView(bounds, size.w, size.h, size.w < 500 ? 12 : 32));
  }, [bounds, size]);

  // the canvas's size; the first time it has one, everything is fitted in view
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!fitted.current && size.w > 0 && size.h > 0) {
      fitted.current = true;
      fit();
    }
  }, [size, fit]);

  useImperativeHandle(
    controls,
    () => ({
      zoom: (factor) => setView((v) => zoomAt(v, factor, { x: size.w / 2, y: size.h / 2 })),
      fit,
      center: () => toWorld(viewRef.current, { x: size.w / 2, y: size.h / 2 }),
      reveal: (p) =>
        setView((v) => ({ ...v, tx: size.w / 2 - p.x * v.scale, ty: size.h / 2 - p.y * v.scale })),
    }),
    [fit, size],
  );

  // the wheel zooms around the pointer (a trackpad's pinch comes as a wheel with ctrlKey)
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) => zoomAt(v, factor, { x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const positionOf = (id: string): Point | null => {
    const item = plan.tables.find((x) => x.id === id) ?? plan.layout.landmarks.find((x) => x.id === id);
    return item ? { x: item.x, y: item.y } : null;
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    svg.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      // a second finger: pinch (whatever the first one was doing is dropped)
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', a: a!, b: b!, view: viewRef.current };
      setPreview(null);
      return;
    }
    if (pointers.current.size > 2) return;
    if (calibrating) {
      const w = toWorld(viewRef.current, p);
      gesture.current = { kind: 'calibrate', pointerId: e.pointerId, a: w, b: w };
      setLine({ a: w, b: w });
      return;
    }
    const target = (e.target as Element).closest<SVGGElement>('[data-item-id]');
    const id = target?.dataset.itemId;
    const touch = e.pointerType === 'touch';
    if (id) {
      const already = selected.has(id);
      const ids = e.shiftKey
        ? already
          ? selection.filter((x) => x !== id)
          : [...selection, id]
        : already
          ? [...selection]
          : [id];
      if (!already || e.shiftKey) onSelect(ids);
      // a finger on a table that wasn't picked yet pans (no accidental moves while looking around)
      if (!(touch && !already)) {
        const origin = new Map<string, Point>();
        for (const x of ids) {
          const pos = positionOf(x);
          if (pos) origin.set(x, pos);
        }
        gesture.current = { kind: 'drag', pointerId: e.pointerId, start: p, origin, moved: false };
        return;
      }
    } else if (!e.shiftKey && selection.length) onSelect([]);
    gesture.current = { kind: 'pan', pointerId: e.pointerId, start: p, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (a && b) setView(pinch(g.view, g.a, g.b, a, b));
      return;
    }
    if (g.pointerId !== e.pointerId) return;
    if (g.kind === 'calibrate') {
      g.b = toWorld(viewRef.current, p);
      setLine({ a: g.a, b: g.b });
      return;
    }
    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    g.moved = true;
    if (g.kind === 'pan') {
      setView({ ...g.view, tx: g.view.tx + dx, ty: g.view.ty + dy });
      return;
    }
    const v = viewRef.current;
    const next = new Map<string, Point>();
    for (const [id, o] of g.origin) {
      const q = { x: o.x + dx / v.scale, y: o.y + dy / v.scale };
      next.set(id, snap ? snapPoint(q, plan.layout.gridM) : q);
    }
    setPreview(next);
  };

  const finish = (e: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    if (g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (g.kind === 'calibrate') {
      setLine(null);
      if (!cancelled) onCalibrated(g.a, g.b);
      return;
    }
    if (g.kind === 'drag') {
      const moved = previewRef.current;
      if (g.moved && moved && !cancelled) onMove(moved);
      setPreview(null);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<SVGGElement>, id: string, isTable: boolean) => {
    const ids = selected.has(id) ? selection : [id];
    const step = (snap ? plan.layout.gridM : 0.1) * (e.shiftKey ? 5 : 1);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      onNudge(ids, move[0], move[1]);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      onRotate(ids, e.shiftKey ? -15 : 15);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(ids);
    } else if (e.key === 'Enter' && isTable) {
      e.preventDefault();
      onOpenTable(id);
    } else if (e.key === 'Escape') {
      onSelect([]);
      (e.currentTarget as SVGGElement).blur();
    }
  };

  // text stays readable at any zoom: about 12px on screen, never bigger than its table allows
  const fontSize = Math.max(0.3, 12 / view.scale);
  const planDims = planSize(plan.layout);
  const room = planDims ?? { w: 30, h: 20 };
  // the grid: half a meter close up, coarser as the view zooms out (never denser than ~10px)
  let gridStep = plan.layout.gridM;
  while (gridStep * view.scale < 10) gridStep *= 2;
  const at = <T extends SeatingTable | Landmark>(item: T): T => {
    const p = preview?.get(item.id);
    return p ? { ...item, x: p.x, y: p.y } : item;
  };
  const tables = [...plan.tables].sort((a, b) => a.number - b.number);

  return (
    <div
      ref={box}
      className="relative h-full w-full overflow-hidden bg-[#ebe8e3] select-none"
      style={{ touchAction: 'none' }}
      data-testid="seating-canvas"
    >
      <svg
        ref={svg}
        width="100%"
        height="100%"
        role="group"
        aria-label={s.canvas.label}
        className={calibrating ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onDoubleClick={(e) => {
          const id = (e.target as Element).closest<SVGGElement>('[data-table-id]')?.dataset.tableId;
          if (id) onOpenTable(id);
        }}
      >
        <defs>
          <pattern id="seating-grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke="#d6d3d1"
              strokeWidth={1 / view.scale}
            />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <rect x={0} y={0} width={room.w} height={room.h} fill="#ffffff" />
          {planUrl && planDims ? (
            <image
              href={planUrl}
              x={0}
              y={0}
              width={planDims.w}
              height={planDims.h}
              preserveAspectRatio="none"
              data-testid="seating-plan-image"
            />
          ) : null}
          <rect
            x={bounds.x - 50}
            y={bounds.y - 50}
            width={bounds.w + 100}
            height={bounds.h + 100}
            fill="url(#seating-grid)"
            opacity={planUrl ? 0.5 : 1}
            style={{ pointerEvents: 'none' }}
          />
          <rect
            x={0}
            y={0}
            width={room.w}
            height={room.h}
            fill="none"
            stroke="#a8a29e"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'none' }}
          />
          {plan.layout.landmarks.map((m) => {
            const label = m.label || s.landmarks[m.kind];
            return (
              <g
                key={m.id}
                data-item-id={m.id}
                tabIndex={0}
                role="button"
                aria-label={f(s.canvas.landmarkAria, { label })}
                aria-pressed={selected.has(m.id)}
                className="outline-none focus-visible:[&>g>rect]:stroke-[#2563eb]"
                onFocus={() => !selected.has(m.id) && onSelect([m.id])}
                onKeyDown={(e) => onKeyDown(e, m.id, false)}
              >
                <LandmarkGlyph
                  landmark={at(m)}
                  label={label}
                  fontSize={fontSize * 1.1}
                  selected={selected.has(m.id)}
                />
              </g>
            );
          })}
          {tables.map((table) => {
            const seated = occupancy.get(table.id) ?? 0;
            const over = seated > table.capacity;
            return (
              <g
                key={table.id}
                data-item-id={table.id}
                data-table-id={table.id}
                data-table-number={table.number}
                tabIndex={0}
                role="button"
                aria-pressed={selected.has(table.id)}
                aria-label={
                  f(s.canvas.tableAria, {
                    number: table.number,
                    label: table.label ? ` (${table.label})` : '',
                    seated,
                    capacity: table.capacity,
                    locked: table.locked ? s.canvas.lockedAria : '',
                  }) + (over ? s.canvas.overAria : '')
                }
                className="outline-none"
                onFocus={() => !selected.has(table.id) && onSelect([table.id])}
                onKeyDown={(e) => onKeyDown(e, table.id, true)}
              >
                <TableGlyph
                  table={at(table)}
                  seated={seated}
                  fontSize={fontSize}
                  selected={selected.has(table.id)}
                  drop={dropTarget?.tableId === table.id ? dropTarget.ok : null}
                />
              </g>
            );
          })}
          {line ? (
            <g style={{ pointerEvents: 'none' }}>
              <line
                x1={line.a.x}
                y1={line.a.y}
                x2={line.b.x}
                y2={line.b.y}
                stroke="#2563eb"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
              <circle cx={line.a.x} cy={line.a.y} r={5 / view.scale} fill="#2563eb" />
              <circle cx={line.b.x} cy={line.b.y} r={5 / view.scale} fill="#2563eb" />
            </g>
          ) : null}
        </g>
      </svg>
      {plan.tables.length === 0 && !calibrating ? (
        <p className="pointer-events-none absolute inset-x-4 top-1/2 mx-auto max-w-[340px] -translate-y-1/2 rounded-card bg-surface/90 px-4 py-3 text-center text-[13px] text-muted shadow-sm">
          {s.canvas.empty}
        </p>
      ) : null}
    </div>
  );
}
