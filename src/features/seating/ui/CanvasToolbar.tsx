'use client';

import {
  Circle,
  Grid3x3,
  Hand,
  Lock,
  Map as MapIcon,
  Maximize,
  Minimize,
  Minus,
  MousePointerClick,
  Plus,
  Redo2,
  RectangleHorizontal,
  Focus,
  Sparkles,
  Square,
  Undo2,
  Flag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AreaHelp, IconButton, Menu } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { LANDMARK_KINDS, TABLE_SHAPES, type LandmarkKind, type TableShape } from '../model';

const SHAPE_ICON: Record<TableShape, typeof Circle> = {
  round: Circle,
  rect: Square,
  knights: RectangleHorizontal,
};

/** The buttons above the map. Every one explains itself (tooltip), and "?" explains them all. */
export function CanvasToolbar({
  canUndo,
  canRedo,
  snap,
  full,
  onAddTable,
  onAddLandmark,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  onSnap,
  onPlan,
  onFull,
}: {
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  full: boolean;
  onAddTable(shape: TableShape): void;
  onAddLandmark(kind: LandmarkKind): void;
  onUndo(): void;
  onRedo(): void;
  onZoom(factor: number): void;
  onFit(): void;
  onSnap(on: boolean): void;
  onPlan(): void;
  onFull(on: boolean): void;
}) {
  const { t } = useUi();
  const s = t.seating;
  const tb = s.toolbar;
  const pill =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-btn bg-primary px-2.5 text-[13px] font-semibold text-primary-ink shadow-sm hover:bg-primary-hover sm:px-3 [&_svg]:size-4';
  const soft =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-btn border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink shadow-sm hover:bg-subtle sm:px-3 [&_svg]:size-4';
  return (
    <div
      role="toolbar"
      aria-label={tb.label}
      // phones: one row that scrolls sideways rather than two rows over the map
      className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface/95 px-2 py-1.5 backdrop-blur [scrollbar-width:none] sm:flex-wrap sm:gap-1.5 [&::-webkit-scrollbar]:hidden"
    >
      <Menu
        align="start"
        trigger={
          <button type="button" className={pill} aria-label={tb.addTableLabel} data-testid="add-table">
            <Plus aria-hidden />
            {tb.addTable}
          </button>
        }
        items={TABLE_SHAPES.map((shape) => {
          const Icon = SHAPE_ICON[shape];
          return {
            label: (
              <span className="flex flex-col leading-tight">
                <span>{tb.shapes[shape]}</span>
                <span className="text-[11.5px] text-muted">{tb.shapeHints[shape]}</span>
              </span>
            ),
            icon: <Icon />,
            onSelect: () => onAddTable(shape),
          };
        })}
      />
      <Menu
        align="start"
        trigger={
          <button type="button" className={soft} aria-label={tb.addLandmarkLabel} data-testid="add-landmark">
            <Flag aria-hidden />
            <span className="max-sm:sr-only">{tb.addLandmark}</span>
          </button>
        }
        items={LANDMARK_KINDS.map((kind) => ({
          label: s.landmarks[kind],
          onSelect: () => onAddLandmark(kind),
        }))}
      />
      <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
      <IconButton label={tb.undo} tooltip disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="icon-dir" />
      </IconButton>
      <IconButton label={tb.redo} tooltip disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="icon-dir" />
      </IconButton>
      <span aria-hidden className="mx-0.5 h-6 w-px bg-line max-sm:hidden" />
      <IconButton label={tb.zoomOut} tooltip onClick={() => onZoom(1 / 1.25)} className="max-sm:hidden">
        <ZoomOut />
      </IconButton>
      <IconButton label={tb.zoomIn} tooltip onClick={() => onZoom(1.25)} className="max-sm:hidden">
        <ZoomIn />
      </IconButton>
      <IconButton label={tb.fit} tooltip onClick={onFit}>
        <Focus />
      </IconButton>
      <IconButton label={tb.snap} tooltip aria-pressed={snap} onClick={() => onSnap(!snap)}>
        <Grid3x3 />
      </IconButton>
      <IconButton label={tb.plan} tooltip onClick={onPlan} data-testid="plan-button">
        <MapIcon />
      </IconButton>
      <div className="ms-auto flex items-center gap-0.5">
        {/* phones have it beside "map | guests" (and the bar on top in full screen) */}
        <IconButton
          label={full ? s.actions.exitFullScreen : s.actions.fullScreen}
          tooltip
          onClick={() => onFull(!full)}
          className="max-sm:hidden"
          data-testid={full ? undefined : 'full-screen'}
        >
          {full ? <Minimize /> : <Maximize />}
        </IconButton>
        <SeatingHelp className={full ? 'size-9' : 'size-9 max-sm:hidden'} />
      </div>
    </div>
  );
}

/** "What does each button do?" — the seating screen's tools, each with its icon. */
export function SeatingHelp({ className }: { className?: string }) {
  const { t } = useUi();
  const s = t.seating;
  const h = s.help.items;
  return (
    <AreaHelp
      label={s.toolbar.help}
      title={s.help.title}
      intro={s.help.intro}
      items={[
        { icon: <Plus />, ...h.addTable },
        { icon: <Flag />, ...h.addLandmark },
        { icon: <Hand />, ...h.move },
        { icon: <Undo2 className="icon-dir" />, ...h.undo },
        { icon: <Minus />, ...h.zoom },
        { icon: <Maximize />, ...h.full },
        { icon: <Grid3x3 />, ...h.snap },
        { icon: <MapIcon />, ...h.plan },
        { icon: <MousePointerClick />, ...h.assign },
        { icon: <Lock />, ...h.lock },
        { icon: <Sparkles />, ...h.auto },
      ]}
      className={className}
    />
  );
}
