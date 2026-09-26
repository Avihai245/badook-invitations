'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { TemplateManifest } from '../../contracts/types';
import { mixHex } from '../../lib/contrast';
import { INK, inkWidth } from './ink';
import { textDir, type Variant } from './localized';

type Effect = TemplateManifest['cover']['overlay']['text']['effect'];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The host's monogram drawn over the blank overlay PNG (§5 "Cover overlay rendering"): SVG text in the
 * template's monogram font, fitted to 58% of the overlay width (its ink, swashes included, to 90%),
 * with the template's effect —
 * `emboss` / `deboss` (light + shadow copies around the text; ink = seal color darkened 18% /
 * lightened 22% when the overlay is recolored), `foil` (a gold sheen that sweeps once when opened)
 * and `print` (flat ink at 0.9 with a little paper roughness). A monogram in several languages ("נ&א"
 * / "N&I") draws each one, fitted on its own; the page's language shows (invitation.css `[data-lg]`).
 */
export function Monogram({
  variants,
  effect,
  color,
  sealColor,
  wide = false,
  sheen = false,
}: {
  variants: readonly Variant[];
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
  // A first guess by glyph count (the server has no fonts to measure); refined after mount.
  const guess = (text: string) => Math.min(wide ? 40 : 38, ((W * 0.58) / ([...text].length || 1)) * 1.7);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const refs = useRef(new Map<string, SVGTextElement>());
  const sweep = useRef<SVGAnimateElement>(null);
  const texts = variants.map((v) => v.text).join('\u0000');

  useIsoLayoutEffect(() => {
    let live = true;
    // every language's text is laid out (a hidden one only with visibility: hidden) — each is measured
    const fit = () => {
      if (!live) return;
      const next: Record<string, number> = {};
      for (const [text, el] of refs.current) {
        const width = el.getComputedTextLength();
        const current = Number(el.getAttribute('font-size')) || guess(text);
        if (width <= 0) continue;
        let size = (current * (W * 0.58)) / width;
        // a script's swashes reach past its letters' width (a Cyrillic stand-in's more than most):
        // they may, as far as the seal's edge
        const ink = inkWidth(el, text, current);
        if (ink > 0) size = Math.min(size, (current * (W * INK)) / ink);
        next[text] = Math.min(wide ? 44 : 42, size);
      }
      if (Object.keys(next).length) setSizes((s) => ({ ...s, ...next }));
    };
    fit();
    // the monogram font may still be loading on the first paint; another language brings its own stack
    void document.fonts?.ready.then(fit);
    const refit = () => void document.fonts?.ready.then(fit);
    window.addEventListener('invitation:locale', refit);
    return () => {
      live = false;
      window.removeEventListener('invitation:locale', refit);
    };
  }, [texts, W]);

  useEffect(() => {
    if (sheen && effect === 'foil') sweep.current?.beginElement?.();
  }, [sheen, effect]);

  const ink =
    sealColor && (effect === 'emboss' || effect === 'deboss')
      ? mixHex(sealColor, effect === 'emboss' ? '#000000' : '#ffffff', effect === 'emboss' ? 0.18 : 0.22)
      : color;
  const draw = (text: string) => {
    const style: CSSProperties = { fontFamily: 'var(--f-monogram)', direction: textDir(text) };
    const at = {
      x: W / 2,
      y: H / 2,
      dy: '.35em',
      textAnchor: 'middle' as const,
      fontSize: sizes[text] ?? guess(text),
      style,
    };
    return (
      <>
        {effect === 'emboss' ? (
          <>
            <text
              {...at}
              x={at.x - 0.7}
              y={at.y - 0.7}
              fill="rgba(255,255,255,.4)"
              filter={`url(#soft${uid})`}
            >
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
          ref={(el) => {
            if (el) refs.current.set(text, el);
            else refs.current.delete(text);
          }}
          {...at}
          fill={effect === 'foil' ? `url(#foil${uid})` : ink}
          opacity={effect === 'print' ? 0.9 : 1}
          filter={effect === 'print' ? `url(#prn${uid})` : undefined}
        >
          {text}
        </text>
      </>
    );
  };

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
      {variants.length <= 1
        ? draw(variants[0]?.text ?? '')
        : variants.map((v) => (
            <g key={v.locales.join(' ')} data-lg={v.locales.join(' ')}>
              {draw(v.text)}
            </g>
          ))}
    </svg>
  );
}
