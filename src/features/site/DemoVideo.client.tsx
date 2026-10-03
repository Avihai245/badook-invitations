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

/**
 * The 45-second demo (UX report stage 7): plays muted, looping and inline once it scrolls into view
 * (loaded only then), with its poster until; the portrait cut on narrow screens. "Watch in full" opens
 * it with controls in a dialog. Reduced motion: it stays on its poster until played.
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
        title={V.label}
        closeLabel={t.common.close}
        className="max-w-[980px]"
      >
        {open ? (
          <video
            className="mt-3 w-full rounded-[14px]"
            poster={DEMO_VIDEO.poster}
            controls
            autoPlay
            playsInline
          >
            <source src={DEMO_VIDEO.webm} type="video/webm" />
            <source src={DEMO_VIDEO.mp4} type="video/mp4" />
          </video>
        ) : null}
      </Dialog>
    </div>
  );
}
