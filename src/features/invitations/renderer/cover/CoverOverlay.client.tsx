'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CoverStyle, Locale, TemplateManifest } from '../../contracts/types';
import type { CoverMedia } from './media';
import { Monogram } from './Monogram';
import { SealArt, TagArt, TicketArt } from './SealArt';

type Overlay = TemplateManifest['cover']['overlay'];

export interface CoverOverlayProps {
  locale: Locale;
  style: CoverStyle;
  overlay: Pick<Overlay, 'kind' | 'exit' | 'recolor' | 'size' | 'offset' | 'text'>;
  /** resolved seal color of a recolored overlay (null otherwise) */
  sealColor: string | null;
  media: CoverMedia;
  monogram: string;
  hint: string;
  skipLabel: string;
  /** cached public page: `?open=1` in the URL skips the cover (see InvitationBody) */
  skipFromUrl?: boolean;
}

type Phase = 'idle' | 'opening' | 'gone' | 'removed';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** landscape screens get the desktop pair, or the 9:16 media over a blurred copy of itself */
const WIDE = '(min-width: 1024px) and (min-aspect-ratio: 1/1)';

/** Crossfade of the whole cover layer (§2.2.1: starts 600ms before the video ends). */
const CROSSFADE_MS = 600;
/** A video that doesn't play within this is skipped (§2.2.1). */
const STALL_MS = 1500;

/**
 * The cover (§2.2.1). With the template's media: the poster, a hidden opening video whose first frame
 * is the poster, and the editable overlay (the blank PNG tinted with the seal color + the monogram).
 * A tap / Enter / Space starts the music and the video inside the gesture (iOS), the overlay exits
 * during the video's static first `holdMs`, and the cover crossfades out 600ms before the video ends.
 * Without media (or `renderer: 'css3d'`) the CSS 3D envelope plays instead. The opened state lives on
 * <html data-opened>, so the hero entrance and the floating controls react with CSS only.
 */
export function CoverOverlay(props: CoverOverlayProps) {
  const { media } = props;
  const videoCover = !!(media.poster && media.video);
  const [phase, setPhase] = useState<Phase>('idle');
  const [showSkip, setShowSkip] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  useIsoLayoutEffect(() => {
    // ?open=1 on a cached page: normally already skipped before the first paint by InvitationBody's
    // inline script; the URL is re-checked here so the skip holds even if that state was lost.
    const root = document.documentElement.dataset;
    if (
      root.coverSkipped ||
      (props.skipFromUrl && new URLSearchParams(window.location.search).get('open') === '1')
    ) {
      root.opened = '1';
      root.coverSkipped = '1';
      document.body.classList.remove('locked');
      setPhase('removed');
      return;
    }
    document.body.classList.add('locked');
    const t = window.setTimeout(() => setShowSkip(true), 1000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const finish = useCallback((fadeMs: number) => {
    document.documentElement.dataset.opened = '1';
    document.body.classList.remove('locked');
    setPhase('gone');
    timers.current.push(window.setTimeout(() => setPhase('removed'), fadeMs + 100));
  }, []);

  if (phase === 'removed') return null;
  return videoCover ? (
    <VideoCover
      {...props}
      phase={phase}
      setPhase={setPhase}
      showSkip={showSkip}
      finish={finish}
      later={later}
    />
  ) : (
    <CssCover
      {...props}
      phase={phase}
      setPhase={setPhase}
      showSkip={showSkip}
      finish={finish}
      later={later}
    />
  );
}

interface PhaseProps {
  phase: Phase;
  setPhase: (p: Phase) => void;
  showSkip: boolean;
  finish: (fadeMs: number) => void;
  later: (fn: () => void, ms: number) => void;
}

/** Everything the gesture must start synchronously (iOS): the music listens to this event. */
const announceOpen = () => window.dispatchEvent(new CustomEvent('invitation:open'));

// ─── video-first ──────────────────────────────────────────────────────────────────────────────

function VideoCover({
  locale,
  style,
  overlay,
  sealColor,
  media,
  monogram,
  hint,
  skipLabel,
  phase,
  setPhase,
  showSkip,
  finish,
  later,
}: CoverOverlayProps & PhaseProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const done = useRef(false);
  const desktop = !!(media.posterDesktop && media.videoDesktop);

  // The source is chosen on the client (screen shape); preload so the tap starts at once.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.src = desktop && window.matchMedia(WIDE).matches ? media.videoDesktop! : media.video!;
    v.load();
  }, [desktop, media.video, media.videoDesktop]);

  const crossfade = useCallback(() => {
    if (done.current) return;
    done.current = true;
    finish(CROSSFADE_MS);
  }, [finish]);

  const open = (skip: boolean) => {
    if (phase !== 'idle') return;
    announceOpen();
    const v = video.current;
    if (skip || !v || reducedMotion()) {
      // §2.2.1: reduced motion → a plain 300ms fade; Skip → straight to the invitation
      setPhase('opening');
      done.current = true;
      finish(300);
      return;
    }
    setPhase('opening');
    let stall = window.setTimeout(crossfade, STALL_MS);
    const clearStall = () => window.clearTimeout(stall);
    v.addEventListener('playing', () => {
      clearStall();
      setPlaying(true);
    });
    v.addEventListener('waiting', () => {
      clearStall();
      stall = window.setTimeout(crossfade, STALL_MS);
    });
    v.addEventListener('timeupdate', () => {
      if (Number.isFinite(v.duration) && v.duration - v.currentTime <= CROSSFADE_MS / 1000) crossfade();
    });
    v.addEventListener('ended', crossfade);
    v.addEventListener('error', crossfade);
    const started = v.play();
    if (started) started.catch(crossfade);
    // a video without a usable duration still ends: 'ended' covers it; this is the last resort
    later(crossfade, 15000);
  };

  const cls = [
    'cover',
    'cover-video',
    phase !== 'idle' ? 'opening' : '',
    phase === 'gone' ? 'gone' : '',
    playing ? 'playing' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const wide = overlay.kind === 'ticket_text';
  const ovStyle = {
    '--ov-size': overlay.size,
    '--ov-x': overlay.offset.x,
    '--ov-y': overlay.offset.y,
    '--ov-aspect': wide ? 2.2 : 1,
  } as CSSProperties;

  const art = media.overlay ? (
    <span className="ov-art">
      {overlay.recolor && sealColor ? (
        <span
          className="ov-tint"
          style={{
            backgroundColor: sealColor,
            WebkitMaskImage: `url("${media.overlay}")`,
            maskImage: `url("${media.overlay}")`,
          }}
        />
      ) : null}
      <img
        className={overlay.recolor && sealColor ? 'ov-png multiply' : 'ov-png'}
        src={media.overlay}
        alt=""
        draggable={false}
      />
      <Monogram
        text={monogram}
        locale={locale}
        effect={overlay.text.effect}
        color={overlay.text.color}
        sealColor={overlay.recolor ? sealColor : null}
        sheen={phase !== 'idle'}
      />
    </span>
  ) : overlay.kind === 'ticket_text' ? (
    <span className="ov-art">
      <Monogram
        text={monogram}
        locale={locale}
        effect={overlay.text.effect}
        color={overlay.text.color}
        sealColor={null}
        wide
        sheen={phase !== 'idle'}
      />
    </span>
  ) : overlay.kind === 'none' ? null : (
    // no blank PNG yet: the CSS disc / tag with the monogram (§5 missing overlay image)
    <span className="ov-art">
      {overlay.kind === 'tag' ? (
        <TagArt text={monogram} locale={locale} ink={overlay.text.color} />
      ) : (
        <SealArt
          text={monogram}
          locale={locale}
          shape={overlay.kind === 'medallion' ? 'medallion' : 'wax_seal'}
        />
      )}
    </span>
  );

  return (
    <div className={cls} data-style={style} data-exit={overlay.exit} data-desktop={desktop ? '1' : undefined}>
      <div className="cv-media" aria-hidden="true">
        {/* wide screens without desktop art: the 9:16 media over a blurred copy of itself */}
        {!desktop ? <img className="cv-backdrop" src={media.poster!} alt="" /> : null}
        <picture>
          {desktop ? <source media={WIDE} srcSet={media.posterDesktop!} /> : null}
          <img className="cv-poster" src={media.poster!} alt="" fetchPriority="high" decoding="async" />
        </picture>
        <video ref={video} className="cv-video" muted playsInline preload="auto" disablePictureInPicture />
      </div>
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
        {art ? (
          <span className="cv-overlay" style={ovStyle}>
            <span className="half l">{art}</span>
            <span className="half r">{art}</span>
          </span>
        ) : null}
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

// ─── CSS 3D fallback (no media / css3d templates) ─────────────────────────────────────────────

function CssCover({
  locale,
  style,
  overlay,
  monogram,
  hint,
  skipLabel,
  phase,
  setPhase,
  showSkip,
  finish,
  later,
}: CoverOverlayProps & PhaseProps) {
  const open = (immediate: boolean) => {
    if (phase !== 'idle') return;
    announceOpen();
    if (immediate || reducedMotion()) {
      finish(immediate ? 700 : 300);
      return;
    }
    setPhase('opening');
    later(() => finish(700), overlay.exit === 'fade' ? 700 : 1700);
  };

  const cls = ['cover', phase !== 'idle' ? 'opening' : '', phase === 'gone' ? 'gone' : '']
    .filter(Boolean)
    .join(' ');
  const art =
    overlay.kind === 'ticket_text' ? null : overlay.kind === 'tag' ? (
      <TagArt text={monogram} locale={locale} ink={overlay.text.color} />
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
            <TicketArt text={monogram} locale={locale} ink={overlay.text.color} />
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
