import type { CSSProperties } from 'react';
import { Layer, Piece, cm, cmh, type SceneAnim, type SceneProps } from './kit';

/**
 * Pixel Quest — an 8-bit level at noon: a stepped blue sky, outlined pixel clouds, a HUD of hearts and
 * a game pad, a "LEVEL UP!" banner, rolling pixel hills, a grass-and-dirt ground, a question block with
 * a coin popping out of it and coins caught mid-spin. Every sprite is drawn on one pixel grid (crisp
 * edges), so the whole level keeps one pixel size. The banner follows the accent.
 */
const ACCENT = 'var(--inv-accent, #FFC21A)';
const ACCENT_LIGHT = 'color-mix(in srgb, var(--inv-accent, #FFC21A) 45%, #FFFFFF)';

type Pal = Record<string, string>;
type Grid = string[][];

const grid = (w: number, h: number, c = '.'): Grid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => c));
const rowsOf = (g: Grid) => g.map((r) => r.join(''));
/** Copy `rows` onto `g` at (x, y); '.' is transparent, `as` recolours every pixel. */
function stamp(g: Grid, rows: readonly string[], x: number, y: number, as?: string) {
  rows.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c !== '.' && g[y + j]?.[x + i] !== undefined) g[y + j]![x + i] = as ?? c;
    }),
  );
}

/**
 * A silhouette on a w×h grid: an outline pixel ('K') wherever the shape meets the outside, the inside
 * painted by `paint` (a palette key per pixel).
 */
function outlined(
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  paint: (x: number, y: number) => string,
): string[] {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && inside(x, y);
  const g = grid(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      g[y]![x] = edge ? 'K' : paint(x, y);
    }
  return rowsOf(g);
}

/** Pixel rows → one path per colour (runs of 1-unit squares), with crisp edges. */
function Px({ rows, pal, x = 0 }: { rows: readonly string[]; pal: Pal; x?: number }) {
  const runs = new Map<string, string>();
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length;) {
      const c = row[i]!;
      let k = i + 1;
      while (k < row.length && row[k] === c) k++;
      if (pal[c]) runs.set(c, `${runs.get(c) ?? ''}M${x + i} ${j}h${k - i}v1h${i - k}z`);
      i = k;
    }
  });
  return (
    <g shapeRendering="crispEdges">
      {[...runs].map(([c, d]) => (
        <path key={c} d={d} style={{ fill: pal[c] }} />
      ))}
    </g>
  );
}

const vb = (rows: readonly string[]) => [0, 0, rows[0]!.length, rows.length] as const;

// ── sprites (computed once) ─────────────────────────────────────────────────────────────────────

const HEART = [
  '.KKK.KKK.',
  'KRRRKRRRK',
  'KRLLRRRRK',
  'KRLRRRRRK',
  'KRRRRRRDK',
  '.KRRRRDK.',
  '..KRRDK..',
  '...KDK...',
  '....K....',
];
const HEART_PAL: Pal = { K: '#3D0714', R: '#FF3B5C', L: '#FFB8C6', D: '#C0163A' };

/** A coin mid-spin: `rx` is its half-width in pixels (4 = facing us, 1 = edge on). */
function coin(rx: number): string[] {
  const w = rx * 2;
  const h = 14;
  if (rx === 1) return ['.K.', ...Array.from({ length: h - 2 }, (_, y) => (y < 2 ? 'KLK' : 'KYK')), '.K.'];
  return outlined(
    w,
    h,
    (x, y) => ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 <= 1.02,
    (x, y) => {
      if (rx >= 3 && x === rx && y >= 4 && y <= h - 5) return 'D'; // the stamped slot
      if (x <= Math.max(1, rx - 3)) return 'L';
      if (x >= w - 2) return 'D';
      return 'Y';
    },
  );
}
const COIN_PAL: Pal = { K: '#5A3800', Y: '#FFD23F', L: '#FFF4B8', D: '#D99A00' };
const COINS = [coin(4), coin(3), coin(2), coin(1)];

const QUESTION = ['.WWWW.', 'WW..WW', '....WW', '...WW.', '..WW..', '..WW..', '......', '..WW..', '..WW..'];
const BLOCK = (() => {
  const g = grid(16, 16, 'Y');
  for (let i = 0; i < 16; i++) g[0]![i] = g[15]![i] = g[i]![0] = g[i]![15] = 'K';
  for (let i = 1; i < 15; i++) {
    g[1]![i] = 'L';
    g[i]![1] = 'L';
    g[14]![i] = 'D';
    g[i]![14] = 'D';
  }
  for (const [x, y] of [
    [3, 3],
    [12, 3],
    [3, 12],
    [12, 12],
  ] as const)
    g[y]![x] = 'R';
  stamp(g, QUESTION, 6, 4, 'S');
  stamp(g, QUESTION, 5, 3);
  return rowsOf(g);
})();
const BLOCK_PAL: Pal = {
  K: '#3D2200',
  Y: '#F8B800',
  L: '#FFE17A',
  D: '#C07A00',
  R: '#7A4600',
  W: '#FFFFFF',
  S: '#9A5A00',
};

/** A little white glint (5×5 plus). */
const GLINT = ['..W..', '..W..', 'WWWWW', '..W..', '..W..'];

/** Pixel cloud: bumps of circles over a flat bottom, a pale-blue belly. */
function cloud(w: number, h: number, bumps: readonly (readonly [number, number, number])[]) {
  return outlined(
    w,
    h,
    (x, y) =>
      (y >= h - 5 && x >= 2 && x < w - 2) ||
      bumps.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r),
    (_x, y) => (y >= h - 3 ? 'B' : 'W'),
  );
}
const CLOUD_PAL: Pal = { K: '#0F1B4D', W: '#FFFFFF', B: '#BCD4FF' };
const CLOUD_BIG = cloud(30, 13, [
  [8, 8, 5.2],
  [15, 6, 6.4],
  [22, 8, 5.2],
]);
const CLOUD_SMALL = cloud(20, 10, [
  [6, 6, 4.2],
  [12, 5, 5],
]);

/** A rolling hill: a dome over the full width, dark on its right flank, a few pixel shrubs. */
function hill(w: number, h: number, dots: readonly (readonly [number, number])[]) {
  const top = (x: number) => h - h * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - w / 2) / (w / 2)) ** 2));
  return outlined(
    w,
    h + 1,
    (x, y) => y >= Math.round(top(x)),
    (x, y) => {
      if (dots.some(([dx, dy]) => (x === dx || x === dx + 1) && y === dy)) return 'S';
      if (x > w * 0.68 && y > top(x) + 2) return 'D';
      if (x < w * 0.4 && y <= top(x) + 2) return 'L';
      return 'G';
    },
  );
}
const HILL_PAL: Pal = { K: '#0B3B26', G: '#3CC05A', L: '#7BE08A', D: '#2C9A48', S: '#1E7A3A' };
const FAR_PAL: Pal = { K: '#0F3F45', G: '#2E9D8A', L: '#4FBBA3', D: '#24857A', S: '#1C6E66' };
const HILL_BIG = hill(46, 22, [
  [14, 12],
  [24, 8],
  [30, 15],
  [19, 18],
]);
const HILL_MID = hill(34, 15, [
  [11, 9],
  [21, 6],
]);
const HILL_FAR = hill(60, 26, [
  [18, 14],
  [34, 9],
  [44, 18],
]);

/** One 16×16 ground tile: grass with a ragged edge over dirt with pebbles. */
const TILE = (() => {
  const g = grid(16, 16, 'd');
  const grass = [4, 5, 4, 3, 4, 5, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < grass[x]!; y++) g[y]![x] = y === 0 ? 'l' : 'g';
    g[grass[x]!]![x] = 'e';
  }
  for (const [x, y] of [
    [2, 8],
    [3, 8],
    [9, 7],
    [12, 11],
    [13, 11],
    [6, 13],
    [1, 14],
    [10, 14],
  ] as const)
    g[y]![x] = 'p';
  for (const [x, y] of [
    [5, 9],
    [14, 8],
    [8, 11],
    [3, 12],
    [11, 15],
  ] as const)
    g[y]![x] = 'b';
  return rowsOf(g);
})();
const TILE_PAL: Pal = { l: '#7BE36B', g: '#45C64F', e: '#1D6B2E', d: '#C8743A', p: '#9A5226', b: '#E6A05E' };

/** A game pad seen from above: grips, a D-pad, four coloured buttons, start / select. */
const PAD = (() => {
  const spans: Record<number, [number, number][]> = {
    0: [
      [5, 10],
      [17, 22],
    ],
    1: [[3, 24]],
    2: [[1, 26]],
    3: [[0, 27]],
    4: [[0, 27]],
    5: [[0, 27]],
    6: [[0, 27]],
    7: [[0, 27]],
    8: [[0, 27]],
    9: [
      [0, 10],
      [17, 27],
    ],
    10: [
      [0, 9],
      [18, 27],
    ],
    11: [
      [1, 8],
      [19, 26],
    ],
    12: [
      [2, 7],
      [20, 25],
    ],
  };
  const rows = outlined(
    28,
    13,
    (x, y) => (spans[y] ?? []).some(([a, b]) => x >= a && x <= b),
    (_x, y) => (y >= 8 ? 'S' : y <= 2 ? 'L' : 'B'),
  );
  const g = rows.map((r) => [...r]);
  stamp(g, ['..P..', '..P..', 'PPPPP', '..P..', '..P..'], 3, 3);
  stamp(g, ['..YY..', '..YY..', 'XX..AA', 'XX..AA', '..GG..', '..GG..'], 19, 2);
  stamp(g, ['MM.MM'], 11, 5);
  return rowsOf(g);
})();
const PAD_PAL: Pal = {
  K: '#1A1C33',
  B: '#E4E7F2',
  L: '#FFFFFF',
  S: '#AEB3C9',
  P: '#2B2E4A',
  M: '#7D84A6',
  A: '#FF3B5C',
  X: '#2BB8FF',
  Y: '#FFC21A',
  G: '#3DDC6A',
};

/**
 * "LEVEL UP!" in a chunky 6×8 pixel face — two-pixel strokes both ways, so it still reads on a list
 * thumbnail — outlined, with a drop shadow.
 */
const FONT: Record<string, string[]> = {
  L: ['XX....', 'XX....', 'XX....', 'XX....', 'XX....', 'XX....', 'XXXXXX', 'XXXXXX'],
  E: ['XXXXXX', 'XXXXXX', 'XX....', 'XXXXX.', 'XXXXX.', 'XX....', 'XXXXXX', 'XXXXXX'],
  V: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.', '..XX..'],
  U: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  P: ['XXXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXXXX.', 'XX....', 'XX....'],
  '!': ['XX', 'XX', 'XX', 'XX', 'XX', '..', 'XX', 'XX'],
};
const LEVEL_UP = (() => {
  const text = [...'LEVEL UP!'];
  const adv = text.map((c) => (FONT[c] ? FONT[c]![0]!.length + 1 : 3));
  const glyphs = grid(adv.reduce((a, b) => a + b, 0) - 1, 8);
  let x = 0;
  text.forEach((c, i) => {
    if (FONT[c]) stamp(glyphs, FONT[c]!, x, 0);
    x += adv[i]!;
  });
  const lit = rowsOf(glyphs);
  const g = grid(lit[0]!.length + 3, 11);
  // the outline (and, one pixel lower right, its shadow): the glyphs grown by a pixel all round
  const grow = (dx: number, dy: number, as: string) => {
    for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) stamp(g, lit, 1 + dx + ox, 1 + dy + oy, as);
  };
  grow(1, 1, 'S');
  grow(0, 0, 'K');
  stamp(
    g,
    lit.map((r, j) => r.replaceAll('X', j < 3 ? 'T' : 'X')),
    1,
    1,
  );
  return rowsOf(g);
})();
const LEVEL_PAL: Pal = { S: '#0B1030', K: '#101438', T: ACCENT_LIGHT, X: ACCENT };

// ── the scene ───────────────────────────────────────────────────────────────────────────────────

/**
 * Positions are in pixels of the level's grid: 1.05 hundredths of the shorter side each, at most what
 * that is on a 9:16 portrait (cmh), so a landscape hero keeps the level low and its middle free.
 */
export default function PixelQuest({ place }: SceneProps) {
  const card = place === 'card';
  const hero = place === 'hero';
  const size = (n: number) => Math.round(n * 100) / 100;
  const px = (n: number) => (card ? cm(size(n * 0.62)) : cmh(size(n * 1.05)));
  const hx = (n: number) => (card ? cm(size(n * 0.5)) : cmh(size(n * 0.72)));
  const ground = 16; // the ground's depth, in pixels
  const onGround = (n: number) => `calc(${px(ground)} + ${px(n)})`;
  // the HUD sits under the floating language button in the hero
  const hudTop = hero ? 'max(8cqh, 64px)' : '7cqh';
  const sprite = (rows: readonly string[], pal: Pal, style: CSSProperties, anim?: SceneAnim) => (
    <Piece vb={vb(rows)} anim={anim} style={{ width: px(rows[0]!.length), ...style }}>
      <Px rows={rows} pal={pal} />
    </Piece>
  );
  return (
    <>
      {/* the sky: deep at the top, lighter in steps toward the hills */}
      <Layer
        style={{
          background:
            'linear-gradient(180deg, #1B3698 0%, #2449B6 28%, #2A54C6 56%, #3162D6 70%, #3A6FE0 70% 76%, #4A82EE 76% 82%, #5E93F4 82% 100%)',
        }}
      />
      {!card ? (
        <>
          {/* HUD: three hearts, the player's pad */}
          {[0, 1, 2].map((i) => (
            <Piece
              key={i}
              vb={vb(HEART)}
              anim={i === 2 ? 'pop' : undefined}
              style={{ left: `calc(5cqw + ${hx(i * 11)})`, top: hudTop, width: hx(9) }}
            >
              <Px rows={HEART} pal={HEART_PAL} />
            </Piece>
          ))}
          <Piece vb={vb(PAD)} anim="wiggle" style={{ right: '5cqw', top: hudTop, width: hx(28) }}>
            <Px rows={PAD} pal={PAD_PAL} />
          </Piece>
        </>
      ) : null}
      {/* LEVEL UP! over the crown */}
      <Piece
        vb={vb(LEVEL_UP)}
        anim="float"
        style={{
          left: '50%',
          top: card ? '9cqh' : hero ? 'max(15cqh, 120px)' : '13cqh',
          width: card ? cm(size(LEVEL_UP[0]!.length * 0.5)) : cmh(size(LEVEL_UP[0]!.length * 0.78)),
          translate: '-50% 0',
        }}
      >
        <Px rows={LEVEL_UP} pal={LEVEL_PAL} />
      </Piece>
      {/* clouds (a poster's names start at a quarter of its height: one small cloud above them) */}
      {place !== 'poster'
        ? sprite(CLOUD_BIG, CLOUD_PAL, { left: '3cqw', top: card ? '24cqh' : '21cqh' }, 'drift')
        : null}
      {sprite(
        CLOUD_SMALL,
        CLOUD_PAL,
        {
          right: '4cqw',
          top: card ? '30cqh' : hero ? '27.5cqh' : '17cqh',
          animationDirection: 'alternate-reverse',
        },
        'drift',
      )}
      {/* glints, out at the edges of the names' band */}
      {(
        [
          [5, 40, 0],
          [94, 47, 0.9],
          [4, 57, 1.7],
          [95, 63, 0.4],
        ] as const
      ).map(([x, y, delay]) => (
        <Piece
          key={x}
          vb={vb(GLINT)}
          anim="twinkle"
          style={{
            left: `${x}cqw`,
            top: `${y}cqh`,
            width: px(5),
            translate: '-50% -50%',
            animationDelay: `${delay}s`,
          }}
        >
          <Px rows={GLINT} pal={{ W: '#FFFFFF' }} />
        </Piece>
      ))}
      {/* hills: a far range, then two near ones */}
      {sprite(HILL_FAR, FAR_PAL, { left: '34cqw', bottom: onGround(-1) })}
      {sprite(HILL_FAR, FAR_PAL, { left: '78cqw', bottom: onGround(-1) })}
      {sprite(HILL_BIG, HILL_PAL, { left: `calc(-1 * ${px(12)})`, bottom: onGround(-1) })}
      {sprite(HILL_MID, HILL_PAL, { right: `calc(-1 * ${px(6)})`, bottom: onGround(-1) })}
      {/* the ground, tiled over the whole width */}
      <Piece
        vb={[0, 0, 256, 16]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: px(ground), aspectRatio: 'auto' }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <Px key={i} rows={TILE} pal={TILE_PAL} x={i * 16} />
        ))}
      </Piece>
      {/* the question block and its coin */}
      {sprite(
        BLOCK,
        BLOCK_PAL,
        { left: card ? '14cqw' : '9cqw', bottom: onGround(card ? 14 : 22) },
        'wiggle',
      )}
      {sprite(
        COINS[0]!,
        COIN_PAL,
        { left: `calc(${card ? 14 : 9}cqw + ${px(4)})`, bottom: onGround(card ? 31 : 39) },
        'bounce',
      )}
      {/* coins caught mid-spin */}
      {COINS.map((rows, i) => (
        <Piece
          key={i}
          vb={vb(rows)}
          anim="pop"
          style={{
            left: `calc(${card ? 56 : 54}cqw + ${px(i * 10 + (4 - rows[0]!.length / 2))})`,
            bottom: onGround((card ? 12 : 20) + [0, 3, 4, 3][i]!),
            width: px(rows[0]!.length),
            animationDelay: `${i * 0.35}s`,
          }}
        >
          <Px rows={rows} pal={COIN_PAL} />
        </Piece>
      ))}
    </>
  );
}
