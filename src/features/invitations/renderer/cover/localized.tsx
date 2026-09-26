import type { Locale } from '../../contracts/types';

/**
 * One text of the cover in the languages that share it. The cover is drawn with the page's first
 * bytes, and on a public page in several languages the page's language may change before React takes
 * over (the guest's browser speaks another of them — LiveLocale): the cover carries its texts in each
 * language and CSS shows the one of <html lang> (invitation.css `.l10n`, `[data-lg]`), so the cover is
 * right from its first paint, whatever the language.
 */
export interface Variant {
  locales: Locale[];
  text: string;
}

/** Each distinct text once, with every language that says it (in the languages' order). */
export function variantsOf(locales: readonly Locale[], textIn: (l: Locale) => string): Variant[] {
  const out: Variant[] = [];
  for (const l of locales) {
    const text = textIn(l);
    const same = out.find((v) => v.text === text);
    if (same) same.locales.push(l);
    else out.push({ locales: [l], text });
  }
  return out;
}

/** The first variant's text — what a single-language cover shows, and a measure of the rest. */
export const firstText = (variants: readonly Variant[]) => variants[0]?.text ?? '';

/** Hebrew or Arabic letters first: the text reads right to left. */
export function textDir(text: string): 'rtl' | 'ltr' {
  for (const ch of text) {
    if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return 'rtl';
    if (/\p{L}/u.test(ch)) return 'ltr';
  }
  return 'ltr';
}

/** A text in each of its languages (HTML): the one of the page's language shows. */
export function Localized({ variants }: { variants: readonly Variant[] }) {
  if (variants.length <= 1) return <>{firstText(variants)}</>;
  return (
    <span className="l10n">
      {variants.map((v) => (
        <span key={v.locales.join(' ')} data-l={v.locales.join(' ')} lang={v.locales[0]}>
          {v.text}
        </span>
      ))}
    </span>
  );
}

/**
 * The cover button's accessible name: its call to action — in one language a label; in several, the
 * hint shown for the page's language (the others are display: none, so they aren't read).
 */
export function coverName(hint: readonly Variant[], hintId: string) {
  return hint.length > 1 ? { 'aria-labelledby': hintId } : { 'aria-label': firstText(hint) };
}
