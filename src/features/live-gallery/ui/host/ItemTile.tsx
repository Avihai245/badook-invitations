'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { Check, Ellipsis, ImageOff, Play } from 'lucide-react';
import { Badge, IconButton, Menu, cn, type MenuItem } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { HostItem } from '../../types';

export type HostAction = 'publish' | 'hide' | 'reject' | 'delete';

/** "1:07" */
const length = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The actions that make sense for an item in its status (the menu, the viewer). */
export function actionsFor(item: HostItem): HostAction[] {
  switch (item.status) {
    case 'pending':
      return ['publish', 'reject', 'delete'];
    case 'published':
      return ['hide', 'delete'];
    case 'hidden':
    case 'rejected':
      return ['publish', 'delete'];
    default:
      return ['delete'];
  }
}

/** One item in the host's grid: its thumbnail, status when it isn't in the feed, a checkbox and a menu. */
export function ItemTile({
  item,
  selected,
  onSelect,
  onOpen,
  onAction,
}: {
  item: HostItem;
  selected: boolean;
  onSelect(on: boolean): void;
  onOpen(): void;
  onAction(action: HostAction): void;
}) {
  const { t } = useUi();
  const g = t.liveGallery.items;
  const kind = item.kind === 'video' ? g.video : g.photo;
  const who = item.name ?? item.guestName;
  const menu: MenuItem[] = [
    { label: g.open, onSelect: onOpen },
    ...actionsFor(item).map((a): MenuItem => ({
      label:
        a === 'publish'
          ? item.status === 'pending'
            ? g.approve
            : g.show
          : a === 'hide'
            ? g.hide
            : a === 'reject'
              ? g.reject
              : g.delete,
      danger: a === 'delete',
      onSelect: () => onAction(a),
    })),
  ];
  return (
    <li
      className={cn(
        'group relative overflow-hidden rounded-[10px] bg-subtle ring-offset-2 ring-offset-surface',
        selected && 'ring-2 ring-ink',
      )}
      data-item={item.id}
      data-status={item.status}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={[kind, who, item.status !== 'published' ? g.status[item.status] : null]
          .filter(Boolean)
          .join(' · ')}
      >
        {item.thumb ? (
          <img src={item.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center gap-1 text-[11.5px] text-muted">
            <ImageOff aria-hidden className="size-5" />
            {g.noPreview}
          </span>
        )}
      </button>
      {item.kind === 'video' ? (
        <span className="pointer-events-none absolute start-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          <Play aria-hidden className="size-2.5 fill-current" />
          <span dir="ltr">{length(item.durationMs)}</span>
        </span>
      ) : null}
      {item.status !== 'published' ? (
        <Badge
          variant={item.status === 'pending' ? 'warning' : item.status === 'rejected' ? 'danger' : 'neutral'}
          className="pointer-events-none absolute start-1.5 top-1.5 max-w-[calc(100%-44px)] truncate shadow-sm"
        >
          {g.statusShort[item.status]}
        </Badge>
      ) : null}
      <label
        className={cn(
          'absolute end-1.5 top-1.5 grid size-7 cursor-pointer place-items-center rounded-full border border-white/80 bg-black/35 text-white shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100',
          selected ? 'bg-ink opacity-100' : 'opacity-0 max-sm:opacity-100',
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={t.liveGallery.items.select}
        />
        {selected ? <Check aria-hidden className="size-4" /> : null}
      </label>
      <div className="absolute end-1.5 bottom-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Menu
          items={menu}
          trigger={
            <IconButton label={g.menu} size="sm" className="bg-white/90 text-ink shadow-sm hover:bg-white">
              <Ellipsis />
            </IconButton>
          }
        />
      </div>
    </li>
  );
}
