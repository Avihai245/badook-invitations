'use client';

import { Maximize2, Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/app/utils';
import { useUi } from '@/lib/i18n/client';
import { useFirstInteraction } from './first-interaction';
import files from './site-video.generated.json';

// the dialog (Radix) only once someone opens the tour
const Dialog = dynamic(() => import('@/components/app/Dialog').then((m) => m.Dialog), { ssr: false });

/**
 * The demo video's files (video/ renders them: `npm run video:render`; scripts/encode-site-video.mjs
 * makes the web versions — ≤720p H.264, content-hashed names, cached for good).
 */
export const DEMO_VIDEO = {
  landscape: files.demo.landscape,
  portrait: files.demo.portrait,
  poster: files.demo.poster,
} as const;

/** The full narrated tour of every feature, its Hebrew captions part of the picture. */
export const TOUR_VIDEO = {
  landscape: files.tour.landscape,
  /** the 9:16 cut for phones; null until it is rendered (then phones get the landscape one) */
  portrait: ('portrait' in files.tour ? files.tour.portrait : null) as string | null,
  poster: files.tour.poster,
  minutes: 3,
} as const;

/** True from the first time `open` is: the dialog stays mounted after (its closing animation plays). */
function useOpened(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}

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
      {TOUR_VIDEO.portrait ? (
        <source
          src={TOUR_VIDEO.portrait}
          type="video/mp4"
          media="(max-width: 640px) and (orientation: portrait)"
        />
      ) : null}
      <source src={TOUR_VIDEO.landscape} type="video/mp4" />
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
  const opened = useOpened(open);
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
          <Image
            src={TOUR_VIDEO.poster}
            alt=""
            width={1280}
            height={720}
            sizes={compact ? '112px' : '(min-width: 640px) 220px, 168px'}
            className="block aspect-video w-full object-cover"
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
      {opened ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={T.title}
          closeLabel={t.common.close}
          className="max-w-[980px]"
        >
          {open ? <TourPlayer /> : null}
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * The 45-second demo (UX report stage 7): plays muted, looping and inline, with its poster until it
 * does; the portrait cut on narrow screens. "Watch with sound" opens the full narrated tour
 * (TourVideo) in a dialog. Reduced motion: it stays on its poster.
 *
 * The poster is the first screen's largest picture on a phone: an optimized image (AVIF / WebP at the
 * width shown), preloaded. The video downloads nothing until it is on screen and the visitor has done
 * something on the page — then one file, the one its <source media> picks for the screen.
 */
export function DemoVideo({ className, label }: { className?: string; label?: string }) {
  const { t } = useUi();
  const V = t.demoVideo;
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const engaged = useFirstInteraction();
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(false);
  const opened = useOpened(open);
  const [still, setStill] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setStill(
      typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), {
      rootMargin: '200px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const load = seen && engaged && !still;
  useEffect(() => {
    const el = video.current;
    if (!load || !el) return;
    // both sources went in with one render: one selection, one download
    el.load();
    void el.play().catch(() => undefined);
  }, [load]);
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
        ref={video}
        className="block aspect-video w-full object-cover"
        muted
        loop
        playsInline
        preload="none"
        aria-label={label ?? V.label}
        onPlaying={() => setPlaying(true)}
      >
        {load ? (
          <>
            <source src={DEMO_VIDEO.portrait} type="video/mp4" media="(max-width: 640px)" />
            <source src={DEMO_VIDEO.landscape} type="video/mp4" />
          </>
        ) : null}
      </video>
      {/* the poster, over the video until its first frame plays */}
      <Image
        src={DEMO_VIDEO.poster}
        alt=""
        fill
        priority
        quality={70}
        sizes="(min-width: 1024px) 600px, 100vw"
        className={cn(
          'pointer-events-none object-cover transition-opacity duration-500',
          playing && 'opacity-0',
        )}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute end-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-3.5 py-2 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-ink"
      >
        {still ? <Play aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
        {V.watch}
      </button>
      {opened ? (
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
      ) : null}
    </div>
  );
}
