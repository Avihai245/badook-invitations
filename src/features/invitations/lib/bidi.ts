import bidiFactory from 'bidi-js';

const bidi = bidiFactory();
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * One line of text in visual (left-to-right display) order, for renderers that don't implement the
 * Unicode Bidirectional Algorithm — the OG image (satori) lays every string out left to right, which
 * would print Hebrew backwards. UAX #9 levels (bidi-js), rule L2 reordering by grapheme cluster (so
 * combining marks and emoji stay whole) and L4 mirroring (brackets). Never wrap the result: line
 * breaking must happen before reordering.
 */
export function visualLine(text: string, direction: 'rtl' | 'ltr'): string {
  if (!text) return text;
  const { levels } = bidi.getEmbeddingLevels(text, direction);
  const clusters: { s: string; level: number }[] = [];
  for (const { segment, index } of graphemes.segment(text)) {
    const level = levels[index] ?? 0;
    const mirrored = level & 1 && segment.length === 1 ? bidi.getMirroredCharacter(segment) : null;
    clusters.push({ s: mirrored ?? segment, level });
  }
  const odd = clusters.filter((c) => c.level & 1).map((c) => c.level);
  if (!odd.length) return clusters.map((c) => c.s).join('');
  const lowestOdd = Math.min(...odd);
  const highest = Math.max(...clusters.map((c) => c.level));
  // L2: from the highest level down to the lowest odd level, reverse every run at that level or higher
  for (let level = highest; level >= lowestOdd; level--) {
    for (let i = 0; i < clusters.length;) {
      if (clusters[i]!.level < level) {
        i++;
        continue;
      }
      let j = i;
      while (j < clusters.length && clusters[j]!.level >= level) j++;
      const run = clusters.slice(i, j).reverse();
      clusters.splice(i, run.length, ...run);
      i = j;
    }
  }
  return clusters.map((c) => c.s).join('');
}
