/**
 * The home page's posters, pre-rendered (scripts/build-poster-art.tsx): a poster's scenery runs to
 * hundreds, some to a thousand, SVG elements — the home page's 62 designs would carry ~13k of them,
 * and ~200 KB of markup, in its HTML and again in its RSC payload. A LazyTemplatePoster ships only its
 * frame (the sky, the size) and the address of its contents; PosterArtLoader fetches them as the
 * poster nears the screen. The files are versioned by what draws them (poster-art-version.ts), so the
 * CDN keeps them for good.
 */
import type { UiLocale } from '@/lib/i18n/app';

const version = () => process.env.INVITES_POSTER_ART_VERSION || '';

/** A template's sample poster (posterSample) in `locale`, pre-rendered — null when the build has none. */
export function lazyPosterUrl(templateId: string, locale: UiLocale): string | null {
  const v = version();
  return v ? `/poster-art/${v}/${locale}/${templateId}.html` : null;
}

/**
 * The posters' display and heading faces — { family: its @font-face rules } — fetched with the first
 * poster that nears the screen; each poster's own families are added as it does (`data-poster-fonts`),
 * so the fonts of posters far down the page are not downloaded with the first.
 */
export function posterFontsUrl(): string | null {
  const v = version();
  return v ? `/poster-art/${v}/fonts.json` : null;
}
