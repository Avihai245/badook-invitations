'use client';

import { CircleCheck, MoreHorizontal, PanelRight, Trash2 } from 'lucide-react';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { Badge, Menu, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { VendorStatus } from '../../model/categories';
import type { PlanVendor } from '../../model/plan';
import { Money } from '../Money';
import { STATUSES } from './helpers';
import { StarsDisplay } from './Stars';

/**
 * One vendor as a card: its name (the way to the details), its category and quote, a way to compare
 * it, its rating, and a menu with the same moves a drag does (move to a status, close, delete).
 */
export function VendorCard({
  vendor,
  selected,
  onToggleCompare,
  onOpen,
  onMove,
  onClose,
  onDelete,
  handle,
  liRef,
  style,
  overlay = false,
  dragging = false,
}: {
  vendor: PlanVendor;
  selected: boolean;
  onToggleCompare: () => void;
  onOpen: () => void;
  onMove: (status: VendorStatus) => void;
  onClose: () => void;
  onDelete: () => void;
  /** the grip a drag starts from (the board's cards only) */
  handle?: ReactNode;
  liRef?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  /** the copy that follows the pointer while dragging: looks like the card, does nothing */
  overlay?: boolean;
  /** the card being dragged, left where it was */
  dragging?: boolean;
}) {
  const { t, fmt } = useUi();
  const V = t.planning.vendors;
  const C = V.card;
  const category = vendor.category ? t.planning.categories[vendor.category] : null;

  return (
    <li
      ref={liRef}
      style={style}
      className={cn(
        'rounded-card border bg-surface shadow-sm',
        selected ? 'border-brand-line ring-1 ring-brand-line' : 'border-line',
        dragging && 'opacity-40',
        overlay && 'shadow-lg ring-1 ring-line-strong',
      )}
    >
      <div className="flex items-start gap-0.5 ps-1 pe-1 pt-1">
        {handle}
        <button
          type="button"
          onClick={onOpen}
          disabled={overlay}
          aria-label={fmt(C.open, { name: vendor.name })}
          className="min-h-11 min-w-0 flex-1 rounded-btn px-2 py-1.5 text-start hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="line-clamp-2 block text-[14.5px] leading-snug font-semibold break-words text-ink">
            {vendor.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            {category ? <Badge>{category}</Badge> : null}
            {vendor.quoteAmount !== null ? (
              <Money value={vendor.quoteAmount} className="font-semibold text-ink" />
            ) : null}
          </span>
        </button>
        {overlay ? null : (
          <Menu
            trigger={
              <button
                type="button"
                aria-label={fmt(C.menu, { name: vendor.name })}
                className="grid size-11 shrink-0 place-items-center rounded-btn text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus lg:size-9"
              >
                <MoreHorizontal aria-hidden className="size-[18px]" strokeWidth={1.75} />
              </button>
            }
            items={[
              { label: C.details, icon: <PanelRight />, onSelect: onOpen },
              {
                type: 'radio',
                label: C.moveTo,
                value: vendor.status,
                options: STATUSES.map((s) => ({ value: s, label: V.statuses[s] })),
                onValueChange: (s) => onMove(s as VendorStatus),
              },
              ...(vendor.status !== 'booked'
                ? [{ label: C.closeVendor, icon: <CircleCheck />, onSelect: onClose }]
                : []),
              { type: 'separator' as const },
              { label: C.delete, icon: <Trash2 />, danger: true, onSelect: onDelete },
            ]}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 ps-3 pe-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={selected}
            disabled={overlay}
            onChange={onToggleCompare}
            aria-label={fmt(C.compareLabel, { name: vendor.name })}
            className="size-4 shrink-0 accent-ink"
          />
          {C.compare}
        </label>
        <StarsDisplay value={vendor.rating} />
      </div>
    </li>
  );
}
