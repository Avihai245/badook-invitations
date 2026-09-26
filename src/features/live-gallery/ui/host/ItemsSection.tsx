'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { Check, EyeOff, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Dialog, Hint, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi } from '@/features/invitations/app/api';
import type { HostItem } from '../../types';
import { MediaViewer } from '../MediaViewer';
import { ItemTile, actionsFor, type HostAction } from './ItemTile';

export type Filter = 'all' | 'pending' | 'published' | 'hidden' | 'rejected';
type Cursor = { at: string; id: string } | null;

interface ItemsPage {
  ok: true;
  items: HostItem[];
  next: Cursor;
  expiresAt: number;
}

/**
 * The host's items: the review queue first (approve / reject each, or all), then everything with a
 * filter by status, selection for doing the same to many, a menu per item, and the full-screen viewer
 * with the item's details and actions. New uploads (live hints) refresh the queue at once and the
 * list when the host is at its top.
 */
export function ItemsSection({
  invitationId,
  initialPending,
  initialItems,
  initialNext,
  version,
  onModerate,
}: {
  invitationId: string;
  initialPending: HostItem[];
  initialItems: HostItem[];
  initialNext: Cursor;
  /** changes when something happened in the gallery (a live hint, an action) */
  version: number;
  onModerate(ids: string[], action: HostAction): Promise<boolean>;
}) {
  const { t, plural, fmt, date, dir } = useUi();
  const g = t.liveGallery.items;
  const r = t.liveGallery.review;
  const h = t.liveGallery.hints;
  const [pending, setPending] = useState(initialPending);
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState<Cursor>(initialNext);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [viewer, setViewer] = useState<{ list: 'pending' | 'items'; index: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const pages = useRef(1);

  const load = useCallback(
    async (status: Filter, before: Cursor) => {
      const q = new URLSearchParams({ status });
      if (before) {
        q.set('beforeAt', before.at);
        q.set('beforeId', before.id);
      }
      const res = await hostApi<ItemsPage>(`/api/invitations/${invitationId}/gallery/items?${q}`);
      return res.ok && res.body ? res.body : null;
    },
    [invitationId],
  );

  // something happened: the queue always, the list when the host is at its top
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load('pending', null).then((p) => p && setPending(p.items));
    if (pages.current === 1)
      void load(filter, null).then((p) => {
        if (!p) return;
        setItems(p.items);
        setNext(p.next);
      });
    // `filter` changes load on their own (below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, load]);

  const changeFilter = async (f: Filter) => {
    setFilter(f);
    setSelected(new Set());
    setLoading(true);
    const p = await load(f, null);
    setLoading(false);
    pages.current = 1;
    if (p) {
      setItems(p.items);
      setNext(p.next);
    }
  };
  const more = async () => {
    if (!next || loading) return;
    setLoading(true);
    const p = await load(filter, next);
    setLoading(false);
    if (!p) return;
    pages.current++;
    setItems((cur) => [...cur, ...p.items.filter((i) => !cur.some((c) => c.id === i.id))]);
    setNext(p.next);
  };

  /** Runs an action and shows its outcome at once (the next refresh confirms it). */
  const act = async (ids: string[], action: HostAction) => {
    if (action === 'delete') return setConfirmDelete(ids);
    if (!(await onModerate(ids, action))) return;
    const status: HostItem['status'] =
      action === 'publish' ? 'published' : action === 'hide' ? 'hidden' : 'rejected';
    const change = (list: HostItem[]) =>
      list
        .map((i) => (ids.includes(i.id) ? { ...i, status, reason: 'host' as const } : i))
        .filter((i) => filter === 'all' || i.status === filter);
    setItems(change);
    setPending((p) => p.filter((i) => !ids.includes(i.id)));
    setSelected(new Set());
  };
  const reallyDelete = async (ids: string[]) => {
    setConfirmDelete(null);
    if (!(await onModerate(ids, 'delete'))) return;
    setItems((list) => list.filter((i) => !ids.includes(i.id)));
    setPending((p) => p.filter((i) => !ids.includes(i.id)));
    setSelected(new Set());
    setViewer(null);
  };

  const viewerList = viewer?.list === 'pending' ? pending : items;
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const s = new Set(cur);
      if (on) s.add(id);
      else s.delete(id);
      return s;
    });
  const actionLabel = (item: HostItem, a: HostAction) =>
    a === 'publish'
      ? item.status === 'pending'
        ? g.approve
        : g.show
      : a === 'hide'
        ? g.hide
        : a === 'reject'
          ? g.reject
          : g.delete;
  const filterOptions = useMemo(
    () =>
      (['all', 'published', 'pending', 'hidden', 'rejected'] as const).map((f) => ({
        value: f,
        label: g.filters[f],
      })),
    [g.filters],
  );

  return (
    <>
      {pending.length ? (
        <section className="mt-8" aria-labelledby="gallery-review" data-testid="gallery-review">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="gallery-review" className="text-[18px] font-bold">
                {r.title} <span className="text-muted tabular-nums">({pending.length})</span>
              </h2>
              <p className="text-[13px] text-muted">{r.body}</p>
            </div>
            <Hint text={h.approveAll}>
              <Button
                icon={<Check />}
                onClick={() =>
                  void act(
                    pending.map((p) => p.id),
                    'publish',
                  )
                }
              >
                {plural(r.approveAll, pending.length)}
              </Button>
            </Hint>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pending.map((item, index) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-card border border-line bg-surface shadow-sm"
                data-item={item.id}
              >
                <button
                  type="button"
                  className="relative block aspect-[4/3] w-full bg-subtle"
                  onClick={() => setViewer({ list: 'pending', index })}
                  aria-label={g.open}
                >
                  {item.thumb ? (
                    <img src={item.thumb} alt="" loading="lazy" className="size-full object-cover" />
                  ) : null}
                </button>
                <div className="p-2.5">
                  <p className="truncate text-[12.5px] text-muted">
                    {item.reason ? g.reasons[item.reason] : g.status.pending}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <Hint text={h.approve}>
                      <Button size="sm" icon={<Check />} onClick={() => void act([item.id], 'publish')}>
                        {g.approve}
                      </Button>
                    </Hint>
                    <Hint text={h.reject}>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<X />}
                        onClick={() => void act([item.id], 'reject')}
                      >
                        {g.reject}
                      </Button>
                    </Hint>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="gallery-items">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="gallery-items" className="text-[18px] font-bold">
            {g.title}
          </h2>
          <Hint text={h.filter}>
            <Segmented
              label={g.filterLabel}
              value={filter}
              onValueChange={(f) => void changeFilter(f)}
              options={filterOptions}
            />
          </Hint>
        </div>
        {items.length ? (
          <ul
            className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
            data-testid="gallery-items"
          >
            {items.map((item, index) => (
              <ItemTile
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onSelect={(on) => toggle(item.id, on)}
                onOpen={() => setViewer({ list: 'items', index })}
                onAction={(a) => void act([item.id], a)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-[14px] text-muted">
            {loading ? g.loading : g.empty[filter]}
          </p>
        )}
        {next ? (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" loading={loading} onClick={() => void more()}>
              {g.more}
            </Button>
          </div>
        ) : null}
      </section>

      {selected.size ? (
        <div
          className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 shadow-lg"
          role="toolbar"
          aria-label={plural(g.selected, selected.size)}
        >
          <span className="px-1 text-[13px] font-semibold tabular-nums">
            {plural(g.selected, selected.size)}
          </span>
          <Hint text={h.approve}>
            <Button size="sm" icon={<Check />} onClick={() => void act([...selected], 'publish')}>
              {g.approve}
            </Button>
          </Hint>
          <Hint text={h.hide}>
            <Button
              size="sm"
              variant="secondary"
              icon={<EyeOff />}
              onClick={() => void act([...selected], 'hide')}
            >
              {g.hide}
            </Button>
          </Hint>
          <Hint text={h.reject}>
            <Button
              size="sm"
              variant="secondary"
              icon={<X />}
              onClick={() => void act([...selected], 'reject')}
            >
              {g.reject}
            </Button>
          </Hint>
          <Hint text={h.delete}>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 />}
              onClick={() => void act([...selected], 'delete')}
            >
              {g.delete}
            </Button>
          </Hint>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {g.clearSelection}
          </Button>
        </div>
      ) : null}

      {viewer && viewerList[viewer.index] ? (
        <MediaViewer
          items={viewerList}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
          dir={dir}
          labels={t.liveGallery.viewer}
          onNearEnd={viewer.list === 'items' && next ? () => void more() : undefined}
          footer={(item) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-[13px] text-white/80">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.status === 'published' ? 'live' : item.status === 'pending' ? 'warning' : 'neutral'
                    }
                  >
                    {g.status[item.status]}
                  </Badge>
                  {item.reason && item.reason !== 'ok' ? <span>{g.reasons[item.reason]}</span> : null}
                </p>
                <p className="mt-1 truncate">
                  {[
                    item.name || item.guestName ? fmt(g.by, { name: (item.name || item.guestName)! }) : null,
                    fmt(g.uploadedAt, {
                      time: date(item.createdAt, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    }),
                    item.originalDone ? null : g.originalPending,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {actionsFor(item).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => void act([item.id], a)}
                    className={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold ${a === 'delete' ? 'bg-danger text-white' : 'bg-white/14 text-white hover:bg-white/24'}`}
                  >
                    {actionLabel(item, a)}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      ) : null}

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={plural(g.deleteTitle, confirmDelete?.length ?? 1)}
        description={g.deleteBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 />}
              onClick={() => confirmDelete && void reallyDelete(confirmDelete)}
            >
              {g.deleteConfirm}
            </Button>
          </>
        }
      />
    </>
  );
}
