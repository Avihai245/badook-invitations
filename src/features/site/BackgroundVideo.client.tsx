'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/app';
import { videoEmbedUrl, videoStillUrl, type VideoLink } from '@/features/invitations/lib/video-links';
import { mediaAllowed, useConsent } from './CookieConsent.client';

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
 */
export function BackgroundVideo({
  link,
  labels,
  className,
}: {
  link: VideoLink;
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
  const stills = [videoStillUrl(link, 'maxres'), videoStillUrl(link, 'hq')].filter((u): u is string => !!u);
  const [stillAt, setStillAt] = useState(0);

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

  useEffect(() => {
    if (!origin || paused) return;
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
  }, [origin, paused, link.start]);

  const toggle = () => {
    setWanted(paused);
    if (!paused) setPlaying(false);
  };

  return (
    <>
      <div ref={box} aria-hidden className={cn('site-video', playing && !paused && 'playing', className)}>
        {stills[stillAt] ? (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube's still, straight from its CDN
          <img
            className="site-video-still"
            src={stills[stillAt]}
            alt=""
            fetchPriority="high"
            onLoad={(e) => {
              // a missing YouTube still comes back as a 120×90 grey placeholder
              if (e.currentTarget.naturalWidth <= 120) setStillAt((i) => i + 1);
            }}
            onError={() => setStillAt((i) => i + 1)}
          />
        ) : null}
        {origin && !paused ? (
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
