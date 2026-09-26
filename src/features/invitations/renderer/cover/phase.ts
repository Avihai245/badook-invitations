'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * What every cover shares (CoverOverlay's envelope and video covers, the cinematic openings): its
 * phases, the gesture that opens it once, and the event the music and the particles listen to.
 */
export type Phase = 'idle' | 'opening' | 'gone' | 'removed';

export interface PhaseProps {
  phase: Phase;
  setPhase: (p: Phase) => void;
  showSkip: boolean;
  /** the invitation is open (<html data-opened>, scroll unlocked); the cover fades over `fadeMs` */
  finish: (fadeMs: number) => void;
  later: (fn: () => void, ms: number) => void;
}

/** The guest prefers less motion, or the host turned motion off (<html data-motion="none">): a fade. */
export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset.motion === 'none';

/** Everything the gesture must start synchronously (iOS): the music listens to this event. */
export const announceOpen = () => window.dispatchEvent(new CustomEvent('invitation:open'));

/**
 * Opening happens once: `open` runs at most one time (a tap, the Skip button, a scroll, or a tap that
 * came before React took over — InvitationBody's early-tap script leaves `data-pending-open` for that).
 */
export function useOpening(open: (skip: boolean) => void): (skip: boolean) => void {
  const began = useRef(false);
  const once = useCallback(
    (skip: boolean) => {
      if (began.current) return;
      began.current = true;
      delete document.documentElement.dataset.pendingOpen;
      open(skip);
    },
    [open],
  );
  useEffect(() => {
    const pending = document.documentElement.dataset.pendingOpen;
    if (pending) once(pending === 'skip');
  }, [once]);
  return once;
}
