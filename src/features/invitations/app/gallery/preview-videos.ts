'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Share of a card that must be on screen before its preview plays (touch screens). */
const IN_VIEW = 0.6;

type Mode = 'hover' | 'view' | 'off';

/**
 * The gallery's preview videos (§9B.3-B): muted and one at a time — on hover where there is a mouse,
 * otherwise the card that is at least 60% in view (the most visible one; the first on a tie).
 * Nothing plays by itself with reduced motion, and nothing plays on scroll with Save-Data.
 */
export function usePreviewVideos() {
  const current = useRef<HTMLVideoElement | null>(null);
  const ratios = useRef(new Map<HTMLVideoElement, number>());
  const observer = useRef<IntersectionObserver | null>(null);
  const mode = useRef<Mode>('off');

  const play = useCallback((video: HTMLVideoElement | null) => {
    const previous = current.current;
    current.current = video;
    if (previous && previous !== video) {
      previous.pause();
      previous.currentTime = 0;
    }
    if (video && video !== previous) video.play().catch(() => undefined);
  }, []);

  const pickInView = useCallback(() => {
    let best: HTMLVideoElement | null = null;
    let bestRatio = IN_VIEW - 0.001;
    for (const [video, ratio] of ratios.current)
      if (ratio > bestRatio) {
        best = video;
        bestRatio = ratio;
      }
    play(best);
  }, [play]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    mode.current = reduce
      ? 'off'
      : window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ? 'hover'
        : saveData
          ? 'off'
          : 'view';
    if (mode.current !== 'view') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (ratios.current.has(e.target as HTMLVideoElement))
            ratios.current.set(e.target as HTMLVideoElement, e.isIntersecting ? e.intersectionRatio : 0);
        pickInView();
      },
      { threshold: [0, 0.3, IN_VIEW, 0.8, 1] },
    );
    observer.current = io;
    for (const video of ratios.current.keys()) io.observe(video);
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, [pickInView]);

  /** Ref callback for a card's <video> (React 19 runs the returned cleanup on unmount). */
  const register = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.muted = true; // iOS plays muted inline video without a gesture
      ratios.current.set(video, 0);
      observer.current?.observe(video);
      return () => {
        ratios.current.delete(video);
        observer.current?.unobserve(video);
        if (current.current === video) {
          current.current = null;
          if (mode.current === 'view') pickInView();
        }
      };
    },
    [pickInView],
  );

  /** Mouse over / off a card (desktop). */
  const hover = useCallback(
    (video: HTMLVideoElement | null, on: boolean) => {
      if (mode.current !== 'hover' || !video) return;
      if (on) play(video);
      else if (current.current === video) play(null);
    },
    [play],
  );

  return { register, hover };
}
