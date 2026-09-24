/**
 * Ornaments of the scene templates (24px grid, stroke = currentColor, like the kit icons): they stand
 * in for a missing section illustration and the footer decoration (PlaceholderArt.ornament), drawn at
 * 72–88px with a hairline stroke. A string is a path; `circle` / `dot` are circles (a dot is filled).
 */
type Shape =
  string | { circle: { cx: number; cy: number; r: number } } | { dot: { cx: number; cy: number; r: number } };

const ring = (cx: number, cy: number, r: number) => ({ circle: { cx, cy, r } });
const dot = (cx: number, cy: number, r = 0.45) => ({ dot: { cx, cy, r } });
const round = (n: number) => Math.round(n * 100) / 100;
const at = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`;
};
/** A rounded petal from the centre outward (quadratic lobes). */
const petal = (cx: number, cy: number, r0: number, r1: number, deg: number, spread: number) =>
  `M${at(cx, cy, r0, deg)}Q${at(cx, cy, r1 * 1.08, deg - spread)} ${at(cx, cy, r1, deg)}Q${at(cx, cy, r1 * 1.08, deg + spread)} ${at(cx, cy, r0, deg)}`;
/** A scalloped ring of `n` bumps. */
const scallop = (cx: number, cy: number, r: number, n: number, depth: number, turn = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = turn + (i * 360) / n;
    const a1 = turn + ((i + 1) * 360) / n;
    d += `${i ? '' : `M${at(cx, cy, r, a0)}`}Q${at(cx, cy, r + depth * 2, (a0 + a1) / 2)} ${at(cx, cy, r, a1)}`;
  }
  return `${d}Z`;
};

export const ORNAMENT_PATHS = {
  arch: ['M5 21V10.5a7 7 0 0 1 14 0V21', 'M8.5 21v-9.3a3.5 3.5 0 0 1 7 0V21', 'M3 21h18', ring(12, 5.4, 0.9)],
  cameo: [
    'M12 3.2c3.7 0 6.6 3.9 6.6 8.8s-2.9 8.8-6.6 8.8-6.6-3.9-6.6-8.8 2.9-8.8 6.6-8.8z',
    'M12 5.4c2.5 0 4.4 3 4.4 6.6s-1.9 6.6-4.4 6.6-4.4-3-4.4-6.6 1.9-6.6 4.4-6.6z',
    'M13.2 8.4c-1.3-.4-2.6.4-2.8 1.8l-.9 1.5.9.3-.2 1 .6.3-.3.8c.3.7 1 .9 1.8.7l.3 1.8',
    'M12 3.2 10.4 1.8v2.8zM12 3.2l1.6-1.4v2.8z',
  ],
  peony: [
    scallop(12, 9, 5.2, 7, 0.9, -90),
    scallop(12, 9, 2.9, 5, 0.7, -60),
    ring(12, 9, 1),
    'M12 15.4V22',
    'M12 19.2c-2.4-.2-4-1.5-4.7-3.6 2.3.1 4 1.3 4.7 3.6z',
    'M12 17.8c1.8-.6 3.4-.3 4.6.9-1.8.8-3.4.6-4.6-.9z',
  ],
  anemone: [
    ...[0, 60, 120, 180, 240, 300].map((a) => petal(12, 9, 1.6, 6.2, a - 90, 26)),
    ring(12, 9, 1.7),
    ...[0, 72, 144, 216, 288].map((a) => {
      const [x, y] = at(12, 9, 2.7, a).split(' ').map(Number) as [number, number];
      return dot(x, y, 0.35);
    }),
    'M12 15.3V22',
    'M12 18.6c-.9-1.3-2.3-2-4-2.1M12 18.6c.9-1.3 2.3-2 4-2.1M9.4 17.2l-.9-1.4M14.6 17.2l.9-1.4',
  ],
  'olive-branch': [
    'M3.5 20.5C8 17 12.5 12 20.5 3.5',
    'M7.6 17c-.3-1.8.4-3.3 2-4.2.3 1.8-.4 3.3-2 4.2z',
    'M8.4 16.2c1.8.2 3.2 1.1 3.8 2.7-1.8-.1-3.2-1-3.8-2.7z',
    'M12.2 12.4c-.2-1.8.6-3.3 2.2-4.1.2 1.8-.6 3.3-2.2 4.1z',
    'M13 11.6c1.8.3 3.1 1.3 3.6 2.9-1.8-.2-3.1-1.2-3.6-2.9z',
    'M16.6 7.6c0-1.7.9-3 2.4-3.6 0 1.7-.9 3-2.4 3.6z',
    ring(10.6, 19.6, 1.2),
    ring(15.8, 15.6, 1.1),
  ],
  hamsa: [
    'M12 21.2c-3.5 0-5.9-2.4-5.9-5.6v-1.8c-1-.4-1.7-1.3-1.7-2.4 0-.6.6-.9 1.1-.6l1.6 1V6.4a1 1 0 0 1 2 0v4.2V4.6a1 1 0 0 1 2 0v6V4a1 1 0 0 1 2 0v6.6-6a1 1 0 0 1 2 0v6-4.2a1 1 0 0 1 2 0v5.4l1.6-1c.5-.3 1.1 0 1.1.6 0 1.1-.7 2-1.7 2.4v1.8c0 3.2-2.4 5.6-5.9 5.6z',
    'M8.9 16.3c1.7-1.9 4.5-1.9 6.2 0-1.7 1.9-4.5 1.9-6.2 0z',
    ring(12, 16.3, 0.9),
    dot(9, 13, 0.35),
    dot(12, 12.6, 0.35),
    dot(15, 13, 0.35),
  ],
  rosette: [
    ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => petal(12, 12, 2.6, 8.6, a, 18)),
    ring(12, 12, 2.4),
    dot(12, 12, 0.8),
    ring(12, 12, 10.2),
  ],
  'scribble-heart': [
    'M12 20.2C6.4 15.7 3.4 12.6 3.4 9a4.3 4.3 0 0 1 8.6-1.3A4.3 4.3 0 0 1 20.6 9c0 3.6-3 6.7-8.6 11.2z',
    'M11.2 18.2C7.3 14.9 5.1 12.4 5.3 9.4c.2-2.2 2.2-3.4 4.1-2.8',
    'M12.4 21.4c.6.9 1.8 1.3 2.8.8.8-.4.9-1.4.2-1.9-.8-.6-2.1-.3-3 .4',
  ],
  torah: [
    'M5 3.5v17M19 3.5v17',
    'M3.8 3.5h2.4M3.8 20.5h2.4M17.8 3.5h2.4M17.8 20.5h2.4',
    'M5 5.8c2.5.6 4.3.6 7 0s4.5-.6 7 0M5 18.2c2.5.6 4.3.6 7 0s4.5-.6 7 0',
    'M8.5 9h7M8.5 11.5h7M8.5 14h7',
  ],
  ball: [
    ring(12, 12, 9),
    'M12 8.1l3.7 2.7-1.4 4.4H9.7l-1.4-4.4z',
    'M12 8.1V3M15.7 10.8l4.8-1.6M14.3 15.2l3 4M9.7 15.2l-3 4M8.3 10.8 3.5 9.2',
  ],
  bow: [
    'M12 11.2C9.4 7.6 4.3 6.4 4 9.4c-.3 2.8 4.6 3.7 8 1.8z',
    'M12 11.2c2.6-3.6 7.7-4.8 8-1.8.3 2.8-4.6 3.7-8 1.8z',
    'M11.1 12.2 7.6 19.6l1.8-.5.8 1.6 2.3-8.1M12.9 12.2l3.5 7.4-1.8-.5-.8 1.6-2.3-8.1',
    ring(12, 11.4, 1.3),
  ],
  blossom: [
    ...[0, 72, 144, 216, 288].map((a) => petal(12, 12, 1.8, 8.4, a - 90, 30)),
    ring(12, 12, 1.5),
    ...[-54, -18, 18, 54, 90, 126, 162, 198, 234].map((a) => {
      const [x, y] = at(12, 12, 3.6, a - 90)
        .split(' ')
        .map(Number) as [number, number];
      return dot(x, y, 0.35);
    }),
  ],
  teddy: [
    ring(6.6, 6.8, 2.5),
    ring(17.4, 6.8, 2.5),
    ring(12, 12.6, 7.2),
    'M9.4 15.3c0-1.6 1.2-2.7 2.6-2.7s2.6 1.1 2.6 2.7-1.2 2.4-2.6 2.4-2.6-.8-2.6-2.4z',
    'M11.2 14.2h1.6l-.8.9z',
    dot(9.3, 11, 0.55),
    dot(14.7, 11, 0.55),
  ],
  dino: [
    'M2.8 18.6c2.3.3 3.7-.6 4.6-2.8.9-2.3 2.6-3.7 5.2-3.9 2.2-.2 3.5-1.3 4-3.6.4-1.8 1.4-3 3-3 1.3 0 2 .8 2 1.6 0 .9-.8 1.3-1.8 1.2-.8 0-1.3.6-1.4 1.6-.4 3.3-1.4 6.2-3.2 7.6l.6 3.3h-1.9l-.7-2.5c-1.6.4-3.5.4-5.1 0l-.5 2.5H7.7l.4-3c-1.7.7-3.4.8-5.3 0z',
    dot(19.9, 5.9, 0.4),
    'M9.6 12.4l.6-1.5.8 1.1.7-1.6.8 1.2.8-1.4.6 1.3',
  ],
  'deco-fan': [
    'M3 18a9 9 0 0 1 18 0z',
    'M7.6 18a4.4 4.4 0 0 1 8.8 0',
    ...[180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5, 360].map(
      (a) => `M${at(12, 18, 4.4, a)}L${at(12, 18, 9, a)}`,
    ),
    'M3 20.5h18',
    'M12 21.5l-.9.9.9.9.9-.9z',
  ],
  bauhaus: [ring(7.5, 8, 4.2), 'M13.5 3.8h7v7h-7z', 'M3.5 20.5l4.8-7.8 4.8 7.8z', 'M15 20.5h5.5'],
} satisfies Record<string, readonly Shape[]>;

export type OrnamentIconName = keyof typeof ORNAMENT_PATHS;
export type OrnamentShape = Shape;
