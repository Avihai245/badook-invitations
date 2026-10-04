'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { ChevronLeft, ChevronRight, Pause, Play, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { FeedItem } from '../../types';
import { fmt, useGuestText } from '../guest-text';
import { StoryAvatar } from './StoriesTray';
import { ago, type Story } from './stories';

/** How long a photo stays (a video plays to its end). */
export const IMAGE_MS = 5000;
/** A press longer than this is a "hold": the story pauses until it lets go. */
const HOLD_MS = 220;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    setReduced(query.matches);
    const on = () => setReduced(query.matches);
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

interface Cursor {
  key: string;
  id: string;
}

/**
 * The full-screen story viewer: one person's photos and videos in the order they were shared, a bar
 * per item filling as it plays, then on to the next person. Tap the start side to go back and the rest
 * to go on (in Hebrew the start side is the right), hold to pause, swipe sideways for another person,
 * swipe down or Esc to close, arrow keys and Space too. Photos stay five seconds; videos play to the
 * end, muted until asked. With "reduce motion" nothing moves by itself: the next one is a tap away.
 */
export function StoryViewer({
  stories,
  startKey,
  nameOf,
  onClose,
  onWatched,
  canDelete,
  onDelete,
  suspended = false,
}: {
  stories: readonly Story[];
  startKey: string;
  nameOf(story: Story): string;
  onClose(): void;
  /** the last item of a story is on screen: the ring may turn grey */
  onWatched(story: Story): void;
  /** this phone's own uploads can be deleted from here */
  canDelete?: (item: FeedItem) => boolean;
  onDelete?: (item: FeedItem) => void;
  /** something is on top of the viewer (a confirmation): the story waits */
  suspended?: boolean;
}) {
  const { t, locale, dir, number } = useGuestText();
  const S = t.stories;
  const reduced = useReducedMotion();
  // who comes after whom is decided when the viewer opens, so a new arrival never reshuffles it
  const [order] = useState(() => stories.map((s) => s.key));
  const [cursor, setCursor] = useState<Cursor>(() => {
    const first = stories.find((s) => s.key === startKey) ?? stories[0];
    return { key: first?.key ?? startKey, id: first?.items[0]?.id ?? '' };
  });
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(true);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  // bumps to replay the current item (tapping back at the very first one)
  const [replay, setReplay] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [now] = useState(() => Date.now());

  const story = stories.find((s) => s.key === cursor.key);
  const found = story ? story.items.findIndex((i) => i.id === cursor.id) : -1;
  const index = Math.max(0, found);
  const item = story?.items[index];

  const closeRef = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const storyOf = useCallback((key: string) => stories.find((s) => s.key === key), [stories]);
  const start = useCallback((s: Story) => setCursor({ key: s.key, id: s.items[0]!.id }), []);

  /** The next person who still has a story (or the one before), else null. */
  const neighbour = useCallback(
    (from: string, step: 1 | -1): Story | null => {
      for (let o = order.indexOf(from) + step; o >= 0 && o < order.length; o += step) {
        const s = storyOf(order[o]!);
        if (s) return s;
      }
      return null;
    },
    [order, storyOf],
  );

  const advance = useCallback(() => {
    if (!story) return;
    if (index < story.items.length - 1) return setCursor({ key: story.key, id: story.items[index + 1]!.id });
    const next = neighbour(story.key, 1);
    if (next) start(next);
    else onClose();
  }, [story, index, neighbour, start, onClose]);

  const retreat = useCallback(() => {
    if (!story) return;
    if (index > 0) return setCursor({ key: story.key, id: story.items[index - 1]!.id });
    const before = neighbour(story.key, -1);
    if (before) start(before);
    else setReplay((n) => n + 1);
  }, [story, index, neighbour, start]);

  /** Another person (a sideways swipe): the next in the reading direction, or the one before. */
  const otherStory = useCallback(
    (step: 1 | -1) => {
      if (!story) return;
      const s = neighbour(story.key, step);
      if (s) start(s);
      else if (step === 1) onClose();
    },
    [story, neighbour, start, onClose],
  );

  // the person's story is gone (all deleted): on to the next, or out
  useEffect(() => {
    if (story) return;
    const next = neighbour(cursor.key, 1) ?? neighbour(cursor.key, -1);
    if (next) start(next);
    else onClose();
  }, [story, cursor.key, neighbour, start, onClose]);

  // a ring turns grey once the last of a person's items has been on screen
  const last = story ? index === story.items.length - 1 : false;
  const watched = useRef<string | null>(null);
  useEffect(() => {
    if (!story || !last || watched.current === `${story.key}:${story.newestId}`) return;
    watched.current = `${story.key}:${story.newestId}`;
    onWatched(story);
  }, [story, last, onWatched]);

  // the page underneath doesn't scroll; focus goes back to what opened the viewer
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === 'Escape') onClose();
      else if (e.key === forward) advance();
      else if (e.key === back) retreat();
      else if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button, a, video')))
        setPaused((p) => !p);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, advance, retreat, onClose]);

  // an item with nothing to wait for starts at once; the next ones are fetched ahead
  const src = item ? (item.display ?? item.thumb) : null;
  useEffect(() => {
    if (!item) return;
    setVideoProgress(0);
    if (!src && !(item.kind === 'video' && item.video)) setReadyId(item.id);
  }, [item, src]);
  useEffect(() => {
    if (!story) return;
    for (const n of story.items.slice(index + 1, index + 3))
      if (n.kind === 'image' && n.display) new Image().src = n.display;
  }, [story, index]);

  const ready = !!item && readyId === item.id;
  const playing = ready && !paused && !holding && !suspended && !reduced;

  // a video plays and pauses with the story
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (playing) void el.play?.()?.catch?.(() => undefined);
    else el.pause?.();
  }, [playing, item?.id, replay]);

  // ── the gesture: tap = back / on, hold = pause, swipe sideways = another person, swipe down = close ──
  const press = useRef<{
    x: number;
    y: number;
    at: number;
    id: number;
    moved: boolean;
    timer: number;
  } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, video[controls], [data-no-tap]')) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // not every browser lets a pointer be captured
    }
    const timer = window.setTimeout(() => setHolding(true), HOLD_MS);
    press.current = { x: e.clientX, y: e.clientY, at: Date.now(), id: e.pointerId, moved: false, timer };
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) > 10) {
      p.moved = true;
      window.clearTimeout(p.timer);
      setHolding(false);
    }
    if (p.moved) setDrag({ dx, dy });
  };
  const onPointerEnd = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    window.clearTimeout(p.timer);
    setHolding(false);
    setDrag(null);
    if (e.type === 'pointercancel') return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.moved) {
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        // the next person comes from the reading direction's end
        const forward = dir === 'rtl' ? dx > 0 : dx < 0;
        otherStory(forward ? 1 : -1);
      }
      return;
    }
    if (Date.now() - p.at >= HOLD_MS) return; // a hold, not a tap
    const rect = stage.current?.getBoundingClientRect();
    if (rect && (e.clientX < rect.left || e.clientX > rect.right)) return onClose(); // the dark beside the story
    const along = rect && rect.width ? (e.clientX - rect.left) / rect.width : 1;
    const backSide = dir === 'rtl' ? along > 0.67 : along < 0.33;
    if (backSide) retreat();
    else advance();
  };

  if (!story || !item) return null;
  const name = nameOf(story);
  const origin: CSSProperties = { transformOrigin: dir === 'rtl' ? 'right' : 'left' };
  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const control =
    'grid size-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-white';
  const time = ago(item.at, now, locale);
  const isVideo = item.kind === 'video' && !!item.video;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fmt(S.viewerLabel, { name })}
      dir={dir}
      data-testid="story-viewer"
      data-story={story.key}
      className="fixed inset-0 z-[90] flex touch-none items-center justify-center bg-black text-white select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* the story's frame (a tall phone-shaped card on a big screen), with the arrows beside it */}
      <div className="relative h-full w-full sm:aspect-[9/16] sm:h-[min(calc(100svh-24px),900px)] sm:w-auto">
        <div
          ref={stage}
          className="relative size-full overflow-hidden bg-black sm:rounded-[22px]"
          style={
            drag
              ? {
                  transform: `translateY(${Math.max(0, drag.dy) * 0.6}px)`,
                  opacity: 1 - Math.min(0.5, Math.max(0, drag.dy) / 400),
                }
              : undefined
          }
        >
          {/* the picture, blurred, fills what the picture itself does not (a wide photo on a tall screen) */}
          {item.thumb ? (
            <img
              src={item.thumb}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
            />
          ) : null}
          {isVideo ? (
            <video
              ref={video}
              key={`${item.id}-${replay}`}
              src={item.video ?? undefined}
              poster={src ?? undefined}
              muted={muted}
              playsInline
              controls={reduced}
              preload="auto"
              onLoadedData={() => setReadyId(item.id)}
              onError={() => setReadyId(item.id)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setVideoProgress(v.duration ? Math.min(1, v.currentTime / v.duration) : 0);
              }}
              onEnded={advance}
              className="absolute inset-0 size-full object-contain"
            />
          ) : src ? (
            <img
              key={`${item.id}-${replay}`}
              src={src}
              alt=""
              draggable={false}
              onLoad={() => setReadyId(item.id)}
              onError={() => setReadyId(item.id)}
              className="absolute inset-0 size-full object-contain"
            />
          ) : null}

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/65 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent"
          />

          <div className="absolute inset-x-0 top-0 px-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div aria-hidden className="flex gap-1" data-testid="story-progress">
              {story.items.map((it, i) => {
                const state = i < index ? 'done' : i === index ? 'active' : 'todo';
                return (
                  <span
                    key={it.id}
                    data-state={state}
                    className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
                  >
                    {state === 'done' || (state === 'active' && reduced) ? (
                      <span className="absolute inset-0 bg-white" />
                    ) : state === 'active' ? (
                      isVideo ? (
                        <span
                          className="absolute inset-0 bg-white"
                          style={{ ...origin, transform: `scaleX(${videoProgress})` }}
                        />
                      ) : (
                        <span
                          key={`${item.id}-${replay}`}
                          data-testid="story-fill"
                          className="absolute inset-0 bg-white"
                          style={{
                            ...origin,
                            animation: `story-fill ${IMAGE_MS}ms linear forwards`,
                            animationPlayState: playing ? 'running' : 'paused',
                          }}
                          onAnimationEnd={advance}
                        />
                      )
                    ) : null}
                  </span>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <StoryAvatar story={story} size={36} />
              <p className="min-w-0 flex-1 text-[14px] leading-tight drop-shadow">
                <span className="block truncate font-bold">
                  <bdi>{name}</bdi>
                </span>
                {time ? <span className="block text-[12px] text-white/75">{time}</span> : null}
              </p>
              {isVideo ? (
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? S.sound : S.mute}
                  className={control}
                >
                  {muted ? (
                    <VolumeX aria-hidden className="size-5" />
                  ) : (
                    <Volume2 aria-hidden className="size-5" />
                  )}
                </button>
              ) : null}
              {!reduced ? (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? S.play : S.pause}
                  aria-pressed={paused}
                  className={control}
                >
                  {paused ? (
                    <Play aria-hidden className="size-5" />
                  ) : (
                    <Pause aria-hidden className="size-5" />
                  )}
                </button>
              ) : null}
              <button ref={closeRef} type="button" onClick={onClose} aria-label={S.close} className={control}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
          </div>

          {canDelete?.(item) && onDelete ? (
            <div className="absolute inset-x-0 bottom-0 flex justify-end px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/45 px-4 text-[13px] font-semibold text-white backdrop-blur hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
              >
                <Trash2 aria-hidden className="size-4" />
                {t.mine.delete}
              </button>
            </div>
          ) : null}

          <p className="sr-only" aria-live="polite">
            {fmt(S.position, { i: number(index + 1), n: number(story.items.length) })}
          </p>
        </div>
        <button
          type="button"
          onClick={retreat}
          aria-label={S.previous}
          className={`${control} absolute -start-16 top-1/2 -translate-y-1/2 max-sm:hidden`}
        >
          <PrevIcon aria-hidden className="size-6" />
        </button>
        <button
          type="button"
          onClick={advance}
          aria-label={S.next}
          className={`${control} absolute -end-16 top-1/2 -translate-y-1/2 max-sm:hidden`}
        >
          <NextIcon aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
