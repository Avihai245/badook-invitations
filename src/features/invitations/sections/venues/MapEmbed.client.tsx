'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../ui/Icon';

/**
 * A venue's map (§2.2 Venues, §7 performance): the static placeholder until it comes near the
 * viewport, then Google's key-less embed on top of it, faded in once loaded. Without `src` (editor
 * and previews), or with ?external=0 (the site's sample when its visitor turned external content
 * off), it stays the placeholder. The class list never changes after mount: the ScrollEngine
 * adds `in` to it directly.
 */
export function MapEmbed({
  src,
  label,
  style,
}: {
  src: string | null;
  label: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // inside the site's sample when its visitor turned external content off: the drawing stays
    if (!src || !el || new URLSearchParams(window.location.search).get('external') === '0') return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  const live = near && !!src;
  return (
    <div
      ref={ref}
      className="map reveal"
      style={style}
      role={live ? undefined : 'img'}
      aria-label={live ? undefined : label}
      data-loaded={loaded ? '' : undefined}
    >
      <span className="pin" aria-hidden="true">
        <Icon name="map-pin" size={40} strokeWidth={1.6} />
      </span>
      <span className="chip" aria-hidden="true">
        Google Maps
      </span>
      {live ? (
        <iframe
          src={src}
          title={label}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </div>
  );
}
