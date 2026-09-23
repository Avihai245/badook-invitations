'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BedDouble,
  Bus,
  CalendarDays,
  Camera,
  CaseSensitive,
  Clock,
  Gift,
  GripVertical,
  Heart,
  Image,
  Languages,
  Layers,
  ListPlus,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Palette,
  PartyPopper,
  PenLine,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Type,
  Users,
  UtensilsCrossed,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useMemo, useState } from 'react';
import { Switch, cn, rovingKeyDown, useDir } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { Section } from '../contracts/types';
import { availableEntries, insertionIndex, LOCKED_TYPES, newSection, type CatalogKey } from './catalog';
import { sectionName } from './fields/fields';
import { insertAt, moveAt } from './paths';
import {
  DESIGN_PANELS,
  SETTINGS_PANELS,
  useEditor,
  type PanelId,
  type RailTab,
} from './state/EditorProvider';

type IconKey = CatalogKey | 'cover' | 'hero' | 'footer' | PanelId;

export const SECTION_ICONS: Record<IconKey, LucideIcon> = {
  cover: Mail,
  hero: Image,
  countdown: Clock,
  story: Heart,
  venues: MapPin,
  timeline: ListPlus,
  transport: Bus,
  accommodation: BedDouble,
  dress_code: Sparkles,
  menu: UtensilsCrossed,
  activities: PartyPopper,
  custom: PenLine,
  faq: MessageCircle,
  gallery: Camera,
  gifts: Gift,
  reveal: WandSparkles,
  rsvp: Users,
  footer: Type,
  palette: Palette,
  fonts: CaseSensitive,
  music: Music,
  event: CalendarDays,
  languages: Languages,
  share: Share2,
};

/** Sections move up and down only. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export const iconOf = (section: Section): LucideIcon =>
  SECTION_ICONS[section.type === 'text' ? section.data.kind : (section.type as IconKey)];

/** Hidden between 1024 and 1279px, where the rail collapses to 64px of icons (§9B.3-D). */
const COMPACT_HIDE = 'lg:max-xl:hidden';
const COMPACT_SR = 'lg:max-xl:sr-only';

/** The editor's rail (§9B.3-D): tabs Sections · Design · Settings; the section list reorders by drag. */
export function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const { railTab, setRailTab } = useEditor();
  const { t } = useUi();
  const r = t.editor.rail;
  const id = useId();
  const tabs: { value: RailTab; label: string; Icon: LucideIcon }[] = [
    { value: 'sections', label: r.tabs.sections, Icon: Layers },
    { value: 'design', label: r.tabs.design, Icon: Palette },
    { value: 'settings', label: r.tabs.settings, Icon: Settings2 },
  ];
  return (
    <aside aria-label={r.label} className="flex min-h-0 flex-col bg-surface">
      <div
        role="tablist"
        aria-label={r.label}
        onKeyDown={rovingKeyDown}
        className="flex gap-1 border-b border-line px-3 py-2.5 lg:max-xl:flex-col lg:max-xl:px-2"
      >
        {tabs.map(({ value, label, Icon }) => {
          const on = railTab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${id}-tab-${value}`}
              aria-selected={on}
              aria-controls={`${id}-panel-${value}`}
              tabIndex={on ? 0 : -1}
              data-roving-item=""
              title={label}
              onClick={() => setRailTab(value)}
              className={cn(
                'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-btn text-[13px]',
                on ? 'bg-subtle font-semibold text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Icon aria-hidden size={15} strokeWidth={1.75} className="shrink-0" />
              <span className={COMPACT_SR}>{label}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${railTab}`}
        aria-labelledby={`${id}-tab-${railTab}`}
        className="min-h-0 flex-1 overflow-auto p-2"
      >
        {railTab === 'sections' ? (
          <SectionList onNavigate={onNavigate} />
        ) : (
          <PanelList
            label={railTab === 'design' ? r.designLabel : r.settingsLabel}
            panels={railTab === 'design' ? DESIGN_PANELS : SETTINGS_PANELS}
            onNavigate={onNavigate}
          />
        )}
      </div>
      {railTab === 'sections' ? <AddSection onAdded={onNavigate} /> : null}
    </aside>
  );
}

// ─── rows ──────────────────────────────────────────────────────────────────────────────────────

function RowShell({
  selected,
  off,
  children,
  className,
  style,
  innerRef,
}: {
  selected: boolean;
  off?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  innerRef?: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={innerRef}
      style={style}
      className={cn(
        'relative flex h-11 items-center gap-2.5 rounded-btn px-2.5 hover:bg-subtle lg:max-xl:justify-center lg:max-xl:px-0',
        selected && 'bg-subtle font-semibold',
        off && 'text-faint',
        className,
      )}
    >
      {selected ? (
        <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-[3px] bg-ink" />
      ) : null}
      {children}
    </li>
  );
}

function RowButton({
  icon: Icon,
  name,
  selected,
  onClick,
  flagged,
}: {
  icon: LucideIcon;
  name: string;
  selected: boolean;
  onClick: () => void;
  flagged?: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={onClick}
      title={name}
      className="relative flex h-full min-w-0 flex-1 items-center gap-2 text-start outline-offset-[-2px] lg:max-xl:flex-none lg:max-xl:justify-center lg:max-xl:px-3"
    >
      <Icon aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
      <span className={cn('truncate', COMPACT_SR)}>{name}</span>
      {flagged ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-danger lg:max-xl:absolute lg:max-xl:end-2 lg:max-xl:top-2"
        />
      ) : null}
    </button>
  );
}

function LockedRow({
  icon,
  name,
  selected,
  onSelect,
  flagged,
}: {
  icon: LucideIcon;
  name: string;
  selected: boolean;
  onSelect: () => void;
  flagged?: boolean;
}) {
  const { t } = useUi();
  return (
    <RowShell selected={selected}>
      <Lock
        role="img"
        aria-label={t.editor.rail.locked}
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-faint"
      />
      <RowButton icon={icon} name={name} selected={selected} onClick={onSelect} flagged={flagged} />
    </RowShell>
  );
}

function SortableRow({
  section,
  name,
  selected,
  onSelect,
  onToggle,
  flagged,
}: {
  section: Section;
  name: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: (on: boolean) => void;
  flagged?: boolean;
}) {
  const { t } = useUi();
  const r = t.editor.rail;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: section.id,
    });
  return (
    <RowShell
      selected={selected}
      off={!section.enabled}
      innerRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'z-10 bg-surface shadow-lg')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={fmt(r.drag, { name })}
        className={cn(
          '-ms-1 grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-[6px] text-faint hover:text-muted active:cursor-grabbing',
          COMPACT_HIDE,
        )}
      >
        <GripVertical aria-hidden size={16} strokeWidth={1.75} />
      </button>
      <RowButton
        icon={iconOf(section)}
        name={name}
        selected={selected}
        onClick={onSelect}
        flagged={flagged}
      />
      <Switch
        label={fmt(r.toggle, { name })}
        checked={section.enabled}
        onCheckedChange={onToggle}
        className={COMPACT_HIDE}
      />
    </RowShell>
  );
}

// ─── lists ─────────────────────────────────────────────────────────────────────────────────────

function SectionList({ onNavigate }: { onNavigate?: () => void }) {
  const { doc, selection, select, apply, issues, showIssues } = useEditor();
  const { t, locale } = useUi();
  const e = t.editor;
  const dir = useDir();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const middle = doc.sections.filter((s) => !LOCKED_TYPES.includes(s.type));
  const hero = doc.sections.find((s) => s.type === 'hero');
  const footer = doc.sections.find((s) => s.type === 'footer');
  const flagged = useMemo(
    () => new Set(showIssues ? issues.errors.map((i) => i.sectionId).filter(Boolean) : []),
    [issues, showIssues],
  );
  const nameOf = (id: string | number) => {
    const s = doc.sections.find((x) => x.id === id);
    return s ? sectionName(s, e, locale) : '';
  };
  const positionOf = (id: string | number) => middle.findIndex((s) => s.id === id) + 1;
  const dndId = useId();
  const d = e.rail.dnd;
  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(d.picked, { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? fmt(d.over, { name: nameOf(active.id), n: positionOf(over.id), total: middle.length })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? fmt(d.dropped, { name: nameOf(active.id), n: positionOf(over.id), total: middle.length })
        : undefined,
    onDragCancel: ({ active }) => fmt(d.cancelled, { name: nameOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    apply((doc) => {
      const from = doc.sections.findIndex((s) => s.id === active.id);
      const to = doc.sections.findIndex((s) => s.id === over.id);
      return from < 0 || to < 0 ? doc : moveAt(doc, 'sections', from, to);
    }, null);
  };
  const go = (fn: () => void) => {
    fn();
    onNavigate?.();
  };
  const isSelected = (id: string) => selection.kind === 'section' && selection.id === id;

  return (
    <ul aria-label={e.rail.sectionsLabel} className="flex flex-col gap-0.5" dir={dir}>
      <LockedRow
        icon={SECTION_ICONS.cover}
        name={e.names.cover}
        selected={selection.kind === 'panel' && selection.panel === 'cover'}
        onSelect={() => go(() => select({ kind: 'panel', panel: 'cover' }))}
      />
      {hero ? (
        <LockedRow
          icon={SECTION_ICONS.hero}
          name={e.names.hero}
          selected={isSelected(hero.id)}
          onSelect={() => go(() => select({ kind: 'section', id: hero.id }))}
          flagged={flagged.has(hero.id)}
        />
      ) : null}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: { draggable: d.instructions } }}
      >
        <SortableContext items={middle.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {middle.map((s) => {
            const index = doc.sections.indexOf(s);
            return (
              <SortableRow
                key={s.id}
                section={s}
                name={sectionName(s, e, locale)}
                selected={isSelected(s.id)}
                onSelect={() => go(() => select({ kind: 'section', id: s.id }))}
                onToggle={(on) =>
                  apply(
                    (doc) => ({
                      ...doc,
                      sections: doc.sections.map((x, i) => (i === index ? { ...x, enabled: on } : x)),
                    }),
                    null,
                  )
                }
                flagged={flagged.has(s.id)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      {footer ? (
        <LockedRow
          icon={SECTION_ICONS.footer}
          name={e.names.footer}
          selected={isSelected(footer.id)}
          onSelect={() => go(() => select({ kind: 'section', id: footer.id }))}
          flagged={flagged.has(footer.id)}
        />
      ) : null}
    </ul>
  );
}

function PanelList({
  label,
  panels,
  onNavigate,
}: {
  label: string;
  panels: readonly PanelId[];
  onNavigate?: () => void;
}) {
  const { selection, select } = useEditor();
  const { t } = useUi();
  return (
    <ul aria-label={label} className="flex flex-col gap-0.5">
      {panels.map((panel) => {
        const selected = selection.kind === 'panel' && selection.panel === panel;
        return (
          <RowShell key={panel} selected={selected}>
            <RowButton
              icon={SECTION_ICONS[panel]}
              name={t.editor.names[panel]}
              selected={selected}
              onClick={() => {
                select({ kind: 'panel', panel });
                onNavigate?.();
              }}
            />
          </RowShell>
        );
      })}
    </ul>
  );
}

// ─── add section ───────────────────────────────────────────────────────────────────────────────

/** "+ הוספת סקשן" (dashed, 40px) → a popover grid of section types (icon + name + one line). */
function AddSection({ onAdded }: { onAdded?: () => void }) {
  const { doc, template, defaults, selection, apply, select } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const dir = useDir();
  const [open, setOpen] = useState(false);
  const entries = availableEntries(doc);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={e.rail.addSection}
          className="m-2 flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-input border border-dashed border-line-strong font-semibold text-muted hover:bg-subtle hover:text-ink"
        >
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          <span className={COMPACT_SR}>{e.rail.addSection}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          dir={dir}
          aria-label={e.rail.addSectionTitle}
          className="z-50 w-[min(560px,calc(100vw-24px))] rounded-dialog border border-line bg-surface p-3 shadow-lg motion-safe:data-[state=open]:animate-app-fade-in"
        >
          <p className="px-1 pb-2 text-[13px] font-bold text-muted">{e.rail.addSectionTitle}</p>
          <div className="grid max-h-[60vh] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
            {entries.map((entry) => {
              const Icon = SECTION_ICONS[entry.key];
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => {
                    const section = newSection(entry, doc, template, defaults);
                    const at = insertionIndex(doc, selection.kind === 'section' ? selection.id : null);
                    apply((d) => insertAt(d, 'sections', section, at), null);
                    select({ kind: 'section', id: section.id });
                    setOpen(false);
                    onAdded?.();
                  }}
                  className="flex items-start gap-3 rounded-btn p-2.5 text-start hover:bg-subtle"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-btn bg-subtle text-muted">
                    <Icon aria-hidden size={18} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">{e.names[entry.key]}</span>
                    <span className="block text-[12px] text-muted">{e.catalog[entry.key]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
