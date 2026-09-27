// The "forest-lights" design (a wedding: a path of lights through a forest): five pictures of one
// evening in a wood — the misty path at golden hour, the path at dusk lined with lanterns and candles in
// jars, the clearing with the chuppah, the long tables under string lights at blue hour, and the canopy of
// lights and stars at night. The eye stays at one height (the path's vanishing point at y 1060) so the
// cross-fades read as one film. Painted with the kit (scripts/scene-art/kit.mjs).
//
//   node scripts/scene-art/forest-lights.mjs [--draft <dir>] [scene …]
import {
  H,
  W,
  eucalyptus,
  foliage,
  lgrad,
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
  soft,
  svgLayer,
  tree,
  ugrad,
  vignette,
} from './kit.mjs';
import {
  barkFilter,
  blurred,
  bulbGrad,
  bulbs,
  eye,
  glints,
  jar,
  lantern,
  mottle,
  radial,
  sagPts,
  stars,
  trunk,
  unit,
  veil,
} from './nature-shared.mjs';

const HZ = 1060;
const cam = eye({ hz: HZ, h: 1.6, f: 1000 });

/** the path's middle wanders a little (metres across, at depth z) */
const pathX = (z) => 0.38 * Math.sin(z * 0.15 + 0.5) - 0.12;
const PATH_HALF = 0.62;

/** the light of each hour: the air, the light far down the path, trunks, ground, path, canopy */
const MOODS = {
  golden: {
    sky: [
      [0, '#2c3b2b'],
      [0.16, '#4d5a3b'],
      [0.32, '#98905e'],
      [0.46, '#dcc893'],
      [0.54, '#ecdaa8'],
      [0.6, '#d3c290'],
      [1, '#6e7a4e'],
    ],
    haze: '#e2cf9c',
    light: '#f3dca6',
    lightA: 0.62,
    trunkNear: { shade: '#18221c', body: '#28331f', lit: '#5d5a38', rim: '#e0bb72' },
    ground: [
      [0, '#d6c897'],
      [0.12, '#a9a371'],
      [0.35, '#6f7e4f'],
      [0.7, '#4a5c3c'],
      [1, '#34452f'],
    ],
    path: [
      [0, '#efdfb2'],
      [0.2, '#dcc690'],
      [0.55, '#b39868'],
      [1, '#7f6a4b'],
    ],
    canopy: { lit: '#b3a45c', mid: '#34482f', shade: '#18241b' },
    canopyFar: { lit: '#c9bb80', mid: '#6f7a52', shade: '#4a5840' },
    bush: { lit: '#a39c5c', front: '#8a9158', mid: '#4e603a', shade: '#27352a' },
  },
  dusk: {
    sky: [
      [0, '#22343a'],
      [0.2, '#35505a'],
      [0.38, '#587a7e'],
      [0.5, '#88a3a0'],
      [0.56, '#95ada6'],
      [0.62, '#7b958d'],
      [1, '#2e4038'],
    ],
    haze: '#7d9a98',
    light: '#b4c7bb',
    lightA: 0.42,
    trunkNear: { shade: '#15201d', body: '#1f2c28', lit: '#3a4d48', rim: '#9a8b62' },
    ground: [
      [0, '#8ea39c'],
      [0.12, '#627970'],
      [0.35, '#3f564b'],
      [0.7, '#2c3f35'],
      [1, '#1f2e27'],
    ],
    path: [
      [0, '#a9b5a6'],
      [0.25, '#8a8a74'],
      [0.6, '#6c6553'],
      [1, '#4d4638'],
    ],
    canopy: { lit: '#4f6a62', mid: '#26393a', shade: '#16232a' },
    canopyFar: { lit: '#7f9a92', mid: '#4c6664', shade: '#34494d' },
    bush: { lit: '#5d7a6d', front: '#56705f', mid: '#34493f', shade: '#1c2a27' },
  },
  blue: {
    sky: [
      [0, '#1f2b40'],
      [0.2, '#2e3d58'],
      [0.38, '#48607a'],
      [0.5, '#6f8796'],
      [0.56, '#7e939a'],
      [0.62, '#667c80'],
      [1, '#26332f'],
    ],
    haze: '#6b8290',
    light: '#a7b6bd',
    lightA: 0.36,
    trunkNear: { shade: '#131b20', body: '#1c2629', lit: '#35464a', rim: '#a38a5e' },
    ground: [
      [0, '#7a8d91'],
      [0.12, '#56696a'],
      [0.35, '#3a4d48'],
      [0.7, '#283a33'],
      [1, '#1d2b26'],
    ],
    path: [
      [0, '#98a3a3'],
      [0.25, '#7a7c70'],
      [0.6, '#5c5a4d'],
      [1, '#433f35'],
    ],
    canopy: { lit: '#435a63', mid: '#223240', shade: '#141f2b' },
    canopyFar: { lit: '#6d8290', mid: '#44576a', shade: '#2f3e52' },
    bush: { lit: '#4f6a68', front: '#4a625e', mid: '#2f433f', shade: '#1a2626' },
  },
};

/** the trunks of the wood: rows along both sides of the path, and a sparser row behind them */
const trunkList = (seed) => {
  const rnd = prng(seed);
  const list = [];
  for (const s of [-1, 1]) {
    let z = 2.4 + rnd() * 1.4 + (s > 0 ? 0.9 : 0);
    while (z < 80) {
      list.push({
        X: pathX(z) + s * (1.4 + rnd() ** 1.6 * 3.6),
        z,
        D: 0.26 + rnd() ** 1.5 * 0.7,
        rnd: rnd(),
      });
      z *= 1.24 + rnd() * 0.4;
    }
    z = 5 + rnd() * 4;
    while (z < 80) {
      list.push({ X: pathX(z) + s * (5.5 + rnd() * 7), z, D: 0.35 + rnd() * 0.55, rnd: rnd() });
      z *= 1.45 + rnd() * 0.5;
    }
  }
  return list.sort((a, b) => b.z - a.z);
};

const hazeAt = (z) => 1 - Math.exp(-z / 16);

/** the trunks between depths zMin and zMax, hazed by their distance, lit from the light down the path */
const trunks = (m, list, zMin, zMax, seed) => {
  const rnd = prng(seed);
  const bark = barkFilter(seed);
  let out = '';
  for (const t of list) {
    if (t.z < zMin || t.z >= zMax) continue;
    const [x, foot] = cam.at(t.X, 0, t.z);
    const w = cam.k(t.z) * t.D;
    if (x + w < -60 || x - w > W + 60) continue;
    const k = hazeAt(t.z) * 0.3;
    const pal = {
      shade: mix(m.trunkNear.shade, m.haze, k),
      body: mix(m.trunkNear.body, m.haze, k),
      lit: mix(m.trunkNear.lit, m.haze, k * 0.9),
      rim: mix(m.trunkNear.rim, m.light, k * 0.6),
    };
    out += trunk({
      x,
      top: -60,
      foot: foot + w * 0.08,
      w,
      taper: 0.78,
      flare: 0.42,
      lean: (t.rnd - 0.5) * 0.035,
      pal,
      side: x < W / 2 ? 1 : -1,
      rnd,
    });
  }
  return `${bark.defs}<g filter="url(#${bark.id})">${out}</g>`;
};

/** the forest floor and the path, in perspective, hazing into the light */
const floor = (m, seed) => {
  let s = `<defs>${ugrad('gnd', m.ground, [0, HZ, 0, H])}</defs><rect y="${HZ - 6}" width="${W}" height="${H - HZ + 6}" fill="url(#gnd)"/>`;
  s += mottle({
    clip: `M0 ${HZ + 10}H${W}V${H}H0Z`,
    freq: [0.012, 0.045],
    seed,
    dark: unit('#1c2a1f'),
    light: unit('#c9c08a'),
    a: 0.45,
    box: [0, HZ, W, H - HZ],
  });
  // the path
  const L = [];
  const R = [];
  const rnd = prng(seed + 3);
  for (let i = 0; i <= 60; i++) {
    const z = 1.6 * (90 / 1.6) ** (i / 60);
    const wob = (rnd() - 0.5) * 0.06;
    L.push(cam.at(pathX(z) - PATH_HALF + wob, 0, z));
    R.push(cam.at(pathX(z) + PATH_HALF + wob, 0, z));
  }
  const path = `${pts(L.concat(R.reverse()))}Z`;
  const pg = nid('pg');
  s += `<defs>${ugrad(pg, m.path, [0, HZ, 0, H])}</defs>`;
  s += soft(
    { box: [0, HZ - 20, W, H - HZ + 40], blur: 2.5, disp: 16, freq: 0.05, seed: seed + 1 },
    `<path d="${path}"/>`,
    `fill="url(#${pg})"`,
  );
  s += mottle({
    clip: path,
    freq: [0.014, 0.07],
    seed: seed + 5,
    dark: unit('#3d3326'),
    light: unit('#f4e6c0'),
    a: 0.22,
    box: [0, HZ, W, H - HZ],
  });
  return s;
};

/** low bushes and ferns between the trunks */
const undergrowth = (m, seed, zMin, zMax) => {
  const rnd = prng(seed);
  let out = '';
  const items = [];
  for (let i = 0; i < 26; i++) {
    const z = zMin * (zMax / zMin) ** rnd();
    const s = rnd() < 0.5 ? -1 : 1;
    items.push({ z, X: pathX(z) + s * (PATH_HALF + 0.35 + rnd() ** 1.4 * 5) });
  }
  items.sort((a, b) => b.z - a.z);
  items.forEach(({ z, X }, i) => {
    const [x, y] = cam.at(X, 0, z);
    const k = cam.k(z);
    const haze = hazeAt(z) * 0.9;
    const pal = {
      lit: mix(m.bush.lit, m.haze, haze),
      front: mix(m.bush.front, m.haze, haze),
      mid: mix(m.bush.mid, m.haze, haze),
      shade: mix(m.bush.shade, m.haze, haze),
    };
    out += tree({
      cx: x,
      cy: y - k * 0.28,
      w: k * (1.2 + rnd() * 1.2),
      h: k * (0.55 + rnd() * 0.4),
      n: 22,
      pal,
      seed: seed + i * 3,
      bands: 2,
      leaf: 0.06,
      clump: 1.4,
      dir: [x < W / 2 ? 0.8 : 0.2, 0, x < W / 2 ? 0.2 : 0.8, 1],
    });
  });
  return out;
};

/** the canopy over the path: clusters of leaves hanging from above, thicker at the sides, lit from below */
const canopy = (m, seed, { low = 330, gap = 150, pal = m.canopy, blur = 0, n = 13 } = {}) => {
  const rnd = prng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = -80 + t * (W + 160) + (rnd() - 0.5) * 60;
    const side = Math.abs(x - W / 2) / (W / 2);
    if (side < gap / W) continue;
    const cy = -60 + (low - 60) * Math.min(1, side) ** 1.2 * (0.7 + rnd() * 0.4);
    const w = 260 + rnd() * 200;
    out += tree({
      cx: x,
      cy,
      w,
      h: w * (0.7 + rnd() * 0.3),
      n: 46,
      pal: {
        lit: pal.lit,
        front: mix(pal.lit, pal.mid, 0.3),
        mid: pal.mid,
        midFront: pal.mid,
        shade: pal.shade,
      },
      seed: seed + i * 5,
      leaf: 0.045,
      bands: 3,
      dir: x < W / 2 ? [1, 1, 0, 0] : [0, 1, 1, 0],
    });
  }
  return blurred(blur, out);
};

/** out-of-focus ferns at our feet */
const nearFerns = (m, seed) => {
  const fg = `${tree({ cx: -40, cy: 1880, w: 420, h: 260, n: 40, pal: m.bush, seed, leaf: 0.05 })}${tree({ cx: 1120, cy: 1860, w: 400, h: 300, n: 40, pal: m.bush, seed: seed + 2, leaf: 0.05 })}`;
  return blurred(9, fg);
};

/** a veil of the air itself over what is behind it (its own colours at each height), gone below y1 */
const airVeil = (a, y0 = 1000, y1 = 1250) => {
  const id = nid('av');
  return `<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y1}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${id}g)"/></mask></defs><rect width="${W}" height="${H}" fill="url(#air)" opacity="${a}" mask="url(#${id})"/>`;
};

/** sun breaking through the leaves: small bright gaps in the canopy */
const leafGaps = (m, seed, n = 40, y1 = 420) => {
  const rnd = prng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = rnd() ** 1.3 * y1;
    const r = 3 + rnd() ** 2 * 12;
    out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" opacity="${r3(0.2 + rnd() * 0.4)}"/>`;
  }
  return blurred(3.5, out, `fill="${m.light}" style="mix-blend-mode:screen"`);
};

/** the wood along the path at an hour: air, far trunks, the light, mist, nearer trunks, canopy */
const wood = (
  m,
  { seed = 11, lightY = 1000, raysA = 0.3, mistA = 0.5, before = '', mid = '', after = '', gaps = 0 } = {},
) => {
  const list = trunkList(seed);
  let s = `<defs>${ugrad('air', m.sky, [0, 0, 0, H])}</defs><rect width="${W}" height="${H}" fill="url(#air)"/>`;
  s += glow({ x: W / 2, y: lightY, rx: 760, ry: 720, color: m.light, a: m.lightA * 0.6 });
  s += blurred(2.5, trunks(m, list, 26, 99, seed));
  s += airVeil(0.72, 1400, 1500);
  s += canopy(m, seed + 80, { low: 300, gap: 200, pal: m.canopyFar, blur: 4, n: 11 });
  s += airVeil(0.35, 1400, 1500);
  s += floor(m, seed + 20);
  s += glow({ x: W / 2 + 10, y: lightY + 40, rx: 420, ry: 330, color: m.light, a: m.lightA });
  s += mist({ y: HZ + 10, h: 70, color: m.haze, a: mistA, seed: seed + 31, n: 10 });
  s += before;
  s += blurred(1.6, undergrowth(m, seed + 40, 10, 40));
  s += blurred(1.6, trunks(m, list, 10, 26, seed + 1));
  s += airVeil(0.42, 1080, 1260);
  s += mist({ y: HZ + 60, h: 90, x0: -200, x1: 1280, color: m.haze, a: mistA * 0.55, seed: seed + 33, n: 8 });
  s += mid;
  s += blurred(1.2, undergrowth(m, seed + 50, 3.2, 10));
  s += blurred(2.2, trunks(m, list, 0, 10, seed + 2));
  if (raysA)
    s += rays({
      x: W / 2 + 20,
      y: lightY - 200,
      n: 24,
      len: 1500,
      a0: -172,
      a1: -8,
      w: [1.2, 4.5],
      color: m.light,
      a: raysA,
      seed: seed + 5,
      blur: 12,
    });
  s += canopy(m, seed + 60, { low: 420, gap: 150, blur: 1.4, n: 12 });
  if (gaps) s += leafGaps(m, seed + 90, gaps);
  if (raysA)
    s += rays({
      x: W / 2 + 20,
      y: lightY - 150,
      n: 20,
      len: 1400,
      a0: 22,
      a1: 158,
      w: [1, 4],
      color: m.light,
      a: raysA * 0.6,
      seed: seed + 6,
      blur: 12,
    });
  s += after;
  s += nearFerns(m, seed + 70);
  return s;
};

// ---------------------------------------------------------------------------------------------------
// the pictures

/** golden hour: the misty path, trunks on both sides, sun rays, the path into the soft light */
const path = () => {
  const m = MOODS.golden;
  let s = wood(m, { seed: 11, raysA: 0.42, mistA: 0.55, gaps: 30 });
  // dappled light on the path and the moss
  const rnd = prng(91);
  let spots = '';
  for (let i = 0; i < 16; i++) {
    const z = 2 + rnd() ** 1.3 * 20;
    const [x, y] = cam.at(pathX(z) + (rnd() - 0.5) * 3.2, 0, z);
    const k = cam.k(z);
    spots += glow({
      x,
      y,
      rx: k * (0.25 + rnd() * 0.4),
      ry: k * 0.06,
      color: '#f4dfa6',
      a: 0.35 + rnd() * 0.25,
      blend: 'screen',
    });
  }
  s += spots;
  s += veil(m.haze, [
    [0, 0.08],
    [700, 0.14],
    [1000, 0.2],
    [1300, 0.06],
    [1920, 0],
  ]);
  s += vignette(0.36, '#1a2a20');
  return [svgLayer(s)];
};

/** lanterns and jar candles along both edges of the path, at depth z */
const pathLights = (seed, { zs, jars = true, light = '#f2b765', glowA = 0.6 }) => {
  const rnd = prng(seed);
  const items = [];
  zs.forEach((z, i) => {
    const s = i % 2 ? 1 : -1;
    items.push({ kind: 'lantern', z, X: pathX(z) + s * (PATH_HALF + 0.12), hgt: 0.46 + rnd() * 0.12 });
    if (jars) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const zz = z * (1.04 + rnd() * 0.18);
        items.push({
          kind: 'jar',
          z: zz,
          X: pathX(zz) + s * (PATH_HALF + 0.05 + rnd() * 0.3),
          hgt: 0.12 + rnd() * 0.08,
        });
      }
      const zo = z * 1.12;
      items.push({
        kind: 'jar',
        z: zo,
        X: pathX(zo) - s * (PATH_HALF + 0.08 + rnd() * 0.2),
        hgt: 0.13 + rnd() * 0.07,
      });
    }
  });
  items.sort((a, b) => b.z - a.z);
  let out = '';
  for (const it of items) {
    const [x, y] = cam.at(it.X, 0, it.z);
    const h = cam.k(it.z) * it.hgt;
    if (x < -80 || x > W + 80) continue;
    const dim = Math.min(1, 0.45 + 6 / it.z);
    out +=
      it.kind === 'lantern'
        ? lantern({ x, y, h, light, glowA: glowA * dim, rnd })
        : jar({ x, y, h, light, glowA: glowA * dim * 0.9 });
  }
  return out;
};

/** dusk: the same path lined with lanterns and candles in jars, glowing warm in a blue-green haze */
const lanterns = () => {
  const m = MOODS.dusk;
  const zs = [2.35, 3.2, 4.4, 6.1, 8.4, 11.6, 16, 22, 30, 41];
  const far = pathLights(201, { zs: zs.filter((z) => z >= 9), glowA: 0.7 });
  const near = pathLights(203, { zs: zs.filter((z) => z < 9), glowA: 0.65 });
  let s = wood(m, {
    seed: 11,
    lightY: 1010,
    raysA: 0,
    mistA: 0.6,
    before: far,
    after: '',
  });
  s += veil(m.haze, [
    [0, 0.05],
    [800, 0.12],
    [1060, 0.2],
    [1400, 0.05],
    [1920, 0],
  ]);
  s += near;
  // the warm light gathers low along the path
  s += glow({ x: W / 2, y: 1150, rx: 520, ry: 170, color: '#e9b56c', a: 0.22, blend: 'screen' });
  s += vignette(0.34, '#13201c');
  return [svgLayer(s)];
};

/** the chuppah: four wooden posts, a white canopy seen a little from above, draped cloth, white flowers */
const chuppah = (rnd) => {
  const F = { l: 372, r: 708, top: 1336, foot: 1716 };
  const B = { l: 424, r: 656, top: 1262, foot: 1592 };
  const wood = nid('wd');
  const cloth = nid('ct');
  const drape = nid('dr');
  let s = `<defs>${lgrad(
    wood,
    [
      [0, '#6b5a45'],
      [0.35, '#a88f6c'],
      [0.7, '#d5c09a'],
      [1, '#8a7558'],
    ],
    [0, 0, 1, 0],
  )}${ugrad(
    cloth,
    [
      [0, '#e9e3d6'],
      [0.6, '#f4efe4'],
      [1, '#ded7c9'],
    ],
    [0, B.top, 0, F.top + 30],
  )}${ugrad(
    drape,
    [
      [0, '#f6f1e7', 0.75],
      [0.6, '#f1ebe0', 0.45],
      [1, '#ebe4d8', 0.08],
    ],
    [0, F.top, 0, F.foot],
  )}</defs>`;
  const post = (x, top, foot, w) =>
    `<rect x="${r1(x - w / 2)}" y="${r1(top)}" width="${r1(w)}" height="${r1(foot - top)}" fill="url(#${wood})"/>`;
  // back posts, a sheer back drape, front posts
  s += post(B.l, B.top, B.foot, 11) + post(B.r, B.top, B.foot, 11);
  s += `<path d="M${B.l} ${B.top + 8}C${B.l + 40} ${B.top + 60} ${B.r - 40} ${B.top + 60} ${B.r} ${B.top + 8}L${B.r} ${B.foot - 30}L${B.l} ${B.foot - 30}Z" fill="#f3eee4" opacity=".16"/>`;
  s += post(F.l, F.top, F.foot, 15) + post(F.r, F.top, F.foot, 15);
  // the canopy: the cloth over the frame, its front hem hanging in soft scallops
  s += `<path d="M${F.l - 12} ${F.top}L${B.l - 8} ${B.top - 4}L${B.r + 8} ${B.top - 4}L${F.r + 12} ${F.top}Z" fill="url(#${cloth})"/>`;
  let hem = `M${F.l - 14} ${F.top - 2}`;
  const nS = 4;
  for (let i = 0; i < nS; i++) {
    const x0 = F.l - 14 + ((F.r - F.l + 28) * i) / nS;
    const x1 = F.l - 14 + ((F.r - F.l + 28) * (i + 1)) / nS;
    hem += `Q${r1((x0 + x1) / 2)} ${F.top + 44} ${r1(x1)} ${F.top - 2}`;
  }
  s += `<path d="${hem}Z" fill="#f2ede3" opacity=".92"/>`;
  s += `<path d="${hem}" fill="none" stroke="#c9c0b0" stroke-width="2" opacity=".5"/>`;
  // long sheer drapes down the front posts, gathered and falling to the grass
  for (const [x, dir] of [
    [F.l, -1],
    [F.r, 1],
  ]) {
    for (let i = 0; i < 4; i++) {
      const w = 8 + i * 5;
      s += `<path d="M${x} ${F.top + 6}C${x + dir * (10 + i * 6)} ${F.top + 120} ${x - dir * (4 + i * 3)} ${F.top + 250} ${x + dir * (14 + i * 9)} ${F.foot + 6}" fill="none" stroke="url(#${drape})" stroke-width="${w}" opacity="${r3(0.35 + 0.1 * (i % 2))}"/>`;
    }
  }
  // flowers: white roses and greenery at the front corners, along the front, and at the feet
  const tones = [
    { base: '#ece6da', light: '#faf7f0', deep: '#c4baa9', heart: '#a29481' },
    { base: '#efe9df', light: '#fcfaf5', deep: '#c9c0b2', heart: '#a59886' },
    { base: '#e8dfcf', light: '#f7f2e8', deep: '#bdb09b', heart: '#9d8c76' },
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
  const blooms = [];
  const stems = [];
  const cluster = (cx, cy, sx, sy, n, [a, b], out) => {
    for (let i = 0; i < n; i++) {
      const r = a + rnd() * (b - a);
      blooms.push({
        x: cx + (rnd() - 0.5) * sx,
        y: cy + (rnd() - 0.5) * sy,
        r,
        t: Math.floor(rnd() * 3),
        rot: rnd() * 360,
        sq: 0.75 + rnd() * 0.2,
      });
    }
    for (let i = 0; i < n * 0.8; i++) {
      const ang = ((out[0] + rnd() * (out[1] - out[0])) * Math.PI) / 180;
      stems.push([
        cx + (rnd() - 0.5) * sx * 0.6,
        cy + (rnd() - 0.5) * sy * 0.5,
        ang,
        30 + rnd() * 40,
        (rnd() - 0.5) * 20,
      ]);
    }
  };
  cluster(F.l + 6, F.top + 10, 90, 50, 12, [7, 15], [100, 260]);
  cluster(F.r - 6, F.top + 10, 90, 50, 12, [7, 15], [-80, 80]);
  cluster((F.l + F.r) / 2, F.top + 6, 150, 20, 7, [5, 10], [60, 120]);
  cluster(F.l, F.foot - 6, 110, 36, 10, [7, 14], [180, 360]);
  cluster(F.r, F.foot - 6, 110, 36, 10, [7, 14], [180, 360]);
  const sage = ['#7f937f', '#71866f', '#8ea08b', '#667a66'];
  const green = stems.map(([x, y, a, len, bend]) => eucalyptus(rnd, x, y, a, len, bend, sage)).join('');
  const bloomSvg = blooms
    .sort((a, b) => a.r - b.r)
    .map((b) => rose(rnd, b.x, b.y, b.r, tones[b.t], b.rot, b.sq, tg[b.t].id))
    .join('');
  s += `<defs>${tg.map((g) => g.def).join('')}</defs>`;
  s += soft(
    { box: [200, 1200, 700, 600], blur: 3, disp: 14, freq: 0.06, seed: 5 },
    blooms.map((b) => `<circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r * 1.15)}"/>`).join(''),
    'fill="#4a5c4b"',
  );
  s += green + bloomSvg;
  return s;
};

/** the clearing under old trees, the chuppah low in it, the leaves above calm */
const clearing = () => {
  const rnd = prng(301);
  const hz = HZ;
  let s = `<defs>${ugrad(
    'air',
    [
      [0, '#2c4448'],
      [0.18, '#4b6a6a'],
      [0.34, '#8ea596'],
      [0.46, '#d7c9a0'],
      [0.52, '#e6d3a6'],
      [0.56, '#c9c49c'],
      [1, '#4e6446'],
    ],
    [0, 0, 0, H],
  )}</defs><rect width="${W}" height="${H}" fill="url(#air)"/>`;
  s += glow({ x: 600, y: 900, rx: 820, ry: 520, color: '#efd7a4', a: 0.5 });
  // the far edge of the clearing: a soft wall of trees against the glow
  const farPal = { lit: '#a9a46e', front: '#8f9767', mid: '#4b6452', shade: '#2d4543' };
  let far = '';
  for (let x = -60, i = 0; x < W + 80; x += 60 + rnd() * 50, i += 1)
    far += tree({
      cx: x,
      cy: hz - 90 - rnd() * 150,
      w: 200 + rnd() * 120,
      h: 300 + rnd() * 220,
      n: 36,
      pal: farPal,
      haze: 0.28,
      hazeColor: '#c9c6a4',
      seed: 320 + i,
      leaf: 0.05,
      bands: 3,
      dir: [0.5, 0, 0.5, 1],
    });
  s += blurred(1.4, far);
  s += veil('#dccfa3', [
    [600, 0],
    [950, 0.12],
    [1080, 0.4],
    [1180, 0],
  ]);
  // the meadow of the clearing, in the last warm light
  s += `<defs>${ugrad(
    'mdw',
    [
      [0, '#c9c28e'],
      [0.1, '#a3a672'],
      [0.35, '#768a57'],
      [0.75, '#52683f'],
      [1, '#3c4f33'],
    ],
    [0, hz, 0, H],
  )}</defs><rect y="${hz - 4}" width="${W}" height="${H - hz + 4}" fill="url(#mdw)"/>`;
  s += mottle({
    clip: `M0 ${hz}H${W}V${H}H0Z`,
    freq: [0.01, 0.04],
    seed: 7,
    dark: unit('#233222'),
    light: unit('#d8cf96'),
    a: 0.4,
    box: [0, hz, W, H - hz],
  });
  s += mist({ y: hz + 30, h: 60, color: '#dcd3ae', a: 0.6, seed: 331, n: 10 });
  // an aisle of petals towards the chuppah
  let petals = '';
  for (let i = 0; i < 140; i++) {
    const t = rnd();
    const y = 1640 + t * 300;
    const spread = 60 + t * 190;
    const r = 2 + t * 6;
    petals += `<ellipse cx="${r1(540 + (rnd() - 0.5) * spread * 2)}" cy="${r1(y)}" rx="${r1(r)}" ry="${r1(r * 0.55)}" fill="#efe8dc" opacity="${r3(0.5 + rnd() * 0.4)}"/>`;
  }
  s += blurred(1.4, petals);
  // shadows under the chuppah
  s += soft(
    { box: [200, 1500, 700, 300], blur: 14, disp: 18, freq: 0.03 },
    '<ellipse cx="560" cy="1690" rx="250" ry="40"/>',
    'fill="#2d3d2b" opacity=".35"',
  );
  // lanterns and jars round its feet
  let lights = '';
  const L = [
    [300, 1742, 64, 'l'],
    [792, 1748, 70, 'l'],
    [352, 1760, 26, 'j'],
    [735, 1770, 24, 'j'],
    [262, 1760, 22, 'j'],
    [470, 1612, 20, 'j'],
    [612, 1612, 18, 'j'],
    [838, 1768, 20, 'j'],
  ];
  for (const [x, y, h, k] of L)
    lights += k === 'l' ? lantern({ x, y, h, glowA: 0.55, rnd }) : jar({ x, y, h, glowA: 0.5 });
  s += blurred(0.9, chuppah(rnd));
  s += lights;
  // the old trees: great trunks at the sides and their branches overhead, calm and out of focus
  const bark = barkFilter(17);
  const tp = { shade: '#1b2621', body: '#2c3a30', lit: '#56604a', rim: '#b9a371' };
  const limb = (x0, y0, x1, y1, w) => {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI - 90;
    return `<g transform="translate(${r1(x0)} ${r1(y0)}) rotate(${r1(ang)})">${trunk({ x: 0, top: d, foot: 0, w, taper: 0.35, flare: 0, pal: tp, side: 1, rnd })}</g>`;
  };
  const big =
    trunk({
      x: 40,
      top: -80,
      foot: 1790,
      w: 170,
      taper: 0.62,
      flare: 0.55,
      lean: 0.05,
      pal: tp,
      side: 1,
      rnd,
    }) +
    trunk({
      x: 1040,
      top: -80,
      foot: 1760,
      w: 185,
      taper: 0.62,
      flare: 0.55,
      lean: -0.05,
      pal: tp,
      side: -1,
      rnd,
    }) +
    limb(80, 420, 330, 90, 56) +
    limb(1000, 470, 760, 110, 52) +
    trunk({
      x: 205,
      top: -80,
      foot: 1330,
      w: 80,
      taper: 0.8,
      flare: 0.4,
      pal: { ...tp, shade: '#34463c', body: '#4a5a49' },
      side: 1,
      rnd,
    }) +
    trunk({
      x: 880,
      top: -80,
      foot: 1300,
      w: 70,
      taper: 0.8,
      flare: 0.4,
      pal: { ...tp, shade: '#34463c', body: '#4a5a49' },
      side: -1,
      rnd,
    });
  s += blurred(2.6, `${bark.defs}<g filter="url(#${bark.id})">${big}</g>`);
  const leaves = { lit: '#9aa36c', mid: '#3c5040', shade: '#1e2b25' };
  const lobes = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const edge = Math.abs(t - 0.5) * 2;
    lobes.push([
      -100 + t * 1280,
      -60 + 90 + edge ** 1.5 * 260 + rnd() * 60,
      110 + rnd() * 80,
      80 + rnd() * 50,
    ]);
    lobes.push([-100 + t * 1280 + 40, -60 + rnd() * 50, 130, 90]);
  }
  s += blurred(
    5,
    foliage({
      lobes,
      pal: leaves,
      seed: 341,
      grain: 0.03,
      edge: 20,
      clump: 40,
      tex: 0.3,
      relief: 4,
      soften: 2,
      light: [0.5, 1, 0.5, 0],
      box: [-300, -300, W + 600, 700],
    }),
  );
  s += rays({
    x: 620,
    y: 860,
    n: 16,
    len: 1100,
    a0: -170,
    a1: -10,
    w: [1.2, 3.5],
    color: '#f1dcaa',
    a: 0.18,
    seed: 9,
    blur: 16,
  });
  s += veil('#e3d4a8', [
    [0, 0.05],
    [800, 0.12],
    [1100, 0.1],
    [1500, 0],
  ]);
  s += blurred(
    10,
    `${tree({ cx: -30, cy: 1900, w: 380, h: 240, n: 36, pal: MOODS.golden.bush, seed: 351, leaf: 0.05 })}${tree({ cx: 1110, cy: 1890, w: 360, h: 260, n: 36, pal: MOODS.golden.bush, seed: 353, leaf: 0.05 })}`,
  );
  s += vignette(0.34, '#172620');
  return [svgLayer(s)];
};

/** the long table down the middle of the path: planks, a runner of greenery, candles; z from z0 to z1 */
const longTable = (rnd, { z0 = 2.3, z1 = 26, xc = 0, half = 0.45 } = {}) => {
  const Y = 0.76;
  const at = (x, y, z) => cam.at(pathX(z) * 0.4 + xc + x, y, z);
  const top = (z) => [at(-half, Y, z), at(half, Y, z)];
  const zs = Array.from({ length: 40 }, (_, i) => z0 * (z1 / z0) ** (i / 39));
  const Lp = zs.map((z) => top(z)[0]);
  const Rp = zs.map((z) => top(z)[1]);
  const wd = nid('tw');
  let s = `<defs>${ugrad(
    wd,
    [
      [0, '#7f7a70'],
      [0.2, '#6f6254'],
      [0.5, '#5e4c3c'],
      [1, '#4a3a2d'],
    ],
    [0, HZ, 0, H],
  )}</defs>`;
  // benches and legs in the shadow under the table, then the table's side and top
  const _bench = (s0) => {
    const L2 = zs.map((z) => at(s0 * (half + 0.18), 0.46, z));
    const R2 = zs.map((z) => at(s0 * (half + 0.48), 0.46, z));
    return `<path d="${pts(L2.concat(R2.reverse()))}Z" fill="#3c2e24" opacity=".85"/>`;
  };
  s = s.replace(
    '</defs>',
    '</defs>' +
      soft(
        { box: [-200, HZ, W + 400, H - HZ], blur: 10, disp: 12, freq: 0.03 },
        `<path d="${pts(zs.map((z) => at(-half - 0.3, 0, z)).concat(zs.map((z) => at(half + 0.3, 0, z)).reverse()))}Z"/>`,
        'fill="#0e1714" opacity=".6"',
      ),
  );
  let legs = '';
  for (let z = z0 + 0.15; z < z1; z *= 1.9) {
    for (const sx of [-1, 1]) {
      const [x, y] = at(sx * (half - 0.06), Y, z);
      const [, yb] = at(sx * (half - 0.06), 0, z);
      legs += `<rect x="${r1(x - cam.k(z) * 0.025)}" y="${r1(y)}" width="${r1(cam.k(z) * 0.05)}" height="${r1(yb - y)}" fill="#261d17"/>`;
    }
  }
  s += legs;
  const side = (sx) => {
    const a = zs.map((z) => at(sx * half, Y, z));
    const b = zs.map((z) => at(sx * half, Y - 0.07, z));
    return `<path d="${pts(a.concat(b.reverse()))}Z" fill="#3a2b20"/>`;
  };
  s += side(-1) + side(1);
  const topPath = `${pts(Lp.concat(Rp.slice().reverse()))}Z`;
  s += `<path d="${topPath}" fill="url(#${wd})"/>`;
  // planks: seams converging on the far end, and grain
  let seams = '';
  for (let i = 1; i < 4; i++) {
    const x = -half + (2 * half * i) / 4;
    seams += pts(zs.map((z) => at(x, Y, z)));
  }
  s += `<path d="${seams}" fill="none" stroke="#2c2018" stroke-width="1.6" opacity=".4"/>`;
  s += mottle({
    clip: topPath,
    freq: [0.08, 0.008],
    seed: 21,
    dark: unit('#2b1e15'),
    light: unit('#c2a27a'),
    a: 0.35,
    box: [0, HZ, W, H - HZ],
  });
  // the runner of greenery and white blossom down the middle
  let runner = '';
  const sage = ['#6f8570', '#7e937c', '#5f7462', '#8b9d88'];
  for (let i = 0; i < 70; i++) {
    const z = z0 * 1.1 * (z1 / (z0 * 1.1)) ** rnd();
    const [x, y] = at((rnd() - 0.5) * 0.24, Y + 0.02, z);
    const k = cam.k(z);
    runner += eucalyptus(
      rnd,
      x,
      y,
      rnd() * Math.PI * 2,
      k * (0.18 + rnd() * 0.12),
      (rnd() - 0.5) * k * 0.06,
      sage,
    ).replace(/stroke-width="2"/, `stroke-width="${r1(Math.max(0.6, k * 0.004))}"`);
  }
  let blossom = '';
  for (let i = 0; i < 50; i++) {
    const z = z0 * 1.1 * (z1 / (z0 * 1.1)) ** rnd();
    const [x, y] = at((rnd() - 0.5) * 0.18, Y + 0.04, z);
    blossom += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(cam.k(z) * (0.02 + rnd() * 0.025))}" fill="#eee8dc" opacity=".85"/>`;
  }
  s += blurred(0.8, runner + blossom);
  // candles: tapers in pairs down the table, and small jars between
  let candles = '';
  for (let z = z0 + 0.3; z < z1; z *= 1.3) {
    for (const sx of [-1, 1]) {
      const X = sx * (0.17 + rnd() * 0.04);
      const zz = z * (1 + (sx > 0 ? 0.06 : 0));
      const [x, y] = at(X, Y, zz);
      const k = cam.k(zz);
      const hh = k * (0.2 + rnd() * 0.1);
      const w = Math.max(1.4, k * 0.024);
      candles += `<rect x="${r1(x - w / 2)}" y="${r1(y - hh)}" width="${r1(w)}" height="${r1(hh)}" fill="#efe5d0"/>`;
      candles += `<rect x="${r1(x - w * 1.4)}" y="${r1(y - k * 0.025)}" width="${r1(w * 2.8)}" height="${r1(k * 0.025)}" fill="#a58d5e"/>`;
      candles += `<g>${glowFlame(x, y - hh, Math.max(1, k * 0.012))}</g>`;
    }
    const [jx, jy] = at((rnd() - 0.5) * 0.3, Y, z * 1.13);
    candles += jar({ x: jx, y: jy, h: cam.k(z * 1.13) * 0.09, glowA: 0.45 });
  }
  s += candles;
  return s;
};

const glowFlame = (x, y, s) => {
  const id = nid('gf');
  return `<defs>${radial(id, [
    [0, '#fffbe8', 1],
    [0.35, '#ffe2a0', 0.9],
    [1, '#f0a850', 0],
  ])}</defs>${glow({ x, y: y - s, rx: s * 9, color: '#f0b060', a: 0.5, blend: 'screen' })}<ellipse cx="${r1(x)}" cy="${r1(y - s * 1.1)}" rx="${r1(s * 0.75)}" ry="${r1(s * 1.7)}" fill="url(#${id})"/>`;
};

/** string lights zigzagging between the trees along the path, `Y` metres up; far ones fade */
const zigzag = (rnd, { Y = 4.4, zs, X = [-3.1, 3.3], sag = 0.7, gap = 0.36, r = 0.11, g }) => {
  let wires = '';
  const list = [];
  for (let i = 1; i < zs.length; i++) {
    const [za, zb] = [zs[i - 1], zs[i]];
    const [xa, xb] = i % 2 ? [X[0], X[1]] : [X[1], X[0]];
    const n = 50;
    const P = Array.from({ length: n + 1 }, (_, j) => {
      const t = j / n;
      // along the wire in the world, sagging
      const z = za + (zb - za) * t;
      const x = pathX(z) * 0.5 + xa + (xb - xa) * t;
      const y = Y - 4 * sag * t * (1 - t);
      return { p: cam.at(x, y, z), z, x, y };
    });
    wires += pts(P.map((q) => q.p));
    const len = Math.hypot(xb - xa, zb - za);
    const nb = Math.round(len / gap);
    for (let j = 0; j < nb; j++) {
      const q = P[Math.round(((j + rnd() * 0.4) / nb) * n)];
      const k = cam.k(q.z);
      const fade = Math.min(1, 9 / q.z);
      list.push({
        x: q.p[0],
        y: q.p[1] + k * 0.03,
        r: Math.max(2.5, k * r * (0.85 + rnd() * 0.3)),
        a: (0.55 + rnd() * 0.45) * (0.35 + 0.65 * fade),
      });
    }
  }
  return {
    svg: `<path d="${wires}" fill="none" stroke="#141c1c" stroke-width="1.6" opacity=".6"/>${bulbs(list, g)}`,
    list,
  };
};

/** blue hour: long wooden tables with candles, string lights zigzagging between the trees overhead */
const tables = () => {
  const m = MOODS.blue;
  const rnd = prng(401);
  const g = bulbGrad('#f1b965', '#fff4d8');
  const zig = zigzag(rnd, { zs: [2.3, 3.4, 5, 7.3, 10.6, 15.4, 22, 31, 44], g });
  let s = wood(m, { seed: 13, lightY: 1010, raysA: 0, mistA: 0.5 });
  s += veil(m.haze, [
    [0, 0.04],
    [800, 0.1],
    [1060, 0.18],
    [1400, 0.04],
    [1920, 0],
  ]);
  // the trees catch the candlelight low down
  s += glow({ x: W / 2, y: 1350, rx: 700, ry: 420, color: '#d99a58', a: 0.2, blend: 'screen' });
  s += longTable(rnd, { xc: -1.02 }) + longTable(rnd, { xc: 1.02 });
  s += glow({ x: W / 2, y: 1330, rx: 620, ry: 300, color: '#e9ab62', a: 0.18, blend: 'screen' });
  s += zig.svg;
  s += glints(
    zig.list.filter((b) => b.r > 9 && rnd() < 0.18).map((b) => ({ x: b.x, y: b.y, r: b.r * 2, a: 0.4 })),
    '#ffe9c0',
  );
  s += glow({ x: W / 2, y: 520, rx: 700, ry: 420, color: '#e7b36e', a: 0.1, blend: 'screen' });
  s += vignette(0.32, '#121c22');
  return [svgLayer(s)];
};

/** night: looking up through the leaves at a canopy of string lights and the stars */
const canopyNight = () => {
  const rnd = prng(501);
  let s = `<defs>${radial(
    'nsky',
    [
      [0, '#3f6d6e'],
      [0.35, '#2f5559'],
      [0.7, '#213d45'],
      [1, '#172c35'],
    ],
    'cx="0.5" cy="0.47" r="0.62" gradientTransform="translate(0.5 0.47) scale(1.6 1) translate(-0.5 -0.47)"',
  )}</defs><rect width="${W}" height="${H}" fill="url(#nsky)"/>`;
  s += stars({
    seed: 5,
    n: 260,
    y0: 60,
    y1: 1860,
    pow: 1,
    r: [0.6, 1.7],
    a: [0.2, 0.75],
    bright: 16,
    fade: (x, y) => Math.min(1, Math.hypot((x - 540) / 520, (y - 940) / 820) < 1 ? 1 : 0.35),
  });
  // the trunks rising round us, converging on the sky overhead; their crowns ring the opening
  const bark = barkFilter(23, [0.05, 0.012]);
  const tp = { shade: '#0e1a1c', body: '#1b2c2d', lit: '#34463f', rim: '#a8844f' };
  const Z = [540, 930];
  const ends = [];
  const col = ([x0, y0], w0, frac) => {
    const d = Math.hypot(Z[0] - x0, Z[1] - y0);
    const ang = (Math.atan2(Z[1] - y0, Z[0] - x0) * 180) / Math.PI - 90;
    ends.push([x0 + (Z[0] - x0) * frac, y0 + (Z[1] - y0) * frac, w0]);
    return `<g transform="translate(${r1(x0)} ${r1(y0)}) rotate(${r1(ang)})">${trunk({ x: 0, top: d * frac, foot: -40, w: w0, taper: 0.28, flare: 0, pal: tp, side: 1, rnd })}</g>`;
  };
  let cols = '';
  cols += col([-80, 1990], 260, 0.55);
  cols += col([1160, 2000], 240, 0.52);
  cols += col([-90, 360], 170, 0.5);
  cols += col([1170, 480], 180, 0.48);
  cols += col([1170, 1420], 150, 0.44);
  cols += col([-90, 1260], 140, 0.42);
  cols += col([330, -90], 150, 0.5);
  cols += col([820, -100], 140, 0.46);
  s += blurred(1, `${bark.defs}<g filter="url(#${bark.id})">${cols}</g>`);
  // crowns: dark leaves round each trunk's end and all round the edge, warm where the lights touch them
  const leafPal = { lit: '#3b4a37', front: '#2c3d33', mid: '#15262a', midFront: '#172a2c', shade: '#0b171b' };
  let crowns = '';
  ends.forEach(([x, y, w], i) => {
    const d = Math.hypot(x - 540, y - 930) || 1;
    const [ox, oy] = [((x - 540) / d) * w * 0.9, ((y - 930) / d) * w * 0.9];
    crowns += tree({
      cx: x + ox,
      cy: y + oy,
      w: w * 3.2,
      h: w * 2.6,
      n: 60,
      pal: leafPal,
      seed: 540 + i * 7,
      leaf: 0.05,
      bands: 3,
      dir: [0.5, 0.5, 0, 0],
    });
  });
  const edge = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    edge.push([
      540 + Math.cos(a) * (660 + rnd() * 90),
      930 + Math.sin(a) * (1080 + rnd() * 100),
      150 + rnd() * 80,
      130 + rnd() * 70,
    ]);
  }
  s += foliage({
    lobes: edge,
    pal: { lit: '#233530', mid: '#12212a', shade: '#0a151a' },
    seed: 511,
    grain: 0.035,
    edge: 22,
    clump: 60,
    tex: 0.4,
    relief: 5,
    soften: 1.3,
    light: [0.5, 0.5, 0, 0],
    box: [-300, -300, W + 600, H + 600],
  });
  s += blurred(0.8, crowns);
  // strands of lights across the opening, most of them above and below the middle
  const g = bulbGrad('#f0b35e', '#fff3d6');
  const strands = [
    [[-40, 170], [1120, 300], 120, 30, 13],
    [[-40, 420], [1120, 250], 150, 34, 14],
    [[-40, 560], [1120, 600], 170, 42, 11],
    [[-40, 1380], [1120, 1300], 150, 40, 12],
    [[-40, 1560], [1120, 1650], 170, 34, 14],
    [[-40, 1790], [1120, 1720], 120, 30, 15],
  ];
  let lights = '';
  const all = [];
  for (const [p0, p1, sag, gap, r] of strands) {
    const line = sagPts(p0, p1, sag, 40);
    const pos = [];
    let acc = rnd() * gap;
    for (let i = 1; i < line.length; i++) {
      const d = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      acc += d;
      while (acc >= gap) {
        acc -= gap;
        const t = 1 - acc / d;
        pos.push({
          x: line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
          y: line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t + 4,
          r: r * (0.8 + rnd() * 0.5),
          a: 0.65 + rnd() * 0.35,
        });
      }
    }
    lights += `<path d="${pts(line)}" fill="none" stroke="#0e1718" stroke-width="1.6" opacity=".55"/>`;
    all.push(...pos);
  }
  s += lights + bulbs(all, g);
  s += glints(
    all.filter(() => rnd() < 0.3).map((b) => ({ x: b.x, y: b.y, r: b.r * 2.4, a: 0.5 })),
    '#ffe8bd',
  );
  s += glow({ x: 540, y: 380, rx: 760, ry: 360, color: '#e9a95c', a: 0.16, blend: 'screen' });
  s += glow({ x: 540, y: 1560, rx: 760, ry: 380, color: '#e9a95c', a: 0.16, blend: 'screen' });
  s += vignette(0.3, '#0f1b1c');
  return [svgLayer(s)];
};

const scenes = {
  'scene-path': { paint: path, seed: 21, post: { gamma: 1.05, bloom: 0.42 } },
  'scene-lanterns': { paint: lanterns, seed: 22, post: { gamma: 0.86, bloom: 0.5 } },
  'scene-clearing': { paint: clearing, seed: 23, post: { gamma: 1, bloom: 0.42 } },
  'scene-tables': { paint: tables, seed: 24, post: { gamma: 0.8, bloom: 0.5 } },
  'scene-canopy': { paint: canopyNight, seed: 25, post: { gamma: 0.9, bloom: 0.5 } },
};

await paintScenes({ id: 'forest-lights', scenes, background: '#3d5a45' });
