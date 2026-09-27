// Scroll-scene pictures of the "moonshot" design (space — a birthday, a bar or a bat mitzvah): five
// full-screen 9:16 pictures of one flight, in the design's palette (space navy, purple, cyan, flame
// orange, moon silver): the launch pad at dusk, rising through the clouds, the curve of the Earth, deep
// space with a nebula and a ringed planet, and a starfield with the Earth small below. The app draws the
// rocket lifting off at the bottom centre and landing on a moon in the upper middle — so there is no
// rocket and no moon here, the pad keeps its bottom centre clear, and the last picture its upper middle.
//
//   node scripts/scene-art/moonshot.mjs [scene …]            the files, and their entries in the list
//   node scripts/scene-art/moonshot.mjs --draft <dir> [scene …]  drafts only
import {
  W,
  H,
  paintScenes,
  prng,
  mix,
  r1,
  r3,
  nid,
  pts,
  glow,
  mist,
  wisps,
  cumulus,
  vignette,
  svgLayer,
  ugrad,
  stopsOf,
} from './kit.mjs';
import { stars, hazeTex, blurred, vgrad, rgrad, rmask, beam } from './action-shared.mjs';

/** the design's palette */
const C = {
  navy: '#0B1030',
  navy2: '#151a4a',
  purple: '#3B2A6B',
  purple2: '#5a3f8f',
  cyan: '#5FD4F4',
  orange: '#FF8A3D',
  silver: '#D9DDE6',
  shade: '#070A1E',
  pink: '#e98aa6',
};

// ---------------------------------------------------------------------------------------------------
// painting blocks

/** a disc clipped group */
const inDisc = (x, y, r, inner) => {
  const id = nid('dc');
  return `<defs><clipPath id="${id}"><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
};

/**
 * The Earth as a disc (centre x, y, radius r): ocean, a few continents, clouds, lit from `sun` (a unit
 * vector on screen), its night side dark with a few city lights, and a thin glowing atmosphere.
 */
const earth = ({ x, y, r, sun = [-0.8, -0.35], seed = 1, clouds = 0.75, cityLights = true, atmo = 1 }) => {
  const rnd = prng(seed * 313 + 1);
  const [lx, ly] = sun;
  let body = rgrad({
    x: x + lx * r * 0.35,
    y: y + ly * r * 0.35,
    rx: r * 1.25,
    stops: [
      [0, '#3d8fd0'],
      [0.45, '#1f5fa8'],
      [0.8, '#143f7c'],
      [1, '#0d2a5a'],
    ],
  });
  // continents: soft irregular patches
  let land = '';
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.8;
    const [cx, cy] = [x + Math.cos(a) * d, y + Math.sin(a) * d];
    for (let j = 0; j < 6; j++)
      land += `<ellipse cx="${r1(cx + (rnd() - 0.5) * r * 0.35)}" cy="${r1(cy + (rnd() - 0.5) * r * 0.25)}" rx="${r1(r * (0.08 + rnd() * 0.16))}" ry="${r1(r * (0.05 + rnd() * 0.1))}"/>`;
  }
  body += blurred(Math.max(1.5, r * 0.012), land, `fill="#5f8a5a" opacity=".55"`);
  // clouds: fractal noise, white, patchy
  body += hazeTex({
    box: [x - r, y - r, 2 * r, 2 * r],
    color: '#f2f6ff',
    a: clouds,
    freq: [3.2 / r, 5 / r],
    oct: 5,
    seed: seed + 3,
    k: 2.4,
    b: -1.0,
  });
  // the night side
  body += rgrad({
    x: x - lx * r * 0.9,
    y: y - ly * r * 0.9,
    rx: r * 1.5,
    stops: [
      [0, '#050a22', 0.92],
      [0.55, '#050a22', 0.75],
      [0.8, '#050a22', 0.2],
      [1, '#050a22', 0],
    ],
  });
  if (cityLights) {
    let cl = '';
    for (let i = 0; i < 180; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * r;
      const [px, py] = [x + Math.cos(a) * d, y + Math.sin(a) * d];
      const side = (px - x) * lx + (py - y) * ly;
      if (side > -r * 0.25) continue;
      cl += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${r1(0.6 + rnd() * Math.max(0.6, r * 0.004))}" fill="#ffc47a" opacity="${r3(0.3 + rnd() * 0.5)}"/>`;
    }
    body += blurred(0.6, cl);
  }
  // the limb's haze inside the disc
  body += rgrad({
    x,
    y,
    rx: r,
    stops: [
      [0.8, C.cyan, 0],
      [0.96, C.cyan, 0.3],
      [1, '#bff0ff', 0.55],
    ],
  });
  let s = inDisc(x, y, r, body);
  // the atmosphere: a thin bright line on the lit limb, a soft blue glow round it
  const g = nid('at');
  s += `<defs><linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="${r1(x + lx * r)}" y1="${r1(y + ly * r)}" x2="${r1(x - lx * r)}" y2="${r1(y - ly * r)}">${stopsOf(
    [
      [0, '#c9f3ff', 0.95],
      [0.5, C.cyan, 0.55],
      [1, C.cyan, 0.1],
    ],
  )}</linearGradient></defs>`;
  s += blurred(
    Math.max(1.2, r * 0.006),
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r + Math.max(1.5, r * 0.004))}" fill="none" stroke="url(#${g})" stroke-width="${r1(Math.max(2.5, r * 0.012))}"/>`,
  );
  s += blurred(
    Math.max(6, r * 0.03),
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r + r * 0.02)}" fill="none" stroke="url(#${g})" stroke-width="${r1(r * 0.05)}" opacity="${r3(0.6 * atmo)}"/>`,
  );
  return s;
};

/** a nebula: layers of colored fractal haze inside soft radial masks */
const nebula = (clouds) =>
  clouds
    .map(({ x, y, rx, ry, color, a, freq = 0.004, seed, k = 1.7, b = -0.5 }) => {
      const m = rmask({
        x,
        y,
        rx,
        ry,
        stops: [
          [0, 1],
          [0.55, 0.6],
          [1, 0],
        ],
      });
      return (
        m.defs +
        hazeTex({
          box: [x - rx, y - ry, rx * 2, ry * 2],
          color,
          a,
          freq: [freq, freq * 1.3],
          oct: 5,
          seed,
          k,
          b,
          mask: m.id,
          blend: 'screen',
        })
      );
    })
    .join('');

// ---------------------------------------------------------------------------------------------------
// the pictures

/** the launch pad at dusk: a pink-orange sky over the desert, a gantry tower on the right, the pad clear */
const pad = () => {
  const rnd = prng(3101);
  const hz = 1330;
  let s = vgrad([
    [0, '#161c4a'],
    [0.18, '#2a2a66'],
    [0.34, '#4b367a'],
    [0.47, '#7d4a86'],
    [0.57, '#b65f86'],
    [0.64, '#e07f78'],
    [0.68, '#f59a68'],
    [r3(hz / H), '#ffb372'],
    [r3(hz / H + 0.004), '#9b5a6c'],
    [1, '#3a2340'],
  ]);
  s += stars({
    n: 110,
    box: [0, 0, W, 620],
    seed: 3,
    a: [0.25, 0.8],
    size: [0.5, 1.4],
    bright: 0.03,
    weight: (x, y) => 1 - y / 640,
  });
  // the sun just set, a little left of centre
  s += glow({ x: 330, y: hz, rx: 900, ry: 520, color: '#ffb070', a: 0.55 });
  s += glow({ x: 330, y: hz, rx: 300, ry: 120, color: '#ffd9a8', a: 0.7 });
  // thin clouds lit from below
  s += wisps({
    color: '#f7b39a',
    a: 0.5,
    seed: 5,
    items: [
      [260, 880, 420, 18, -3],
      [800, 820, 380, 14, 2],
      [540, 1010, 520, 20, -1],
      [180, 1130, 360, 12, 2],
      [900, 1180, 300, 12, -2],
    ],
  });
  s += wisps({
    color: '#c98fb2',
    a: 0.35,
    seed: 7,
    items: [
      [700, 560, 380, 14, 3],
      [300, 640, 300, 12, -2],
    ],
  });
  // far mesas on the horizon, hazy purple
  const mesa = (x0, x1, h, col) => {
    const top = [];
    for (let x = x0 + 40; x <= x1 - 50; x += 18) top.push([x, hz - h + (rnd() - 0.5) * 5]);
    return `<path d="M${x0} ${hz + 2}C${x0 + 20} ${hz - h * 0.3} ${x0 + 26} ${hz - h * 0.8} ${x0 + 40} ${hz - h}${pts(top).replace('M', 'L')}C${x1 - 36} ${hz - h * 0.7} ${x1 - 20} ${hz - h * 0.2} ${x1} ${hz + 2}Z" fill="${col}"/>`;
  };
  s += blurred(
    1.5,
    mesa(-40, 260, 46, '#8a5476') + mesa(700, 1000, 34, '#8f5878') + mesa(930, 1140, 58, '#7d4c70'),
  );
  // the desert floor: lit by the sky near the horizon, darker toward us, rippled
  s += vgrad(
    [
      [0, '#b0667a'],
      [0.12, '#8a4f68'],
      [0.5, '#5b3653'],
      [1, '#2e1f3c'],
    ],
    [0, hz, W, H - hz],
  );
  s += hazeTex({
    box: [0, hz, W, H - hz],
    color: '#1f1430',
    a: 0.45,
    freq: [0.004, 0.035],
    oct: 3,
    seed: 9,
    k: 1.8,
    b: -0.6,
  });
  s += hazeTex({
    box: [0, hz, W, H - hz],
    color: '#f0a07a',
    a: 0.14,
    freq: [0.006, 0.05],
    oct: 2,
    seed: 11,
    k: 1.9,
    b: -0.8,
  });
  s += mist({ y: hz + 10, h: 26, color: '#f1a58a', a: 0.45, seed: 13, n: 10 });
  // lightning masts, far
  s += blurred(
    1,
    `<path d="M120 ${hz + 40}V760M112 ${hz + 40}L120 760L128 ${hz + 40}M1010 ${hz + 60}V900" stroke="#2a1b38" stroke-width="3" fill="none" opacity=".85"/>`,
  );
  // the pad: a concrete deck in perspective, the flame trench, floodlights on its corners
  const deck = `M300 1600L780 1600L900 1720L180 1720Z`;
  const dg = nid('dk');
  s += `<defs>${ugrad(
    dg,
    [
      [0, '#9c7f96'],
      [1, '#5f4a66'],
    ],
    [0, 1600, 0, 1720],
  )}</defs><path d="${deck}" fill="url(#${dg})"/><path d="M180 1720L900 1720L900 1745L180 1745Z" fill="#3a2a46"/>`;
  s += `<path d="M470 1600L610 1600L640 1720L440 1720Z" fill="#2a1d36" opacity=".9"/>`;
  s += glow({ x: 540, y: 1640, rx: 420, ry: 90, color: '#ffd9b0', a: 0.3, blend: 'screen' });
  for (const [x, y] of [
    [230, 1540],
    [850, 1540],
  ]) {
    s += `<path d="M${x} 1700V${y}" stroke="#2a1b38" stroke-width="4"/>`;
    s += glow({ x, y, rx: 60, ry: 40, color: '#fff3e0', a: 0.9, blend: 'screen' });
    s += glow({ x, y, rx: 200, ry: 140, color: '#ffe2c0', a: 0.3, blend: 'screen' });
  }
  // the gantry tower: a lattice of steel with platforms, a crane on top, access arms toward the pad's centre
  const [tx0, tx1, ttop, tbase] = [790, 900, 520, 1610];
  let lat = `M${tx0} ${tbase}V${ttop}M${tx1} ${tbase}V${ttop}`;
  for (let y = tbase; y > ttop; y -= 55)
    lat += `M${tx0} ${y}L${tx1} ${y - 55}M${tx1} ${y}L${tx0} ${y - 55}M${tx0} ${y}H${tx1}`;
  for (const y of [760, 900, 1040, 1180]) lat += `M${tx0} ${y}H${tx0 - 150}M${tx0} ${y + 16}H${tx0 - 150}`;
  lat += `M${tx0 - 20} ${ttop}H${tx1 + 60}M${tx1 + 60} ${ttop}V${ttop + 30}M${tx0 + 40} ${ttop}V${ttop - 70}M${tx0 - 120} ${ttop - 40}H${tx1 + 20}`;
  const towerG = nid('tw');
  s += `<defs>${ugrad(
    towerG,
    [
      [0, '#3a2a52'],
      [1, '#1d1530'],
    ],
    [0, ttop, 0, tbase],
  )}</defs>`;
  s += `<rect x="${tx0}" y="${ttop}" width="${tx1 - tx0}" height="${tbase - ttop}" fill="#231a38" opacity=".35"/>`;
  s += blurred(
    0.9,
    `<path d="${lat}" stroke="url(#${towerG})" stroke-width="8" fill="none" stroke-linecap="square"/>`,
  );
  s += blurred(1.2, `<path d="M${tx0} ${tbase}V${ttop}" stroke="#f0a070" stroke-width="2" opacity=".45"/>`);
  for (const [x, y] of [
    [tx1 + 60, ttop + 30],
    [tx0 + 40, ttop - 70],
    [tx1, 800],
    [tx0 - 150, 1040],
  ])
    s += glow({ x, y, rx: 14, ry: 14, color: '#ff4d4d', a: 0.9, blend: 'screen' });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.35],
    ],
    [0, 1650, W, 270],
  );
  s += vignette(0.35, C.shade, 0.5);
  return [svgLayer(s)];
};

/** rising through the clouds: towers of cloud lit pink and gold from below, the sky deepening from blue to indigo */
const clouds = () => {
  let s = vgrad([
    [0, '#1a1c58'],
    [0.2, '#262e78'],
    [0.42, '#3b56a4'],
    [0.62, '#6a86c6'],
    [0.8, '#a490c0'],
    [1, '#d49aa8'],
  ]);
  s += stars({
    n: 70,
    box: [0, 0, W, 520],
    seed: 15,
    a: [0.2, 0.6],
    size: [0.5, 1.2],
    bright: 0.02,
    weight: (x, y) => 1 - y / 520,
  });
  s += glow({ x: 200, y: 1900, rx: 1100, ry: 800, color: '#ffb48a', a: 0.45 });
  const lit = (t) => ({
    top: mix('#f7c1a8', '#f2b39e', t),
    mid: mix('#a58fb8', '#9884b0', t),
    bot: mix('#5a5796', '#4c4a88', t),
  });
  const far = (t) => ({ top: mix('#d7a8b6', '#cfa4b8', t), mid: '#8f8cbc', bot: '#6c6fa8' });
  const dir = [0.3, 1, 0.6, 0];
  s += cumulus({
    cx: 540,
    base: 1420,
    width: 700,
    height: 260,
    n: 30,
    size: 70,
    pal: far,
    seed: 17,
    bands: 3,
    dir,
  });
  s += cumulus({
    cx: 90,
    base: 1180,
    width: 420,
    height: 720,
    n: 40,
    size: 120,
    pal: lit,
    seed: 19,
    bands: 4,
    dir,
    skew: 0.1,
  });
  s += cumulus({
    cx: 1010,
    base: 1300,
    width: 420,
    height: 680,
    n: 40,
    size: 120,
    pal: lit,
    seed: 21,
    bands: 4,
    dir,
    skew: -0.1,
  });
  s += cumulus({
    cx: 540,
    base: 2250,
    width: 1600,
    height: 700,
    n: 64,
    size: 180,
    pal: lit,
    seed: 23,
    bands: 5,
    dir,
    flatBase: 0,
  });
  s += mist({ y: 340, h: 110, x0: 640, x1: 1300, color: '#b7b3d8', a: 0.35, seed: 25, n: 3 });
  s += mist({ y: 1560, h: 120, x0: -300, x1: 520, color: '#e4b8b8', a: 0.35, seed: 27, n: 3 });
  s += wisps({
    color: '#c7c1e4',
    a: 0.3,
    seed: 29,
    items: [
      [300, 520, 360, 14, -6],
      [780, 700, 320, 12, 5],
    ],
  });
  s += vignette(0.32, C.shade, 0.5);
  return [svgLayer(s)];
};

/** in orbit: the curve of the Earth below with its thin glowing atmosphere, the sun rising on its rim, stars */
const orbit = () => {
  let s = vgrad([
    [0, '#0b1030'],
    [0.4, '#141a48'],
    [0.7, '#1f2462'],
    [1, '#1c2a6a'],
  ]);
  s += nebula([
    { x: 800, y: 420, rx: 700, ry: 520, color: '#6a4fc0', a: 0.35, seed: 31 },
    { x: 250, y: 900, rx: 600, ry: 420, color: '#3a7fd0', a: 0.2, seed: 33 },
  ]);
  s += stars({ n: 420, box: [0, 0, W, 1500], seed: 35, a: [0.25, 0.9], size: [0.5, 1.6], bright: 0.015 });
  // the Earth: a vast disc below, tilted
  const [ex, ey, R] = [420, 3260, 1850];
  s += glow({ x: ex, y: ey - R, rx: 1500, ry: 380, color: '#3fa3e0', a: 0.45 });
  s += earth({ x: ex, y: ey, r: R, sun: [-0.92, -0.4], seed: 37, clouds: 0.85 });
  // the sun rising on the rim, on the left
  const [sx, sy] = [60, 1430];
  s += glow({ x: sx, y: sy, rx: 700, ry: 260, color: '#ffb070', a: 0.55, blend: 'screen' });
  s += glow({ x: sx, y: sy, rx: 160, ry: 80, color: '#fff1d8', a: 0.9, blend: 'screen' });
  s += beam({
    x: sx,
    y: sy,
    ang: -8,
    spread: 3,
    len: 1300,
    w0: 4,
    color: '#ffd9b0',
    a: 0.3,
    blur: 6,
    core: 0.4,
  });
  s += vignette(0.32, C.shade, 0.45);
  return [svgLayer(s)];
};

/** deep space: a nebula in purple and cyan, a ringed planet off to the right */
const deep = () => {
  let s = vgrad([
    [0, '#0e1236'],
    [0.5, '#171a4c'],
    [1, '#1b1646'],
  ]);
  s += nebula([
    { x: 300, y: 500, rx: 760, ry: 620, color: '#8a55d0', a: 0.55, seed: 41 },
    { x: 700, y: 1000, rx: 800, ry: 520, color: '#b0509a', a: 0.35, seed: 43 },
    { x: 520, y: 760, rx: 620, ry: 460, color: C.cyan, a: 0.35, seed: 45, freq: 0.005 },
    { x: 160, y: 1400, rx: 640, ry: 520, color: '#3a60c0', a: 0.4, seed: 47 },
    { x: 900, y: 300, rx: 520, ry: 420, color: '#5fb8e8', a: 0.3, seed: 49 },
  ]);
  // dust lanes
  s += hazeTex({ color: '#0a0c26', a: 0.35, freq: [0.003, 0.005], seed: 51, k: 1.8, b: -0.7 });
  s += stars({ n: 520, seed: 53, a: [0.25, 0.9], size: [0.5, 1.7], bright: 0.015 });
  // the ringed planet: the ring's far half, the body, the near half
  const [px, py, pr] = [890, 1360, 250];
  const tilt = -16;
  const ring = (half) => {
    const id = nid('rgc');
    const clip =
      half === 'back'
        ? `M-400 -400H${W + 400}V${r1(py)}H-400Z`
        : `M-400 ${r1(py)}H${W + 400}V${H + 400}H-400Z`;
    let o = `<defs><clipPath id="${id}"><path d="${clip}" transform="rotate(${tilt} ${px} ${py})"/></clipPath></defs><g clip-path="url(#${id})"><g transform="rotate(${tilt} ${px} ${py})">`;
    const bands = [
      [1.35, 10, '#c9b2c8', 0.55],
      [1.48, 18, '#e3cdbf', 0.7],
      [1.62, 8, '#9f8fb5', 0.5],
      [1.74, 14, '#d9c4c6', 0.55],
      [1.9, 6, '#a898bf', 0.35],
    ];
    for (const [k, w, c, a] of bands)
      o += `<ellipse cx="${px}" cy="${py}" rx="${r1(pr * k)}" ry="${r1(pr * k * 0.2)}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${a}"/>`;
    return `${o}</g></g>`;
  };
  s += blurred(1.2, ring('back'));
  const pg = nid('pl');
  s += `<defs><linearGradient id="${pg}" x1="0" y1="0" x2="0" y2="1" gradientTransform="rotate(${tilt} .5 .5)">${stopsOf(
    [
      [0, '#e6b89c'],
      [0.2, '#c99a8f'],
      [0.32, '#e8c3a6'],
      [0.45, '#b0829a'],
      [0.6, '#d6a894'],
      [0.75, '#8f6a92'],
      [1, '#b98fa0'],
    ],
  )}</linearGradient></defs>`;
  let planet = `<circle cx="${px}" cy="${py}" r="${pr}" fill="url(#${pg})"/>`;
  planet += hazeTex({
    box: [px - pr, py - pr, pr * 2, pr * 2],
    color: '#f3dccb',
    a: 0.25,
    freq: [0.004, 0.03],
    oct: 3,
    seed: 55,
    k: 1.8,
    b: -0.6,
  });
  planet += rgrad({
    x: px + pr * 0.55,
    y: py + pr * 0.35,
    rx: pr * 1.4,
    stops: [
      [0, '#0a0a26', 0.9],
      [0.5, '#0a0a26', 0.6],
      [1, '#0a0a26', 0],
    ],
  });
  s += inDisc(px, py, pr, planet);
  s += blurred(
    3,
    `<circle cx="${px}" cy="${py}" r="${pr + 2}" fill="none" stroke="#f3d6c4" stroke-width="4" opacity=".35"/>`,
  );
  s += blurred(1.2, ring('front'));
  s += glow({
    x: px - pr * 0.4,
    y: py - pr * 0.4,
    rx: pr * 2,
    ry: pr * 1.6,
    color: '#e9b8a8',
    a: 0.18,
    blend: 'screen',
  });
  s += vignette(0.3, C.shade, 0.5);
  return [svgLayer(s)];
};

/** a starfield, the Earth small in the lower left, the upper middle dark and calm (the moon is drawn there) */
const moon = () => {
  let s = vgrad([
    [0, '#0e1338'],
    [0.45, '#1a2056'],
    [1, '#2a2468'],
  ]);
  // a soft milky way from the lower left to the right, clear of the upper middle
  s += nebula([
    { x: 360, y: 1560, rx: 760, ry: 480, color: '#7a5ad0', a: 0.6, seed: 61 },
    { x: 900, y: 1150, rx: 560, ry: 420, color: '#4a8ae0', a: 0.5, seed: 63 },
    { x: 980, y: 1700, rx: 560, ry: 400, color: '#b066b8', a: 0.45, seed: 65 },
    { x: 80, y: 1000, rx: 460, ry: 420, color: C.cyan, a: 0.28, seed: 67 },
    { x: 1000, y: 700, rx: 360, ry: 320, color: '#6a5ad0', a: 0.3, seed: 68 },
  ]);
  const calm = (x, y) => {
    const d = Math.hypot((x - 540) / 380, (y - 520) / 420);
    return d < 1 ? 0.12 + 0.5 * d * d : 1;
  };
  s += stars({ n: 620, seed: 69, a: [0.25, 0.9], size: [0.5, 1.7], bright: 0.015, weight: calm });
  s += rgrad({
    x: 540,
    y: 520,
    rx: 460,
    ry: 480,
    stops: [
      [0, '#080b24', 0.55],
      [1, '#080b24', 0],
    ],
  });
  // the Earth, small, low on the left, lit from the upper right
  s += glow({ x: 220, y: 1650, rx: 380, ry: 380, color: '#3f8fe0', a: 0.35 });
  s += earth({ x: 220, y: 1650, r: 130, sun: [0.75, -0.6], seed: 71, clouds: 0.8 });
  s += vignette(0.3, C.shade, 0.5);
  return [svgLayer(s)];
};

const scenes = {
  'scene-pad': { paint: pad, seed: 301, post: { gamma: 0.86, bloom: 0.42 } },
  'scene-clouds': { paint: clouds, seed: 302, post: { gamma: 1.0, bloom: 0.4 } },
  'scene-orbit': { paint: orbit, seed: 303, post: { gamma: 0.85, bloom: 0.45 } },
  'scene-stars': { paint: deep, seed: 304, post: { gamma: 0.72, bloom: 0.45 } },
  'scene-moon': { paint: moon, seed: 305, post: { gamma: 0.7, bloom: 0.45 } },
};

await paintScenes({ id: 'moonshot', scenes, background: '#1c1f4a' });
