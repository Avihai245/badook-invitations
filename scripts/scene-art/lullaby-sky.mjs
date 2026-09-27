// The "lullaby-sky" design (a brit, a baby shower or a first birthday: dreamy pastel skies): five skies of
// one gentle day — a pastel sunrise, among soft pink-and-blue cumulus, the hills and a tiny village far
// below through gaps in the clouds, a lilac dusk with the first stars, and a soft starry night. The app
// draws its own hot-air balloon (rising from the lower left) and the crescent moon (upper right) over
// them, so there are none here, and the night's upper-right quarter stays clear sky. Painted with the kit.
//
//   node scripts/scene-art/lullaby-sky.mjs [--draft <dir>] [scene …]
import {
  H,
  W,
  cloudSea,
  cumulus,
  glow,
  mist,
  mix,
  nid,
  paintScenes,
  prng,
  pts,
  r1,
  r3,
  rays,
  skyFill,
  soft,
  svgLayer,
  tree,
  ugrad,
  vignette,
  wisps,
} from './kit.mjs';
import { blurred, mottle, stars, unit, veil } from './nature-shared.mjs';

/** a low bank of cloud to the horizon: pastel, its tops lit by the hour */
const seaOf = (hz, pal, seed, extra = {}) =>
  cloudSea({ hz, cam: 900, zFar: 60, zNear: 1.3, r0: 150, n: 2200, bins: 20, seed, pal, ...extra });

/** dawn: a pastel sunrise, soft clouds, a pink-cream horizon and blue above */
const dawn = () => {
  const hz = 1480;
  let s = skyFill([
    [0, '#7898c2'],
    [0.18, '#8eaad0'],
    [0.36, '#a8b8d8'],
    [0.5, '#c4bfd8'],
    [0.62, '#dfc3cd'],
    [0.71, '#ecd0c6'],
    [0.77, '#f3e0c3'],
    [1, '#d9c8d0'],
  ]);
  s += glow({ x: 660, y: hz - 20, rx: 900, ry: 520, color: '#f7e2bf', a: 0.55 });
  s += glow({ x: 660, y: hz - 10, rx: 240, ry: 120, color: '#fbeccd', a: 0.7 });
  s += wisps({
    color: '#f3d6d8',
    a: 0.4,
    seed: 11,
    items: [
      [260, 300, 360, 16, -4],
      [800, 420, 340, 14, 3],
      [520, 620, 420, 14, -2],
      [180, 820, 260, 10, 2],
      [900, 900, 240, 10, -3],
    ],
  });
  // soft heaps lit pink from the rising sun on the right
  const lit = (t) => ({
    top: mix('#fbe3d8', '#f7dcd4', t),
    mid: mix('#e1cfdc', '#d9c9da', t),
    bot: mix('#adb3d6', '#a3a9cf', t),
  });
  const dir = [0.85, 0.1, 0.15, 0.9];
  s += cumulus({
    cx: 180,
    base: 1330,
    width: 520,
    height: 260,
    n: 30,
    size: 80,
    pal: lit,
    seed: 21,
    bands: 4,
    dir,
  });
  s += cumulus({
    cx: 930,
    base: 1250,
    width: 420,
    height: 200,
    n: 24,
    size: 66,
    pal: lit,
    seed: 23,
    bands: 3,
    dir,
  });
  s += seaOf(
    hz,
    (t) => {
      const haze = Math.max(0, 1 - t * 1.4);
      return {
        top: mix('#fae6d6', '#f1ded6', haze * 0.6),
        mid: mix('#d8c8d8', '#e6d6dc', haze),
        bot: mix('#9ea6cf', '#d6cfdd', haze),
      };
    },
    31,
  );
  s += glow({ x: 660, y: hz + 4, rx: 1300, ry: 60, color: '#f6e1cc', a: 0.55 });
  s += rays({
    x: 660,
    y: hz - 10,
    n: 16,
    len: 1400,
    a0: -165,
    a1: -15,
    w: [1.5, 4],
    color: '#fbe8c8',
    a: 0.14,
    seed: 5,
    blur: 16,
  });
  s += vignette(0.22, '#4d5585');
  return [svgLayer(s)];
};

/** among big soft cumulus in pink and blue, lit from the side */
const clouds = () => {
  let s = skyFill([
    [0, '#6f8fbd'],
    [0.2, '#84a2ce'],
    [0.42, '#9fb6d8'],
    [0.6, '#b9c3de'],
    [0.72, '#dcd6e6'],
    [1, '#c3c3de'],
  ]);
  s += glow({ x: 1040, y: 700, rx: 760, ry: 900, color: '#f8e1cf', a: 0.45 });
  s += wisps({
    color: '#f0dde2',
    a: 0.3,
    seed: 13,
    items: [
      [400, 260, 340, 14, -3],
      [760, 560, 300, 12, 4],
    ],
  });
  const lit = (t) => ({
    top: mix('#fce7df', '#f9e0da', t),
    mid: mix('#e2d0de', '#d8c8dc', t),
    bot: mix('#a7b3d8', '#98a6d0', t),
  });
  const far = (t) => ({ top: mix('#f5e4e2', '#efdfe2', t), mid: '#d9d3e6', bot: '#bcc2e0' });
  const dir = [1, 0.15, 0, 0.85];
  // far heaps in the gap
  s += cumulus({
    cx: 560,
    base: 1330,
    width: 420,
    height: 220,
    n: 24,
    size: 56,
    pal: far,
    seed: 41,
    bands: 3,
    dir,
  });
  // towers either side, lit on their right flanks
  s += cumulus({
    cx: 110,
    base: 1080,
    width: 380,
    height: 520,
    n: 36,
    size: 108,
    pal: lit,
    seed: 43,
    bands: 4,
    dir,
    skew: 0.1,
  });
  s += cumulus({
    cx: 990,
    base: 1180,
    width: 380,
    height: 420,
    n: 32,
    size: 100,
    pal: lit,
    seed: 45,
    bands: 4,
    dir,
    skew: -0.08,
  });
  s += cumulus({
    cx: 140,
    base: 1620,
    width: 600,
    height: 560,
    n: 44,
    size: 140,
    pal: lit,
    seed: 47,
    bands: 5,
    dir,
  });
  s += cumulus({
    cx: 960,
    base: 1660,
    width: 560,
    height: 520,
    n: 42,
    size: 140,
    pal: lit,
    seed: 49,
    bands: 5,
    dir,
  });
  // the heap below, rising towards us
  s += cumulus({
    cx: 540,
    base: 2150,
    width: 1500,
    height: 620,
    n: 60,
    size: 170,
    pal: lit,
    seed: 51,
    bands: 5,
    dir,
    flatBase: 0,
  });
  s += rays({
    x: 1100,
    y: 600,
    n: 14,
    len: 1300,
    a0: 150,
    a1: 215,
    w: [1.5, 4],
    color: '#fbe7d6',
    a: 0.16,
    seed: 7,
    blur: 16,
  });
  s += mist({ y: 260, h: 110, x0: -300, x1: 420, color: '#efe4ea', a: 0.3, seed: 53, n: 3 });
  s += vignette(0.24, '#4d5585');
  return [svgLayer(s)];
};

/** far below: rolling pastel hills and a tiny village in morning haze, through gaps in the clouds */
const meadow = () => {
  const rnd = prng(601);
  const hz = 980;
  const hazeColor = '#dfe0e9';
  let s = skyFill([
    [0, '#7898c2'],
    [0.2, '#90abd2'],
    [0.4, '#b3c1dc'],
    [0.5, '#e4dde6'],
    [0.52, '#e7e0e4'],
    [1, '#b9c7b8'],
  ]);
  s += glow({ x: 300, y: hz - 60, rx: 900, ry: 380, color: '#f8e6cf', a: 0.45 });
  // the land: rolling hills in bands, hazier with distance
  const greens = ['#aebf9c', '#bcc59e', '#a3b797', '#cbc9a0', '#b3c2a5', '#d6c9a6'];
  let land = '';
  const bands = 16;
  for (let b = 0; b < bands; b++) {
    const t = b / (bands - 1); // 0 far … 1 near
    const y0 = hz + 6 + (H - hz) * t ** 1.8;
    const amp = 8 + 70 * t ** 1.5;
    const haze = 1 - t ** 0.8;
    const c = mix(greens[b % greens.length], hazeColor, haze * 0.75);
    const shade = mix(mix(greens[(b + 2) % greens.length], '#7f9c86', 0.35), hazeColor, haze * 0.75);
    const id = nid('hl');
    const ph = rnd() * 6;
    const top = Array.from({ length: 25 }, (_, i) => {
      const x = -40 + (i / 24) * (W + 80);
      return [x, y0 - amp * (0.5 + 0.5 * Math.sin(ph + (i / 24) * (3 + rnd() * 0.3) * Math.PI))];
    });
    land += `<defs>${ugrad(
      id,
      [
        [0, c],
        [1, shade],
      ],
      [0, y0 - amp, 0, y0 + 60 + 140 * t],
    )}</defs><path d="${pts(top)}L${W + 40} ${H}L-40 ${H}Z" fill="url(#${id})"/>`;
    // hedgerows and little trees along the crests
    if (t > 0.15) {
      let dots = '';
      for (let i = 0; i < 18; i++) {
        const [x, y] = top[Math.floor(rnd() * top.length)];
        const r = 1.5 + t * 7 * (0.6 + rnd() * 0.6);
        dots += `<circle cx="${r1(x + (rnd() - 0.5) * 40)}" cy="${r1(y + r * 0.6)}" r="${r1(r)}"/>`;
      }
      land += `<g fill="${mix('#7f9f84', hazeColor, haze * 0.7)}" opacity=".8">${dots}</g>`;
    }
  }
  s += blurred(1.2, land);
  s += mottle({
    clip: `M0 ${hz}H${W}V${H}H0Z`,
    freq: [0.008, 0.03],
    seed: 7,
    dark: unit('#6f8f7c'),
    light: unit('#f1ecc6'),
    a: 0.25,
    box: [0, hz, W, H - hz],
  });
  // a river winding through, silver in the morning light
  const river = [
    [-40, 1500],
    [180, 1420],
    [420, 1360],
    [560, 1250],
    [520, 1150],
    [620, 1060],
    [760, 1010],
  ];
  s += blurred(
    1.5,
    `<path d="${pts(river)}" fill="none" stroke="#d9e6ef" stroke-width="14" stroke-linejoin="round" opacity=".85"/><path d="${pts(river)}" fill="none" stroke="#f4f4f2" stroke-width="4" opacity=".6"/>`,
  );
  // the tiny village on a rise: white walls, rosy roofs, a steeple-less little square
  let houses = '';
  const vx = 640;
  const vy = 1290;
  for (let i = 0; i < 26; i++) {
    const x = vx + (rnd() - 0.5) * 230;
    const y = vy + (rnd() - 0.5) * 70;
    const w = 10 + rnd() * 8;
    const h = 7 + rnd() * 4;
    houses += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="#f7f1e8"/><path d="M${r1(x - 1)} ${r1(y)}L${r1(x + w / 2)} ${r1(y - h * 0.7)}L${r1(x + w + 1)} ${r1(y)}Z" fill="${rnd() < 0.6 ? '#e1a79f' : '#d99588'}"/>`;
  }
  for (let i = 0; i < 20; i++)
    houses += `<circle cx="${r1(vx + (rnd() - 0.5) * 280)}" cy="${r1(vy + (rnd() - 0.5) * 90)}" r="${r1(4 + rnd() * 5)}" fill="#8faa8c"/>`;
  s += blurred(0.8, houses);
  // the haze of morning over it all, thicker far off
  s += veil(hazeColor, [
    [hz - 60, 0],
    [hz - 6, 0.8],
    [hz + 80, 0.45],
    [1300, 0.18],
    [1920, 0.05],
  ]);
  s += mist({ y: hz + 40, h: 50, color: '#eeeaf0', a: 0.5, seed: 611, n: 10 });
  // the cloud we look down through: a layer with breaks in it, and heaps at its edges
  const pal = (t) => {
    const haze = Math.max(0, 1 - t * 1.3);
    return {
      top: mix('#fcebe4', '#efe6ea', haze * 0.5),
      mid: mix('#dcd2e2', '#e5e0ea', haze),
      bot: mix('#a9b4d8', '#d6d8e6', haze),
    };
  };
  s += cloudSea({
    hz: hz - 20,
    cam: 800,
    zFar: 30,
    zNear: 1.25,
    r0: 150,
    n: 1600,
    bins: 18,
    seed: 621,
    pal,
    gaps: [
      [600, 1330, 300, 120],
      [330, 1620, 230, 120],
      [800, 1700, 190, 110],
      [300, 1100, 260, 50],
      [860, 1120, 220, 45],
    ],
  });
  const lit = (t) => ({
    top: mix('#fde9e1', '#f8e2dc', t),
    mid: mix('#e2d3e0', '#d9cbdc', t),
    bot: mix('#a9b4d8', '#9eaad3', t),
  });
  s += cumulus({
    cx: -40,
    base: 1900,
    width: 560,
    height: 460,
    n: 40,
    size: 130,
    pal: lit,
    seed: 631,
    bands: 4,
    dir: [0.8, 0, 0.2, 1],
  });
  s += cumulus({
    cx: 1110,
    base: 1960,
    width: 560,
    height: 420,
    n: 40,
    size: 130,
    pal: lit,
    seed: 633,
    bands: 4,
    dir: [0.8, 0, 0.2, 1],
  });
  s += wisps({
    color: '#f4eaee',
    a: 0.3,
    seed: 15,
    items: [
      [300, 380, 360, 14, -3],
      [820, 560, 300, 12, 3],
    ],
  });
  s += vignette(0.22, '#4d5585');
  return [svgLayer(s)];
};

/** a lilac dusk: the first stars, clouds lit pink from below */
const dusk = () => {
  const hz = 1480;
  let s = skyFill([
    [0, '#5d6399'],
    [0.16, '#7274aa'],
    [0.32, '#8e8fc4'],
    [0.46, '#ad9fcb'],
    [0.6, '#d3adc6'],
    [0.7, '#eabfbf'],
    [0.77, '#f0cbb5'],
    [1, '#b6a3c0'],
  ]);
  s += glow({ x: 480, y: hz - 10, rx: 1000, ry: 520, color: '#f5cdb2', a: 0.5 });
  s += stars({ seed: 71, n: 80, y0: 20, y1: 640, a: [0.2, 0.7], bright: 8, pow: 1.5 });
  const under = (t) => ({
    top: mix('#b6a6cf', '#c0aecf', t),
    mid: mix('#d5aac4', '#dfb2c2', t),
    bot: mix('#f3c7bd', '#f6d0c0', t),
  });
  const flip = [0.4, 0, 0.6, 1];
  s += wisps({
    color: '#f0c3c6',
    a: 0.4,
    seed: 17,
    items: [
      [320, 700, 380, 16, -4],
      [820, 620, 340, 14, 3],
      [560, 860, 440, 16, -1],
    ],
  });
  s += cumulus({
    cx: 230,
    base: 1030,
    width: 600,
    height: 170,
    n: 32,
    size: 58,
    pal: under,
    seed: 81,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 880,
    base: 960,
    width: 520,
    height: 150,
    n: 28,
    size: 54,
    pal: under,
    seed: 83,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 560,
    base: 1250,
    width: 1300,
    height: 200,
    n: 52,
    size: 70,
    pal: under,
    seed: 85,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += seaOf(
    hz,
    (t) => {
      const haze = Math.max(0, 1 - t * 1.4);
      return {
        top: mix('#f2cdc4', '#e8c7c8', haze * 0.6),
        mid: mix('#b9a7cc', '#d4b9cc', haze),
        bot: mix('#7f82b6', '#c2afc8', haze),
      };
    },
    87,
  );
  s += glow({ x: 480, y: hz + 4, rx: 1200, ry: 60, color: '#f3d0bd', a: 0.5 });
  s += vignette(0.26, '#3b3f6e');
  return [svgLayer(s)];
};

/** night: a gentle starry sky, soft clouds low down, the upper-right quarter left clear for the moon */
const moon = () => {
  const hz = 1520;
  let s = skyFill([
    [0, '#2e3462'],
    [0.2, '#3a4172'],
    [0.42, '#4d5588'],
    [0.62, '#666c9f'],
    [0.76, '#8581b4'],
    [1, '#5a5f92'],
  ]);
  s += glow({ x: 300, y: hz - 60, rx: 900, ry: 420, color: '#a6a3cf', a: 0.35 });
  const clear = (x, y) => (x > W * 0.46 && y < H * 0.52 ? 0 : x > W * 0.4 && y < H * 0.56 ? 0.3 : 1);
  s += stars({
    seed: 91,
    n: 320,
    y0: 20,
    y1: 1400,
    pow: 1.1,
    a: [0.2, 0.8],
    bright: 18,
    fade: clear,
    color: '#f7f2e6',
  });
  s += wisps({
    color: '#9d9bcf',
    a: 0.3,
    seed: 19,
    items: [
      [260, 1080, 340, 12, -2],
      [700, 1180, 320, 10, 2],
    ],
  });
  // soft clouds low down, their tops silvered by the moon above to the right
  const lit = (t) => ({
    top: mix('#c9c6e6', '#bfbde0', t),
    mid: mix('#8a8cc0', '#8284b8', t),
    bot: mix('#565d92', '#4f5689', t),
  });
  const dir = [0.8, 0, 0.3, 1];
  s += cumulus({
    cx: 200,
    base: 1500,
    width: 600,
    height: 260,
    n: 34,
    size: 76,
    pal: lit,
    seed: 93,
    bands: 4,
    dir,
  });
  s += cumulus({
    cx: 900,
    base: 1560,
    width: 520,
    height: 220,
    n: 30,
    size: 70,
    pal: lit,
    seed: 95,
    bands: 3,
    dir,
  });
  s += seaOf(
    hz,
    (t) => {
      const haze = Math.max(0, 1 - t * 1.4);
      return {
        top: mix('#bdbbe0', '#a9a8d2', haze * 0.6),
        mid: mix('#7c80b5', '#9493c4', haze),
        bot: mix('#4b5286', '#8284b6', haze),
      };
    },
    97,
  );
  s += glow({ x: 540, y: hz + 4, rx: 1300, ry: 60, color: '#a7a5d0', a: 0.4 });
  s += vignette(0.24, '#232850');
  return [svgLayer(s)];
};

void [soft, tree, r3, rays];

const scenes = {
  'scene-dawn': { paint: dawn, seed: 41, post: { gamma: 1.62, bloom: 0.36 } },
  'scene-clouds': { paint: clouds, seed: 42, post: { gamma: 1.62, bloom: 0.34 } },
  'scene-meadow': { paint: meadow, seed: 43, post: { gamma: 1.66, bloom: 0.34 } },
  'scene-dusk': { paint: dusk, seed: 44, post: { gamma: 1.15, bloom: 0.4 } },
  'scene-moon': { paint: moon, seed: 45, post: { gamma: 0.95, bloom: 0.45 } },
};

await paintScenes({ id: 'lullaby-sky', scenes, background: '#c9d9ec' });
