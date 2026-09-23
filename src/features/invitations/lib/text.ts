/** Text helpers shared by seeding, validation and rendering. */

const segmenter = (locale?: string) => new Intl.Segmenter(locale, { granularity: 'grapheme' });

export function graphemes(text: string, locale?: string): string[] {
  return [...segmenter(locale).segment(text)].map((s) => s.segment);
}

export function firstGrapheme(text: string, locale?: string): string {
  return graphemes(text.trim(), locale)[0] ?? '';
}

/** Visible glyph count for monograms: grapheme clusters, spaces ignored (§3 validation rules). */
export function visibleGlyphCount(text: string, locale?: string): number {
  return graphemes(text, locale).filter((g) => g.trim() !== '').length;
}

/** Grapheme count of the longest word — what must fit on one line when a name wraps at spaces. */
export function longestWordLength(text: string, locale?: string): number {
  return Math.max(1, ...text.split(/\s+/).map((w) => graphemes(w, locale).length));
}

// Rough Hebrew → Latin transliteration, only used to *suggest* a slug the host can edit.
const HE: Record<string, string> = {
  א: 'a',
  ב: 'b',
  ג: 'g',
  ד: 'd',
  ה: 'h',
  ו: 'v',
  ז: 'z',
  ח: 'ch',
  ט: 't',
  י: 'y',
  כ: 'k',
  ך: 'ch',
  ל: 'l',
  מ: 'm',
  ם: 'm',
  נ: 'n',
  ן: 'n',
  ס: 's',
  ע: 'a',
  פ: 'p',
  ף: 'f',
  צ: 'tz',
  ץ: 'tz',
  ק: 'k',
  ר: 'r',
  ש: 'sh',
  ת: 't',
};

function transliterateHebrew(word: string): string {
  const chars = [...word];
  return chars
    .map((c, i) => {
      const isFirst = i === 0;
      const isLast = i === chars.length - 1;
      if (c === 'ו') return isFirst ? 'v' : 'o';
      if (c === 'י') return isFirst ? 'y' : isLast ? 'i' : 'i';
      if (c === 'ה' && isLast) return 'a';
      if ((c === 'א' || c === 'ע') && !isFirst && !isLast) return '';
      return HE[c] ?? c;
    })
    .join('');
}

/** "Noa", "Itay" → "noa-and-itay"; Hebrew names are transliterated; always matches the slug rule. */
export function suggestSlug(names: readonly string[]): string {
  const parts = names
    .map((n) =>
      n
        .trim()
        .split(/\s+/)
        .map((w) => (/[֐-׿]/.test(w) ? transliterateHebrew(w) : w))
        .join('-'),
    )
    .map((n) =>
      n
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean);
  let slug = parts.join('-and-').slice(0, 60).replace(/-+$/g, '');
  if (slug.length < 3) slug = `invitation-${slug || 'new'}`;
  return slug;
}
