'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Locale, TemplateManifest } from '../../contracts/types';
import { mixHex } from '../../lib/contrast';

type Effect = TemplateManifest['cover']['overlay']['text']['effect'];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The host's monogram drawn over the blank overlay PNG (§5 "Cover overlay rendering"): SVG text in the
 * template's monogram font, fitted to 58% of the overlay width, with the template's effect —
 * `emboss` / `deboss` (light + shadow copies around the text; ink = seal color darkened 18% /
 * lightened 22% when the overlay is recolored), `foil` (a gold sheen that sweeps once when opened)
 * and `print` (flat ink at 0.9 with a little paper roughness).
 */
export function Monogram({
  text,
  locale,
  effect,
  color,
  sealColor,
  wide = false,
  sheen = false,
}: {
  text: string;
  locale: Locale;
  effect: Effect;
  /** the template's text color (non-recolored overlays, foil, print) */
  color: string;
  /** recolored overlays: the text takes its tone from the seal */
  sealColor: string | null;
  /** ticket text: a 220×100 box instead of the 100×100 seal */
  wide?: boolean;
  /** play the foil sheen (set when the cover opens) */
  sheen?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = wide ? 220 : 100;
  const H = 100;
  const glyphs = [...text].length || 1;
  // A first guess by glyph count (the server has no fonts to measure); refined after mount.
  const guess = Math.min(wide ? 40 : 38, ((W * 0.58) / glyphs) * 1.7);
  const [size, setSize] = useState(guess);
  const ref = useRef<SVGTextElement>(null);
  const sweep = useRef<SVGAnimateElement>(null);

  useIsoLayoutEffect(() => {
    let live = true;
    const fit = () => {
      const el = ref.current;
      if (!el || !live) return;
      const width = el.getComputedTextLength();
      const current = Number(el.getAttribute('font-size')) || guess;
      if (width > 0) setSize(Math.min(wide ? 44 : 42, (current * (W * 0.58)) / width));
    };
    fit();
    // the monogram font may still be loading on the first paint
    void document.fonts?.ready.then(fit);
    return () => {
      live = false;
    };
  }, [text, locale, W]);

  useEffect(() => {
    if (sheen && effect === 'foil') sweep.current?.beginElement?.();
  }, [sheen, effect]);

  const ink =
    sealColor && (effect === 'emboss' || effect === 'deboss')
      ? mixHex(sealColor, effect === 'emboss' ? '#000000' : '#ffffff', effect === 'emboss' ? 0.18 : 0.22)
      : color;
  const style: CSSProperties = {
    fontFamily: 'var(--f-monogram)',
    direction: locale === 'he' ? 'rtl' : 'ltr',
  };
  const at = { x: W / 2, y: H / 2, dy: '.35em', textAnchor: 'middle' as const, fontSize: size, style };

  return (
    <svg className="monogram" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        {effect === 'foil' ? (
          <linearGradient id={`foil${uid}`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor={mixHex(color, '#000000', 0.25)} />
            <stop offset=".45" stopColor={color} />
            <stop offset=".5" stopColor="#fff8e1" />
            <stop offset=".55" stopColor={color} />
            <stop offset="1" stopColor={mixHex(color, '#000000', 0.25)} />
            <animateTransform
              ref={sweep as never}
              attributeName="gradientTransform"
              type="translate"
              from="-1 0"
              to="1 0"
              dur="1.2s"
              begin="indefinite"
              fill="freeze"
            />
          </linearGradient>
        ) : null}
        {effect === 'print' ? (
          <filter id={`prn${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" />
          </filter>
        ) : null}
        <filter id={`soft${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation=".35" />
        </filter>
      </defs>
      {effect === 'emboss' ? (
        <>
          <text {...at} x={at.x - 0.7} y={at.y - 0.7} fill="rgba(255,255,255,.4)" filter={`url(#soft${uid})`}>
            {text}
          </text>
          <text {...at} x={at.x + 0.9} y={at.y + 0.9} fill="rgba(0,0,0,.35)" filter={`url(#soft${uid})`}>
            {text}
          </text>
        </>
      ) : null}
      {effect === 'deboss' ? (
        <>
          <text {...at} x={at.x - 0.7} y={at.y - 0.7} fill="rgba(0,0,0,.35)" filter={`url(#soft${uid})`}>
            {text}
          </text>
          <text
            {...at}
            x={at.x + 0.7}
            y={at.y + 0.7}
            fill="rgba(255,255,255,.45)"
            filter={`url(#soft${uid})`}
          >
            {text}
          </text>
        </>
      ) : null}
      <text
        ref={ref}
        {...at}
        fill={effect === 'foil' ? `url(#foil${uid})` : ink}
        opacity={effect === 'print' ? 0.9 : 1}
        filter={effect === 'print' ? `url(#prn${uid})` : undefined}
      >
        {text}
      </text>
    </svg>
  );
}
