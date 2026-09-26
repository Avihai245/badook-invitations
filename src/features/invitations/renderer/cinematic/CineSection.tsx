import type { CSSProperties, ReactNode } from 'react';
import { imageSet } from '../images';
import type { CineMedia, CinePresentation } from './presentation';

/** How wide a section's media shows, per layout (the srcset's `sizes`). */
const SIZES = {
  background: '100vw',
  split: '(min-width: 900px) 50vw, 100vw',
  stack: '(min-width: 608px) 560px, calc(100vw - 48px)',
} as const;

/**
 * A picture, or a video over its still. The video never loads with the page: the Scroll Timeline
 * Engine (ScrollEngine.client.tsx) gives it its `src` and plays it — muted, looping, inline — only near
 * the screen, never for a guest saving data or preferring less motion (they keep the still), and
 * pauses it off screen.
 */
function MediaLayer({ media, sizes, decorative }: { media: CineMedia; sizes: string; decorative: boolean }) {
  const position = { objectPosition: 'var(--fx) var(--fy)' } as CSSProperties;
  const still = media.still ? imageSet(media.still, sizes) : null;
  const img = still ? (
    <img
      className="cine-img"
      src={still.src}
      srcSet={still.srcSet}
      sizes={still.sizes}
      data-fallback={still.fallback}
      alt={decorative ? '' : media.alt}
      loading="lazy"
      decoding="async"
      style={position}
      // the error fallback (images.ts) may swap it for the original before React hydrates
      suppressHydrationWarning
    />
  ) : null;
  if (media.kind !== 'video') return img;
  return (
    <>
      {img}
      <video
        className="cine-video"
        data-src={media.src}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        tabIndex={-1}
        aria-hidden="true"
        style={position}
        suppressHydrationWarning
      />
    </>
  );
}

/**
 * A section with a v2 presentation (renderer/cinematic/presentation.ts): the view's own markup inside
 * a wrapper that carries the layout, the motion (data-enter / data-scroll / data-tr for invitation.css
 * and the engine) and the section's own tokens. Full-bleed layouts put the media behind the text under
 * a scrim; split layouts put it beside the text; the stack shows it framed above the text.
 */
export function CineSection({
  p,
  sectionId,
  children,
}: {
  p: CinePresentation;
  sectionId: string;
  children: ReactNode;
}) {
  const style = p.vars as CSSProperties;
  const common = { className: 'cine', 'data-section': sectionId, ...p.attrs, style };
  const media = p.media;
  if (media && p.onMedia) {
    return (
      <div {...common}>
        <div className="cine-bg" aria-hidden="true">
          <div className="cine-layer">
            <MediaLayer media={media} sizes={SIZES.background} decorative />
          </div>
          <div className="cine-scrim" />
        </div>
        {children}
      </div>
    );
  }
  if (media && p.split) {
    return (
      <div {...common}>
        <figure className="cine-figure reveal" aria-hidden={media.alt ? undefined : true}>
          <MediaLayer media={media} sizes={SIZES.split} decorative={!media.alt} />
        </figure>
        <div className="cine-body">{children}</div>
      </div>
    );
  }
  return (
    <div {...common}>
      {media ? (
        <figure className="cine-figure reveal" aria-hidden={media.alt ? undefined : true}>
          <MediaLayer media={media} sizes={SIZES.stack} decorative={!media.alt} />
        </figure>
      ) : null}
      {children}
    </div>
  );
}
