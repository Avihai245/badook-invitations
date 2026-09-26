'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GALLERY } from '../../config';
import { galleryApi } from '../../client/api';
import { useLiveRefresh } from '@/lib/live/client';
import type { ProjectorPageData } from '../../server/pages';
import { advance, arrive, depart, EMPTY_SHOW, type SlideState } from '../../slideshow';
import type { FeedItem, GalleryState, RealtimeInfo } from '../../types';
import { guestText, type GuestLocale } from '../guest-text';

/**
 * The venue's screen (/e/<slug>/projector?t=…): full screen, no controls, only what is published.
 * A slideshow goes round the gallery; a photo that has just arrived (a Realtime hint, or polling
 * while that connection is down) gets on screen within seconds with its own entrance. It reconnects
 * by itself, keeps the screen awake (where the browser allows), hides the cursor, and a click goes
 * full screen.
 */

interface ProjectorResponse {
  state: GalleryState;
  now: string;
  items: FeedItem[];
  removed: string[];
  realtime: RealtimeInfo | null;
  expiresAt: number;
}

interface Slide {
  item: FeedItem;
  fresh: boolean;
  /** increases per slide: a new element each time (the animation replays) */
  key: number;
}

function preload(item: FeedItem): Promise<void> {
  const src = item.kind === 'video' ? (item.display ?? item.thumb) : (item.display ?? item.thumb);
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    const timer = setTimeout(done, 3_000);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      done();
    };
    img.src = src;
  });
}

export function Projector({ data, token }: { data: ProjectorPageData; token: string }) {
  const locale = data.event.defaultLocale as GuestLocale;
  const text = useMemo(() => guestText(locale), [locale]);
  const { t } = text;
  const title = data.event.titles[locale] || data.event.title;

  const [state, setState] = useState<GalleryState>(data.state);
  const [invalid, setInvalid] = useState(false);
  const [items, setItems] = useState<FeedItem[]>(data.items.slice(0, GALLERY.projector.maxItems));
  const [realtime, setRealtime] = useState<RealtimeInfo | null>(data.realtime);
  const [slides, setSlides] = useState<Slide[]>([]);
  const since = useRef(data.now);
  const expires = useRef(data.expiresAt);
  const show = useRef<SlideState>(EMPTY_SHOW);
  // what the slideshow reads between renders (kept in step with `items`)
  const itemsRef = useRef(items);
  const shownAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  // ── the slides ──
  const nextSlide = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const list = itemsRef.current;
    const step = advance(
      show.current,
      list.map((i) => i.id),
    );
    show.current = step.state;
    const item = step.id ? list.find((i) => i.id === step.id) : undefined;
    if (!item) {
      setSlides([]);
      return;
    }
    await preload(item);
    const slide: Slide = { item, fresh: step.fresh, key: ++counter.current };
    setSlides((cur) => [...cur.slice(-1), slide]);
    shownAt.current = Date.now();
    // one photo alone stays; a video advances when it ends (or at its cap)
    if (list.length > 1 || show.current.fresh.length)
      timer.current = setTimeout(
        () => void nextSlide(),
        item.kind === 'video' ? GALLERY.projector.videoMaxMs : GALLERY.projector.slideMs,
      );
  }, []);

  useEffect(() => {
    if (items.length && !show.current.current) void nextSlide();
    if (!items.length && show.current.current) {
      show.current = EMPTY_SHOW;
      setSlides([]);
    }
  }, [items.length, nextSlide]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // ── the data ──
  const fetchFeed = useCallback(
    async (sinceIso: string | null) => {
      const res = await galleryApi<ProjectorResponse>('/api/gallery/projector', {
        p: token,
        ...(sinceIso ? { since: sinceIso } : {}),
      });
      if (res.status === 404) setInvalid(true);
      return res.ok && res.body ? res.body : null;
    },
    [token],
  );

  const reload = useCallback(async () => {
    const body = await fetchFeed(null);
    if (!body) return;
    since.current = body.now;
    expires.current = body.expiresAt;
    setState(body.state);
    if (body.realtime) setRealtime(body.realtime);
    const list = body.items.slice(0, GALLERY.projector.maxItems);
    // photos not on screen before arrive with their entrance
    const known = new Set(itemsRef.current.map((i) => i.id));
    const added = list.filter((i) => !known.has(i.id)).map((i) => i.id);
    const removed = itemsRef.current.filter((i) => !list.some((l) => l.id === i.id)).map((i) => i.id);
    const gone = depart(
      show.current,
      itemsRef.current.map((i) => i.id),
      removed,
    );
    show.current = itemsRef.current.length ? arrive(gone.state, added) : gone.state;
    itemsRef.current = list;
    setItems(list);
    if (gone.skip) void nextSlide();
  }, [fetchFeed, nextSlide]);

  const refresh = useCallback(
    async (kind: string) => {
      const stale = Date.now() > expires.current - GALLERY.urls.refreshBeforeSeconds * 1000;
      if (kind === 'settings' || stale) return void reload();
      const body = await fetchFeed(since.current);
      if (!body) return;
      since.current = body.now;
      setState(body.state);
      const known = new Set(itemsRef.current.map((i) => i.id));
      const added = body.items.filter((i) => !known.has(i.id));
      const gone = depart(
        show.current,
        itemsRef.current.map((i) => i.id),
        body.removed,
      );
      const removed = new Set(body.removed);
      const list = [...added, ...itemsRef.current.filter((i) => !removed.has(i.id))].slice(
        0,
        GALLERY.projector.maxItems,
      );
      show.current = arrive(
        gone.state,
        added.map((i) => i.id),
      );
      itemsRef.current = list;
      setItems(list);
      // the one on screen was taken down, or a new photo waits and the current one has had its moment
      if (gone.skip || (added.length && Date.now() - shownAt.current >= GALLERY.projector.freshAfterMs))
        void nextSlide();
      else if (added.length && !timer.current) {
        timer.current = setTimeout(() => void nextSlide(), GALLERY.projector.freshAfterMs);
      }
    },
    [fetchFeed, reload, nextSlide],
  );

  useLiveRefresh(invalid ? null : realtime, (kind) => void refresh(kind), GALLERY.live.pollProjectorMs);

  // ── the screen: awake, no cursor, full screen on a click ──
  const [cursor, setCursor] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const wl = (
      navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    ).wakeLock;
    const acquire = async () => {
      if (!wl || document.visibilityState !== 'visible') return;
      try {
        lock = await wl.request('screen');
      } catch {
        // refused (power saving, an old browser): the screen's own settings decide
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener('visibilitychange', onVisible);
    let idle: ReturnType<typeof setTimeout> | null = null;
    const onMove = () => {
      setCursor(true);
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => setCursor(false), 1_500);
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('mousemove', onMove);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('fullscreenchange', onFs);
      if (idle) clearTimeout(idle);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  const goFullscreen = () => {
    if (!document.fullscreenElement)
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const current = slides[slides.length - 1] ?? null;
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black text-white select-none"
      style={{ cursor: cursor ? 'default' : 'none' }}
      onClick={goFullscreen}
      data-testid="projector"
      data-state={state}
      dir={text.dir}
      lang={locale}
    >
      {invalid ? (
        <Message title={t.projector.invalid} />
      ) : state === 'off' ? (
        <Message title={title} sub={t.projector.off} />
      ) : !current ? (
        <Message title={title} sub={t.projector.empty} note={t.projector.emptySub} />
      ) : (
        slides.map((slide) => (
          <SlideView
            key={slide.key}
            slide={slide}
            leaving={slide !== current}
            onEnded={() => void nextSlide()}
          />
        ))
      )}
      {!fullscreen && cursor ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[15px] text-white/70">
          {t.projector.fullscreen}
        </p>
      ) : null}
    </div>
  );
}

function SlideView({ slide, leaving, onEnded }: { slide: Slide; leaving: boolean; onEnded(): void }) {
  const { item, fresh } = slide;
  const src = item.display ?? item.thumb;
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out motion-reduce:transition-none ${leaving ? 'opacity-0' : 'opacity-100'}`}
      data-item={item.id}
      data-current={leaving ? undefined : ''}
      aria-hidden={leaving || undefined}
    >
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl"
        />
      ) : null}
      <div
        className={
          fresh
            ? 'absolute inset-0 grid place-items-center p-[4vmin] motion-safe:animate-[projector-arrive_1400ms_cubic-bezier(0.22,1,0.36,1)_both]'
            : 'absolute inset-0 grid place-items-center p-[4vmin] motion-safe:animate-[projector-drift_9000ms_ease-out_both]'
        }
      >
        {/* sized by the screen, not in percentages: a grid cell grows to a big photo's own size */}
        {item.kind === 'video' && item.video ? (
          <video
            src={item.video}
            poster={src ?? undefined}
            autoPlay
            muted
            playsInline
            onEnded={onEnded}
            className="max-h-[92vh] max-w-[92vw] rounded-[1vmin] shadow-[0_2vmin_6vmin_rgba(0,0,0,0.6)]"
          />
        ) : src ? (
          <img
            src={src}
            alt=""
            className={`max-h-[92vh] max-w-[92vw] object-contain shadow-[0_2vmin_6vmin_rgba(0,0,0,0.6)] ${fresh ? 'rounded-[0.6vmin] outline-[1.2vmin] outline-white' : 'rounded-[0.6vmin]'}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function Message({ title, sub, note }: { title: string; sub?: string; note?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-[6vmin] text-center">
      <div>
        <p className="font-display text-[7vmin] leading-tight font-bold text-balance">
          <bdi>{title}</bdi>
        </p>
        {sub ? <p className="mt-[3vmin] text-[3.2vmin] text-white/80">{sub}</p> : null}
        {note ? <p className="mt-[1.5vmin] text-[2.4vmin] text-white/55">{note}</p> : null}
      </div>
    </div>
  );
}
