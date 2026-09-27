// The "enchanted-garden" design (a bat mitzvah in an enchanted garden): five pictures of one garden from
// golden hour to night — the white gate in the hedge under climbing roses, the path between lavender,
// peonies and roses, the flower-wrapped swing at a lilac dusk, the white gazebo with lanterns at
// twilight, and the garden at night under a big pale moon. The garden's horizon stays near y 1150.
// Painted with the kit (scripts/scene-art/kit.mjs).
//
//   node scripts/scene-art/enchanted-garden.mjs [--draft <dir>] [scene …]
import {
  H,
  W,
  eucalyptus,
  foliage,
  glow,
  mist,
  nid,
  paintScenes,
  prng,
  pts,
  r1,
  rays,
  rose,
  skyFill,
  soft,
  svgLayer,
  tree,
  ugrad,
  vignette,
  wisps,
} from './kit.mjs';
import {
  along,
  barkFilter,
  blurred,
  bokeh,
  bulbGrad,
  bulbs,
  glints,
  lantern,
  mottle,
  radial,
  sagPts,
  stars,
  trunk,
  unit,
  veil,
} from './nature-shared.mjs';

const HZ = 1150;

const PINK = [
  { base: '#eab3bd', light: '#f8dce1', deep: '#bf7d8b', heart: '#94566a' },
  { base: '#f0c6cc', light: '#fbe6e8', deep: '#c9929c', heart: '#9d6674' },
  { base: '#e5a2b0', light: '#f5d0d7', deep: '#b36c7e', heart: '#8a4c60' },
  { base: '#f4e0de', light: '#fdf3f2', deep: '#d1aaae', heart: '#a87d86' },
];
const PEONY = [
  { base: '#f2c3cb', light: '#fde6ea', deep: '#d18e9c', heart: '#b86f80' },
  { base: '#f6d6da', light: '#fff0f2', deep: '#dba4ae', heart: '#c07f8e' },
  { base: '#eeb0bd', light: '#fbd9e0', deep: '#c97a8d', heart: '#a45a6e' },
];

/** a group of roses (or peonies): their gradients, a bed of dark leaves under them, the blooms */
const blooms = (rnd, list, tones, { leaves = '#4d6450', leafA = 1, shadow = true } = {}) => {
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
  let s = `<defs>${tg.map((g) => g.def).join('')}</defs>`;
  if (leaves) {
    let lv = '';
    for (const b of list)
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2;
        const [x, y] = [b.x + Math.cos(a) * b.r * 1.05, b.y + Math.sin(a) * b.r * 0.9];
        lv += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(b.r * 0.62)}" ry="${r1(b.r * 0.3)}" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(x)} ${r1(y)})"/>`;
      }
    s += `<g fill="${leaves}" opacity="${leafA}">${lv}</g>`;
  }
  if (shadow)
    s += `<g fill="#3a2f45" opacity=".22">${list.map((b) => `<circle cx="${r1(b.x + b.r * 0.15)}" cy="${r1(b.y + b.r * 0.2)}" r="${r1(b.r)}"/>`).join('')}</g>`;
  s += list
    .slice()
    .sort((a, b) => a.r - b.r)
    .map((b) =>
      rose(
        rnd,
        b.x,
        b.y,
        b.r,
        tones[b.t % tones.length],
        b.rot ?? rnd() * 360,
        b.sq ?? 0.8 + rnd() * 0.15,
        tg[b.t % tones.length].id,
      ),
    )
    .join('');
  return s;
};

/** scatter n blooms over an area, not overlapping much */
const scatter = (rnd, n, [x0, y0, x1, y1], [rMin, rMax], tones = 4, test = () => true) => {
  const out = [];
  let tries = 0;
  while (out.length < n && tries < n * 40) {
    tries += 1;
    const r = rMin + rnd() * (rMax - rMin);
    const [x, y] = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (!test(x, y)) continue;
    if (out.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.72)) continue;
    out.push({ x, y, r, t: Math.floor(rnd() * tones) });
  }
  return out;
};

/** lavender: clumps of grey-green stems with purple spikes, `list` = [{x, y, s}] (s = scale) */
const lavender = (rnd, list) => {
  let stems = '';
  let spikes = '';
  const purples = ['#8e78b6', '#9d87c4', '#7d68a6', '#ad9ad0', '#8a74b0'];
  for (const { x, y, s } of list) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 0.9 + (rnd() - 0.5) * 0.2 - Math.PI / 2;
      const len = s * (60 + rnd() * 30);
      const [tx, ty] = [x + Math.cos(a) * len, y + Math.sin(a) * len];
      stems += `M${r1(x)} ${r1(y)}L${r1(tx)} ${r1(ty)}`;
      const sl = len * 0.38;
      const [bx, by] = [x + Math.cos(a) * (len - sl), y + Math.sin(a) * (len - sl)];
      spikes += `<path d="M${r1(bx)} ${r1(by)}L${r1(tx)} ${r1(ty)}" stroke="${purples[Math.floor(rnd() * purples.length)]}" stroke-width="${r1(Math.max(1.4, s * 7))}" stroke-linecap="round" stroke-dasharray="${r1(Math.max(1, s * 4))} ${r1(Math.max(0.6, s * 1.6))}"/>`;
    }
  }
  return `<path d="${stems}" stroke="#7d8f7c" stroke-width="1.4" fill="none" opacity=".85"/><g fill="none">${spikes}</g>`;
};

/** fairy lights draped between points: [{p0, p1, sag}] */
const fairy = (rnd, strands, { gap = 22, r = 7, color = '#f4c77c', wire = '#3b3140', wireA = 0.4 } = {}) => {
  const g = bulbGrad(color, '#fff6e0');
  let wires = '';
  const list = [];
  for (const { p0, p1, sag, k = 1 } of strands) {
    const line = sagPts(p0, p1, sag, 36);
    wires += pts(line);
    for (const [x, y] of along(line, gap * k, rnd() * gap * k))
      list.push({ x, y: y + 2, r: r * k * (0.75 + rnd() * 0.5), a: 0.6 + rnd() * 0.4 });
  }
  return {
    svg: `<path d="${wires}" fill="none" stroke="${wire}" stroke-width="1.1" opacity="${wireA}"/>${bulbs(list, g)}`,
    list,
  };
};

/** a lawn from the horizon down, sage in the light of the hour */
const lawn = (top, stops, seed, a = 0.35) =>
  `<defs>${ugrad(`lw${seed}`, stops, [0, top, 0, H])}</defs><rect y="${top - 4}" width="${W}" height="${H - top + 4}" fill="url(#lw${seed})"/>` +
  mottle({
    clip: `M0 ${top}H${W}V${H}H0Z`,
    freq: [0.012, 0.05],
    seed,
    dark: unit('#2f3d33'),
    light: unit('#e4e0bf'),
    a,
    box: [0, top, W, H - top],
  });

/** a far line of soft trees and hedges along the horizon */
const farGarden = (rnd, { y, pal, haze, hazeColor, seed, n = 16, h = [180, 320] }) => {
  let s = '';
  for (let i = 0, x = -60; x < W + 80; i += 1, x += W / n + (rnd() - 0.5) * 40)
    s += tree({
      cx: x,
      cy: y - h[0] * 0.4 - rnd() * (h[1] - h[0]) * 0.4,
      w: 150 + rnd() * 130,
      h: h[0] + rnd() * (h[1] - h[0]),
      n: 28,
      pal,
      haze,
      hazeColor,
      seed: seed + i,
      leaf: 0.055,
      bands: 2,
      dir: [0.5, 0, 0.5, 1],
    });
  return s;
};

// ---------------------------------------------------------------------------------------------------

/** golden hour: a white gate in a tall hedge, an arbor of climbing pink roses, dreamy bokeh */
const gate = () => {
  const rnd = prng(101);
  const A = { cx: 540, top: 740, r: 205, foot: 1500 };
  const cy = A.top + A.r;
  const opening = `M${A.cx - A.r} ${A.foot}V${cy}A${A.r} ${A.r} 0 0 1 ${A.cx + A.r} ${cy}V${A.foot}Z`;
  // the garden beyond, seen through the arch: golden haze, soft trees, a path
  let s = skyFill([
    [0, '#9d8fb8'],
    [0.14, '#b7a2c2'],
    [0.28, '#dcbcbe'],
    [0.4, '#efd2b0'],
    [0.5, '#f2dcb2'],
    [0.6, '#e5d4ac'],
    [1, '#a3ae8c'],
  ]);
  s += glow({ x: 700, y: 760, rx: 700, ry: 560, color: '#f6ddaa', a: 0.55 });
  s += blurred(
    5,
    farGarden(rnd, {
      y: 1150,
      pal: { lit: '#d8d0a0', mid: '#a4ae8c', shade: '#8a8f86' },
      haze: 0.35,
      hazeColor: '#e6d6b4',
      seed: 120,
      n: 9,
      h: [260, 420],
    }),
  );
  s += lawn(
    1140,
    [
      [0, '#d9d2a8'],
      [0.3, '#b5b98f'],
      [1, '#8d9a78'],
    ],
    5,
    0.2,
  );
  s += `<path d="M${A.cx - 40} 1150L${A.cx + 40} 1150L${A.cx + 170} 1500L${A.cx - 170} 1500Z" fill="#eadfc4" opacity=".75"/>`;
  s += glow({ x: 560, y: 1080, rx: 300, ry: 260, color: '#fbe7bd', a: 0.6 });
  // the hedge, with the arch cut through it
  const mask = nid('hm');
  s += `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${opening}" fill="#000"/></mask></defs>`;
  const lobes = [];
  for (let i = 0; i <= 24; i++) {
    const x = -80 + (i / 24) * (W + 160);
    lobes.push([x, 600 + Math.sin(i * 1.7) * 30 + rnd() * 40, 90 + rnd() * 40, 80 + rnd() * 30]);
  }
  for (let y = 700; y < 1560; y += 120)
    for (let x = -60; x < W + 100; x += 150) lobes.push([x + rnd() * 40, y + rnd() * 40, 110, 90]);
  s += `<g mask="url(#${mask})">${foliage({ lobes, pal: { lit: '#c2bf86', mid: '#6f8766', shade: '#3e5245' }, seed: 131, grain: 0.05, edge: 12, clump: 34, tex: 0.75, relief: 8, soften: 1.1, light: [0.8, 0.05, 0.3, 0.75] })}</g>`;
  s += veil('#33453a', [
    [900, 0],
    [1500, 0.35],
    [1560, 0],
  ]);
  // the hedge's shadowed reveal round the opening
  s += `<path d="${opening}" fill="none" stroke="#3e5044" stroke-width="30" opacity=".35" mask="url(#${mask})"/>`;
  s += veil('#f1d9ae', [
    [500, 0.18],
    [800, 0.1],
    [1200, 0],
  ]);
  // the white arbor inside the arch: two posts of lattice and an arched top
  const white = nid('wh');
  s += `<defs>${ugrad(
    white,
    [
      [0, '#d9d2d0'],
      [0.5, '#f4efe9'],
      [1, '#e2d8d2'],
    ],
    [A.cx - A.r, 0, A.cx + A.r, 0],
  )}</defs>`;
  const ar = A.r - 22;
  let arbor = `<path d="M${A.cx - ar} ${A.foot}V${cy}A${ar} ${ar} 0 0 1 ${A.cx + ar} ${cy}V${A.foot}" fill="none" stroke="url(#${white})" stroke-width="22"/>`;
  arbor += `<path d="M${A.cx - ar + 30} ${A.foot}V${cy}A${ar - 30} ${ar - 30} 0 0 1 ${A.cx + ar - 30} ${cy}V${A.foot}" fill="none" stroke="#efe8e0" stroke-width="7" opacity=".9"/>`;
  let lat = '';
  for (let y = cy; y < A.foot; y += 34)
    lat += `M${A.cx - ar} ${y}L${A.cx - ar + 30} ${y + 34}M${A.cx + ar} ${y}L${A.cx + ar - 30} ${y + 34}`;
  arbor += `<path d="${lat}" stroke="#ece5dc" stroke-width="3" opacity=".8"/>`;
  // the gate: two leaves of white pickets under a dipping rail
  const g0 = A.cx - ar + 34;
  const g1 = A.cx + ar - 34;
  const gTop = 1210;
  let gate = '';
  for (let x = g0 + 8; x < g1; x += 24) {
    const t = (x - A.cx) / (g1 - g0);
    const top = gTop + 70 * (1 - (2 * t) ** 2) * 0 + Math.abs(t) * -60 + 40;
    gate += `<path d="M${r1(x - 6)} 1478V${r1(top + 10)}L${r1(x)} ${r1(top)}L${r1(x + 6)} ${r1(top + 10)}V1478Z"/>`;
  }
  gate += `<rect x="${g0}" y="1290" width="${g1 - g0}" height="12"/><rect x="${g0}" y="1420" width="${g1 - g0}" height="12"/><rect x="${A.cx - 3}" y="1250" width="6" height="228"/>`;
  arbor += `<g fill="url(#${white})">${gate}</g><path d="M${g0} 1296L${A.cx} 1426M${g1} 1296L${A.cx} 1426" stroke="#e9e2d9" stroke-width="8"/>`;
  s += soft(
    { box: [0, 1400, W, 200], blur: 10, disp: 14, freq: 0.03 },
    `<ellipse cx="540" cy="1505" rx="300" ry="26"/>`,
    'fill="#4a4a3e" opacity=".3"',
  );
  s += blurred(0.8, arbor);
  // climbing roses over the arbor and spilling down its sides and onto the hedge
  const onArch = [];
  for (let i = 0; i < 60; i++) {
    const a = Math.PI + rnd() * Math.PI;
    const rr = ar + (rnd() - 0.4) * 60;
    onArch.push([A.cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let i = 0; i < 26; i++) {
    const sx = rnd() < 0.5 ? -1 : 1;
    onArch.push([A.cx + sx * (ar + (rnd() - 0.5) * 50), cy + rnd() ** 1.4 * 420]);
  }
  const list = [];
  for (const [x, y] of onArch) {
    const r = 12 + rnd() * 16 * (y < cy + 100 ? 1 : 0.7);
    if (list.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.75)) continue;
    list.push({ x, y, r, t: Math.floor(rnd() * 4) });
  }
  let greens = '';
  for (let i = 0; i < 70; i++) {
    const [x, y] = onArch[Math.floor(rnd() * onArch.length)];
    greens += eucalyptus(rnd, x, y, rnd() * Math.PI * 2, 30 + rnd() * 40, (rnd() - 0.5) * 20, [
      '#5f7a5f',
      '#6d876a',
      '#557054',
    ]);
  }
  s += blurred(0.9, greens + blooms(rnd, list, PINK));
  // light: the sun behind the hedge, pouring through; bokeh
  s += rays({
    x: 760,
    y: 560,
    n: 18,
    len: 1400,
    a0: 70,
    a1: 160,
    w: [1.5, 4],
    color: '#f7e0b0',
    a: 0.22,
    seed: 7,
    blur: 14,
  });
  s += bokeh({
    seed: 11,
    n: 46,
    y0: 80,
    y1: 1500,
    r: [10, 46],
    color: '#f8dcb4',
    a: [0.12, 0.4],
    avoid: (x, y) => Math.abs(x - 540) < 260 && y > 820 && y < 1300,
  });
  s += bokeh({
    seed: 13,
    n: 24,
    y0: 200,
    y1: 1400,
    r: [16, 50],
    color: '#f3c6cf',
    a: [0.1, 0.3],
    avoid: (x, y) => Math.abs(x - 540) < 280 && y > 800 && y < 1300,
  });
  // roses out of focus at our feet
  const near = scatter(rnd, 7, [-60, 1740, 260, 1980], [44, 70]).concat(
    scatter(rnd, 6, [840, 1720, 1140, 1980], [44, 70]),
  );
  s += blurred(10, blooms(rnd, near, PINK, { leaves: '#5b7058' }));
  s += vignette(0.3, '#3a2c4a');
  return [svgLayer(s)];
};

/** golden hour: a path winding into the garden between lavender, peonies and pink roses */
const path = () => {
  const rnd = prng(201);
  let s = skyFill([
    [0, '#a595bd'],
    [0.16, '#c6aec6'],
    [0.32, '#e8c9bd'],
    [0.46, '#f1d8b4'],
    [0.56, '#eedbb4'],
    [0.62, '#d9d3aa'],
    [1, '#8f9d79'],
  ]);
  s += glow({ x: 560, y: 960, rx: 760, ry: 600, color: '#f7e0ae', a: 0.5 });
  // the far garden: trees and a hint of the white gazebo far off in the haze
  s += blurred(
    3,
    farGarden(rnd, {
      y: HZ + 10,
      pal: { lit: '#c9c091', mid: '#8b9a7b', shade: '#66786e' },
      haze: 0.35,
      hazeColor: '#e0cfaa',
      seed: 220,
      n: 12,
      h: [240, 420],
    }),
  );
  s += blurred(
    2.5,
    `<ellipse cx="610" cy="1118" rx="54" ry="10" fill="#efe6dc" opacity=".6"/><path d="M566 1116V1076M596 1118V1072M626 1118V1072M656 1116V1076" stroke="#f1ebe3" stroke-width="5" opacity=".6"/><path d="M556 1076Q610 1000 664 1076Z" fill="#f2ece4" opacity=".65"/>`,
  );
  s += lawn(
    HZ - 6,
    [
      [0, '#c9c497'],
      [0.12, '#a2a97c'],
      [0.4, '#7c8d63'],
      [1, '#56684a'],
    ],
    7,
    0.3,
  );
  s += mist({ y: HZ + 6, h: 50, color: '#eee0bc', a: 0.55, seed: 231, n: 10 });
  // the path: an S winding to the far end, gravel in the low sun
  const L = [];
  const R = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50; // 0 near … 1 far
    const y = H + 60 - (H + 60 - HZ - 8) * (1 - (1 - t) ** 2.2);
    const half = 330 * (1 - t) ** 1.9 + 6;
    const cx = 540 + Math.sin(t * Math.PI * 1.6 + 0.2) * 120 * (1 - t) ** 0.8 + 40 * t;
    L.push([cx - half, y]);
    R.push([cx + half, y]);
  }
  const pathD = `${pts(L.concat(R.reverse()))}Z`;
  const pg = nid('pg');
  s += `<defs>${ugrad(
    pg,
    [
      [0, '#eadcbc'],
      [0.3, '#cdbd9d'],
      [1, '#a8987d'],
    ],
    [0, HZ, 0, H],
  )}</defs>`;
  s += soft(
    { box: [0, HZ - 20, W, H - HZ + 80], blur: 2, disp: 12, freq: 0.05, seed: 3 },
    `<path d="${pathD}"/>`,
    `fill="url(#${pg})"`,
  );
  s += mottle({
    clip: pathD,
    freq: [0.03, 0.09],
    seed: 9,
    dark: unit('#8b7a63'),
    light: unit('#fff4de'),
    a: 0.3,
    box: [0, HZ, W, H - HZ],
  });
  s += glow({ x: 590, y: 1200, rx: 260, ry: 90, color: '#fbe8bf', a: 0.5 });
  // beds along both sides: lavender at the edge, roses and peonies behind, smaller with distance
  const edge = (side) => {
    const out = [];
    for (let i = 3; i < 48; i++) {
      const p = side < 0 ? L[i] : R[50 - i];
      out.push(p);
    }
    return out;
  };
  const beds = (side) => {
    const e = edge(side);
    const lav = [];
    let roses = [];
    let bushes = '';
    e.forEach(([x, y], i) => {
      const k = (y - HZ) / (H - HZ);
      if (k < 0.02) return;
      const s0 = 0.15 + k * 1.1;
      lav.push({ x: x + side * (10 + 30 * k), y: y + 4, s: s0 });
      if (i % 3 === 0) {
        const bx = x + side * (60 + 200 * k);
        bushes += tree({
          cx: bx,
          cy: y - 40 * s0,
          w: 260 * s0,
          h: 150 * s0,
          n: 18,
          pal: { lit: '#aab58a', mid: '#6e8465', shade: '#465a4a' },
          seed: 250 + i + (side > 0 ? 100 : 0),
          leaf: 0.08,
          bands: 2,
        });
        roses = roses.concat(
          scatter(rnd, 3, [bx - 110 * s0, y - 90 * s0, bx + 110 * s0, y - 10 * s0], [7 * s0, 14 * s0], 4),
        );
      }
    });
    return { lav, roses, bushes };
  };
  const bl = beds(-1);
  const br = beds(1);
  s += blurred(1.2, bl.bushes + br.bushes);
  s += blurred(0.7, blooms(rnd, bl.roses.concat(br.roses), PINK, { leaves: false, shadow: false }));
  s += blurred(0.9, lavender(rnd, bl.lav.concat(br.lav)));
  // peonies in the foreground beds, big and soft
  const pl = scatter(
    rnd,
    9,
    [-40, 1480, 300, 1800],
    [40, 66],
    3,
    (x, y) => x < L[Math.round(((H - y) / (H - HZ)) * 12)][0],
  );
  const pr = scatter(rnd, 9, [790, 1460, 1120, 1780], [40, 66], 3);
  s += blurred(1.5, blooms(rnd, pl.concat(pr), PEONY, { leaves: '#58704f' }));
  // light and bokeh
  s += rays({
    x: 600,
    y: 900,
    n: 16,
    len: 1300,
    a0: -170,
    a1: -10,
    w: [1.5, 4],
    color: '#f6e0b0',
    a: 0.16,
    seed: 5,
    blur: 16,
  });
  s += bokeh({
    seed: 21,
    n: 40,
    y0: 100,
    y1: 1200,
    r: [10, 40],
    color: '#f8e0b8',
    a: [0.1, 0.35],
    avoid: (x, y) => Math.abs(x - 540) < 300 && y > 700 && y < 1250,
  });
  s += bokeh({
    seed: 23,
    n: 18,
    y0: 200,
    y1: 1300,
    r: [16, 44],
    color: '#e9c7e0',
    a: [0.1, 0.28],
    avoid: (x, y) => Math.abs(x - 540) < 300 && y > 700 && y < 1250,
  });
  const near = scatter(rnd, 6, [-80, 1760, 300, 2000], [60, 90], 3).concat(
    scatter(rnd, 6, [800, 1760, 1160, 2000], [60, 90], 3),
  );
  s += blurred(
    12,
    blooms(rnd, near, PEONY, { leaves: '#5b7058' }) +
      lavender(rnd, [
        { x: 120, y: 1990, s: 3 },
        { x: 980, y: 1990, s: 3 },
      ]),
  );
  s += vignette(0.3, '#3a2c4a');
  return [svgLayer(s)];
};

/** a lilac dusk: a flower-wrapped swing hanging from a big tree, fairy lights beginning to glow */
const swing = () => {
  const rnd = prng(301);
  let s = skyFill([
    [0, '#6f6293'],
    [0.14, '#8a7aab'],
    [0.3, '#b3a0c6'],
    [0.44, '#d9b9cb'],
    [0.54, '#ecc9c4'],
    [0.6, '#e6c9bd'],
    [1, '#7d8a80'],
  ]);
  s += glow({ x: 700, y: 1100, rx: 800, ry: 420, color: '#f3cfb6', a: 0.5 });
  s += wisps({
    color: '#f1d2d0',
    a: 0.3,
    seed: 31,
    items: [
      [760, 640, 300, 12, -3],
      [300, 780, 260, 10, 2],
      [840, 880, 200, 8, 1],
    ],
  });
  s += blurred(
    3,
    farGarden(rnd, {
      y: HZ + 10,
      pal: { lit: '#a9a3b6', mid: '#877f9c', shade: '#6d6689' },
      haze: 0.3,
      hazeColor: '#c7b4cb',
      seed: 320,
      n: 12,
      h: [200, 360],
    }),
  );
  s += lawn(
    HZ - 6,
    [
      [0, '#b7b3b6'],
      [0.15, '#9aa39a'],
      [0.5, '#7b8a7c'],
      [1, '#56655b'],
    ],
    9,
    0.3,
  );
  s += mist({ y: HZ + 10, h: 50, color: '#d9c6d2', a: 0.5, seed: 331, n: 10 });
  // the tree: a trunk at the left, a great bough across the top
  const bark = barkFilter(33);
  const tp = { shade: '#2f2a38', body: '#4a4150', lit: '#7b6d7a', rim: '#d9b7a8' };
  const bough = (x0, y0, x1, y1, w0, w1) => {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI - 90;
    return `<g transform="translate(${r1(x0)} ${r1(y0)}) rotate(${r1(ang)})">${trunk({ x: 0, top: d, foot: 0, w: w0, taper: w1 / w0, flare: 0, pal: tp, side: -1, rnd, wobble: 0.04 })}</g>`;
  };
  let wood = trunk({
    x: 90,
    top: 250,
    foot: 1640,
    w: 190,
    taper: 0.7,
    flare: 0.5,
    lean: 0.03,
    pal: tp,
    side: 1,
    rnd,
  });
  wood += bough(150, 470, 1160, 300, 92, 34);
  wood += bough(120, 380, -60, 60, 80, 40);
  wood += bough(160, 420, 520, 120, 60, 26);
  s += `${bark.defs}<g filter="url(#${bark.id})">${blurred(1, wood)}</g>`;
  // leaves over the bough, dusky
  const lp = { lit: '#9a9b8a', front: '#8a8f80', mid: '#56606a', midFront: '#5c6670', shade: '#3a3f55' };
  let crown = '';
  for (let i = 0; i < 9; i++)
    crown += tree({
      cx: -60 + i * 150 + rnd() * 40,
      cy: 60 + rnd() * 150 + (i > 6 ? 60 : 0),
      w: 280 + rnd() * 120,
      h: 220 + rnd() * 80,
      n: 40,
      pal: lp,
      seed: 340 + i,
      leaf: 0.05,
      bands: 3,
      dir: [0.8, 1, 0.2, 0],
    });
  s += blurred(1.5, crown);
  // the swing: ropes from the bough to a seat, wound with blossom and greenery
  const [xa, xb, yTop, ySeat] = [420, 700, 430, 1500];
  const ropeY = (x) => yTop - ((x - 150) / 1010) * 170;
  let ropes = '';
  for (const x of [xa, xb])
    ropes += `<path d="M${x} ${r1(ropeY(x))}L${x + 6} ${ySeat}" stroke="#e9dccb" stroke-width="5"/><path d="M${x} ${r1(ropeY(x))}L${x + 6} ${ySeat}" stroke="#b9a58d" stroke-width="5" stroke-dasharray="3 5" opacity=".6"/>`;
  s += ropes;
  const wrap = [];
  let vine = '';
  for (const x of [xa, xb]) {
    for (let y = ropeY(x) + 10; y < ySeat; y += 10) {
      const dens = y < 640 || y > 1280 ? 1 : 0.18;
      if (rnd() > dens) continue;
      const xx = x + ((y - ropeY(x)) / (ySeat - ropeY(x))) * 6;
      if (rnd() < 0.45)
        wrap.push({ x: xx + (rnd() - 0.5) * 14, y, r: 6 + rnd() * 7, t: Math.floor(rnd() * 4) });
      else
        vine += eucalyptus(rnd, xx, y, rnd() * Math.PI * 2, 16 + rnd() * 16, (rnd() - 0.5) * 8, [
          '#71886f',
          '#809779',
          '#62795f',
        ]);
    }
  }
  // the seat and its garland
  const seat = `<path d="M${xa - 30} ${ySeat}L${xb + 36} ${ySeat}L${xb + 30} ${ySeat + 22}L${xa - 24} ${ySeat + 22}Z" fill="#8d7766"/><path d="M${xa - 30} ${ySeat}L${xb + 36} ${ySeat}" stroke="#c6b09c" stroke-width="4"/>`;
  const garland = scatter(rnd, 26, [xa - 40, ySeat - 26, xb + 46, ySeat + 20], [9, 17], 4);
  for (let i = 0; i < 30; i++)
    vine += eucalyptus(
      rnd,
      xa - 30 + rnd() * (xb - xa + 60),
      ySeat + rnd() * 16,
      Math.PI / 2 + (rnd() - 0.5) * 1.2,
      30 + rnd() * 50,
      (rnd() - 0.5) * 20,
      ['#6b8269', '#7b9275', '#5e735c'],
    );
  s += soft(
    { box: [200, 1500, 700, 300], blur: 14, disp: 20, freq: 0.03 },
    `<ellipse cx="${(xa + xb) / 2 + 40}" cy="1690" rx="220" ry="26"/>`,
    'fill="#3d3b48" opacity=".32"',
  );
  s += blurred(0.7, seat + vine + blooms(rnd, wrap.concat(garland), PINK, { leaves: false, shadow: false }));
  // fairy lights along the bough and hanging in the leaves
  const fl = fairy(
    rnd,
    [
      { p0: [-20, 300], p1: [420, 330], sag: 60 },
      { p0: [420, 330], p1: [760, 250], sag: 70 },
      { p0: [760, 250], p1: [1100, 190], sag: 60 },
      { p0: [60, 150], p1: [520, 120], sag: 80 },
      { p0: [520, 120], p1: [1100, 60], sag: 90 },
      { p0: [170, 420], p1: [150, 900], sag: 30, k: 0.9 },
    ],
    { gap: 26, r: 8 },
  );
  s += fl.svg;
  s += glints(
    fl.list.filter(() => rnd() < 0.08).map((b) => ({ x: b.x, y: b.y, r: 22, a: 0.45 })),
    '#fff0d0',
  );
  // flowers in the grass, blossom out of focus at our feet
  const beds = scatter(rnd, 16, [-40, 1560, 330, 1780], [14, 26], 4).concat(
    scatter(rnd, 14, [760, 1580, 1120, 1780], [14, 26], 4),
  );
  s += blurred(1.4, blooms(rnd, beds, PINK, { leaves: '#4f6150' }));
  const near = scatter(rnd, 5, [-60, 1800, 250, 2000], [50, 76]).concat(
    scatter(rnd, 5, [860, 1800, 1150, 2000], [50, 76]),
  );
  s += blurred(11, blooms(rnd, near, PINK, { leaves: '#4f6150' }));
  s += bokeh({
    seed: 31,
    n: 26,
    y0: 500,
    y1: 1400,
    r: [10, 34],
    color: '#f6cfd6',
    a: [0.08, 0.25],
    avoid: (x, y) => Math.abs(x - 560) < 320 && y > 650 && y < 1250,
  });
  s += vignette(0.32, '#2e2340');
  return [svgLayer(s)];
};

/** a white gazebo (an octagon of posts under a bell roof), cloth draped between its posts, lanterns */
const gazebo = (rnd, { cx = 540, fy = 1600, R = 240, k = 0.2, colH = 250 }) => {
  const post = nid('gp');
  const roof = nid('gr');
  const drape = nid('gd');
  let s = `<defs>${ugrad(
    post,
    [
      [0, '#b9aebd'],
      [0.4, '#eee7ea'],
      [1, '#c8bccb'],
    ],
    [0, 0, 0, 0],
  ).replace(/x1="0" y1="0" x2="0" y2="0"/, `x1="${cx - R}" y1="0" x2="${cx + R}" y2="0"`)}${radial(
    roof,
    [
      [0, '#f7f0ee'],
      [0.5, '#e6dbe0'],
      [1, '#aa9db4'],
    ],
    'cx="0.38" cy="0.35" r="0.8"',
  )}${ugrad(
    drape,
    [
      [0, '#f8e3e6', 0.75],
      [1, '#f3d5da', 0.25],
    ],
    [0, fy - colH, 0, fy],
  )}</defs>`;
  // the floor and its steps, warm light on it from within
  s += `<ellipse cx="${cx}" cy="${fy + 24}" rx="${R + 40}" ry="${r1((R + 40) * k)}" fill="#cfc2c9"/><ellipse cx="${cx}" cy="${fy + 10}" rx="${R + 20}" ry="${r1((R + 20) * k)}" fill="#e2d6da"/><ellipse cx="${cx}" cy="${fy}" rx="${R}" ry="${r1(R * k)}" fill="#efe4e2"/>`;
  s += glow({ x: cx, y: fy - 20, rx: R * 0.9, ry: R * 0.3, color: '#f6c98a', a: 0.55 });
  const angles = Array.from({ length: 8 }, (_, i) => ((i + 0.5) * Math.PI) / 4);
  const at = (t) => [cx + R * Math.sin(t), fy + R * Math.cos(t) * k];
  const col = (t, back) => {
    const [x, yb] = at(t);
    const w = back ? 12 : 16;
    return `<rect x="${r1(x - w / 2)}" y="${r1(yb - colH)}" width="${w}" height="${colH}" fill="${back ? '#cabfcf' : `url(#${post})`}"/>`;
  };
  // lanterns hanging inside
  const inner = [
    [cx - 70, fy - colH + 90, 40],
    [cx + 60, fy - colH + 70, 46],
    [cx, fy - colH + 120, 36],
  ];
  s += `<g opacity=".9">${angles
    .filter((t) => Math.cos(t) < 0)
    .map((t) => col(t, true))
    .join('')}</g>`;
  s += inner
    .map(([x, y, h]) =>
      lantern({ x, y, h, hang: y - h - (fy - colH), ground: false, light: '#f2b765', glowA: 0.6, rnd }),
    )
    .join('');
  s += angles
    .filter((t) => Math.cos(t) >= 0)
    .sort((a, b) => Math.cos(a) - Math.cos(b))
    .map((t) => col(t, false))
    .join('');
  // swags of cloth between the front posts, and drapes tied at each post
  const front = angles.filter((t) => Math.cos(t) >= 0).sort((a, b) => Math.sin(a) - Math.sin(b));
  let cloth = '';
  for (let i = 1; i < front.length; i++) {
    const [x0, y0] = at(front[i - 1]);
    const [x1, y1] = at(front[i]);
    const top = (y0 + y1) / 2 - colH + 8;
    cloth += `<path d="M${r1(x0)} ${r1(y0 - colH + 8)}Q${r1((x0 + x1) / 2)} ${r1(top + 70)} ${r1(x1)} ${r1(y1 - colH + 8)}" fill="none" stroke="url(#${drape})" stroke-width="16" opacity=".8"/>`;
  }
  for (const t of front) {
    const [x, y] = at(t);
    cloth += `<path d="M${r1(x)} ${r1(y - colH + 8)}C${r1(x + 26)} ${r1(y - colH + 90)} ${r1(x - 20)} ${r1(y - 120)} ${r1(x + 10)} ${r1(y)}" fill="none" stroke="url(#${drape})" stroke-width="22" opacity=".55"/>`;
  }
  s += cloth;
  // the entablature, the bell roof and its finial
  const yE = fy - colH;
  s += `<path d="M${cx - R - 18} ${yE}A${R + 18} ${r1((R + 18) * k)} 0 0 0 ${cx + R + 18} ${yE}L${cx + R + 18} ${yE - 22}A${R + 18} ${r1((R + 18) * k)} 0 0 1 ${cx - R - 18} ${yE - 22}Z" fill="#e8dfe3"/>`;
  const yR = yE - 22;
  s += `<path d="M${cx - R - 30} ${yR}C${cx - R + 10} ${yR - 40} ${cx - 120} ${yR - 60} ${cx - 50} ${yR - 130}C${cx - 20} ${yR - 160} ${cx - 8} ${yR - 180} ${cx} ${yR - 200}C${cx + 8} ${yR - 180} ${cx + 20} ${yR - 160} ${cx + 50} ${yR - 130}C${cx + 120} ${yR - 60} ${cx + R - 10} ${yR - 40} ${cx + R + 30} ${yR}A${R + 30} ${r1((R + 30) * k)} 0 0 1 ${cx - R - 30} ${yR}Z" fill="url(#${roof})"/>`;
  s += `<path d="M${cx} ${yR - 200}V${yR - 236}" stroke="#d6b77c" stroke-width="4"/><circle cx="${cx}" cy="${yR - 240}" r="7" fill="#e2c48c"/>`;
  return s;
};

/** twilight: the white gazebo with lanterns and draped cloth */
const gazeboScene = () => {
  const rnd = prng(401);
  let s = skyFill([
    [0, '#4a3a66'],
    [0.14, '#5f4d7c'],
    [0.3, '#8a74a0'],
    [0.44, '#b99bb5'],
    [0.54, '#dcb3b3'],
    [0.6, '#d5b1ae'],
    [1, '#5d6064'],
  ]);
  s += glow({ x: 540, y: 1120, rx: 820, ry: 380, color: '#f2c9a8', a: 0.45 });
  s += stars({ seed: 41, n: 60, y0: 30, y1: 520, a: [0.15, 0.6] });
  s += wisps({
    color: '#e7bfc0',
    a: 0.3,
    seed: 43,
    items: [
      [280, 700, 300, 12, -2],
      [820, 620, 280, 10, 3],
    ],
  });
  s += blurred(
    2.5,
    farGarden(rnd, {
      y: HZ + 20,
      pal: { lit: '#8a7c98', mid: '#62587a', shade: '#4a4264' },
      haze: 0.25,
      hazeColor: '#a893b4',
      seed: 420,
      n: 11,
      h: [260, 440],
    }),
  );
  s += lawn(
    HZ + 4,
    [
      [0, '#9f96a6'],
      [0.15, '#86888a'],
      [0.5, '#66706c'],
      [1, '#434c4b'],
    ],
    11,
    0.28,
  );
  s += mist({ y: HZ + 20, h: 50, color: '#c5afc2', a: 0.45, seed: 431, n: 10 });
  // fairy lights in the far trees
  const far = fairy(
    rnd,
    [
      { p0: [-20, 930], p1: [300, 960], sag: 40, k: 0.6 },
      { p0: [760, 950], p1: [1100, 920], sag: 40, k: 0.6 },
    ],
    { gap: 22, r: 7 },
  );
  s += far.svg;
  s += soft(
    { box: [100, 1500, 900, 300], blur: 14, disp: 18, freq: 0.03 },
    '<ellipse cx="560" cy="1660" rx="330" ry="40"/>',
    'fill="#2f2a3c" opacity=".35"',
  );
  s += blurred(0.8, gazebo(rnd, { cx: 540, fy: 1600, R: 230, colH: 250 }));
  // a path of lanterns towards it, flowering bushes to either side
  const L = [
    [300, 1790, 90],
    [790, 1800, 96],
    [392, 1700, 60],
    [700, 1705, 62],
    [446, 1648, 40],
    [642, 1650, 40],
  ];
  const bushes =
    tree({
      cx: 110,
      cy: 1560,
      w: 320,
      h: 260,
      n: 40,
      pal: { lit: '#7d7f84', mid: '#4f5760', shade: '#34384a' },
      seed: 451,
      leaf: 0.06,
    }) +
    tree({
      cx: 980,
      cy: 1570,
      w: 330,
      h: 260,
      n: 40,
      pal: { lit: '#7d7f84', mid: '#4f5760', shade: '#34384a' },
      seed: 453,
      leaf: 0.06,
    });
  s += blurred(1.2, bushes);
  const fl = scatter(rnd, 16, [-20, 1450, 260, 1640], [9, 16], 4).concat(
    scatter(rnd, 16, [840, 1460, 1110, 1650], [9, 16], 4),
  );
  s += blurred(1, blooms(rnd, fl, PINK, { leaves: false, shadow: false }));
  s += L.map(([x, y, h]) => lantern({ x, y, h, glowA: 0.6, rnd })).join('');
  s += glow({ x: 540, y: 1450, rx: 520, ry: 260, color: '#f0b56c', a: 0.16, blend: 'screen' });
  s += bokeh({
    seed: 45,
    n: 22,
    y0: 700,
    y1: 1500,
    r: [8, 26],
    color: '#f6cf94',
    a: [0.1, 0.3],
    avoid: (x, y) => Math.abs(x - 540) < 330 && y < 1300,
  });
  s += vignette(0.34, '#2e2340');
  return [svgLayer(s)];
};

/** night: the garden under a big pale moon, lanterns glowing, a purple-blue sky */
const night = () => {
  const rnd = prng(501);
  let s = skyFill([
    [0, '#29264a'],
    [0.2, '#3b3563'],
    [0.4, '#544c7f'],
    [0.54, '#6f6597'],
    [0.6, '#7b6f9d'],
    [1, '#383650'],
  ]);
  // the moon, high and to the right, with its halo
  const [mx, my, mr] = [720, 420, 118];
  s += glow({ x: mx, y: my, rx: 620, color: '#b9b2d8', a: 0.4 });
  s += glow({ x: mx, y: my, rx: 260, color: '#e4def0', a: 0.45 });
  s += stars({
    seed: 51,
    n: 200,
    y0: 20,
    y1: 1000,
    a: [0.2, 0.8],
    bright: 12,
    fade: (x, y) => Math.min(1, Math.hypot(x - mx, y - my) / 400),
  });
  const moon = nid('mn');
  s += `<defs>${radial(
    moon,
    [
      [0, '#f7f3ea'],
      [0.7, '#efe9dc'],
      [1, '#ddd6cd'],
    ],
    'cx="0.42" cy="0.4" r="0.65"',
  )}</defs><circle cx="${mx}" cy="${my}" r="${mr}" fill="url(#${moon})"/>`;
  s += blurred(
    6,
    `<g fill="#c9c1cc" opacity=".45"><ellipse cx="${mx - 30}" cy="${my - 20}" rx="38" ry="28"/><ellipse cx="${mx + 34}" cy="${my + 10}" rx="30" ry="40"/><ellipse cx="${mx - 10}" cy="${my + 50}" rx="24" ry="16"/><ellipse cx="${mx + 20}" cy="${my - 55}" rx="18" ry="12"/></g>`,
  );
  s += wisps({
    color: '#a79cc6',
    a: 0.35,
    seed: 53,
    items: [
      [300, 760, 320, 12, -2],
      [780, 690, 300, 10, 2],
      [560, 880, 360, 10, 0],
    ],
  });
  // the garden's dark shapes: far trees, the gazebo aglow far off, hedges, a path of lanterns
  s += blurred(
    2.2,
    farGarden(rnd, {
      y: HZ + 20,
      pal: { lit: '#5e5880', mid: '#433e62', shade: '#302c4a' },
      haze: 0.2,
      hazeColor: '#6a6290',
      seed: 520,
      n: 12,
      h: [260, 460],
    }),
  );
  s += `<g opacity=".9">${blurred(1.5, `<ellipse cx="820" cy="1150" rx="70" ry="12" fill="#6e6588"/><path d="M766 1150V1100M800 1152V1096M840 1152V1096M874 1150V1100" stroke="#7b7294" stroke-width="6"/><path d="M752 1100Q820 1010 888 1100Z" fill="#7a7194"/>`)}</g>`;
  s += glow({ x: 820, y: 1120, rx: 90, ry: 60, color: '#f2c07a', a: 0.6 });
  s += lawn(
    HZ + 10,
    [
      [0, '#6a6689'],
      [0.2, '#555a6c'],
      [0.6, '#3f4656'],
      [1, '#2d3243'],
    ],
    13,
    0.25,
  );
  s += mist({ y: HZ + 30, h: 60, color: '#8c83ad', a: 0.45, seed: 531, n: 10 });
  const hedge = (x0, x1, y, h, sd) => {
    const lobes = [];
    for (let i = 0; i <= 14; i++)
      lobes.push([
        x0 + ((x1 - x0) * i) / 14,
        y - h * 0.5 + (rnd() - 0.5) * 20,
        (x1 - x0) / 14 + 20,
        h * 0.55,
      ]);
    return foliage({
      lobes,
      pal: { lit: '#6d6c8a', mid: '#3f4260', shade: '#2a2c44' },
      seed: sd,
      grain: 0.08,
      edge: 7,
      clump: 14,
      tex: 0.5,
      relief: 5,
      light: [0.8, 0, 0.3, 1],
    });
  };
  s += hedge(-60, 380, 1330, 150, 541) + hedge(700, 1140, 1320, 150, 543);
  // lanterns along the path
  const path = [
    [250, 1830, 110],
    [820, 1850, 116],
    [350, 1640, 66],
    [720, 1650, 70],
    [420, 1500, 42],
    [650, 1505, 44],
    [470, 1420, 28],
    [600, 1422, 28],
    [505, 1370, 18],
    [565, 1372, 18],
  ];
  s += `<path d="M430 1340L620 1340L900 ${H}L180 ${H}Z" fill="#5b5877" opacity=".5"/>`;
  s += path.map(([x, y, h]) => lantern({ x, y, h, glowA: 0.62, rnd })).join('');
  // roses in the dark, their edges silvered by the moon
  const fl = scatter(rnd, 14, [-40, 1560, 300, 1760], [14, 26], 4).concat(
    scatter(rnd, 14, [780, 1570, 1120, 1770], [14, 26], 4),
  );
  s += `<g opacity=".7">${blurred(1.2, blooms(rnd, fl, PINK, { leaves: '#2f3a3c' }))}</g>`;
  s += veil('#2a2645', [
    [1500, 0],
    [1920, 0.25],
  ]);
  // fairy lights across the top in the trees
  const fl2 = fairy(
    rnd,
    [
      { p0: [-20, 1060], p1: [320, 1090], sag: 40, k: 0.7 },
      { p0: [760, 1080], p1: [1100, 1050], sag: 40, k: 0.7 },
    ],
    { gap: 22, r: 7 },
  );
  s += fl2.svg;
  s += vignette(0.3, '#1f1a33');
  return [svgLayer(s)];
};

const scenes = {
  'scene-gate': { paint: gate, seed: 31, post: { gamma: 1.12, bloom: 0.42 } },
  'scene-path': { paint: path, seed: 32, post: { gamma: 1.3, bloom: 0.4 } },
  'scene-swing': { paint: swing, seed: 33, post: { gamma: 1.05, bloom: 0.45 } },
  'scene-gazebo': { paint: gazeboScene, seed: 34, post: { gamma: 0.95, bloom: 0.48 } },
  'scene-night': { paint: night, seed: 35, post: { gamma: 0.92, bloom: 0.5 } },
};

await paintScenes({ id: 'enchanted-garden', scenes, background: '#b9a3c9' });
