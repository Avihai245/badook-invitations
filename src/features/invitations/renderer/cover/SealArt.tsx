import { useId, type CSSProperties, type SVGProps } from 'react';
import type { Locale } from '../../contracts/types';
import { graphemes, visibleGlyphCount } from '../../lib/text';

/** Irregular wax-seal outline (same 28-point shape as the design reference). */
const SEAL_PATH = (() => {
  const pts: string[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 46 + Math.sin(i * 2.7) * 2.2 + Math.cos(i * 1.3) * 1.6;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
})();

const seal = (pct: number, mix: '#fff' | '#000') => `color-mix(in srgb, var(--inv-seal) ${pct}%, ${mix})`;

/**
 * Lines and font size for the cover text in `width` viewBox units. Up to 3 glyphs (initials, "N&I")
 * keep the design's size; longer text ("DANA 30", a name) shrinks to fit — on two lines, split at
 * its last space, where the art is tall enough (`twoLines`). An estimate by glyph count: the text is
 * drawn before its font is measurable.
 */
function fitText(text: string, locale: Locale, base: number, width: number, twoLines: boolean) {
  if (visibleGlyphCount(text, locale) <= 3) return { lines: [text], size: base };
  const cut = text.trim().lastIndexOf(' ');
  const lines =
    twoLines && cut > 0 ? [text.trim().slice(0, cut).trim(), text.trim().slice(cut + 1)] : [text.trim()];
  const em = locale === 'he' ? 0.58 : 0.66; // average advance of a display face's capitals / letters
  const longest = Math.max(...lines.map((l) => graphemes(l, locale).length));
  const size = Math.min(base * (lines.length > 1 ? 0.8 : 1), width / (longest * em));
  return { lines, size: Math.round(size * 10) / 10 };
}

/** SVG text centred on (x, y), one tspan per line. */
function Lines({
  lines,
  size,
  x,
  y,
  ...rest
}: { lines: string[]; size: number; x: number; y: number } & SVGProps<SVGTextElement>) {
  const step = Math.round(size * 1.02 * 10) / 10;
  return (
    <text x={x} y={y - ((lines.length - 1) * step) / 2} textAnchor="middle" fontSize={size} {...rest}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? '.35em' : step}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * CSS fallback for the overlay when the blank seal/medallion PNG isn't available (§5): a disc in
 * `sealColor` with the monogram pressed into it (the P3 renderer adds the PNG recolor + effects).
 */
export function SealArt({
  text,
  locale,
  shape,
}: {
  text: string;
  locale: Locale;
  shape: 'wax_seal' | 'medallion';
}) {
  const id = useId().replace(/:/g, '');
  const { lines, size } = fitText(text, locale, locale === 'he' ? 28 : 34, 54, true);
  const textStyle: CSSProperties = {
    fontFamily: 'var(--f-monogram)',
    direction: locale === 'he' ? 'rtl' : 'ltr',
  };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`sg${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" style={{ stopColor: seal(70, '#fff') }} />
          <stop offset=".55" style={{ stopColor: 'var(--inv-seal)' }} />
          <stop offset="1" style={{ stopColor: seal(70, '#000') }} />
        </radialGradient>
        <filter id={`sh${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodOpacity=".35" />
        </filter>
      </defs>
      {shape === 'wax_seal' ? (
        <path d={SEAL_PATH} fill={`url(#sg${id})`} filter={`url(#sh${id})`} />
      ) : (
        <circle cx="50" cy="50" r="46" fill={`url(#sg${id})`} filter={`url(#sh${id})`} />
      )}
      <circle
        cx="50"
        cy="50"
        r="33"
        fill="none"
        style={{ stroke: seal(72, '#000') }}
        strokeWidth="1.4"
        opacity=".7"
      />
      <circle
        cx="50"
        cy="50"
        r="33"
        fill="none"
        stroke="rgba(255,255,255,.25)"
        strokeWidth=".8"
        transform="translate(-.6,-.6)"
      />
      {shape === 'medallion' ? (
        <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".8" />
      ) : null}
      <Lines
        lines={lines}
        size={size}
        x={50}
        y={50}
        fill="rgba(255,255,255,.28)"
        transform="translate(-.7,-.7)"
        style={textStyle}
      />
      <Lines lines={lines} size={size} x={50} y={50} style={{ ...textStyle, fill: seal(62, '#000') }} />
    </svg>
  );
}

/** Paper/wood tag with the monogram printed on it (ramon-dusk, nitzan). */
export function TagArt({ text, locale, ink }: { text: string; locale: Locale; ink: string }) {
  const { lines, size } = fitText(text, locale, locale === 'he' ? 20 : 22, 34, true);
  const textStyle: CSSProperties = {
    fontFamily: 'var(--f-monogram)',
    direction: locale === 'he' ? 'rtl' : 'ltr',
  };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 2 C44 10 40 14 38 22" fill="none" stroke="rgba(90,70,50,.55)" strokeWidth="1.2" />
      <path
        d="M30 24 L50 12 L70 24 L70 90 Q70 94 66 94 L34 94 Q30 94 30 90 Z"
        style={{ fill: 'color-mix(in srgb, var(--inv-surface) 70%, #c9a57a)' }}
        stroke="rgba(90,70,50,.35)"
        strokeWidth=".8"
      />
      <circle cx="50" cy="24" r="3.2" fill="rgba(60,40,25,.55)" />
      <Lines lines={lines} size={size} x={50} y={62} fill={ink} opacity=".9" style={textStyle} />
    </svg>
  );
}

/**
 * Admission ticket (`ticket_text`): the text is the overlay. The paper is vintage cream unless the
 * template's placeholder art gives it another (`--ticket-paper`, `--ticket-edge`).
 */
export function TicketArt({ text, locale, ink }: { text: string; locale: Locale; ink: string }) {
  const { lines, size } = fitText(text, locale, locale === 'he' ? 30 : 24, 136, false);
  const textStyle: CSSProperties = {
    fontFamily: 'var(--f-monogram)',
    direction: locale === 'he' ? 'rtl' : 'ltr',
  };
  return (
    <svg viewBox="0 0 220 100" aria-hidden="true">
      <path
        d="M8 4 H212 a4 4 0 0 1 4 4 V38 a12 12 0 0 0 0 24 V92 a4 4 0 0 1 -4 4 H8 a4 4 0 0 1 -4 -4 V62 a12 12 0 0 0 0 -24 V8 a4 4 0 0 1 4 -4 Z"
        style={{ fill: 'var(--ticket-paper, #F3E6CF)', stroke: 'var(--ticket-edge, rgba(0,0,0,.15))' }}
        strokeWidth=".8"
      />
      <path d="M168 10 V90" stroke={ink} strokeWidth="1" strokeDasharray="3 4" opacity=".35" />
      <rect
        x="14"
        y="14"
        width="148"
        height="72"
        rx="3"
        fill="none"
        stroke={ink}
        strokeWidth=".8"
        opacity=".3"
      />
      <Lines lines={lines} size={size} x={88} y={50} fill={ink} opacity=".9" style={textStyle} />
      <text
        x="192"
        y="50"
        dy=".35em"
        textAnchor="middle"
        fontSize="11"
        fill={ink}
        opacity=".55"
        transform="rotate(-90 192 50)"
        style={{ fontFamily: 'var(--f-ui)' }}
      >
        ★ ★ ★
      </text>
    </svg>
  );
}
