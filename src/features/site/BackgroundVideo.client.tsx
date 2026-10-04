'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { cn } from '@/components/app/utils';
import { videoEmbedUrl, type VideoLink } from '@/features/invitations/lib/video-links';
import { imageSet } from '@/features/invitations/renderer/images';
import { mediaAllowed, useConsent } from './CookieConsent.client';
import { useFirstInteraction } from './first-interaction';

const PLAYER = 'https://www.youtube-nocookie.com';

/** A YouTube player message (JSON string) → its event and player state, if any. */
function read(data: unknown): { event: string | null; state: number | null } {
  let msg: unknown = data;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return { event: null, state: null };
    }
  }
  const m = (msg && typeof msg === 'object' ? msg : {}) as { event?: unknown; info?: unknown };
  const event = typeof m.event === 'string' ? m.event : null;
  const info = m.info as { playerState?: unknown } | number | undefined;
  const state =
    event === 'onStateChange' && typeof info === 'number'
      ? info
      : event === 'infoDelivery' && typeof info === 'object' && typeof info?.playerState === 'number'
        ? info.playerState
        : null;
  return { event, state };
}

/**
 * The home page's background video: a YouTube link played muted, looping (back to the link's start
 * time), without controls or subtitles, covering its box. The still shows until it really plays — and
 * instead of it for visitors who prefer reduced motion or save data, or who turned external content off
 * (cookie settings; the play button loads it for this visit). It pauses while off screen, and the
 * button pauses it for good (WCAG 2.2.2: moving content can be stopped).
 *
 * The still (`still`, picked on the server: hero-still.ts) is the first screen's largest picture: it
 * comes through the image optimizer, preloaded. The YouTube player (~1 MB of script) loads only once
 * the visitor does something on the page (or presses play) — never on its own with the first paint.
 */
export function BackgroundVideo({
  link,
  still,
  labels,
  className,
}: {
  link: VideoLink;
  still: string | null;
  labels: { pause: string; play: string };
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const consent = useConsent();
  const [origin, setOrigin] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // null: nobody chose yet — plays unless external content is off; true/false: the button's choice
  const [wanted, setWanted] = useState<boolean | null>(null);
  const engaged = useFirstInteraction();
  // the still, a plain <img> over the optimizer's widths (renderer/images.ts — next/image would add its
  // runtime); preloaded with its priority, which an image preloaded without it lacks (it waits behind CSS)
  const set = still ? imageSet(still, '100vw', 70) : null;
  if (set?.srcSet)
    preload(set.src, { as: 'image', imageSrcSet: set.srcSet, imageSizes: set.sizes, fetchPriority: 'high' });

  useEffect(() => {
    setOrigin(window.location.origin);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const still = 'a11yMotion' in document.documentElement.dataset; // the accessibility menu's "stop animations"
    if (reduce || saveData || still) setWanted(false);
    const onA11y = (e: Event) => {
      if ((e as CustomEvent<{ motion?: boolean }>).detail?.motion) setWanted(false);
    };
    window.addEventListener('a11y:change', onA11y);
    return () => window.removeEventListener('a11y:change', onA11y);
  }, []);

  const paused = wanted === null ? !mediaAllowed(consent) : !wanted;
  // the player: once the visitor is here (did anything) or asked for it (the play button)
  const live = !!origin && !paused && (engaged || wanted === true);

  useEffect(() => {
    if (!live) return;
    const post = (message: unknown) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(message), PLAYER);
    const command = (func: string, args: unknown[] = []) => post({ event: 'command', func, args });
    // no subtitles: YouTube loads its captions module with the player and again whenever the video
    // (re)starts — each loop included — so it is unloaded each time
    const hideCaptions = () => {
      for (const name of ['captions', 'cc']) command('unloadModule', [name]);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER || e.source !== frame.current?.contentWindow) return;
      const { event, state } = read(e.data);
      if (event === 'onReady') hideCaptions();
      if (state === 1) {
        setPlaying(true);
        hideCaptions();
      }
      // a looping playlist restarts at 0: back to the link's moment instead
      if (state === 0 && link.start) {
        command('seekTo', [link.start, true]);
        command('playVideo');
      }
    };
    const onLoad = () => post({ event: 'listening', id: 'site-hero', channel: 'widget' });
    const iframe = frame.current;
    window.addEventListener('message', onMessage);
    iframe?.addEventListener('load', onLoad);
    onLoad();
    // off screen: no need to keep decoding video
    const seen = new IntersectionObserver(([entry]) =>
      command(entry?.isIntersecting ? 'playVideo' : 'pauseVideo'),
    );
    if (box.current) seen.observe(box.current);
    return () => {
      window.removeEventListener('message', onMessage);
      iframe?.removeEventListener('load', onLoad);
      seen.disconnect();
    };
  }, [live, link.start]);

  const toggle = () => {
    setWanted(paused);
    if (!paused) setPlaying(false);
  };

  return (
    <>
      <div ref={box} aria-hidden className={cn('site-video', playing && !paused && 'playing', className)}>
        {set ? (
          <img
            className="site-video-still"
            src={set.src}
            srcSet={set.srcSet}
            sizes={set.sizes}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        ) : null}
        {live && origin ? (
          <iframe
            ref={frame}
            src={videoEmbedUrl(link, origin, { captions: false, start: link.start })}
            title=""
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid="site-hero-video"
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        aria-label={paused ? labels.play : labels.pause}
        title={paused ? labels.play : labels.pause}
        className="absolute end-4 bottom-4 z-20 grid size-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:end-6 sm:bottom-6 [&_svg]:size-4"
      >
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
      </button>
    </>
  );
}
