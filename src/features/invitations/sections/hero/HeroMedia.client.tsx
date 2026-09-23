'use client';

import { useEffect, useRef, useState } from 'react';
import { videoEmbedUrl, videoStillUrl, type VideoLink } from '../../lib/video-links';

/** Starts `v` when the browser hasn't; one it won't play with sound plays muted. */
const kick = (v: HTMLVideoElement) => {
  if (!v.paused) return;
  v.play()?.catch(() => {
    if (v.muted) return;
    v.muted = true;
    delete document.documentElement.dataset.videoSound;
    v.play()?.catch(() => undefined);
  });
};

/**
 * Runs `fn` on the guest's first tap anywhere, and on the cover's opening — a gesture, which is what a
 * browser holding a video back (iOS Low Power Mode) waits for.
 */
function onFirstTap(fn: () => void): () => void {
  const opts = { capture: true, once: true } as const;
  window.addEventListener('invitation:open', fn);
  document.addEventListener('click', fn, opts);
  document.addEventListener('touchend', fn, opts);
  return () => {
    window.removeEventListener('invitation:open', fn);
    document.removeEventListener('click', fn, opts);
    document.removeEventListener('touchend', fn, opts);
  };
}

/**
 * The hero's background video: muted, inline and looping, so every browser lets it autoplay. `muted`
 * is set as an attribute as well — React only sets the property on elements it creates (the editor
 * preview, the live language switch), and iOS looks at the attribute — and a browser that still holds
 * it back starts it on the guest's first tap. With the host's "video sound" option (`sound`) the music
 * button turns its sound on and off (FloatingControls; <html data-video-sound="on"> marks it on — also
 * when the cover's early-tap script did it before React took over).
 */
export function HeroVideo({
  src,
  poster,
  focal,
  sound,
}: {
  src: string;
  poster: string | null;
  focal: string;
  /** the host's volume when its sound is the music (0..1), else null */
  sound: number | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    if (sound !== null && document.documentElement.dataset.videoSound === 'on') {
      // its sound is on: a video re-created by the live language switch gets it back (one the
      // early-tap script unmuted keeps fading in)
      if (v.muted) {
        v.muted = false;
        v.volume = sound;
      }
    } else v.muted = true;
    kick(v);
    return onFirstTap(() => kick(v));
  }, [src, sound]);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      data-sound={sound !== null ? '' : undefined}
      data-volume={sound ?? undefined}
      style={{ objectPosition: focal }}
      // the cover's early-tap script may have turned its sound on before React hydrates: keep it
      suppressHydrationWarning
    />
  );
}

type PlayerMessage = { provider: 'youtube' | 'vimeo'; data: unknown };

/** What a YouTube / Vimeo player posted to this page → whether it is playing now (or null: no news). */
function playingFrom({ provider, data }: PlayerMessage): boolean | null {
  let msg: unknown = data;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as { event?: string; info?: unknown };
  if (provider === 'youtube') {
    // onStateChange: 1 = playing; infoDelivery carries { playerState } too
    const state =
      m.event === 'onStateChange'
        ? m.info
        : m.event === 'infoDelivery'
          ? (m.info as { playerState?: unknown } | undefined)?.playerState
          : undefined;
    return typeof state === 'number' ? state === 1 : null;
  }
  if (m.event === 'play' || m.event === 'playing' || m.event === 'timeupdate') return true;
  if (m.event === 'pause' || m.event === 'ended') return false;
  return null;
}

/** The `event` of a player message (YouTube posts JSON strings). */
function eventOf(data: unknown): string | null {
  let msg: unknown = data;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  return msg && typeof msg === 'object' && typeof (msg as { event?: unknown }).event === 'string'
    ? (msg as { event: string }).event
    : null;
}

/** YouTube reported the video ended (state 0). */
function endedFrom(data: unknown): boolean {
  let msg: unknown = data;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return false;
    }
  }
  const m = msg as { event?: string; info?: unknown } | null;
  if (!m || typeof m !== 'object') return false;
  const state =
    m.event === 'onStateChange'
      ? m.info
      : m.event === 'infoDelivery'
        ? (m.info as { playerState?: unknown } | undefined)?.playerState
        : undefined;
  return state === 0;
}

const PLAYER_ORIGIN = {
  youtube: 'https://www.youtube-nocookie.com',
  vimeo: 'https://player.vimeo.com',
} as const;

/**
 * A YouTube / Vimeo link as the hero background: the player muted, looping and without controls,
 * scaled to cover the hero (a 16:9 frame, 9:16 for a Short), untouchable (taps go to the page). Until
 * it actually plays, the still stays on screen — also when a browser won't autoplay it — so there is
 * never a black box. With the "video sound" option the music button's `hero:sound` event turns its
 * sound on and off through the players' postMessage APIs (as far as the browser allows). Unless the
 * host turned them on, the players' own subtitles stay off (text burned into the picture can't be).
 */
export function HeroEmbed({
  link,
  poster,
  sound,
  captions = false,
  start,
}: {
  link: VideoLink;
  poster: string | null;
  sound: boolean;
  captions?: boolean;
  /** YouTube: the second it starts from — and loops back to */
  start?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // YouTube: the 16:9 still (HD uploads), else the 4:3 one; Vimeo: the one saved with the link
  const stills = [videoStillUrl(link, 'maxres'), videoStillUrl(link, 'hq'), poster].filter(
    (u): u is string => !!u,
  );
  const [stillAt, setStillAt] = useState(0);
  const still = stills[stillAt] ?? null;
  const nextStill = () => setStillAt((i) => i + 1);
  const vertical = link.provider === 'youtube' && link.vertical;

  // the player's API needs this page's origin: only known in the browser (the iframe is client-only)
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!origin) return;
    const target = PLAYER_ORIGIN[link.provider];
    const post = (message: unknown) => frame.current?.contentWindow?.postMessage(message, target);
    const command = (func: string, value?: number | boolean | string) =>
      link.provider === 'youtube'
        ? post(JSON.stringify({ event: 'command', func, args: value === undefined ? [] : [value] }))
        : post({ method: func, value });
    // YouTube loads its captions module with the player and again as a video starts: unload it then
    const hideCaptions = () => {
      if (captions) return;
      if (link.provider === 'youtube') for (const name of ['captions', 'cc']) command('unloadModule', name);
      else post({ method: 'disableTextTrack' });
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== target || e.source !== frame.current?.contentWindow) return;
      const now = playingFrom({ provider: link.provider, data: e.data });
      if (now !== null) setPlaying(now);
      if (now) hideCaptions();
      if (link.provider === 'youtube' && start && endedFrom(e.data)) {
        // a looping playlist restarts at 0: back to the host's second instead
        command('seekTo', start);
        command('playVideo');
      }
      if (link.provider === 'youtube' && eventOf(e.data) === 'onReady') hideCaptions();
      // Vimeo announces itself: then ask for the events that tell it plays
      if (link.provider === 'vimeo' && typeof e.data === 'object' && e.data?.event === 'ready') {
        for (const value of ['play', 'pause', 'timeupdate']) post({ method: 'addEventListener', value });
        hideCaptions();
      }
    };
    const onLoad = () => {
      // YouTube starts sending state changes once the page says it listens
      if (link.provider === 'youtube')
        post(JSON.stringify({ event: 'listening', id: 'hero', channel: 'widget' }));
    };
    const onSound = (e: Event) => {
      const { on, volume } = (e as CustomEvent<{ on: boolean; volume: number }>).detail;
      if (link.provider === 'youtube') {
        command(on ? 'unMute' : 'mute');
        if (on) command('setVolume', Math.round(volume * 100));
        command('playVideo');
      } else {
        command('setMuted', !on);
        if (on) command('setVolume', volume);
        command('play');
      }
    };
    const iframe = frame.current;
    window.addEventListener('message', onMessage);
    iframe?.addEventListener('load', onLoad);
    onLoad(); // in case it loaded before this ran (a lost message is harmless)
    if (sound) window.addEventListener('hero:sound', onSound);
    const stopTap = onFirstTap(() => command(link.provider === 'youtube' ? 'playVideo' : 'play'));
    return () => {
      window.removeEventListener('message', onMessage);
      iframe?.removeEventListener('load', onLoad);
      window.removeEventListener('hero:sound', onSound);
      stopTap();
    };
  }, [origin, link, sound, captions, start]);

  return (
    <div
      className={['hero-embed', vertical ? 'vertical' : '', playing ? 'playing' : '']
        .filter(Boolean)
        .join(' ')}
      data-sound={sound ? '' : undefined}
    >
      {still ? (
        <img
          className="hero-still"
          src={still}
          alt=""
          fetchPriority="high"
          onLoad={(e) => {
            // a missing YouTube still comes back as a 120×90 grey placeholder
            if (e.currentTarget.naturalWidth <= 120) nextStill();
          }}
          onError={nextStill}
        />
      ) : null}
      {origin ? (
        <iframe
          ref={frame}
          src={videoEmbedUrl(link, origin, { captions, start })}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
    </div>
  );
}
