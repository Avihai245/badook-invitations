'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage: nothing for the image optimizer to cache */

import { ChevronLeft, ChevronRight, Pin, PinOff, Plus, RotateCcw, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardTitle, Drawer, Hint, IconButton } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { NO_CHOICE, type FilmChoice } from '../select';
import type { FilmItem, FilmView } from '../server/api';
import type { FilmPlan } from '../timeline';

/**
 * The shots in the film, in its order: each with its place, pinned or not, earlier / later, and
 * "remove"; "add shots" opens every photo and video of the gallery to pin in (or bring back what was
 * removed); "reset" undoes the host's choices.
 */
export function ShotsCard({
  view,
  plan,
  choice,
  onChoice,
  dropped,
}: {
  view: FilmView;
  plan: FilmPlan;
  choice: FilmChoice;
  onChoice(update: (c: FilmChoice) => FilmChoice): void;
  dropped: number;
}) {
  const { t, fmt, number, dir } = useUi();
  const S = t.film.shots;
  const [drawer, setDrawer] = useState(false);
  const byId = useMemo(() => new Map(view.items.map((i) => [i.id, i])), [view.items]);
  const shots = plan.shots.filter((s) => s.kind === 'item' && s.id && byId.has(s.id));
  const order = shots.map((s) => s.id!);
  const inFilm = new Set(order);
  const pinned = new Set(choice.pinned);
  const excluded = new Set(choice.excluded);
  const clips = shots.filter((s) => s.media === 'video').length;

  const move = (id: string, by: number) =>
    onChoice((c) => {
      const list = [...order];
      const i = list.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return { ...c, order: list };
    });
  const togglePin = (id: string) =>
    onChoice((c) =>
      c.pinned.includes(id)
        ? { ...c, pinned: c.pinned.filter((x) => x !== id) }
        : { ...c, pinned: [...c.pinned, id], excluded: c.excluded.filter((x) => x !== id) },
    );
  const remove = (id: string) =>
    onChoice((c) => ({
      pinned: c.pinned.filter((x) => x !== id),
      excluded: [...new Set([...c.excluded, id])],
      order: c.order.filter((x) => x !== id),
    }));
  const bringIn = (id: string) =>
    onChoice((c) => ({
      ...c,
      pinned: [...new Set([...c.pinned, id])],
      excluded: c.excluded.filter((x) => x !== id),
    }));
  const touched = choice.pinned.length + choice.excluded.length + choice.order.length > 0;
  // "earlier" points toward the reading start: right in Hebrew, left in English
  const Earlier = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Later = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="film-shots">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle as="h2" className="mb-1">
            {S.title}
          </CardTitle>
          <p className="text-[13px] font-semibold" data-testid="film-shot-count">
            {fmt(S.count, {
              n: number(shots.length),
              photos: number(shots.length - clips),
              clips: number(clips),
              seconds: number(Math.round(plan.duration)),
            })}
          </p>
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-muted">{S.hint}</p>
          {dropped ? (
            <p className="mt-1 text-[12.5px] text-muted">{fmt(S.dropped, { n: number(dropped) })}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Hint text={S.addHint}>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus />}
              onClick={() => setDrawer(true)}
              data-testid="film-add-shots"
            >
              {S.add}
            </Button>
          </Hint>
          {touched ? (
            <Hint text={S.resetHint}>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw />}
                onClick={() => onChoice(() => NO_CHOICE)}
              >
                {S.reset}
              </Button>
            </Hint>
          ) : null}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 xl:grid-cols-5">
        {shots.map((shot, i) => {
          const item = byId.get(shot.id!)!;
          const isPinned = pinned.has(item.id);
          return (
            <li
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface"
              data-testid="film-shot"
              data-id={item.id}
            >
              <div className="relative aspect-square bg-subtle">
                <Thumb item={item} />
                <span className="absolute start-1.5 top-1.5 rounded-full bg-ink/75 px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
                  {number(i + 1)}
                </span>
                {item.kind === 'video' ? (
                  <span className="absolute end-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/75 px-1.5 text-[11px] leading-5 text-white">
                    <Video aria-hidden className="size-3" />
                    <span className="sr-only">{S.video}</span>
                  </span>
                ) : null}
                {isPinned ? (
                  <Badge variant="info" className="absolute start-1.5 bottom-1.5">
                    {S.pinned}
                  </Badge>
                ) : null}
                <span className="absolute end-1.5 bottom-1.5 rounded-full bg-ink/75 px-1.5 text-[11px] leading-5 text-white tabular-nums">
                  {(shot.end - shot.start).toFixed(1)}
                </span>
              </div>
              <div
                className="flex items-center justify-between gap-0.5 px-1 py-1"
                aria-label={fmt(S.number, { n: i + 1 })}
                role="group"
              >
                <IconButton
                  size="sm"
                  label={S.earlier}
                  tooltip
                  disabled={i === 0}
                  onClick={() => move(item.id, -1)}
                >
                  <Earlier />
                </IconButton>
                <IconButton
                  size="sm"
                  label={isPinned ? S.unpin : S.pin}
                  tooltip
                  aria-pressed={isPinned}
                  onClick={() => togglePin(item.id)}
                  data-testid="film-pin"
                >
                  {isPinned ? <PinOff /> : <Pin />}
                </IconButton>
                <IconButton
                  size="sm"
                  label={S.remove}
                  tooltip
                  onClick={() => remove(item.id)}
                  data-testid="film-remove"
                >
                  <X />
                </IconButton>
                <IconButton
                  size="sm"
                  label={S.later}
                  tooltip
                  disabled={i === shots.length - 1}
                  onClick={() => move(item.id, 1)}
                >
                  <Later />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>

      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title={S.drawerTitle}
        description={S.drawerBody}
        closeLabel={S.close}
      >
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="film-drawer">
          {view.items.map((item) => {
            const on = inFilm.has(item.id);
            const out = excluded.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  className={`relative block aspect-square w-full overflow-hidden rounded-input border-2 bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${on ? 'border-ink' : 'border-transparent'} ${out ? 'opacity-50' : ''}`}
                  onClick={() => (on ? remove(item.id) : bringIn(item.id))}
                  data-testid="film-drawer-item"
                  data-id={item.id}
                >
                  <Thumb item={item} />
                  {on ? (
                    <span className="absolute inset-x-1 bottom-1 rounded bg-ink/80 px-1 text-[11px] text-white">
                      {S.inFilm}
                    </span>
                  ) : out ? (
                    <span className="absolute inset-x-1 bottom-1 rounded bg-ink/60 px-1 text-[11px] text-white">
                      {S.excluded}
                    </span>
                  ) : null}
                  {item.kind === 'video' ? (
                    <Video aria-hidden className="absolute end-1 top-1 size-4 text-white drop-shadow" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </Card>
  );
}

function Thumb({ item }: { item: FilmItem }) {
  const src = item.thumb ?? item.display;
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="absolute inset-0 size-full object-cover"
    />
  ) : null;
}
