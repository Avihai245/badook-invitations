'use client';

import { useEffect, useRef, useState } from 'react';
import { CoreIcon } from '../ui/core-icons';
import { motionAllowed } from './fx/motion';

export interface MotionLabels {
  pause: string;
  play: string;
}

/** `invitation:still` — the animations paused (true) or playing again (false): the hero's player listens. */
export const STILL_EVENT = 'invitation:still';

/** An animation that never ends by itself (a drawn scene's sway, the particles, the scroll cue). */
const endless = (a: Animation) => a.effect?.getTiming().iterations === Infinity;

const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/**
 * "Pause the animations" (WCAG 2.2.2): what moves by itself and doesn't end — the hero's background
 * video, a cinematic section's, the particles, a drawn scene's loop, the scroll cue — stops where it
 * is, and plays again on a second tap. What starts meanwhile (a section scrolled to, the particles
 * after the cover) stops as it starts; the countdown keeps counting without its roll. For this visit
 * only. With reduced motion (the device's, or the host's motion at 0) nothing loops, and the button
 * isn't there. A video playing with its sound (the host's "video sound") is the music button's.
 */
export function MotionPause({ labels, className }: { labels: MotionLabels; className: string }) {
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const held = useRef({ animations: new Set<Animation>(), videos: new Set<HTMLVideoElement>() });

  useEffect(() => setShown(motionAllowed()), []);

  useEffect(() => {
    if (!paused) return;
    const root = document.documentElement;
    const { animations, videos } = held.current;
    // held through the API: one the page paused itself for now (the particles off screen) would
    // otherwise run again when the page lets it go, while the guest's pause still holds
    const hold = (list: Animation[]) => {
      for (const a of list)
        if (endless(a) && (a.playState === 'running' || a.playState === 'paused') && !animations.has(a)) {
          a.pause();
          animations.add(a);
        }
    };
    const holdVideo = (v: HTMLVideoElement) => {
      if (v.paused || !v.muted || !v.closest('.inv')) return;
      v.pause();
      videos.add(v);
    };
    root.dataset.still = '1';
    hold(document.getAnimations());
    document.querySelectorAll('video').forEach(holdVideo);
    const onAnimation = (e: Event) => {
      if (e.target instanceof Element) hold(e.target.getAnimations({ subtree: true }));
    };
    const onPlay = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) holdVideo(e.target);
    };
    document.addEventListener('animationstart', onAnimation, true);
    document.addEventListener('play', onPlay, true);
    window.dispatchEvent(new CustomEvent(STILL_EVENT, { detail: true }));
    return () => {
      document.removeEventListener('animationstart', onAnimation, true);
      document.removeEventListener('play', onPlay, true);
      delete root.dataset.still;
      for (const a of animations) a.play();
      animations.clear();
      // the ones on screen play again; the others when they come back (ScrollEngine)
      for (const v of videos) if (v.isConnected && inView(v)) v.play()?.catch(() => undefined);
      videos.clear();
      window.dispatchEvent(new CustomEvent(STILL_EVENT, { detail: false }));
    };
  }, [paused]);

  if (!shown) return null;
  const label = paused ? labels.play : labels.pause;
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      // an icon alone: the words on hover too
      title={label}
      data-paused={paused ? '' : undefined}
      data-testid="motion-pause"
      onClick={() => setPaused((p) => !p)}
    >
      <CoreIcon name={paused ? 'play' : 'pause'} size={18} />
    </button>
  );
}
