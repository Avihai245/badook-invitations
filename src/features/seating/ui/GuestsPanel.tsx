'use client';

import {
  Accessibility,
  Armchair,
  DoorOpen,
  GripVertical,
  Link2,
  Mic2,
  MoreHorizontal,
  Music2,
  Search,
  SlidersHorizontal,
  UserMinus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Badge,
  Button,
  Hint,
  IconButton,
  Input,
  Menu,
  Segmented,
  Select,
  Switch,
  cn,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { sortKey } from '../export';
import { unitCategory, unitSettings, type Plan, type SeatingTable, type UnitInfo } from '../model';

export type GuestFilter = 'all' | 'unseated' | 'seated';
const NO_CATEGORY = '\u0000none';

/** Who the list shows: those coming, those who haven't replied (when asked, or already seated), and
 * anyone who declined but still holds a seat (to free it). */
export function listedUnits(plan: Plan, units: readonly UnitInfo[], showPending: boolean): UnitInfo[] {
  return units.filter(
    (u) =>
      (u.status === 'confirmed' && u.seats > 0) ||
      (u.status === 'pending' && (showPending || !!plan.assignments[u.id])) ||
      (u.status === 'declined' && !!plan.assignments[u.id]),
  );
}

/**
 * The guest list beside the map: every family (unit) with its size, category and wishes; search and
 * filters; drag a family by its handle onto a table, or "Seat" to pick a table (the keyboard and touch
 * way); a seated family shows its table.
 */
export function GuestsPanel({
  id,
  plan,
  units,
  tablesById,
  showPending,
  onShowPending,
  onSeat,
  onUnseat,
  onSettings,
  onRules,
  onShowTable,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  id: string;
  plan: Plan;
  units: readonly UnitInfo[];
  tablesById: ReadonlyMap<string, SeatingTable>;
  showPending: boolean;
  onShowPending(on: boolean): void;
  onSeat(unitId: string): void;
  onUnseat(unitId: string): void;
  onSettings(unitId: string): void;
  onRules(): void;
  onShowTable(tableId: string): void;
  onDragStart(unitId: string, x: number, y: number): void;
  onDragMove(x: number, y: number): void;
  onDragEnd(x: number, y: number, cancelled: boolean): void;
}) {
  const { t, fmt, plural, number, locale } = useUi();
  const s = t.seating;
  const g = s.guests;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('all');
  const [category, setCategory] = useState('');
  const drag = useRef<{ unitId: string; pointerId: number; x: number; y: number; active: boolean } | null>(
    null,
  );

  const listed = useMemo(() => listedUnits(plan, units, showPending), [plan, units, showPending]);
  const categories = useMemo(
    () =>
      [...new Set(listed.map((u) => unitCategory(plan, u)).filter((c): c is string => !!c))].sort((a, b) =>
        a.localeCompare(b, locale),
      ),
    [listed, plan, locale],
  );
  const collator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base', numeric: true }), [locale]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed
      .filter((u) => {
        const seated = !!plan.assignments[u.id];
        if (filter === 'seated' && !seated) return false;
        if (filter === 'unseated' && seated) return false;
        const c = unitCategory(plan, u);
        if (category === NO_CATEGORY ? !!c : category && c !== category) return false;
        if (!q) return true;
        return [u.name, ...u.people, c ?? ''].some((x) => x.toLowerCase().includes(q));
      })
      .sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)));
  }, [listed, plan, filter, category, query, collator]);

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, unitId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { unitId, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  };
  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
      d.active = true;
      onDragStart(d.unitId, e.clientX, e.clientY);
    }
    if (d.active) onDragMove(e.clientX, e.clientY);
  };
  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.active) onDragEnd(e.clientX, e.clientY, cancelled);
  };

  const prefIcons = (u: UnitInfo) => {
    const st = unitSettings(plan, u.id);
    const icons: { key: string; icon: typeof Mic2; far: boolean; label: string }[] = [];
    if (st.prefs.stage)
      icons.push({ key: 'stage', icon: Mic2, far: st.prefs.stage < 0, label: s.unit.zones.stage });
    if (st.prefs.dance)
      icons.push({ key: 'dance', icon: Music2, far: st.prefs.dance < 0, label: s.unit.zones.dance });
    if (st.prefs.exit)
      icons.push({ key: 'exit', icon: DoorOpen, far: st.prefs.exit < 0, label: s.unit.zones.exit });
    return { icons, accessible: st.accessible };
  };
  const rulesCount = plan.rules.length;

  return (
    <section aria-label={g.title} className="flex h-full min-h-0 flex-col" data-testid="guests-panel">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-bold">
            {g.title}{' '}
            <span className="text-[12.5px] font-normal text-muted tabular-nums">
              {fmt(g.count, { shown: number(rows.length), total: number(listed.length) })}
            </span>
          </h2>
          <Hint text={g.rulesHint}>
            <Button
              size="sm"
              variant="secondary"
              icon={<Link2 />}
              onClick={onRules}
              data-testid="rules-button"
            >
              {g.rulesButton}
              {rulesCount ? (
                <span className="rounded-full bg-subtle px-1.5 text-[11.5px] tabular-nums">
                  {number(rulesCount)}
                </span>
              ) : null}
            </Button>
          </Hint>
        </div>
        <Input
          type="search"
          icon={<Search />}
          placeholder={g.search}
          aria-label={g.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={g.filters.label}
            value={filter}
            onValueChange={setFilter}
            options={(['all', 'unseated', 'seated'] as const).map((v) => ({ value: v, label: g.filters[v] }))}
          />
          {categories.length ? (
            // too narrow beside the filter for its label: it takes the next row
            <Select
              aria-label={g.category}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 min-w-0 text-[13px]"
              wrapperClassName="min-w-[8.5rem] flex-1"
            >
              <option value="">{g.allCategories}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NO_CATEGORY}>{g.noCategory}</option>
            </Select>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <Switch label={g.showPending} checked={showPending} onCheckedChange={onShowPending} />
          <Hint text={g.showPendingHint}>
            <span>{g.showPending}</span>
          </Hint>
        </label>
      </div>

      {listed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <Users aria-hidden className="size-8 text-faint" />
          <p className="text-[13px] text-muted">{g.empty}</p>
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/app/invitations/${id}/guests`}>{g.toGuestList}</Link>
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-muted">{g.emptyFilter}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="guest-units">
          {rows.map((u) => {
            const at = plan.assignments[u.id];
            const table = at ? tablesById.get(at.tableId) : undefined;
            const c = unitCategory(plan, u);
            const { icons, accessible } = prefIcons(u);
            return (
              <li
                key={u.id}
                data-unit-id={u.id}
                data-unit-name={u.name}
                className="flex items-center gap-1.5 border-b border-line px-2 py-2 [contain-intrinsic-size:auto_56px] [content-visibility:auto]"
              >
                <Hint text={g.drag}>
                  <button
                    type="button"
                    aria-label={fmt(g.dragAria, { name: u.name })}
                    tabIndex={-1}
                    className="grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-[6px] text-faint hover:bg-subtle hover:text-muted active:cursor-grabbing"
                    onPointerDown={(e) => startDrag(e, u.id)}
                    onPointerMove={moveDrag}
                    onPointerUp={(e) => endDrag(e, false)}
                    onPointerCancel={(e) => endDrag(e, true)}
                    data-testid="unit-drag"
                  >
                    <GripVertical aria-hidden className="size-4" />
                  </button>
                </Hint>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold">
                    <bdi className="truncate">{u.name}</bdi>
                    <span className="shrink-0 rounded-full bg-subtle px-1.5 text-[11.5px] font-semibold text-ink/80 tabular-nums">
                      {number(u.seats)}
                    </span>
                  </p>
                  <p className="flex min-w-0 flex-wrap items-center gap-1 text-[11.5px] text-muted">
                    {u.status !== 'confirmed' ? (
                      <Badge variant={u.status === 'declined' ? 'danger' : 'draft'}>
                        {g.status[u.status]}
                      </Badge>
                    ) : null}
                    {c ? <span className="truncate">{c}</span> : null}
                    {icons.length || accessible ? (
                      <span className="inline-flex items-center gap-0.5" aria-label={g.prefsAria}>
                        {icons.map(({ key, icon: Icon, far, label }) => (
                          <Icon
                            key={key}
                            aria-label={`${far ? s.unit.far : s.unit.near}: ${label}`}
                            className={cn('size-3.5', far ? 'text-faint' : 'text-brand')}
                            strokeWidth={far ? 1.5 : 2.2}
                          />
                        ))}
                        {accessible ? (
                          <Accessibility aria-label={s.unit.accessible} className="size-3.5 text-[#2563eb]" />
                        ) : null}
                      </span>
                    ) : null}
                  </p>
                </div>
                {table ? (
                  <button
                    type="button"
                    onClick={() => onShowTable(table.id)}
                    className="shrink-0 rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand-deep hover:bg-[#efe0cc]"
                    data-testid="unit-table"
                  >
                    {fmt(g.atTable, { number: table.number })}
                  </button>
                ) : u.status !== 'declined' ? (
                  <Hint text={g.seatHint}>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Armchair />}
                      onClick={() => onSeat(u.id)}
                      data-testid="unit-seat"
                    >
                      {g.seat}
                    </Button>
                  </Hint>
                ) : null}
                <Menu
                  trigger={
                    <IconButton label={fmt(g.more, { name: u.name })} size="sm">
                      <MoreHorizontal />
                    </IconButton>
                  }
                  items={[
                    ...(u.status !== 'declined'
                      ? [{ label: table ? g.move : g.seat, icon: <Armchair />, onSelect: () => onSeat(u.id) }]
                      : []),
                    { label: g.settings, icon: <SlidersHorizontal />, onSelect: () => onSettings(u.id) },
                    ...(table
                      ? [{ label: g.unseat, icon: <UserMinus />, onSelect: () => onUnseat(u.id) }]
                      : []),
                  ]}
                />
                <span className="sr-only">{plural(g.people, u.seats)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
