'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CoverStyle, Locale, TemplateManifest } from '../../contracts/types';
import { SealArt, TagArt, TicketArt } from './SealArt';

type Overlay = TemplateManifest['cover']['overlay'];

export interface CoverOverlayProps {
  locale: Locale;
  style: CoverStyle;
  overlay: Pick<Overlay, 'kind' | 'exit'> & { textColor: string };
  monogram: string;
  hint: string;
  skipLabel: string;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Cover — P0 renders the CSS 3D fallback of §2.2.1 (the video-first cover with recolored PNG overlays
 * and monogram effects lands in P3). Tap / Enter / Space opens it; the opened state lives on
 * <html data-opened> so the hero entrance and the floating controls react with CSS only.
 */
export function CoverOverlay({ locale, style, overlay, monogram, hint, skipLabel }: CoverOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'opening' | 'gone' | 'removed'>('idle');
  const [showSkip, setShowSkip] = useState(false);
  const timers = useRef<number[]>([]);

  useIsoLayoutEffect(() => {
    document.body.classList.add('locked');
    const t = window.setTimeout(() => setShowSkip(true), 1000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const finish = useCallback(() => {
    document.documentElement.dataset.opened = '1';
    document.body.classList.remove('locked');
    setPhase('gone');
    timers.current.push(window.setTimeout(() => setPhase('removed'), 800));
  }, []);

  const open = useCallback(
    (immediate: boolean) => {
      if (phase !== 'idle') return;
      // P3: music.play() + video.play() start here, inside the gesture handler (iOS).
      window.dispatchEvent(new CustomEvent('invitation:open'));
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }
      setPhase('opening');
      timers.current.push(window.setTimeout(finish, overlay.exit === 'fade' ? 700 : 1700));
    },
    [phase, finish, overlay.exit],
  );

  if (phase === 'removed') return null;
  const cls = ['cover', phase === 'opening' ? 'opening' : '', phase === 'gone' ? 'opening gone' : '']
    .filter(Boolean)
    .join(' ');
  const art =
    overlay.kind === 'ticket_text' ? null : overlay.kind === 'tag' ? (
      <TagArt text={monogram} locale={locale} ink={overlay.textColor} />
    ) : overlay.kind === 'none' ? null : (
      <SealArt
        text={monogram}
        locale={locale}
        shape={overlay.kind === 'medallion' ? 'medallion' : 'wax_seal'}
      />
    );

  return (
    <div className={cls} data-style={style} data-exit={overlay.exit}>
      <button
        type="button"
        className="cover-tap"
        aria-label={hint}
        onClick={() => open(false)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            open(false);
          }
        }}
      >
        {style === 'ticket' || overlay.kind === 'ticket_text' ? (
          <span className="ticket">
            <TicketArt text={monogram} locale={locale} ink={overlay.textColor} />
          </span>
        ) : (
          <span className="env" aria-hidden="true">
            <span className="env-back" />
            <span className="env-card" />
            <span className="env-pocket" />
            <span className="env-flap" />
            {art ? (
              <span className="seal">
                <span className="half l">{art}</span>
                <span className="half r">{art}</span>
              </span>
            ) : null}
          </span>
        )}
        <span className="cover-hint" aria-hidden="true">
          {hint}
        </span>
      </button>
      {showSkip && phase === 'idle' ? (
        <button type="button" className="cover-skip" onClick={() => open(true)}>
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}
