'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { Locale } from '../contracts/types';
import { Icon } from '../ui/Icon';
import { withStartAt } from './assets';

export interface MusicProps {
  src: string;
  /** 0..1 */
  volume: number;
  startAtSec: number;
  playLabel: string;
  pauseLabel: string;
}

const FADE_MS = 1500;

/**
 * Floating music toggle + language pill (§2.2 Global, §9A.4). Both appear once the cover opens (CSS
 * reacts to <html data-opened>).
 *
 * Music (§2.2.1, §9): one <audio>, started by the cover's `invitation:open` event — dispatched inside
 * the tap handler, so iOS allows it — with a 1.5s fade-in; a tap on the cover before React has taken
 * over starts it from InvitationBody's early-tap script instead. It never autoplays otherwise (a
 * skipped cover leaves it paused, one tap on the button starts it); when a browser refuses to start
 * it, the button pulses for that tap. It starts at the host's second (`#t=`), pauses while the page
 * is hidden and resumes when the guest comes back. (iOS ignores `volume`: the device volume applies.)
 *
 * The language pill switches in place when the page provides `onSwitch` (the public page's
 * LiveLocale: no reload, same place in the invitation); otherwise — and before hydration — it is a
 * plain link to the other language. `onIntent` (hover, press, focus) lets the page fetch ahead.
 */
export function FloatingControls({
  langSwitch,
  music,
}: {
  langSwitch: {
    href: string;
    label: string;
    targetLocale: Locale;
    onSwitch?: (locale: Locale) => void;
    onIntent?: () => void;
  } | null;
  music: MusicProps | null;
}) {
  return (
    <>
      {langSwitch ? (
        <a
          className="fab fab-lang"
          href={langSwitch.href}
          hrefLang={langSwitch.targetLocale}
          onPointerEnter={langSwitch.onIntent}
          onPointerDown={langSwitch.onIntent}
          onFocus={langSwitch.onIntent}
          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
            if (!langSwitch.onSwitch || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            langSwitch.onSwitch(langSwitch.targetLocale);
          }}
        >
          <Icon name="languages" size={16} />
          <span lang={langSwitch.targetLocale}>{langSwitch.label}</span>
        </a>
      ) : null}
      {music ? <MusicButton {...music} /> : null}
    </>
  );
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function MusicButton({ src, volume, startAtSec, playLabel, pauseLabel }: MusicProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  /** the browser wouldn't start it by itself: the button asks for a tap */
  const [blocked, setBlocked] = useState(false);
  /** the file can't be played at all: no button */
  const [failed, setFailed] = useState(false);
  const fade = useRef({ raf: 0, timer: 0 });
  const resumeOnShow = useRef(false);
  const target = Math.min(1, Math.max(0, volume));

  const stopFade = useCallback(() => {
    cancelAnimationFrame(fade.current.raf);
    window.clearTimeout(fade.current.timer);
  }, []);

  /** 0 → the host's volume over FADE_MS; the timer makes sure it gets there even without frames. */
  const fadeIn = useCallback(
    (a: HTMLAudioElement) => {
      stopFade();
      const t0 = performance.now();
      const step = (now: number) => {
        // a frame's timestamp is when the frame began — it can be a little before t0
        const k = Math.min(1, Math.max(0, (now - t0) / FADE_MS));
        a.volume = target * k;
        if (k < 1) fade.current.raf = requestAnimationFrame(step);
      };
      fade.current.raf = requestAnimationFrame(step);
      fade.current.timer = window.setTimeout(() => {
        cancelAnimationFrame(fade.current.raf);
        a.volume = target;
      }, FADE_MS + 250);
    },
    [stopFade, target],
  );

  const play = useCallback(
    (withFade: boolean) => {
      const a = audio.current;
      // already playing: started by the cover's early-tap script (InvitationBody) before React took over
      if (!a || !a.paused) return;
      // play() first and synchronously — it must stay inside the gesture (iOS, in-app browsers)
      let started: Promise<void>;
      try {
        started = a.play() ?? Promise.resolve();
      } catch (err) {
        started = Promise.reject(err);
      }
      try {
        a.volume = withFade ? 0 : target;
        if (withFade) fadeIn(a);
      } catch {
        // volume is read-only on iOS (the device volume applies)
      }
      started.then(
        () => setBlocked(false),
        () => {
          stopFade();
          setBlocked(true);
        },
      );
    },
    [fadeIn, stopFade, target],
  );

  const pause = useCallback(() => {
    stopFade();
    audio.current?.pause();
  }, [stopFade]);

  // The cover's tap starts the music. Listening from the hydration commit on (a layout effect): a tap
  // React replays right after hydrating must not come before the listener.
  useIsoLayoutEffect(() => {
    const onOpen = () => play(true);
    window.addEventListener('invitation:open', onOpen);
    return () => window.removeEventListener('invitation:open', onOpen);
  }, [play]);

  // Started before React took over (the early-tap script): the button shows it.
  useEffect(() => {
    if (audio.current && !audio.current.paused) setPlaying(true);
  }, []);

  // Paused while the page is hidden (another app, locked phone), resumed when it comes back.
  useEffect(() => {
    const onVisibility = () => {
      const a = audio.current;
      if (!a) return;
      if (document.hidden) {
        resumeOnShow.current = !a.paused;
        if (!a.paused) a.pause();
      } else if (resumeOnShow.current) {
        resumeOnShow.current = false;
        a.play()?.catch(() => setBlocked(true));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(
    () => () => {
      stopFade();
      audio.current?.pause();
    },
    [stopFade],
  );

  return (
    <>
      {/* preload="none": nothing downloads before the guest opens the invitation. `#t=` = the host's
          start second; class + data-volume are for the early-tap script. */}
      <audio
        ref={audio}
        className="inv-music"
        src={withStartAt(src, startAtSec)}
        data-volume={target}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          // a browser that ignores the media fragment starts at 0: seek now that it can
          const a = e.currentTarget;
          if (startAtSec > 0 && a.currentTime < 1 && startAtSec < a.duration) {
            try {
              a.currentTime = startAtSec;
            } catch {
              // it plays from the start
            }
          }
        }}
        onError={() => setFailed(true)}
      />
      {failed ? null : (
        <button
          className="fab fab-music"
          type="button"
          data-blocked={blocked && !playing ? '' : undefined}
          aria-pressed={playing}
          aria-label={playing ? pauseLabel : playLabel}
          onClick={() => (playing ? pause() : play(false))}
        >
          <Icon name={playing ? 'volume-2' : 'volume-x'} size={20} />
        </button>
      )}
    </>
  );
}
