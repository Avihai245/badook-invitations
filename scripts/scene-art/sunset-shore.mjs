// The "sunset-shore" design (a wedding or an engagement on the beach): five pictures of one evening by
// the sea — the path through the dunes at golden hour, the sea under a low sun, the chuppah of white cloth
// on the sand at sunset, lanterns and a long candlelit table at blue hour, and the moonlit sea at night.
// The sea's horizon stays at y 1200 throughout, so the cross-fades read as one film. Painted with the kit.
//
//   node scripts/scene-art/sunset-shore.mjs [--draft <dir>] [scene …]
import {
  H,
  W,
  cumulus,
  eucalyptus,
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
  rose,
  skyFill,
  soft,
  svgLayer,
  ugrad,
  vignette,
  wisps,
} from './kit.mjs';
import { blurred, eye, jar, lantern, mottle, radial, stars, unit, veil } from './nature-shared.mjs';

const HZ = 1200;

/** the sea from the horizon to the shore: its colours, soft swells, and a path of light under (sx, …) */
const sea = (
  rnd,
  {
    top,
    mid,
    bottom,
    shore = 1760,
    sx = 540,
    glitter = '#f6d9a0',
    gA = 0.8,
    gW = 60,
    swell = '#ffffff',
    swellA = 0.12,
    dark = '#0f2c40',
  },
) => {
  const id = nid('sea');
  let s = `<defs>${ugrad(
    id,
    [
      [0, top],
      [0.25, mid],
      [1, bottom],
    ],
    [0, HZ, 0, shore],
  )}</defs><rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id})"/>`;
  // swells: long soft light and dark streaks, thinner and closer together towards the horizon
  let lights = '';
  let darks = '';
  for (let i = 0; i < 150; i++) {
    const t = rnd() ** 1.7;
    const y = HZ + 3 + t * (shore - HZ);
    const w = 60 + t * 520 * (0.4 + rnd());
    const h = 0.8 + t * 5;
    const x = rnd() * W;
    const e = `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(w)}" ry="${r1(h)}"/>`;
    if (rnd() < 0.5) lights += e;
    else darks += e;
  }
  s += blurred(
    1.2,
    `<g fill="${swell}" opacity="${swellA}">${lights}</g><g fill="${dark}" opacity=".16">${darks}</g>`,
  );
  // the path of light: glints scattered about a band widening towards us
  if (gA) {
    let g = '';
    for (let i = 0; i < 520; i++) {
      const t = rnd() ** 1.4;
      const y = HZ + 2 + t * (shore - HZ);
      const half = gW * (0.25 + t * 3.2);
      const x = sx + (rnd() + rnd() + rnd() - 1.5) * half * 1.1;
      const w = 2 + t * 22 * (0.3 + rnd());
      g += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(w)}" ry="${r1(0.6 + t * 2.2)}" opacity="${r3((0.35 + rnd() * 0.65) * (1 - t * 0.35))}"/>`;
    }
    s += glow({ x: sx, y: HZ + 150, rx: gW * 3.5, ry: 360, color: glitter, a: gA * 0.35, blend: 'screen' });
    s += blurred(0.7, g, `fill="${glitter}" style="mix-blend-mode:screen" opacity="${gA}"`);
  }
  return s;
};

/** the beach from the waterline down: wet sand shining, the lace of a spent wave, dry sand */
const beach = (rnd, { y0, wet, dry, foam = '#f3ece2', foamA = 0.7, seed = 3 }) => {
  const id = nid('bch');
  const edge = Array.from({ length: 25 }, (_, i) => [
    -20 + (i / 24) * (W + 40),
    y0 + Math.sin(i * 0.9 + seed) * 8 + (rnd() - 0.5) * 6,
  ]);
  let s = `<defs>${ugrad(
    id,
    [
      [0, wet],
      [0.18, mix(wet, dry, 0.5)],
      [0.4, dry],
      [1, mix(dry, '#8a6a58', 0.25)],
    ],
    [0, y0, 0, H],
  )}</defs>`;
  const d = `${pts(edge)}L${W + 20} ${H}L-20 ${H}Z`;
  s += `<path d="${d}" fill="url(#${id})"/>`;
  s += mottle({
    clip: d,
    freq: [0.02, 0.07],
    seed,
    dark: unit('#6b5646'),
    light: unit('#fff3de'),
    a: 0.25,
    box: [0, y0 - 20, W, H - y0 + 20],
  });
  // the foam: a wavy line of lace just below the waterline
  const lace = edge.map(([x, y]) => [x, y + 10 + (rnd() - 0.5) * 6]);
  s += blurred(
    1.5,
    `<path d="${pts(lace)}" fill="none" stroke="${foam}" stroke-width="5" opacity="${foamA}"/><path d="${pts(lace.map(([x, y]) => [x, y + 16 + rnd() * 8]))}" fill="none" stroke="${foam}" stroke-width="2" opacity="${r3(foamA * 0.5)}"/>`,
  );
  return s;
};

/** a low sun: a disc in its glow */
const sun = (x, y, r, { core = '#fff1cf', halo = '#f7c887', a = 0.7 } = {}) => {
  const id = nid('sn');
  return `${glow({ x, y, rx: r * 14, ry: r * 9, color: halo, a: a * 0.6 })}${glow({ x, y, rx: r * 4, color: '#fbe0b0', a })}<defs>${radial(
    id,
    [
      [0, core],
      [0.8, '#fde6bc'],
      [1, '#f8d49a', 0.6],
    ],
  )}</defs><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`;
};

/** dune grass: tufts of thin arching blades, lit on one side */
const grass = (rnd, list, { lit = '#e9c982', body = '#9a9a62', dark = '#5f6444' } = {}) => {
  let out = '';
  for (const { x, y, s, lean = 0 } of list) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.4 + lean + (rnd() - 0.5) * 0.3;
      const len = s * (80 + rnd() * 90);
      const bend = (rnd() - 0.3) * 0.6;
      const [x1, y1] = [x + Math.cos(a) * len * 0.5 + bend * len * 0.3, y + Math.sin(a) * len * 0.5];
      const [x2, y2] = [x + Math.cos(a + bend) * len, y + Math.sin(a + bend) * len];
      const c = rnd() < 0.4 ? lit : rnd() < 0.6 ? body : dark;
      out += `<path d="M${r1(x)} ${r1(y)}Q${r1(x1)} ${r1(y1)} ${r1(x2)} ${r1(y2)}" stroke="${c}" stroke-width="${r1(Math.max(0.8, s * 2.4))}" fill="none" stroke-linecap="round"/>`;
    }
  }
  return out;
};

// ---------------------------------------------------------------------------------------------------

/** golden hour: a path through the dunes, dune grass, the sea glimpsed ahead */
const dunes = () => {
  const rnd = prng(101);
  let s = skyFill([
    [0, '#6f95a6'],
    [0.2, '#93aeb0'],
    [0.38, '#c7bea5'],
    [0.52, '#eac394'],
    [0.6, '#f0c78c'],
    [0.625, '#ecc190'],
    [1, '#d9b48e'],
  ]);
  s += sun(820, 1080, 44, { a: 0.65 });
  s += wisps({
    color: '#f3cfa6',
    a: 0.4,
    seed: 11,
    items: [
      [300, 520, 360, 14, -3],
      [780, 700, 320, 12, 2],
      [520, 860, 420, 12, -1],
    ],
  });
  s += sea(rnd, { top: '#c9a98f', mid: '#6f9ea0', bottom: '#3f7f8a', shore: 1300, sx: 820, gA: 0.7, gW: 40 });
  // the dunes: smooth mounds of sand, lit from the low sun on the right, grass on their crests
  const sandL = nid('sl');
  const sandR = nid('sr');
  s += `<defs>${ugrad(
    sandL,
    [
      [0, '#e7c9a0'],
      [0.5, '#d6ae88'],
      [1, '#b98f79'],
    ],
    [600, 900, 0, 1600],
  )}${ugrad(
    sandR,
    [
      [0, '#f0d2a4'],
      [0.5, '#e2b98d'],
      [1, '#c69c80'],
    ],
    [700, 900, 1080, 1700],
  )}</defs>`;
  const left = `M-40 880C120 870 280 960 380 1100C420 1160 450 1200 470 1236L470 ${H}L-40 ${H}Z`;
  const right = `M1120 950C980 950 840 1040 760 1140C720 1180 700 1210 680 1240L680 ${H}L1120 ${H}Z`;
  s += soft(
    { box: [-100, 800, W + 200, H], blur: 3, disp: 10, freq: 0.02, seed: 3 },
    `<path d="${right}"/>`,
    `fill="url(#${sandR})"`,
  );
  s += soft(
    { box: [-100, 800, W + 200, H], blur: 3, disp: 10, freq: 0.02, seed: 5 },
    `<path d="${left}"/>`,
    `fill="url(#${sandL})"`,
  );
  // the path between them, a trough of soft footprinted sand
  const path = `M470 1236C540 1256 620 1256 680 1240C740 1400 830 1650 900 ${H}L240 ${H}C330 1650 420 1420 470 1236Z`;
  s += soft(
    { box: [100, 1150, 900, 800], blur: 4, disp: 12, freq: 0.03, seed: 7 },
    `<path d="${path}"/>`,
    'fill="#dab792"',
  );
  s += soft(
    { box: [100, 1150, 900, 800], blur: 18, disp: 20, freq: 0.02, seed: 8 },
    `<path d="M560 1240C600 1400 700 1650 760 ${H}L520 ${H}C520 1650 540 1420 560 1240Z"/>`,
    'fill="#9c7a73" opacity=".18"',
  );
  s += mottle({
    clip: `${left}${right}${path}`,
    freq: [0.015, 0.05],
    seed: 9,
    dark: unit('#8c6a55'),
    light: unit('#fff0d4'),
    a: 0.25,
    box: [0, 800, W, H - 800],
  });
  // shadows in the troughs, rim light on the crests
  s += soft(
    { box: [0, 800, W, H], blur: 30, disp: 30, freq: 0.01 },
    `<path d="M-40 1200C200 1260 400 1500 460 ${H}L-40 ${H}Z"/><path d="M1120 1300C960 1350 900 1600 880 ${H}L1120 ${H}Z"/>`,
    'fill="#8d6a73" opacity=".25"',
  );
  s += blurred(
    3,
    `<path d="M-40 860C120 840 300 930 420 1080" fill="none" stroke="#fbe2b5" stroke-width="10" opacity=".55"/><path d="M1120 930C980 920 820 1010 720 1120" fill="none" stroke="#fde6bb" stroke-width="10" opacity=".6"/>`,
  );
  // a rope fence on old posts along the path
  const posts = [
    [640, 1290, 34],
    [700, 1390, 52],
    [780, 1520, 76],
    [880, 1700, 110],
  ];
  let fence = '';
  posts.forEach(
    ([x, y, h]) =>
      (fence += `<rect x="${r1(x - h * 0.06)}" y="${r1(y - h)}" width="${r1(h * 0.12)}" height="${r1(h)}" fill="#6d5140"/><rect x="${r1(x - h * 0.06)}" y="${r1(y - h)}" width="${r1(h * 0.04)}" height="${r1(h)}" fill="#d8b284" opacity=".6"/>`),
  );
  for (let i = 1; i < posts.length; i++) {
    const [a, b] = [posts[i - 1], posts[i]];
    fence += `<path d="M${a[0]} ${r1(a[1] - a[2] * 0.85)}Q${r1((a[0] + b[0]) / 2)} ${r1((a[1] + b[1]) / 2 - (a[2] + b[2]) * 0.2)} ${b[0]} ${r1(b[1] - b[2] * 0.85)}" fill="none" stroke="#8d6f58" stroke-width="${r1(1 + i)}"/>`;
  }
  s += blurred(0.8, fence);
  // dune grass: along the crests, on the slopes, and big and soft at our feet
  const tufts = [];
  for (let i = 0; i < 22; i++) {
    const t = rnd();
    tufts.push({
      x: -40 + t * 470,
      y: 860 + t * t * 230 + 20 + rnd() * 40 + t * 60,
      s: 0.5 + rnd() * 0.3,
      lean: 0.25,
    });
  }
  for (let i = 0; i < 20; i++) {
    const t = rnd();
    tufts.push({
      x: 1120 - t * 430,
      y: 930 + t * t * 200 + 20 + rnd() * 40 + t * 60,
      s: 0.5 + rnd() * 0.3,
      lean: 0.25,
    });
  }
  for (let i = 0; i < 14; i++)
    tufts.push({
      x: rnd() < 0.5 ? rnd() * 300 : 760 + rnd() * 320,
      y: 1300 + rnd() * 400,
      s: 0.7 + rnd() * 0.4,
      lean: 0.2,
    });
  s += blurred(0.9, grass(rnd, tufts));
  s += blurred(
    7,
    grass(rnd, [
      { x: 40, y: 1990, s: 3.2, lean: 0.2 },
      { x: 170, y: 2000, s: 2.6, lean: 0.3 },
      { x: 1000, y: 1990, s: 3, lean: 0.25 },
      { x: 900, y: 2010, s: 2.4, lean: 0.3 },
    ]),
  );
  s += rays({
    x: 820,
    y: 1080,
    n: 16,
    len: 1400,
    a0: 150,
    a1: 250,
    w: [1.5, 4],
    color: '#fbe0b0',
    a: 0.18,
    seed: 5,
    blur: 16,
  });
  s += vignette(0.28, '#3e3140');
  return [svgLayer(s)];
};

/** sunset: the sea under a low sun, a glittering path of light, gentle waves */
const seaScene = () => {
  const rnd = prng(201);
  let s = skyFill([
    [0, '#46708b'],
    [0.16, '#6c8b9e'],
    [0.32, '#a99c9e'],
    [0.46, '#dc9f86'],
    [0.56, '#ecb482'],
    [0.625, '#f0c688'],
    [1, '#d9a98a'],
  ]);
  s += wisps({
    color: '#efa78a',
    a: 0.5,
    seed: 21,
    items: [
      [260, 540, 380, 16, -4],
      [800, 470, 340, 14, 3],
      [540, 760, 460, 16, -1],
      [200, 900, 280, 10, 2],
      [900, 960, 260, 10, -2],
    ],
  });
  const coral = (t) => ({
    top: mix('#f4b58f', '#f1c395', t),
    mid: mix('#c98d88', '#d59c8a', t),
    bot: mix('#7d6f86', '#8c7a88', t),
  });
  s += cumulus({
    cx: 150,
    base: 1150,
    width: 420,
    height: 90,
    n: 20,
    size: 40,
    pal: coral,
    seed: 23,
    bands: 2,
    dir: [0.9, 0.2, 0.1, 0.9],
    flatBase: 0.6,
  });
  s += cumulus({
    cx: 950,
    base: 1130,
    width: 380,
    height: 80,
    n: 18,
    size: 36,
    pal: coral,
    seed: 25,
    bands: 2,
    dir: [0.1, 0.2, 0.9, 0.9],
    flatBase: 0.6,
  });
  s += sun(540, 1150, 46, { a: 0.7 });
  s += sea(rnd, {
    top: '#d59a82',
    mid: '#4f8f95',
    bottom: '#1f5570',
    shore: 1780,
    sx: 540,
    gA: 0.85,
    gW: 50,
  });
  s += glow({ x: 540, y: HZ + 2, rx: 1200, ry: 26, color: '#f6cf98', a: 0.6 });
  s += beach(rnd, { y0: 1780, wet: '#b98f86', dry: '#c9a488', seed: 27 });
  s += glow({ x: 540, y: 1830, rx: 300, ry: 60, color: '#f2c28e', a: 0.35, blend: 'screen' });
  s += vignette(0.28, '#2c2a40');
  return [svgLayer(s)];
};

/** the chuppah on the sand facing the sea: four driftwood posts, white cloth flowing in the wind, flowers */
const chuppah = (rnd) => {
  const F = { l: 330, r: 750, top: 1236, foot: 1700 };
  const B = { l: 392, r: 690, top: 1222, foot: 1596 };
  const wood = nid('wd');
  const cloth = nid('cl');
  let s = `<defs>${ugrad(
    wood,
    [
      [0, '#8f735c'],
      [0.4, '#d8bf9c'],
      [1, '#a78a70'],
    ],
    [0, 0, 18, 0],
  )}${ugrad(
    cloth,
    [
      [0, '#fbf6ee', 0.85],
      [0.5, '#f6efe6', 0.55],
      [1, '#f1e8de', 0.12],
    ],
    [0, F.top, 0, F.foot + 60],
  )}</defs>`;
  const post = (x, top, foot, w) =>
    `<g transform="translate(${x - w / 2} 0)"><rect y="${top}" width="${w + 4}" height="${foot - top}" fill="url(#${wood})"/></g>`;
  s += soft(
    { box: [100, 1550, 900, 250], blur: 12, disp: 16, freq: 0.03 },
    `<ellipse cx="${(F.l + F.r) / 2 + 60}" cy="1690" rx="320" ry="34"/>`,
    'fill="#6c4e52" opacity=".3"',
  );
  s += post(B.l, B.top, B.foot, 10) + post(B.r, B.top, B.foot, 10);
  // the canopy cloth, and sheer panels billowing out to the right in the sea wind
  s += `<path d="M${F.l - 10} ${F.top}L${B.l - 6} ${B.top}L${B.r + 6} ${B.top}L${F.r + 10} ${F.top}L${F.r + 10} ${F.top + 18}Q${(F.l + F.r) / 2} ${F.top + 50} ${F.l - 10} ${F.top + 18}Z" fill="#f7f1e8" opacity=".95"/>`;
  const panel = (x0, y0, dx, spread, a) =>
    `<path d="M${x0} ${y0}C${x0 + dx * 0.4} ${y0 + 120} ${x0 + dx * 0.2} ${y0 + 300} ${x0 + dx} ${F.foot + 10}L${x0 + dx + spread} ${F.foot + 16}C${x0 + dx * 0.9 + spread} ${y0 + 280} ${x0 + dx * 0.7 + spread * 0.6} ${y0 + 120} ${x0 + 14} ${y0}Z" fill="url(#${cloth})" opacity="${a}"/>`;
  s += panel(B.r, B.top + 4, 120, 90, 0.7) + panel(B.l, B.top + 4, 60, 80, 0.6);
  s += post(F.l, F.top, F.foot, 14) + post(F.r, F.top, F.foot, 14);
  s += panel(F.r, F.top + 6, 170, 120, 0.9) + panel(F.l, F.top + 6, 110, 110, 0.85);
  s += `<path d="M${F.l - 12} ${F.top - 2}Q${(F.l + F.r) / 4 + F.l / 2} ${F.top + 40} ${(F.l + F.r) / 2} ${F.top + 4}Q${(F.l + F.r) / 4 + F.r / 2} ${F.top + 40} ${F.r + 12} ${F.top - 2}" fill="#fbf7f0" opacity=".9"/>`;
  // flowers at its feet: coral, blush, white and gold roses with greenery, petals on the sand
  const tones = [
    { base: '#f0a98f', light: '#fbd4c2', deep: '#c9765f', heart: '#a45a48' },
    { base: '#f3d2c8', light: '#fdeee8', deep: '#d4a397', heart: '#ad7a6e' },
    { base: '#f2ece2', light: '#fdfaf4', deep: '#cfc3b2', heart: '#a79683' },
    { base: '#efcb8e', light: '#fbe6bf', deep: '#c99f5e', heart: '#a47d42' },
  ];
  const tg = tones.map((t) => {
    const id = nid('rg');
    return {
      id,
      def: radial(
        id,
        [
          [0, t.heart],
          [0.4, t.deep],
          [0.85, t.base],
          [1, t.base],
        ],
        'cx="0.5" cy="0.5" r="0.5"',
      ),
    };
  });
  const bl = [];
  const stems = [];
  for (const [cx, cy, sx, n] of [
    [F.l, F.foot - 10, 170, 16],
    [F.r, F.foot - 10, 170, 16],
    [B.l, B.foot - 8, 90, 6],
    [B.r, B.foot - 8, 90, 6],
  ]) {
    for (let i = 0; i < n; i++)
      bl.push({
        x: cx + (rnd() - 0.5) * sx,
        y: cy + (rnd() - 0.6) * sx * 0.3,
        r: 9 + rnd() * 13,
        t: Math.floor(rnd() * 4),
      });
    for (let i = 0; i < n; i++)
      stems.push([
        cx + (rnd() - 0.5) * sx * 0.7,
        cy - rnd() * 20,
        -Math.PI / 2 + (rnd() - 0.5) * 2.4,
        30 + rnd() * 40,
        (rnd() - 0.5) * 20,
      ]);
  }
  s += `<defs>${tg.map((g) => g.def).join('')}</defs>`;
  s += stems
    .map(([x, y, a, len, bend]) => eucalyptus(rnd, x, y, a, len, bend, ['#8f9c86', '#7f8e7a', '#a0ab94']))
    .join('');
  s += bl
    .sort((a, b) => a.y - b.y)
    .map((b) => rose(rnd, b.x, b.y, b.r, tones[b.t], rnd() * 360, 0.7 + rnd() * 0.2, tg[b.t].id))
    .join('');
  return s;
};

/** sunset: the chuppah of white flowing cloth on the sand, facing the sea */
const chuppahScene = () => {
  const rnd = prng(301);
  let s = skyFill([
    [0, '#4d7189'],
    [0.16, '#7690a0'],
    [0.32, '#b3a0a0'],
    [0.46, '#e0a488'],
    [0.56, '#eeb784'],
    [0.625, '#f1c68a'],
    [1, '#d9a98a'],
  ]);
  s += wisps({
    color: '#f0ab8c',
    a: 0.45,
    seed: 31,
    items: [
      [300, 560, 380, 16, -3],
      [820, 480, 320, 14, 2],
      [600, 820, 440, 14, -1],
    ],
  });
  s += sun(860, 1178, 40, { a: 0.65 });
  s += sea(rnd, {
    top: '#d59d84',
    mid: '#4f9095',
    bottom: '#2b6478',
    shore: 1330,
    sx: 860,
    gA: 0.75,
    gW: 40,
  });
  s += beach(rnd, { y0: 1330, wet: '#c79a86', dry: '#e2bf98', seed: 33, foamA: 0.6 });
  // the aisle of petals towards us
  let petals = '';
  for (let i = 0; i < 160; i++) {
    const t = rnd();
    const y = 1700 + t * 240;
    const spread = 60 + t * 200;
    const r = 2 + t * 7;
    const c = ['#f0a98f', '#f5d5cb', '#f6efe6', '#efc98c'][Math.floor(rnd() * 4)];
    petals += `<ellipse cx="${r1(540 + (rnd() - 0.5) * spread * 2)}" cy="${r1(y)}" rx="${r1(r)}" ry="${r1(r * 0.55)}" fill="${c}" opacity="${r3(0.55 + rnd() * 0.4)}"/>`;
  }
  s += blurred(1.4, petals);
  s += glow({ x: 860, y: 1500, rx: 500, ry: 280, color: '#f5c38e', a: 0.2, blend: 'screen' });
  s += blurred(0.8, chuppah(rnd));
  // the low sun catching the cloth's edge
  s += glow({ x: 760, y: 1300, rx: 200, ry: 160, color: '#f8d7a8', a: 0.25, blend: 'screen' });
  s += vignette(0.28, '#2c2a40');
  return [svgLayer(s)];
};

/** a long table in perspective, laid with white linen, candles down its length */
const table = (rnd, cam, { xc = 0, z0 = 2.2, z1 = 13, half = 0.5 }) => {
  const Y = 0.76;
  const at = (x, y, z) => cam.at(xc + x, y, z);
  const zs = Array.from({ length: 30 }, (_, i) => z0 * (z1 / z0) ** (i / 29));
  const L = zs.map((z) => at(-half, Y, z));
  const R = zs.map((z) => at(half, Y, z));
  const Ld = zs.map((z) => at(-half, Y - 0.2, z));
  const Rd = zs.map((z) => at(half, Y - 0.2, z));
  const lin = nid('ln');
  let s = `<defs>${ugrad(
    lin,
    [
      [0, '#a8a0ad'],
      [0.5, '#b8aab0'],
      [1, '#c9b3aa'],
    ],
    [0, HZ, 0, H],
  )}</defs>`;
  // legs under a short drop of cloth, the cloth's sides (in shadow), the near end, the top
  for (let z = z0 + 0.05; z < z1; z *= 1.7)
    for (const sx of [-1, 1]) {
      const [x, y] = at(sx * (half - 0.05), Y - 0.2, z);
      const [, yb] = at(sx * (half - 0.05), 0, z);
      s += `<rect x="${r1(x - cam.k(z) * 0.02)}" y="${r1(y)}" width="${r1(cam.k(z) * 0.04)}" height="${r1(yb - y)}" fill="#3a3445"/>`;
    }
  s += `<path d="${pts(L.concat(Ld.slice().reverse()))}Z" fill="#5f5b70"/><path d="${pts(R.concat(Rd.slice().reverse()))}Z" fill="#6d6778"/>`;
  s += `<path d="${pts([L[0], R[0], Rd[0], Ld[0]])}Z" fill="#7a7282"/>`;
  s += `<path d="${pts(L.concat(R.slice().reverse()))}Z" fill="url(#${lin})"/>`;
  // candles down the middle, and small jars between them
  let c = '';
  for (let z = z0 + 0.25; z < z1; z *= 1.22) {
    for (const sx of [-1, 1]) {
      const [x, y] = at(sx * 0.14, Y, z * (sx > 0 ? 1.05 : 1));
      const k = cam.k(z);
      const hh = k * (0.18 + rnd() * 0.12);
      const w = Math.max(1.2, k * 0.028);
      c += `<rect x="${r1(x - w / 2)}" y="${r1(y - hh)}" width="${r1(w)}" height="${r1(hh)}" fill="#f4ecdc"/>`;
      c += glow({ x, y: y - hh - k * 0.02, rx: k * 0.14, color: '#f2b467', a: 0.6, blend: 'screen' });
      c += `<ellipse cx="${r1(x)}" cy="${r1(y - hh - k * 0.018)}" rx="${r1(Math.max(0.8, k * 0.009))}" ry="${r1(Math.max(1.6, k * 0.022))}" fill="#fff2cf"/>`;
    }
    const [jx, jy] = at((rnd() - 0.5) * 0.2, Y, z * 1.1);
    c += jar({ x: jx, y: jy, h: cam.k(z * 1.1) * 0.08, glowA: 0.5 });
  }
  return s + c;
};

/** blue hour: lanterns on the sand, a long table with candles, the sea darkening */
const lanternsScene = () => {
  const rnd = prng(401);
  const cam = eye({ hz: HZ, h: 2.1, f: 1000 });
  let s = skyFill([
    [0, '#1f3553'],
    [0.18, '#2c4764'],
    [0.36, '#4d6682'],
    [0.5, '#8a8195'],
    [0.58, '#c38c80'],
    [0.625, '#d99a7c'],
    [1, '#6e6a78'],
  ]);
  s += stars({ seed: 41, n: 50, y0: 20, y1: 560, a: [0.15, 0.55] });
  s += wisps({
    color: '#b98a92',
    a: 0.35,
    seed: 43,
    items: [
      [280, 820, 360, 12, -2],
      [780, 900, 320, 10, 3],
    ],
  });
  s += glow({ x: 380, y: HZ - 10, rx: 900, ry: 200, color: '#e8a07c', a: 0.4 });
  s += sea(rnd, {
    top: '#8d7288',
    mid: '#2e5a74',
    bottom: '#1b3c55',
    shore: 1320,
    sx: 380,
    glitter: '#e7a483',
    gA: 0.35,
    gW: 70,
    swellA: 0.08,
  });
  s += beach(rnd, { y0: 1320, wet: '#6e6a80', dry: '#8f8290', seed: 45, foam: '#cfc8d4', foamA: 0.45 });
  s += veil('#2a3550', [
    [1320, 0],
    [1920, 0.3],
  ]);
  // the table running down to the water, lanterns on the sand around it
  s += soft(
    { box: [0, 1300, W, 620], blur: 12, disp: 14, freq: 0.03 },
    `<path d="${pts([cam.at(-0.8, 0, 3.4), cam.at(1, 0, 3.4), cam.at(0.9, 0, 14), cam.at(-0.7, 0, 14)])}Z"/>`,
    'fill="#1f2433" opacity=".35"',
  );
  s += table(rnd, cam, { xc: 0.1, z0: 3.4, z1: 14, half: 0.45 });
  s += glow({ x: 560, y: 1500, rx: 420, ry: 260, color: '#f0ae68', a: 0.2, blend: 'screen' });
  const spots = [
    [-2.1, 2.6, 0.5],
    [2.4, 2.9, 0.55],
    [-1.6, 4.4, 0.45],
    [1.8, 5, 0.45],
    [-1.5, 7.5, 0.45],
    [1.6, 8.5, 0.45],
    [-1.3, 12, 0.4],
    [1.5, 13.5, 0.4],
    [-3.4, 6, 0.5],
    [3.6, 7, 0.5],
  ];
  const items = spots.map(([X, z, h]) => ({ X, z, h })).sort((a, b) => b.z - a.z);
  for (const { X, z, h } of items) {
    const [x, y] = cam.at(X, 0, z);
    s += lantern({ x, y, h: cam.k(z) * h, glowA: 0.65, rnd });
    const [jx, jy] = cam.at(X + (rnd() - 0.5) * 0.6, 0, z * 1.08);
    s += jar({ x: jx, y: jy, h: cam.k(z * 1.08) * 0.14, glowA: 0.5 });
  }
  s += vignette(0.32, '#13263a');
  return [svgLayer(s)];
};

/** night: the moonlit sea, a path of moonlight on the water, stars */
const moonScene = () => {
  const rnd = prng(501);
  const [mx, my, mr] = [560, 520, 62];
  let s = skyFill([
    [0, '#1c3450'],
    [0.2, '#284766'],
    [0.42, '#3a5f7e'],
    [0.58, '#4d7690'],
    [0.625, '#5a8198'],
    [1, '#1d3a52'],
  ]);
  s += glow({ x: mx, y: my, rx: 700, ry: 640, color: '#9fb9c8', a: 0.4 });
  s += glow({ x: mx, y: my, rx: 220, color: '#d9e3e6', a: 0.5 });
  s += stars({
    seed: 51,
    n: 220,
    y0: 20,
    y1: 1150,
    a: [0.2, 0.8],
    bright: 12,
    fade: (x, y) => Math.min(1, Math.hypot(x - mx, y - my) / 320),
  });
  const moon = nid('mn');
  s += `<defs>${radial(
    moon,
    [
      [0, '#f6f3ea'],
      [0.75, '#ece8de'],
      [1, '#d9d6d0'],
    ],
    'cx="0.42" cy="0.4" r="0.65"',
  )}</defs><circle cx="${mx}" cy="${my}" r="${mr}" fill="url(#${moon})"/>`;
  s += blurred(
    4,
    `<g fill="#cfcbc9" opacity=".45"><ellipse cx="${mx - 18}" cy="${my - 12}" rx="20" ry="15"/><ellipse cx="${mx + 20}" cy="${my + 8}" rx="16" ry="21"/><ellipse cx="${mx - 4}" cy="${my + 30}" rx="12" ry="8"/></g>`,
  );
  s += wisps({
    color: '#9db3c6',
    a: 0.3,
    seed: 53,
    items: [
      [280, 780, 340, 12, -2],
      [820, 860, 300, 10, 2],
    ],
  });
  s += sea(rnd, {
    top: '#557d94',
    mid: '#2b5572',
    bottom: '#173652',
    shore: 1790,
    sx: mx,
    glitter: '#e3e8e6',
    gA: 0.75,
    gW: 34,
    swell: '#c9d8e0',
    swellA: 0.1,
    dark: '#0b1d2e',
  });
  s += glow({ x: mx, y: HZ + 2, rx: 900, ry: 20, color: '#a9c0cc', a: 0.5 });
  s += beach(rnd, { y0: 1790, wet: '#4b6072', dry: '#5f6a78', seed: 55, foam: '#dfe6ea', foamA: 0.55 });
  s += vignette(0.3, '#0d1b2b');
  return [svgLayer(s)];
};

void [mist, cumulus];

const scenes = {
  'scene-dunes': { paint: dunes, seed: 51, post: { gamma: 1.2, bloom: 0.42 } },
  'scene-sea': { paint: seaScene, seed: 52, post: { gamma: 1.1, bloom: 0.45 } },
  'scene-chuppah': { paint: chuppahScene, seed: 53, post: { gamma: 1.12, bloom: 0.42 } },
  'scene-lanterns': { paint: lanternsScene, seed: 54, post: { gamma: 0.9, bloom: 0.48 } },
  'scene-moon': { paint: moonScene, seed: 55, post: { gamma: 0.9, bloom: 0.48 } },
};

await paintScenes({ id: 'sunset-shore', scenes, background: '#d9a98a' });
