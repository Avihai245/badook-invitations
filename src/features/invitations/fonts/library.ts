import type { FontPair, Locale, TemplateManifest } from '../contracts/types';
import library from './library.json';

/**
 * The font library: Hebrew + Latin pairs any template can use, offered after a template's own pairs
 * ("More fonts"). A document's `theme.fontPairId` names either one of its template's pairs or one of
 * these; library ids start with "lib-", which template pair ids may not.
 * scripts/build-fonts.mjs self-hosts their families like the templates' (library.json is read there too).
 */
export interface LibraryFontPair extends FontPair {
  name: Record<Locale, string>;
}

export const LIBRARY_PAIR_PREFIX = 'lib-';

export const FONT_LIBRARY: readonly LibraryFontPair[] = library.pairs;

const BY_ID = new Map(FONT_LIBRARY.map((p) => [p.id, p]));

export function libraryPair(id: string | null | undefined): LibraryFontPair | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** The pair a `fontPairId` names: one of the template's own, else one from the library. */
export function findFontPair(
  template: Pick<TemplateManifest, 'fontPairs'>,
  id: string | null | undefined,
): FontPair | undefined {
  if (!id) return undefined;
  return template.fontPairs.find((p) => p.id === id) ?? BY_ID.get(id);
}
