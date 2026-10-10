'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage: nothing for the image optimizer to cache */

import { ChevronLeft, ChevronRight, Heart, Maximize2, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AI_PHOTOS_GUEST } from '@/lib/i18n/ai-photos-guest';
import type { FeedItem, Likes } from '../../types';
import { fmt, useGuestText } from '../guest-text';
import { hueOf } from './StoriesTray';
import { frameRatio, type Post } from './posts';
import { ago } from './stories';

/** A person's circle in a post's header: their initial on a colour of their own in the event's ring. */
function Avatar({ name, seed, host }: { name: string | null; seed: string; host: boolean }) {
  const hue = hueOf(seed);
  const initial = name ? (Array.from(name.trim())[0] ?? '').toLocaleUpperCase() : '';
  return (
    <span
      aria-hidden
      className="gallery-ring grid size-[38px] shrink-0 place-items-center rounded-full p-[2px]"
    >
      <span
        className="grid size-full place-items-center rounded-full border-2 border-surface text-[14px] font-bold"
        style={{ background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 40% 30%)` }}
      >
        {host ? (
          <Heart className="size-4 fill-current" />
        ) : initial ? (
          <span className="font-display">{initial}</span>
        ) : (
          <User className="size-4" />
        )}
      </span>
    </span>
  );
}

/**
 * A post of the feed, as on Instagram: who shared it and when, its photos and videos (several: a
 * swipe — or the arrows — between them, with dots and "2 of 5"), and a heart. A double tap on a photo
 * likes it with a heart over the photo; the heart button likes and unlikes, and says how many did.
 * Its photos open full screen.
 */
export function FeedPost({
  post,
  author,
  likes,
  fresh,
  onLike,
  onOpen,
}: {
  post: Post;
  /** the name shown (a guest's own, "Guest 2", or the hosts) */
  author: string;
  likes: Likes | undefined;
  fresh: boolean;
  onLike(on: boolean): void;
  /** full screen, at this item */
  onOpen(item: FeedItem): void;
}) {
  const { t, plural, number, locale, dir } = useGuestText();
  const P = t.post;
  const [now] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const track = useRef<HTMLUListElement>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const count = post.items.length;
  const liked = !!likes?.mine;
  const n = likes?.n ?? 0;

  // which slide shows (a swipe, the arrows): whichever is nearest the track's start
  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return;
    const onScroll = () => {
      const i = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth));
      setIndex(Math.min(count - 1, Math.max(0, i)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [count]);
  const go = (i: number) => {
    const el = track.current;
    const next = Math.min(count - 1, Math.max(0, i));
    const slide = el?.children[next] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    setIndex(next);
  };

  // a double tap on a photo likes it (never unlikes: that is the heart's job)
  const onTap = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const prev = lastTap.current;
    const at = e.timeStamp;
    if (prev && at - prev.at < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap.current = null;
      setBurst((b) => b + 1);
      if (!liked) onLike(true);
      return;
    }
    lastTap.current = { at, x: e.clientX, y: e.clientY };
  };

  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const arrow =
    'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 [@media(hover:hover)]:grid place-items-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur transition-opacity hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-0';
  const time = ago(post.at, now, locale);
  const current = post.items[index] ?? post.items[0]!;
  // the username the guest asked to be tagged with (their newest)
  const handle = [...post.items].reverse().find((i) => i.instagram)?.instagram ?? null;

  return (
    <article
      aria-label={fmt(P.label, { name: author })}
      data-post={post.key}
      className={`overflow-hidden bg-surface sm:rounded-[18px] sm:border sm:border-line ${
        fresh ? 'motion-safe:animate-[gallery-in_600ms_cubic-bezier(0.22,1,0.36,1)_both]' : ''
      }`}
    >
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={post.name} seed={post.name ?? post.by ?? post.key} host={post.by === 'host'} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold" dir="auto">
            {author}
          </p>
          {handle ? (
            <a
              href={`https://www.instagram.com/${handle}/`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={fmt(t.name.profile, { handle: `@${handle}` })}
              dir="ltr"
              data-instagram={handle}
              className="block truncate text-[12.5px] text-muted hover:text-ink"
            >
              @{handle}
            </a>
          ) : null}
        </div>
        {current.ai ? (
          // an AI photo a guest made with the people of honor (features/ai-photos): said so
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[11px] font-bold text-muted"
            data-ai=""
          >
            <Sparkles aria-hidden className="size-3" />
            {AI_PHOTOS_GUEST[locale].ai}
          </span>
        ) : null}
        {time ? (
          <time className="shrink-0 text-[12.5px] text-muted" dateTime={post.at}>
            {time}
          </time>
        ) : null}
      </header>

      <div className="relative bg-subtle" style={{ aspectRatio: String(frameRatio(post.items[0])) }}>
        <ul
          ref={track}
          className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={count > 1 ? fmt(P.slide, { i: number(index + 1), n: number(count) }) : undefined}
        >
          {post.items.map((item, i) => (
            <li
              key={item.id}
              className="relative size-full shrink-0 snap-start snap-always"
              aria-label={count > 1 ? fmt(P.slide, { i: number(i + 1), n: number(count) }) : undefined}
            >
              {item.kind === 'video' && item.video ? (
                <video
                  src={item.video}
                  poster={item.display ?? item.thumb ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="size-full bg-black object-contain"
                  data-item={item.id}
                />
              ) : (
                <div
                  className="size-full touch-manipulation select-none"
                  onPointerUp={onTap}
                  data-item={item.id}
                  title={P.doubleTap}
                >
                  {item.display || item.thumb ? (
                    <img
                      src={item.display ?? item.thumb!}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* the double tap's heart */}
        {burst ? (
          <span
            key={burst}
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center animate-[like-burst_900ms_ease-out_both] motion-reduce:animate-[like-burst_900ms_steps(1)_both]"
          >
            <Heart className="size-24 fill-white text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]" />
          </span>
        ) : null}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label={P.previous}
              className={`${arrow} start-2.5`}
            >
              <Prev aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === count - 1}
              aria-label={P.next}
              className={`${arrow} end-2.5`}
            >
              <Next aria-hidden className="size-5" />
            </button>
            <span
              aria-hidden
              className="absolute end-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-white tabular-nums"
              dir="ltr"
            >
              {index + 1}/{count}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1 px-1.5 pt-1">
        <button
          type="button"
          onClick={() => onLike(!liked)}
          aria-pressed={liked}
          aria-label={liked ? P.unlike : P.like}
          data-like={post.key}
          className="grid size-11 place-items-center rounded-full transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Heart
            aria-hidden
            key={liked ? 'on' : 'off'}
            className={`size-[27px] ${
              liked
                ? 'fill-[#e5364b] text-[#e5364b] motion-safe:animate-[like-pop_320ms_ease-out]'
                : 'text-ink'
            }`}
            strokeWidth={liked ? 2 : 1.9}
          />
        </button>
        {count > 1 ? (
          <span aria-hidden className="flex flex-1 justify-center gap-1">
            {post.items.map((item, i) => (
              <span
                key={item.id}
                className={`size-1.5 rounded-full transition-colors ${i === index ? 'bg-[var(--gallery-accent)]' : 'bg-line-strong'}`}
              />
            ))}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => onOpen(current)}
          aria-label={P.open}
          className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Maximize2 aria-hidden className="size-5" />
        </button>
      </div>
      <p className="px-3.5 pb-3.5 text-[14px]" aria-live="polite" data-likes={post.key}>
        {n ? (
          <span className="font-semibold">{plural(P.likes, n, { n: number(n) })}</span>
        ) : (
          <span className="text-[13.5px] text-muted">{P.noLikes}</span>
        )}
      </p>
    </article>
  );
}
