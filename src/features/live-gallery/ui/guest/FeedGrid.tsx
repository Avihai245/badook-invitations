'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FeedItem } from '../../types';
import { fmt, useGuestText } from '../guest-text';

/** "1:07" */
export function duration(ms: number | null): string | null {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The feed: a grid of square thumbnails, newest first — lazy images, a play mark and length on
 * videos; a tap opens the story view. New arrivals fade in at the top. More loads by itself near the
 * bottom (and with a button, for browsers without IntersectionObserver).
 */
export function FeedGrid({
  items,
  fresh,
  onOpen,
  hasMore,
  loadingMore,
  onMore,
}: {
  items: FeedItem[];
  /** ids that just arrived (they fade in) */
  fresh: ReadonlySet<string>;
  onOpen(index: number): void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore(): void;
}) {
  const { t, number } = useGuestText();
  const sentinel = useRef<HTMLDivElement>(null);
  const onMoreRef = useRef(onMore);
  useEffect(() => {
    onMoreRef.current = onMore;
  }, [onMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onMoreRef.current(),
      {
        rootMargin: '600px 0px',
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, items.length]);

  return (
    <>
      <ul
        className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-5"
        data-testid="gallery-feed"
      >
        {items.map((item, i) => {
          const kind = item.kind === 'video' ? t.item.video : t.item.photo;
          const label = item.name
            ? fmt(t.feed.tileBy, { kind, n: number(items.length - i), name: item.name })
            : fmt(t.feed.tile, { kind, n: number(items.length - i) });
          return (
            <li
              key={item.id}
              className={
                fresh.has(item.id)
                  ? 'motion-safe:animate-[gallery-in_600ms_cubic-bezier(0.22,1,0.36,1)_both]'
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={label}
                data-item={item.id}
                className="group relative block aspect-square w-full overflow-hidden rounded-[6px] bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={240}
                    height={240}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[12px] text-muted">{kind}</span>
                )}
                {item.kind === 'video' ? (
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
                    <Play aria-hidden className="size-3 fill-current" />
                    <span dir="ltr">{duration(item.durationMs)}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <div ref={sentinel} className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onMore}
            disabled={loadingMore}
            className="h-10 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold text-ink shadow-sm disabled:opacity-60"
          >
            {loadingMore ? t.feed.loading : t.feed.more}
          </button>
        </div>
      ) : null}
    </>
  );
}
