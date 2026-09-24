import { Play } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/components/app';
import { dirOf, type Locale, type TemplateManifest } from '../contracts/types';
import { longestWordLength } from '../lib/text';
import { placeholderArt, placeholderScrim, type PlaceholderArt } from '../renderer/placeholders';
import { Scene } from '../renderer/scenes';
import type { PosterText } from './poster';

export type PosterTemplate = Pick<TemplateManifest, 'id' | 'fontPairs' | 'hero'>;

/** Clouds over the sky: [left %, top %, width %, height %] (as in the invitation's placeholder art). */
const CLOUDS: [number, number, number, number][] = [
  [6, 11, 42, 8],
  [50, 20, 46, 10],
  [16, 31, 32, 6],
];

/**
 * A template — or a host's invitation — as the first screen of its invitation, 9:16 (§9B.3-B): the
 * template's scenery (the placeholder art its invitation shows until the template's media exists),
 * the opening line, the names in its display font, the date. A preview image replaces the scenery; a
 * preview video (children) plays on top of it. Everything scales with the card (container units), so
 * the same poster works from a 96px list thumbnail to the home page's phones. The page loads the
 * display fonts (POSTER_FONT_CSS).
 */
export function TemplatePoster({
  template,
  locale,
  text,
  joiner = '&',
  image,
  play = false,
  frameless = false,
  className,
  children,
}: {
  template: PosterTemplate;
  locale: Locale;
  text: PosterText;
  joiner?: string;
  image?: string | null;
  play?: boolean;
  /** inside a frame (a phone): no radius or shadow of its own */
  frameless?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const art = placeholderArt(template.id);
  const pair = template.fontPairs[0];
  const script = locale === 'he' ? 'hebrew' : 'latin';
  const font = (role: 'display' | 'heading') => (pair ? `'${pair[role][script]}', serif` : 'serif');
  const { textColor, overlayColor, defaultOverlay: ov } = template.hero;
  // a long name shrinks so a word never overflows the card (like the invitation's own names)
  const chars = Math.max(
    1,
    longestWordLength(text.primary, locale),
    text.secondary ? longestWordLength(text.secondary, locale) : 0,
  );
  const tint = (share: number) =>
    `color-mix(in srgb, ${overlayColor} ${Math.round(Math.min(1, ov * share) * 100)}%, transparent)`;
  return (
    <div
      dir={dirOf(locale)}
      lang={locale}
      className={cn(
        'relative isolate aspect-[9/16] overflow-hidden',
        !frameless && 'rounded-poster shadow-md',
        className,
      )}
      style={{ background: art.sky, containerType: 'inline-size' }}
    >
      <div aria-hidden className="absolute inset-0">
        {art.scene ? (
          <Scene id={art.scene} place="poster" date={isoDate(text.date)} />
        ) : (
          <Scenery art={art} />
        )}
      </div>
      {image ? <img src={image} alt="" className="absolute inset-0 size-full object-cover" /> : null}
      {children}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(75% 42% at 50% 42%, ${tint(1.1)}, ${tint(0.35)} 75%, ${tint(0.2)})`,
        }}
      />
      <div
        className="absolute inset-x-[8%] top-[24%] flex flex-col items-center text-center"
        style={
          {
            color: textColor,
            textShadow: `0 2px 18px color-mix(in srgb, ${overlayColor} 40%, transparent)`,
          } as CSSProperties
        }
      >
        {text.eyebrow ? (
          <p className="leading-tight text-balance" style={{ fontFamily: font('heading'), fontSize: '5cqw' }}>
            {text.eyebrow}
          </p>
        ) : null}
        <p
          className="mt-[3cqw] leading-[1.08]"
          style={{
            fontFamily: font('display'),
            fontSize: `min(15cqw, calc(84cqw / ${chars} / 0.56))`,
          }}
        >
          <bdi className="block">{text.primary}</bdi>
          {text.secondary ? (
            <>
              <span className="my-[0.12em] block text-[0.42em]" style={{ fontFamily: font('heading') }}>
                {joiner}
              </span>
              <bdi className="block">{text.secondary}</bdi>
            </>
          ) : null}
        </p>
        <span className="mt-[4.5cqw] h-px w-[22cqw] bg-current opacity-60" />
        {text.date ? (
          <p
            dir="ltr"
            className="mt-[3cqw] tracking-[0.14em] tabular-nums"
            style={{ fontFamily: font('heading'), fontSize: '4.6cqw' }}
          >
            {text.date}
          </p>
        ) : null}
      </div>
      {play ? (
        <span
          aria-hidden
          className="absolute end-3 bottom-3 grid size-8 place-items-center rounded-full bg-white/85 text-[#111] shadow-sm"
        >
          <Play size={14} />
        </span>
      ) : null}
    </div>
  );
}

/** The poster's date ('17.06.2027') as ISO, for scenes that write the day large. */
function isoDate(date: string | null): string | null {
  const m = date ? /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** The original templates' scenery: sky, clouds, hills (+ the scrim of pale skies). */
function Scenery({ art }: { art: PlaceholderArt }) {
  return (
    <>
      {CLOUDS.map(([x, y, w, h], i) => (
        <span
          key={i}
          className="absolute rounded-full blur-[10px]"
          style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, background: art.cloud }}
        />
      ))}
      <svg
        className="absolute inset-x-0 bottom-0 h-[44%] w-full"
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
      >
        <path d="M0 120 C80 70 160 90 230 110 S360 80 400 95 V260 H0Z" fill={art.hills[0]} opacity=".75" />
        <path d="M0 170 C100 130 200 150 280 160 S370 140 400 150 V260 H0Z" fill={art.hills[1]} />
        {Array.from({ length: 14 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 30} 260 L${150 + i * 8} 168`}
            stroke={art.hills[2]}
            strokeWidth="2"
            opacity=".55"
          />
        ))}
        <path d="M0 215 C120 190 260 205 400 195 V260 H0Z" fill={art.hills[3]} />
      </svg>
      {art.shade ? (
        <span className="absolute inset-0 mix-blend-multiply" style={{ background: placeholderScrim(art) }} />
      ) : null}
    </>
  );
}
