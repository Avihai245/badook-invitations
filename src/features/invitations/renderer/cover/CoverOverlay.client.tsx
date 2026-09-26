'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { CoverStyle, Locale, TemplateManifest } from '../../contracts/types';
import { burstFrom } from '../fx/burst';
import type { BurstKind } from '../fx/theme';
import type { CoverMedia } from './media';
import { Monogram } from './Monogram';
import type { Opening } from './opening';
import { CinematicCover, type CoverBackdrop } from './Openings.client';
import { announceOpen, reducedMotion, useOpening, type Phase, type PhaseProps } from './phase';
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
  /** a scene template: its scene, drawn on the CSS cover's card (rendered by the caller) */
  card?: ReactNode;
  /** the template's opening burst (renderer/fx/theme.ts) — null: none */
  fx?: { burst: BurstKind | null; colors: string[] } | null;
  /** a cinematic opening (gate, curtain, fireworks, gold dust — cover/opening.ts) instead of the style's own */
  opening?: Opening | null;
  /** its "scroll to enter" cue */
  scrollLabel?: string;
  /** a photo-led opening's picture: the hero's still (Openings.client.tsx) */
  backdrop?: CoverBackdrop | null;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
/** landscape screens get the desktop pair, or the 9:16 media over a blurred copy of itself */
const WIDE = '(min-width: 1024px) and (min-aspect-ratio: 1/1)';

/** Crossfade of the whole cover layer (§2.2.1: starts 600ms before the video ends). */
const CROSSFADE_MS = 600;
/** A video that doesn't play within this is skipped (§2.2.1). */
const STALL_MS = 1500;
/** The CSS cover's fade as it goes (invitation.css `.cover.gone`: 120ms + 800ms). */
const FADE_MS = 850;

/**
 * The opening's particles (renderer/fx/burst.ts — nothing with reduced motion): a spray of light where
 * the seal breaks, then the template's own burst (petals, confetti, stars…) out of the card / ticket.
 */
function sparkFrom(el: Element | null, fx: CoverOverlayProps['fx'], at?: { x: number; y: number }) {
  if (fx?.burst) burstFrom(el, 'sparkles', ['#FFF6DA', '#FFE3A1', ...fx.colors.slice(0, 1)], at, 0.45);
}
function burstOf(el: Element | null, fx: CoverOverlayProps['fx'], at?: { x: number; y: number }) {
  if (fx?.burst) burstFrom(el, fx.burst, fx.colors, at);
}

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
    const root = document.documentElement.dataset;
    // from the hydration commit on, taps are ours: InvitationBody's early-tap script stands down
    root.coverReady = '1';
    // ?open=1 on a cached page: normally already skipped before the first paint by InvitationBody's
    // inline script; the URL is re-checked here so the skip holds even if that state was lost.
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
  if (props.opening)
    return (
      <CinematicCover
        {...props}
        opening={props.opening}
        phase={phase}
        setPhase={setPhase}
        showSkip={showSkip}
        finish={finish}
        later={later}
      />
    );
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
  fx,
  phase,
  setPhase,
  showSkip,
  finish,
  later,
}: CoverOverlayProps & PhaseProps) {
  const video = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
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
    // the hand-off: the template's burst over the invitation appearing
    burstOf(video.current, fx, { x: 0.5, y: 0.42 });
  }, [finish, fx]);

  const open = useOpening((skip: boolean) => {
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
    later(() => sparkFrom(overlayRef.current, fx), 60);
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
  });

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
          <span className="cv-overlay" style={ovStyle} ref={overlayRef}>
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
  card,
  fx,
  phase,
  setPhase,
  showSkip,
  finish,
  later,
}: CoverOverlayProps & PhaseProps) {
  const root = useRef<HTMLDivElement>(null);
  const ticket = style === 'ticket' || overlay.kind === 'ticket_text';
  const open = useOpening((immediate: boolean) => {
    announceOpen();
    if (immediate || reducedMotion()) {
      finish(immediate ? FADE_MS : 300);
      return;
    }
    setPhase('opening');
    const el = root.current;
    if (ticket) {
      // the stub tears off: light and the burst from the tear, then the ticket lifts away
      later(() => burstOf(el?.querySelector('.ticket') ?? null, fx, { x: 0.764, y: 0.5 }), 120);
      later(() => finish(FADE_MS), 900);
      return;
    }
    // the seal breaks (sparks) → the flap opens → the card rises (the burst) → the push into the card
    later(() => sparkFrom(el?.querySelector('.seal') ?? null, fx), 60);
    later(() => burstOf(el?.querySelector('.env-card') ?? null, fx, { x: 0.5, y: 0.12 }), 1250);
    later(() => finish(FADE_MS), overlay.exit === 'fade' ? 700 : 1650);
  });

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
    <div
      ref={root}
      className={cls}
      data-style={style}
      data-exit={overlay.exit}
      data-scene={card ? '' : undefined}
    >
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
        {ticket ? (
          <span className="ticket">
            {/* twice, clipped at the perforation: the stub tears off as it opens */}
            <span className="tk tk-main">
              <TicketArt text={monogram} locale={locale} ink={overlay.text.color} />
            </span>
            <span className="tk tk-stub">
              <TicketArt text={monogram} locale={locale} ink={overlay.text.color} />
            </span>
          </span>
        ) : (
          <span className="env" aria-hidden="true">
            <span className="env-back" />
            <span className="env-card">{card}</span>
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
