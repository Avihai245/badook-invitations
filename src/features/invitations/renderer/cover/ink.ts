/**
 * How wide the cover's monogram really draws. A script face's swashes reach past its letters' advance
 * (a Latin script's Cyrillic stand-in's far past), so fitting by advance alone lets "Н&И" spill off
 * the seal: the monogram (Monogram.tsx) and the drawn seals (SealArt.tsx) also keep its ink in bounds.
 */

/** The widest the monogram's ink may run, as a share of its art's width. */
export const INK = 0.9;

let measure: CanvasRenderingContext2D | null | undefined;

/**
 * The width `text`, centred, needs at `size` in `el`'s font for its ink to stay inside: twice the
 * farthest its glyphs reach from the centre, swashes included (a swash may reach out on one side).
 */
export function inkWidth(el: SVGTextElement, text: string, size: number): number {
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure || !text || !(size > 0)) return 0;
  const cs = getComputedStyle(el);
  measure.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  measure.direction = cs.direction === 'rtl' ? 'rtl' : 'ltr';
  measure.textAlign = 'center';
  const m = measure.measureText(text);
  return 2 * Math.max(m.actualBoundingBoxLeft, m.actualBoundingBoxRight);
}
