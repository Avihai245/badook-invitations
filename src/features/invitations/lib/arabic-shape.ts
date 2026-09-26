/**
 * Arabic letters in their joined forms (Unicode Arabic Presentation Forms), for renderers without an
 * Arabic shaper that also can't lay text out right to left — the OG image (satori): the shaping is
 * decided on the text in reading order here, then lib/bidi puts it in visual order, and the glyphs
 * are the presentation forms a full Arabic font maps (Amiri, Noto Naskh / Kufi Arabic). Letters of
 * other scripts, digits and marks pass through.
 */

/** [isolated, final, initial, medial] — a right-joining letter has only the first two. */
const FORMS: Record<number, readonly number[]> = {
  0x0621: [0xfe80],
  0x0622: [0xfe81, 0xfe82],
  0x0623: [0xfe83, 0xfe84],
  0x0624: [0xfe85, 0xfe86],
  0x0625: [0xfe87, 0xfe88],
  0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c],
  0x0627: [0xfe8d, 0xfe8e],
  0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92],
  0x0629: [0xfe93, 0xfe94],
  0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98],
  0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c],
  0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0],
  0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4],
  0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8],
  0x062f: [0xfea9, 0xfeaa],
  0x0630: [0xfeab, 0xfeac],
  0x0631: [0xfead, 0xfeae],
  0x0632: [0xfeaf, 0xfeb0],
  0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4],
  0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc],
  0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0],
  0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8],
  0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc],
  0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0],
  0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4],
  0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8],
  0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0],
  0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4],
  0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec],
  0x0648: [0xfeed, 0xfeee],
  // alef maksura only ends a word in Arabic: right-joining here
  0x0649: [0xfeef, 0xfef0],
  0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4],
  // the letters Arabic borrows for foreign sounds (names: پ p, چ ch, ڤ v, گ g, ژ zh)
  0x067e: [0xfb56, 0xfb57, 0xfb58, 0xfb59],
  0x0686: [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d],
  0x06a4: [0xfb6a, 0xfb6b, 0xfb6c, 0xfb6d],
  0x06af: [0xfb92, 0xfb93, 0xfb94, 0xfb95],
  0x0698: [0xfb8a, 0xfb8b],
};

/** lam + alef (with madda, hamza above, hamza below, plain) → [isolated, final] ligature. */
const LAM_ALEF: Record<number, readonly [number, number]> = {
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa],
  0x0627: [0xfefb, 0xfefc],
};

const TATWEEL = 0x0640;
const ZWJ = 0x200d;
/** Marks that sit on a letter without breaking its joins (harakat, superscript alef). */
const isTransparent = (c: number) => (c >= 0x064b && c <= 0x065f) || c === 0x0670;
/** Joins the letter after it: dual-joining letters, tatweel, a zero-width joiner. */
const joinsForward = (c: number | undefined) =>
  c !== undefined && (c === TATWEEL || c === ZWJ || (FORMS[c]?.length ?? 0) === 4);
/** Joins the letter before it: every letter that has a final form, tatweel, a zero-width joiner. */
const joinsBackward = (c: number | undefined) =>
  c !== undefined && (c === TATWEEL || c === ZWJ || (FORMS[c]?.length ?? 0) >= 2);

export function shapeArabic(text: string): string {
  if (!/[؀-ۿ]/.test(text)) return text;
  const cps = [...text].map((ch) => ch.codePointAt(0)!);
  // the nearest letter before / after each position, skipping the marks on letters
  const neighbour = (i: number, step: -1 | 1): number | undefined => {
    for (let j = i + step; j >= 0 && j < cps.length; j += step) if (!isTransparent(cps[j]!)) return cps[j];
    return undefined;
  };
  const out: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i]!;
    const forms = FORMS[c];
    if (!forms) {
      out.push(String.fromCodePoint(c));
      continue;
    }
    const prev = neighbour(i, -1);
    const next = neighbour(i, 1);
    const joinsPrev = joinsForward(prev) && forms.length >= 2;
    // lam-alef: one ligature, final when the lam joins the letter before it
    if (c === 0x0644 && next !== undefined && LAM_ALEF[next]) {
      let j = i + 1;
      while (j < cps.length && isTransparent(cps[j]!)) j++;
      const marks = cps.slice(i + 1, j).map((m) => String.fromCodePoint(m));
      out.push(String.fromCodePoint(LAM_ALEF[next]![joinsPrev ? 1 : 0]), ...marks);
      i = j;
      continue;
    }
    const joinsNext = forms.length === 4 && joinsBackward(next);
    const form = joinsPrev && joinsNext ? 3 : joinsNext ? 2 : joinsPrev ? 1 : 0;
    out.push(String.fromCodePoint(forms[form] ?? forms[0]!));
  }
  return out.join('');
}
