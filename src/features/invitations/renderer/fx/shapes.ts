/**
 * Particle shapes (renderer/fx), drawn in a 24×24 box centered on (12, 12): SVG path data used by
 * both the hero's ambient layer (inline <svg>) and the bursts (canvas Path2D). `stroke` shapes are
 * outlines; `detail` is a second, lighter path (a vein, a highlight) drawn over the fill.
 */
export interface Shape {
  d: string;
  /** an outline (width in box units) instead of a fill */
  stroke?: number;
  /** a second path over the fill: a vein, a highlight, a string */
  detail?: { d: string; stroke: number; color?: 'light' | 'same'; opacity: number };
  /** the box is taller than wide (balloon: 24×34) */
  h?: number;
}

export const SHAPES = {
  petal: {
    d: 'M12 1.8C17.4 5.2 19.6 10.6 17.6 15.6 16.4 18.8 14.3 21 12 22.2 9.7 21 7.6 18.8 6.4 15.6 4.4 10.6 6.6 5.2 12 1.8Z',
    detail: { d: 'M12 5.5C11.2 10 11.3 14.6 12 19', stroke: 0.8, color: 'light', opacity: 0.35 },
  },
  // a rounder petal with a notch (cherry / almond blossom)
  petal2: {
    d: 'M12 22.4C6.2 19.8 3.6 14.2 5.2 8.8 6.2 5.4 8.4 3 10.6 2.2L12 5.4 13.4 2.2C15.6 3 17.8 5.4 18.8 8.8 20.4 14.2 17.8 19.8 12 22.4Z',
    detail: { d: 'M12 7.5V19', stroke: 0.7, color: 'light', opacity: 0.3 },
  },
  leaf: {
    d: 'M12 1.5C17.8 5.5 19.8 12.4 12 22.5 4.2 12.4 6.2 5.5 12 1.5Z',
    detail: { d: 'M12 4.5V21M12 10 15.4 7.4M12 14.5 8.4 11.8', stroke: 0.9, color: 'light', opacity: 0.4 },
  },
  leaf2: {
    d: 'M4 20C3.6 11.6 9.4 4.6 20.5 3.5 20.2 14 13.8 20.4 4 20Z',
    detail: { d: 'M4.5 19.5C8.6 14.6 12.8 10.4 18 5.8', stroke: 0.9, color: 'light', opacity: 0.4 },
  },
  rect: { d: 'M4 7H20V17H4Z' },
  circle: { d: 'M12 6.5A5.5 5.5 0 1 1 12 17.5 5.5 5.5 0 0 1 12 6.5Z' },
  tri: { d: 'M12 4.5 20.5 19H3.5Z' },
  squiggle: { d: 'M2.5 15C4.9 9.8 7.3 9.8 9.7 15S14.5 20.2 16.9 15 19.8 10.2 21.5 12', stroke: 2.8 },
  heart: {
    d: 'M12 20.6S4.1 15.7 2.2 10.6C1 7.2 3.1 3.6 6.8 3.6 9 3.6 10.6 4.8 12 6.7 13.4 4.8 15 3.6 17.2 3.6 20.9 3.6 23 7.2 21.8 10.6 19.9 15.7 12 20.6 12 20.6Z',
    detail: { d: 'M6 7.8C6.6 6.9 7.5 6.4 8.5 6.3', stroke: 1.2, color: 'light', opacity: 0.55 },
  },
  sparkle: {
    d: 'M12 1C12.9 7.6 16.4 11.1 23 12 16.4 12.9 12.9 16.4 12 23 11.1 16.4 7.6 12.9 1 12 7.6 11.1 11.1 7.6 12 1Z',
  },
  star: { d: 'M12 2.5 14.9 8.6 21.5 9.4 16.6 14 17.9 20.6 12 17.3 6.1 20.6 7.4 14 2.5 9.4 9.1 8.6Z' },
  dot: { d: 'M12 8A4 4 0 1 1 12 16 4 4 0 0 1 12 8Z' },
  bubble: {
    d: 'M12 3A9 9 0 1 1 12 21 9 9 0 0 1 12 3Z',
    stroke: 1.7,
    detail: { d: 'M7 9.6C7.7 7.8 9.1 6.6 10.8 6.1', stroke: 1.6, color: 'light', opacity: 0.9 },
  },
  balloon: {
    d: 'M12 1.5C17.2 1.5 20.5 5.6 20.5 10.7 20.5 16.7 15.8 22.3 12 23.5 8.2 22.3 3.5 16.7 3.5 10.7 3.5 5.6 6.8 1.5 12 1.5ZM10.4 23.2H13.6L12 25.6Z',
    detail: { d: 'M7.6 7.6C8.4 5.7 9.8 4.6 11.5 4.3', stroke: 1.4, color: 'light', opacity: 0.6 },
    h: 34,
  },
  note: {
    d: 'M8.5 6.2 19 3.5V14.9A3.1 3.1 0 1 1 17.2 12.1V7.3L10.3 9.1V17.4A3.1 3.1 0 1 1 8.5 14.6Z',
  },
  note2: { d: 'M13.2 3H15C15.3 5.6 17.6 6.4 19 8.4 17.2 7.5 15.9 7.4 15 7.3V17.2A3.4 3.4 0 1 1 13.2 14.3Z' },
  pixel: { d: 'M6 6H18V18H6Z' },
  plus: { d: 'M9 3H15V9H21V15H15V21H9V15H3V9H9Z' },
} as const satisfies Record<string, Shape>;

export type ShapeId = keyof typeof SHAPES;

/** The balloon's string, drawn under it (not part of its fill). */
export const BALLOON_STRING = 'M12 25.6C10.4 28 13.6 30 12 33.5';
