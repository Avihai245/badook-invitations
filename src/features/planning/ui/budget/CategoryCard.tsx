'use client';

import { ChevronDown, Ellipsis, Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge, Button, Card, IconButton, Menu, cn, type BadgeVariant } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryOver, itemAmount, itemVariance, type CategoryRow } from '../../model/budget-view';
import type { ItemStatus } from '../../model/categories';
import type { PlanItem } from '../../model/plan';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { BasisEditor } from './BasisEditor';
import { Fill } from './Fill';
import { useBudget } from './useBudget';

const STATUS_VARIANT: Record<ItemStatus, BadgeVariant> = {
  estimate: 'draft',
  quoted: 'info',
  booked: 'neutral',
  paid: 'live',
};

/** The thin bar of a category: paid | committed and not paid, against what was planned (or what is committed, if more). */
function CategoryBar({
  planned,
  committed,
  paid,
  label,
}: {
  planned: number;
  committed: number;
  paid: number;
  label: string;
}) {
  const whole = Math.max(planned, committed, 1);
  const share = (n: number) => `${Math.max(0, Math.min(100, (n / whole) * 100))}%`;
  const done = Math.min(paid, committed);
  return (
    <span role="img" aria-label={label} className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-subtle">
      <span className="h-full bg-success" style={{ width: share(done) }} />
      <span className="h-full bg-chart-1" style={{ width: share(committed - done) }} />
    </span>
  );
}

/** One category: planned, committed and paid at a glance, opening into how its cost is set and its items. */
export function CategoryCard({
  row,
  past,
  open,
  onToggle,
  onAddItem,
  onOpenItem,
}: {
  row: CategoryRow;
  past: boolean;
  open: boolean;
  onToggle: () => void;
  onAddItem: (categoryId: string) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const { t, plural, number, fmt } = useUi();
  const T = t.planning.budget;
  const C = T.categories;
  const { view } = usePlan();
  const { deleteCategory, deleteItem, saveItem } = useBudget();
  const { category, items, totals } = row;
  const id = useId();
  const [editing, setEditing] = useState(false);
  const name = category.name ?? (category.key ? t.planning.categories[category.key] : '');
  const over = past ? 0 : categoryOver(totals);
  const vatMode = view.settings?.vatMode ?? 'included';
  const vatPct = view.settings?.vatPct ?? 18;
  const basisLine =
    category.costBasis === 'fixed' || category.unitPrice === null ? (
      T.basisEditor.basis.fixed
    ) : (
      <>
        {T.basisEditor.basis[category.costBasis]} · <Money value={category.unitPrice} />
      </>
    );

  return (
    <Card asChild>
      <section aria-label={name} data-testid="budget-category">
        <div className="flex items-start gap-1 ps-1 pe-2 pt-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            aria-label={fmt(open ? C.collapse : C.expand, { name })}
            onClick={onToggle}
            className="min-h-11 min-w-0 flex-1 rounded-card px-3 py-2.5 text-start"
          >
            <span className="flex items-center gap-2">
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none',
                  open && 'rotate-180',
                )}
              />
              <span className="truncate text-[15px] font-bold">{name}</span>
              {category.required && !past ? (
                <span className="inline-flex" title={C.requiredHint}>
                  <Badge variant="info">{C.required}</Badge>
                </span>
              ) : null}
              <span className="ms-auto shrink-0 text-[12.5px] text-muted">
                {plural(C.items, items.length, { n: number(items.length) })}
              </span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
              <span>
                <Fill
                  text={C.of}
                  vars={{
                    committed: <Money value={totals.committed} className="font-bold" />,
                    planned: <Money value={totals.planned} />,
                  }}
                />
              </span>
              <span className="text-muted">
                {T.kpi.paid} <Money value={totals.paid} />
              </span>
            </span>
            <CategoryBar
              planned={totals.planned}
              committed={totals.committed}
              paid={totals.paid}
              label={fmt(C.bar, {
                committed: String(totals.committed),
                planned: String(totals.planned),
              })}
            />
            {over > 0 ? (
              <span className="mt-1.5 block text-[12.5px] text-warning">
                <Fill text={C.over} vars={{ amount: <Money value={over} className="font-semibold" /> }} />
              </span>
            ) : null}
          </button>
          <Menu
            trigger={
              <IconButton label={fmt(C.menu, { name })} className="mt-1.5 min-h-11 min-w-11">
                <Ellipsis />
              </IconButton>
            }
            items={[
              ...(!past
                ? [
                    {
                      label: C.editBasis,
                      icon: <Pencil />,
                      onSelect: () => {
                        if (!open) onToggle();
                        setEditing(true);
                      },
                    },
                  ]
                : []),
              { label: T.addItem, icon: <Plus />, onSelect: () => onAddItem(category.id) },
              { type: 'separator' as const },
              {
                label: C.delete,
                icon: <Trash2 />,
                danger: true,
                onSelect: () => void deleteCategory(category, name),
              },
            ]}
          />
        </div>

        {open ? (
          <div id={id} className="flex flex-col gap-3 border-t border-line p-4">
            {!past ? (
              editing ? (
                <BasisEditor category={category} planned={totals.planned} onDone={() => setEditing(false)} />
              ) : (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <p className="min-w-0">
                    <span className="text-muted">{basisLine}</span>
                    <span className="mx-1.5 text-faint" aria-hidden>
                      ·
                    </span>
                    <Fill
                      text={C.planned}
                      vars={{ amount: <Money value={totals.planned} className="font-semibold" /> }}
                    />
                  </p>
                  <Button variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEditing(true)}>
                    {C.editBasis}
                  </Button>
                </div>
              )
            ) : null}

            {items.length === 0 ? (
              <p className="text-[13.5px] text-muted">{C.noItems}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-btn border border-line">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    vatMode={vatMode}
                    vatPct={vatPct}
                    onOpen={() => onOpenItem(item.id)}
                    // "סגור": the deal is done — what it costs is counted from now on
                    onClose={() => void saveItem({ ...item, status: 'booked', attachments: undefined })}
                    onDelete={() => void deleteItem(item)}
                  />
                ))}
              </ul>
            )}
            <div>
              <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => onAddItem(category.id)}>
                {T.addItem}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </Card>
  );
}

function ItemRow({
  item,
  vatMode,
  vatPct,
  onOpen,
  onClose,
  onDelete,
}: {
  item: PlanItem;
  vatMode: 'none' | 'included' | 'excluded';
  vatPct: number;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t, fmt } = useUi();
  const T = t.planning.budget;
  const amount = itemAmount(item, vatMode, vatPct);
  const variance = itemVariance(item, vatMode, vatPct);
  const hasAmount = item.final !== null || item.quoted !== null || item.estimate !== null;
  return (
    <li className="flex items-center gap-1 ps-1 pe-1.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={fmt(T.item.open, { title: item.title })}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-btn px-2.5 py-2 text-start hover:bg-row-hover"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{item.title}</span>
          {variance && variance.delta !== 0 ? (
            <span className={cn('block text-[12px]', variance.delta > 0 ? 'text-warning' : 'text-success')}>
              <Fill
                text={variance.delta > 0 ? T.item.variance.over : T.item.variance.under}
                vars={{ amount: <Money value={Math.abs(variance.delta)} /> }}
              />
            </span>
          ) : null}
        </span>
        <Badge variant={STATUS_VARIANT[item.status]}>{T.status[item.status]}</Badge>
        <span className="w-[76px] shrink-0 text-end text-[14px] font-semibold">
          {hasAmount ? <Money value={amount} /> : <span className="text-muted">—</span>}
        </span>
      </button>
      <Menu
        trigger={
          <IconButton label={fmt(T.item.menu, { title: item.title })} className="min-h-11 min-w-11">
            <Ellipsis />
          </IconButton>
        }
        items={[
          ...(item.status === 'estimate' || item.status === 'quoted'
            ? [{ label: T.item.markBooked, icon: <Handshake />, onSelect: onClose }]
            : []),
          { label: t.planning.common.edit, icon: <Pencil />, onSelect: onOpen },
          { type: 'separator' as const },
          { label: t.planning.common.delete, icon: <Trash2 />, danger: true, onSelect: onDelete },
        ]}
      />
    </li>
  );
}
