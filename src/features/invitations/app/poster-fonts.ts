import 'server-only';
import { fontFaceCss, libraryDisplayFamilies } from '../fonts';
import { TEMPLATES } from '../templates/registry';

const manifests = () => [...TEMPLATES.values()].map(({ manifest }) => manifest);

/**
 * @font-face rules for the posters (TemplatePoster): each template's default display face (the names)
 * and heading face (opening line, date), regular weight — what they draw with. Inlined by the pages
 * that show posters; a browser downloads only the subsets it renders.
 */
export const POSTER_FONT_CSS = fontFaceCss(
  new Set(
    manifests().flatMap((m) => {
      const pair = m.fontPairs[0];
      return pair ? [pair.display.hebrew, pair.display.latin, pair.heading.hebrew, pair.heading.latin] : [];
    }),
  ),
  [400],
);

/**
 * The gallery's: the posters' fonts plus every pair's display face (its preview writes the names in
 * each), and the font library's (its "More fonts" writes each pair's name in them).
 */
export const GALLERY_FONT_CSS = [
  POSTER_FONT_CSS,
  fontFaceCss(
    new Set(manifests().flatMap((m) => m.fontPairs.flatMap((p) => [p.display.hebrew, p.display.latin]))),
  ),
  fontFaceCss(libraryDisplayFamilies(), [400]),
].join('\n');
