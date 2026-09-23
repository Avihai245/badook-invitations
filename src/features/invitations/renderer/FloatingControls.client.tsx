'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Locale } from '../contracts/types';
import { Icon } from '../ui/Icon';

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
 * the tap handler, so iOS allows it — with a 1.5s fade-in; never autoplays otherwise (a skipped cover
 * leaves it paused, one tap on the button starts it). It pauses while the page is hidden and resumes
 * when the guest comes back. (iOS ignores `volume`: there the track starts at the device volume.)
 *
 * The language pill switches in place when the page provides `onSwitch` (no reload, same scroll
 * position); otherwise it is a plain link to the other language.
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

function MusicButton({ src, volume, startAtSec, playLabel, pauseLabel }: MusicProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const fade = useRef(0);
  const resumeOnShow = useRef(false);
  const target = Math.min(1, Math.max(0, volume));

  const play = useCallback(
    (fadeIn: boolean) => {
      const a = audio.current;
      if (!a) return;
      cancelAnimationFrame(fade.current);
      if (a.readyState === 0 && startAtSec > 0) a.currentTime = startAtSec;
      a.volume = fadeIn ? 0 : target;
      // play() must be called synchronously inside the gesture (iOS / in-app browsers)
      const started = a.play();
      setPlaying(true);
      started?.catch(() => setPlaying(false));
      if (!fadeIn) return;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / FADE_MS);
        a.volume = target * k;
        if (k < 1) fade.current = requestAnimationFrame(step);
      };
      fade.current = requestAnimationFrame(step);
    },
    [startAtSec, target],
  );

  const pause = useCallback(() => {
    cancelAnimationFrame(fade.current);
    audio.current?.pause();
    setPlaying(false);
  }, []);

  // The cover's tap starts the music.
  useEffect(() => {
    const onOpen = () => play(true);
    window.addEventListener('invitation:open', onOpen);
    return () => window.removeEventListener('invitation:open', onOpen);
  }, [play]);

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
        void a.play().catch(() => setPlaying(false));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(fade.current);
      audio.current?.pause();
    },
    [],
  );

  return (
    <>
      {/* preload="none": nothing downloads before the guest opens the invitation */}
      <audio ref={audio} src={src} loop preload="none" onEnded={() => setPlaying(false)} />
      <button
        className="fab fab-music"
        type="button"
        aria-pressed={playing}
        aria-label={playing ? pauseLabel : playLabel}
        onClick={() => (playing ? pause() : play(false))}
      >
        <Icon name={playing ? 'volume-2' : 'volume-x'} size={20} />
      </button>
    </>
  );
}
