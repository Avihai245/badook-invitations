'use client';

import { Maximize2, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/** The demo video's files (video/ renders them: `npm run video:render`). */
export const DEMO_VIDEO = {
  mp4: '/video/badook-demo.mp4',
  webm: '/video/badook-demo.webm',
  portrait: '/video/badook-demo-portrait.mp4',
  poster: '/video/poster.jpg',
} as const;

/** The full narrated tour of every feature, its Hebrew captions part of the picture. */
export const TOUR_VIDEO = {
  mp4: '/video/badook-tour.mp4',
  portrait: '/video/badook-tour-portrait.mp4',
  poster: '/video/tour-poster.jpg',
  minutes: 2.5,
} as const;

/** The tour with its controls (inside a dialog). */
function TourPlayer() {
  return (
    <video
      className="mt-3 max-h-[78dvh] w-full rounded-[14px] bg-black"
      poster={TOUR_VIDEO.poster}
      controls
      autoPlay
      playsInline
      preload="metadata"
      data-testid="tour-player"
    >
      <source
        src={TOUR_VIDEO.portrait}
        type="video/mp4"
        media="(max-width: 640px) and (orientation: portrait)"
      />
      <source src={TOUR_VIDEO.mp4} type="video/mp4" />
      {/* no captions track: the captions are part of the picture (a track would show them twice) */}
    </video>
  );
}

/**
 * The full tour as a card (the guide, the help panel): its poster, what it shows and how long; it
 * opens in a dialog with controls, sound and Hebrew captions.
 */
export function TourVideo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t, fmt, number } = useUi();
  const T = t.demoVideo.tour;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="tour-video"
        className={cn(
          'group flex w-full items-center gap-4 overflow-hidden rounded-[20px] border border-brand-line bg-linear-to-br from-brand-soft/70 to-surface p-3 text-start shadow-sm transition-shadow hover:shadow-md',
          className,
        )}
      >
        <span
          className={cn(
            'relative block shrink-0 overflow-hidden rounded-[14px] bg-subtle',
            compact ? 'w-[112px]' : 'w-[168px] sm:w-[220px]',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a static poster beside the video files */}
          <img
            src={TOUR_VIDEO.poster}
            alt=""
            className="block aspect-video w-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/15 transition-colors group-hover:bg-black/25">
            <span className="grid size-10 place-items-center rounded-full bg-white/90 text-brand-deep shadow">
              <Play aria-hidden className="size-5 translate-x-[1px]" fill="currentColor" />
            </span>
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold">{T.title}</span>
          {compact ? null : <span className="mt-0.5 block text-[13px] text-muted">{T.body}</span>}
          <span className="mt-1 block text-[12.5px] font-semibold text-brand-deep">
            {T.play} · {fmt(T.length, { n: number(TOUR_VIDEO.minutes) })}
          </span>
        </span>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={T.title}
        closeLabel={t.common.close}
        className="max-w-[980px]"
      >
        {open ? <TourPlayer /> : null}
      </Dialog>
    </>
  );
}

/**
 * The 45-second demo (UX report stage 7): plays muted, looping and inline once it scrolls into view
 * (loaded only then), with its poster until; the portrait cut on narrow screens. "Watch with sound"
 * opens the full narrated tour (TourVideo) in a dialog. Reduced motion: it stays on its poster.
 */
export function DemoVideo({ className, label }: { className?: string; label?: string }) {
  const { t } = useUi();
  const V = t.demoVideo;
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(
      typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: '200px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className={cn(
        'group relative overflow-hidden rounded-[22px] bg-subtle shadow-[0_24px_60px_-28px_rgba(60,35,15,0.6)] ring-1 ring-line',
        className,
      )}
      data-testid="demo-video"
    >
      <video
        className="block aspect-video w-full object-cover"
        poster={DEMO_VIDEO.poster}
        muted
        loop
        playsInline
        autoPlay={near && !still}
        preload="none"
        aria-label={label ?? V.label}
      >
        {near ? (
          <>
            <source src={DEMO_VIDEO.portrait} type="video/mp4" media="(max-width: 640px)" />
            <source src={DEMO_VIDEO.webm} type="video/webm" />
            <source src={DEMO_VIDEO.mp4} type="video/mp4" />
          </>
        ) : null}
      </video>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute end-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-3.5 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-ink"
      >
        {still ? <Play aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
        {V.watch}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={V.tour.title}
        closeLabel={t.common.close}
        className="max-w-[980px]"
      >
        {/* "with sound": the full narrated tour, with captions */}
        {open ? <TourPlayer /> : null}
      </Dialog>
    </div>
  );
}
