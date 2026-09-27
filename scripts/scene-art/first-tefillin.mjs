// first-tefillin (a bar mitzvah: the boy's first tefillin): five backdrop pictures of one morning — the
// table at home by a curtained window, the old synagogue with light falling through its arched windows, the
// dressed Torah on the reading table, Jerusalem at sunrise from a lookout, and a luminous golden dawn — in
// Jerusalem stone cream, warm gold, deep navy, velvet burgundy, sky blue and dawn peach. The app draws the
// tefillin, their velvet bag and the boy over these, so there are no tefillin, bags, people or hands here,
// and nothing written anywhere. Painted with the kit (./kit.mjs) and the architecture group's helpers.
//
//   node scripts/scene-art/first-tefillin.mjs [--draft <dir>] [scene …]
import {
  paintScenes,
  W,
  H,
  prng,
  r1,
  r3,
  nid,
  mix,
  stopsOf,
  ugrad,
  lgrad,
  skyFill,
  glow,
  soft,
  mist,
  wisps,
  rays,
  cumulus,
  billowGrads,
  ellipses,
  vignette,
  svgLayer,
  pts,
  foliage,
  flame,
  crown,
} from './kit.mjs';
import {
  poly,
  box,
  under,
  blurred,
  veil,
  camera,
  stoneTex,
  ashlar,
  bokeh,
  glints,
} from './architecture-shared.mjs';

const C = {
  cream: '#EFE6D4',
  gold: '#C9A45C',
  navy: '#1B2A4A',
  burgundy: '#6B1F2E',
  sky: '#9DB7D1',
  peach: '#F2C9A0',
  shade: '#182238',
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------
// helpers of this design

/** a noise texture laid over a box: fractal noise tinted one colour, its alpha from the noise (k·n + b) */
const noiseTex = ({
  box: [x0, y0, w, h],
  color,
  a = 0.4,
  freq,
  oct = 3,
  seed = 1,
  k = 1.6,
  b = -0.45,
  blend = 'normal',
  attrs = '',
}) => {
  const f = nid('nt');
  const [cr, cg, cb] = color.match(/[0-9a-f]{2}/gi).map((v) => parseInt(v, 16) / 255);
  return `<defs><filter id="${f}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${r3(freq[0])} ${r3(freq[1])}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix values="0 0 0 0 ${r3(cr)}  0 0 0 0 ${r3(cg)}  0 0 0 0 ${r3(cb)}  ${r3(k)} 0 0 0 ${r3(b)}"/></filter></defs><rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filter="url(#${f})" opacity="${r3(a)}" style="mix-blend-mode:${blend}" ${attrs}/>`;
};

/** a clip path from a point list; returns its id and defs */
const clipOf = (list) => {
  const id = nid('cp');
  return { id, defs: `<defs><clipPath id="${id}"><path d="${pts(list)}Z"/></clipPath></defs>` };
};
const clipped = (list, inner) => {
  const c = clipOf(list);
  return `${c.defs}<g clip-path="url(#${c.id})">${inner}</g>`;
};

/** a radial gradient fill (objectBoundingBox) */
const rgradDef = (id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy } = {}) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx !== undefined ? ` fx="${fx}" fy="${fy}"` : ''}>${stopsOf(stops)}</radialGradient>`;

/**
 * Motes of dust in a beam: tiny soft specks, denser where the light is (inside `area`, a point list),
 * screened.
 */
const motes = ({
  area,
  n = 120,
  r = [0.8, 2.4],
  color = '#fff3d8',
  a = [0.25, 0.8],
  seed = 1,
  blur = 0.6,
}) => {
  const rnd = prng(seed * 733 + 5);
  const xs = area.map((p) => p[0]);
  const ys = area.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
      const [xi, yi] = area[i];
      const [xj, yj] = area[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  let s = '';
  let k = 0;
  for (let i = 0; i < n * 8 && k < n; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    if (!inside(x, y)) continue;
    k += 1;
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r[0] + rnd() ** 2 * (r[1] - r[0]))}" opacity="${r3(a[0] + rnd() * (a[1] - a[0]))}"/>`;
  }
  return blurred(blur, s, `fill="${color}" style="mix-blend-mode:screen"`);
};

/** the convex hull of screen points (monotone chain) */
const hullOf = (list) => {
  const all = list.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lower = [];
  for (const p of all) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of all.slice().reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

/**
 * A shaft of parallel light: the aperture (a screen polygon) swept to where it lands (the same polygon
 * moved by `shift`), filled with a gradient that fades along the shaft, blurred, screened.
 */
const shaft = ({
  from,
  shift: [dx, dy],
  color = '#fff0cf',
  a = 0.3,
  fade = 0.15,
  blur = 14,
  blend = 'screen',
}) => {
  const to = from.map(([x, y]) => [x + dx, y + dy]);
  const hull = hullOf(from.concat(to));
  const cx = from.reduce((s, p) => s + p[0], 0) / from.length;
  const cy = from.reduce((s, p) => s + p[1], 0) / from.length;
  const g = nid('sh');
  const f = nid('shf');
  return `<defs>${ugrad(
    g,
    [
      [0, color, a],
      [0.55, color, r3(a * 0.6)],
      [1, color, r3(a * fade)],
    ],
    [cx, cy, cx + dx, cy + dy],
  )}<filter id="${f}" x="-200" y="-200" width="${W + 400}" height="${H + 400}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><path d="${pts(hull)}Z" fill="url(#${g})" filter="url(#${f})" style="mix-blend-mode:${blend}"/>`;
};

/** a thin strip in world space along a polyline on a plane (for grain, seams, stripes): [[X, Y, Z], …], half-width w across X */
const stripX = (cam, line, w) => {
  const left = line.map(([X, Y, Z]) => cam.p([X - w, Y, Z]));
  const right = line.map(([X, Y, Z]) => cam.p([X + w, Y, Z]));
  return left.concat(right.reverse());
};

// ---------------------------------------------------------------------------------------------------
// 1. the table at home: a long wooden table running to an arched window, sheer curtains glowing with the
//    morning, the folded tallit and the prayer book, a small plant; the lower left left plain for the bag

const table = () => {
  const rnd = prng(111);
  const cam = camera({ f: 1150, vx: 540, vy: 1000, eye: 0.42 });
  const { p } = cam;
  const Zw = 2.45; // the wall
  const Zg = 2.72; // the glass and the sheers, in the recess
  const hw = 0.62; // the window's half width
  const sill = 0.16;
  const spring = 1.25;
  const Zt = 2.08; // the table's far end
  const yEdge = p([0, 0, Zt])[1];

  // the wall: warm plaster in the window's backlight, darker away from it
  let s = under(
    stoneTex({
      freq: 0.012,
      oct: 4,
      relief: 1.8,
      tex: 0.3,
      seed: 12,
      patch: 0.14,
      patchFreq: 0.003,
      patchColor: '#6d5a42',
    }),
    skyFill([
      [0, '#5e4a38'],
      [0.2, '#806a50'],
      [0.42, '#9a8061'],
      [0.6, '#957b5c'],
      [0.7, '#76604a'],
      [1, '#4f3d2f'],
    ]) +
      glow({ x: 560, y: 760, rx: 740, ry: 840, color: '#d8bf94', a: 0.55 }) +
      glow({ x: 700, y: 620, rx: 420, ry: 520, color: '#ecd4a8', a: 0.25 }),
  );

  // the window: its outline on the wall's face and in the recess
  const archAt = (Z, r = hw) =>
    Array.from({ length: 41 }, (_, i) => {
      const a = Math.PI + (Math.PI * i) / 40;
      return p([r * Math.cos(a), spring - r * Math.sin(a), Z]);
    });
  const faceArch = archAt(Zw);
  const deepArch = archAt(Zg);
  const deep = [p([-hw, sill, Zg]), ...deepArch, p([hw, sill, Zg])];

  // the stone surround: voussoirs round the arch, jambs
  let sur = '';
  const ring = archAt(Zw, hw + 0.19);
  sur += poly([p([-hw - 0.19, sill - 0.04, Zw]), ...ring, p([hw + 0.19, sill - 0.04, Zw])], 'fill="#bba886"');
  let joints = '';
  for (let i = 1; i < 11; i++) {
    const a = Math.PI + (Math.PI * i) / 11;
    const q0 = p([hw * Math.cos(a), spring - hw * Math.sin(a), Zw]);
    const q1 = p([(hw + 0.19) * Math.cos(a), spring - (hw + 0.19) * Math.sin(a), Zw]);
    joints += `M${r1(q0[0])} ${r1(q0[1])}L${r1(q1[0])} ${r1(q1[1])}`;
  }
  for (let Y = sill + 0.2; Y < spring; Y += 0.22)
    for (const sd of [-1, 1]) {
      const q0 = p([sd * hw, Y, Zw]);
      const q1 = p([sd * (hw + 0.19), Y, Zw]);
      joints += `M${r1(q0[0])} ${r1(q0[1])}L${r1(q1[0])} ${r1(q1[1])}`;
    }
  sur += `<path d="${joints}" stroke="#8a7658" stroke-width="2.2" fill="none" opacity=".6"/>`;
  sur += `<path d="${pts(ring)}" stroke="#d9c9a8" stroke-width="2" fill="none" opacity=".5"/>`;
  // the window's light grazing the surround's inner edge
  sur += glow({ x: 560, y: 780, rx: 360, ry: 520, color: '#f0dfbd', a: 0.35 });
  s += under(stoneTex({ freq: 0.03, relief: 2.2, tex: 0.38, seed: 14, patch: 0.12 }), sur);

  // the recess: the reveals catch the light near the glass
  const revL = [
    p([-hw, sill, Zw]),
    ...faceArch.slice(0, 21),
    ...deepArch.slice(0, 21).reverse(),
    p([-hw, sill, Zg]),
  ];
  const revR = [p([hw, sill, Zw]), ...faceArch.slice(20).reverse(), ...deepArch.slice(20), p([hw, sill, Zg])];
  for (const [list, from, to] of [
    [revL, faceArch[0][0], deepArch[0][0]],
    [revR, faceArch[40][0], deepArch[40][0]],
  ]) {
    const rg = nid('rv');
    s += `<defs>${ugrad(
      rg,
      [
        [0, '#a8956f'],
        [1, '#eadcbd'],
      ],
      [from, 0, to, 0],
    )}</defs>${poly(list, `fill="url(#${rg})"`)}`;
  }

  // the fan light above the curtain rod: morning sky through the glass
  const fan = [p([-hw, spring, Zg]), ...deepArch, p([hw, spring, Zg])];
  const fy0 = Math.min(...deepArch.map((q) => q[1]));
  const fy1 = p([0, spring, Zg])[1];
  const fg = nid('fn');
  let win = `<defs>${ugrad(
    fg,
    [
      [0, '#a9bfd4'],
      [0.5, '#d3d3cc'],
      [1, '#efd3b3'],
    ],
    [0, fy0, 0, fy1],
  )}</defs>${poly(fan, `fill="url(#${fg})"`)}`;
  win += glow({ x: 720, y: fy1 - 10, rx: 280, ry: 200, color: '#fff0d4', a: 0.55 });
  const fcx = p([0, spring, Zg]);
  let bars = '';
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (Math.PI * i) / 6;
    const q = p([hw * Math.cos(a), spring - hw * Math.sin(a), Zg]);
    bars += `M${r1(fcx[0])} ${r1(fcx[1])}L${r1(q[0])} ${r1(q[1])}`;
  }
  win += blurred(1.6, `<path d="${bars}" stroke="#7d6c58" stroke-width="4" fill="none" opacity=".5"/>`);

  // the sheers: fine translucent cloth on a rod, soft folds of varied depth, the light behind
  const [sx0, sy0] = p([-hw, spring, Zg]);
  const [sx1, sy1] = p([hw, sill, Zg]);
  const span = sx1 - sx0 + 20;
  const fstops = [];
  let x = sx0 - 10;
  while (x < sx1 + 10) {
    const per = 22 + rnd() * 40;
    const depth = 0.35 + rnd() * 0.65;
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const v = (0.5 + 0.5 * Math.cos(t * Math.PI * 2)) ** 1.4;
      fstops.push([r3(clamp((x + t * per - sx0 + 10) / span)), mix('#f4e7d0', '#b8a489', v * depth * 0.75)]);
    }
    x += per;
  }
  const sg = nid('sr');
  let sheer = `<defs>${ugrad(sg, fstops, [sx0 - 10, 0, sx1 + 10, 0])}</defs>`;
  sheer += `<rect x="${r1(sx0 - 10)}" y="${r1(sy0)}" width="${r1(span)}" height="${r1(sy1 - sy0 + 4)}" fill="url(#${sg})"/>`;
  // the light behind the cloth: brightest high on the right, where the sun is; warmer low down
  sheer += glow({ x: 700, y: 720, rx: 380, ry: 440, color: '#fff3dc', a: 0.6 });
  sheer += glow({ x: 520, y: 980, rx: 360, ry: 260, color: C.peach, a: 0.28 });
  // a tree outside, a soft shadow through the cloth
  sheer += blurred(
    18,
    crown(prng(7), sx0 + 70, sy0 + 190, 260, 300, 9)
      .map(([cx, cy, rx, ry]) => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`)
      .join('') +
      `<path d="M${r1(sx0 + 60)} ${r1(sy1)}L${r1(sx0 + 76)} ${r1(sy0 + 260)}" stroke-width="16" stroke="#6f7a5c"/>`,
    'fill="#6f7a5c" opacity=".16"',
  );
  // the window's bars as soft shadows through the cloth
  const [mx] = p([0, 0, Zg]);
  const [, my] = p([0, 0.72, Zg]);
  sheer += blurred(
    9,
    `<path d="M${r1(mx)} ${r1(sy0)}V${r1(sy1)}M${r1(sx0)} ${r1(my)}H${r1(sx1)}" stroke="#9b8a6e" stroke-width="12" opacity=".3"/>`,
  );
  // the heading gathered on the rod, a hem above the sill
  let gathers = '';
  for (let gx = sx0 - 4; gx < sx1 + 4; gx += 9 + rnd() * 8)
    gathers += `<path d="M${r1(gx)} ${r1(sy0 + 4)}q3 20 ${r1(-1 + rnd() * 2)} 44" stroke="${rnd() < 0.5 ? '#fff4e0' : '#a8967a'}" stroke-width="${r1(2 + rnd() * 3)}" fill="none" opacity=".5"/>`;
  sheer += blurred(2.4, gathers);
  sheer += blurred(
    3,
    `<rect x="${r1(sx0 - 10)}" y="${r1(sy1 - 34)}" width="${r1(span)}" height="12" fill="#cbb99a" opacity=".45"/>`,
  );
  win += soft(
    {
      box: [sx0 - 60, sy0 - 40, span + 120, sy1 - sy0 + 80],
      blur: 1.8,
      disp: 18,
      freq: 0.004,
      oct: 2,
      seed: 17,
    },
    sheer,
  );
  win += `<path d="M${r1(sx0 - 14)} ${r1(sy0 + 2)}H${r1(sx1 + 14)}" stroke="#5a4a38" stroke-width="7" stroke-linecap="round"/><path d="M${r1(sx0 - 14)} ${r1(sy0)}H${r1(sx1 + 14)}" stroke="#c9ad7c" stroke-width="2" opacity=".6"/>`;
  s += clipped(deep, win);

  // the sill: a stone ledge, lit from the glass
  const sl = [
    p([-hw - 0.08, sill, Zw - 0.08]),
    p([hw + 0.08, sill, Zw - 0.08]),
    p([hw + 0.08, sill, Zg]),
    p([-hw - 0.08, sill, Zg]),
  ];
  const slg = nid('sl');
  s += `<defs>${ugrad(
    slg,
    [
      [0, '#f1e3c5'],
      [1, '#c9b692'],
    ],
    [0, sl[2][1], 0, sl[0][1]],
  )}</defs>${poly(sl, `fill="url(#${slg})"`)}`;
  s += poly(
    [
      p([-hw - 0.08, sill, Zw - 0.08]),
      p([hw + 0.08, sill, Zw - 0.08]),
      p([hw + 0.08, sill - 0.05, Zw - 0.08]),
      p([-hw - 0.08, sill - 0.05, Zw - 0.08]),
    ],
    'fill="#8a7658"',
  );
  s += blurred(5, box(sl[0][0], sl[0][1] + 10, sl[1][0] - sl[0][0], 26, 'fill="#4a3a2c" opacity=".35"'));

  // the window's light in the room
  s += glow({ x: 560, y: 780, rx: 560, ry: 660, color: '#f6e6c6', a: 0.2, blend: 'screen' });

  // below the table's far edge: the wall falling into the shade under the table
  s += `<defs>${ugrad(
    'undr',
    [
      [0, '#5b4838', 0],
      [1, '#3a2c22', 0.85],
    ],
    [0, p([0, 0.02, Zw])[1], 0, yEdge + 4],
  )}</defs>${box(0, p([0, 0.02, Zw])[1], W, yEdge - p([0, 0.02, Zw])[1] + 6, 'fill="url(#undr)"')}`;

  // the table: planks running to the window, waxed walnut, grain drawn in world space
  const Zn = 0.4;
  const TW = 0.85;
  s += box(0, yEdge - 2, W, H - yEdge + 2, 'fill="#3a2a20"');
  const tableTop = [p([-TW, 0, Zn]), p([TW, 0, Zn]), p([TW, 0, Zt]), p([-TW, 0, Zt])];
  let tb = poly(tableTop, 'fill="#7a5034"');
  let X = -TW;
  while (X < TW) {
    const w = 0.11 + rnd() * 0.035;
    const tone = mix(mix('#94613c', '#ab7549', rnd()), '#734a2e', rnd() * 0.4);
    tb += poly([p([X, 0, Zn]), p([X + w, 0, Zn]), p([X + w, 0, Zt]), p([X, 0, Zt])], `fill="${tone}"`);
    for (let g = 0; g < 11; g++) {
      const gx = X + 0.006 + rnd() * (w - 0.012);
      const amp = 0.001 + rnd() * 0.005;
      const k = 1.5 + rnd() * 5;
      const ph = rnd() * 6;
      const line = Array.from({ length: 24 }, (_, i) => {
        const Z = Zn + ((Zt - Zn) * i) / 23;
        return [gx + amp * Math.sin(Z * k + ph), 0, Z];
      });
      const dark = rnd() < 0.62;
      tb += `<path d="${pts(stripX(cam, line, 0.0008 + rnd() * 0.0016))}Z" fill="${dark ? '#4d301d' : '#c9956a'}" opacity="${r3(dark ? 0.18 + rnd() * 0.25 : 0.12 + rnd() * 0.18)}"/>`;
    }
    tb += `<path d="${pts(
      stripX(
        cam,
        [
          [X, 0, Zn],
          [X, 0, Zt],
        ],
        0.0014,
      ),
    )}Z" fill="#3a2517" opacity=".6"/>`;
    X += w;
  }
  let tableSvg = blurred(0.5, tb);
  tableSvg += noiseTex({
    box: [0, yEdge - 10, W, H - yEdge + 10],
    color: '#3d2616',
    a: 0.28,
    freq: [0.018, 0.0035],
    seed: 7,
    k: 1.4,
    b: -0.4,
  });
  // the window mirrored in the wax: a soft glossy streak running towards us
  const refl = [
    p([-hw, -sill, Zg]),
    p([hw, -sill, Zg]),
    p([hw, -spring - 0.2, Zg]),
    p([-hw, -spring - 0.2, Zg]),
  ];
  const rfl = nid('rf');
  tableSvg += `<defs>${ugrad(
    rfl,
    [
      [0, '#fbe6c0', 0.8],
      [0.3, '#efcf9c', 0.4],
      [1, '#efcf9c', 0],
    ],
    [0, refl[0][1] - 10, 0, refl[2][1]],
  )}</defs>${blurred(20, poly(refl, `fill="url(#${rfl})"`), 'style="mix-blend-mode:screen"')}`;
  // the far end in the window's light, the near end in warm shade
  const tg = nid('tg');
  tableSvg += `<defs>${ugrad(
    tg,
    [
      [0, '#f1d6aa', 0.3],
      [0.18, '#d9b484', 0.1],
      [0.5, '#3a2416', 0],
      [1, '#2e1c12', 0.3],
    ],
    [0, yEdge, 0, H],
  )}</defs>${box(0, yEdge - 4, W, H - yEdge + 4, `fill="url(#${tg})"`)}`;
  // soft light on the plain tabletop at the lower left, where the bag will stand
  tableSvg += glow({ x: 240, y: 1610, rx: 380, ry: 320, color: '#e6c291', a: 0.34, blend: 'screen' });
  s += clipped(tableTop, tableSvg);
  // the far edge and the sides: a lit rim
  s += blurred(
    1.5,
    `<path d="${pts([p([-TW, 0, 1.2]), p([-TW, 0, Zt]), p([TW, 0, Zt]), p([TW, 0, 1.2])])}" stroke="#f0d3a3" stroke-width="3" fill="none" opacity=".75"/>`,
  );
  // the sun through the fan light: a soft shaft down to the plain tabletop at the lower left, a warm patch there
  const fanPts = [
    p([-hw * 0.9, spring + 0.05, Zg]),
    ...archAt(Zg, hw * 0.9).slice(4, 37),
    p([hw * 0.9, spring + 0.05, Zg]),
  ];
  s += shaft({ from: fanPts, shift: [-330, 1130], color: '#ffe6b8', a: 0.3, fade: 0.55, blur: 22 });
  const patch = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    patch.push(p([-0.2 + 0.2 * Math.cos(a), 0, 0.84 + 0.2 * Math.sin(a)]));
  }
  s += blurred(30, poly(patch, 'fill="#ffdcaa" opacity=".3"'), 'style="mix-blend-mode:screen"');

  // the plant at the back right: a small clay pot, leaves lit through from the window
  const pz = 1.92;
  const [ppx, ppy] = p([0.6, 0, pz]);
  const psc = 1150 / pz;
  const potH = 0.11 * psc;
  const potW = 0.07 * psc;
  let pl = glow({ x: ppx - 6, y: ppy + 10, rx: potW * 1.8, ry: 16, color: '#24160d', a: 0.55 });
  pl += blurred(
    2.5,
    `<ellipse cx="${r1(ppx)}" cy="${r1(ppy)}" rx="${r1(potW * 0.85)}" ry="5" fill="#140b06" opacity=".7"/>`,
  );
  const pg = nid('pt');
  pl += `<defs>${ugrad(
    pg,
    [
      [0, '#7a4430'],
      [0.35, '#bf7b53'],
      [0.7, '#a45f3d'],
      [1, '#6a3a25'],
    ],
    [ppx - potW, 0, ppx + potW, 0],
  )}</defs>`;
  pl += `<path d="M${r1(ppx - potW)} ${r1(ppy - potH)}L${r1(ppx + potW)} ${r1(ppy - potH)}L${r1(ppx + potW * 0.78)} ${r1(ppy)}L${r1(ppx - potW * 0.78)} ${r1(ppy)}Z" fill="url(#${pg})"/>`;
  pl += `<rect x="${r1(ppx - potW * 1.07)}" y="${r1(ppy - potH - 12)}" width="${r1(potW * 2.14)}" height="18" rx="3" fill="url(#${pg})"/>`;
  const lg = nid('lf');
  let leaves = `<defs>${lgrad(
    lg,
    [
      [0, '#d6e09a'],
      [0.45, '#86a052'],
      [1, '#4b6433'],
    ],
    [0.2, 0, 0.8, 1],
  )}</defs>`;
  for (let st = 0; st < 13; st++) {
    const ang = -Math.PI / 2 + (st - 6) * 0.2 + (rnd() - 0.5) * 0.25;
    const len = (0.08 + rnd() * 0.09) * psc;
    const [bx, by] = [ppx + (rnd() - 0.5) * potW * 1.2, ppy - potH - 8];
    const tip = [bx + Math.cos(ang) * len, by + Math.sin(ang) * len];
    leaves += `<path d="M${r1(bx)} ${r1(by)}Q${r1(bx + Math.cos(ang) * len * 0.5)} ${r1(by + Math.sin(ang) * len * 0.6 - 6)} ${r1(tip[0])} ${r1(tip[1])}" stroke="#5c7040" stroke-width="2" fill="none"/>`;
    for (let lf = 0; lf < 6; lf++) {
      const t = 0.3 + lf * 0.14;
      const lx = bx + (tip[0] - bx) * t;
      const ly = by + (tip[1] - by) * t;
      const side = lf % 2 ? 1 : -1;
      const la = ((ang * 180) / Math.PI + side * (35 + rnd() * 30)) * (Math.PI / 180);
      const lr = (0.016 + rnd() * 0.012) * psc * (1.1 - t * 0.4);
      const [cx, cy] = [lx + Math.cos(la) * lr * 0.85, ly + Math.sin(la) * lr * 0.85];
      leaves += `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(lr)}" ry="${r1(lr * 0.52)}" transform="rotate(${r1((la * 180) / Math.PI)} ${r1(cx)} ${r1(cy)})" fill="url(#${lg})" opacity="${r3(0.85 + rnd() * 0.15)}"/>`;
    }
  }
  pl += leaves;
  pl += glow({
    x: ppx + 14,
    y: ppy - potH - 0.08 * psc,
    rx: 0.13 * psc,
    ry: 0.1 * psc,
    color: '#eef5b8',
    a: 0.28,
    blend: 'screen',
  });
  s += blurred(1.2, pl);

  // the folded tallit: layers of soft white wool, the blue stripes across the top; the prayer book on it
  const tl = { x0: 0.04, x1: 0.4, z0: 1.18, z1: 1.46, h: 0.05, r: 0.025 };
  const rrect = (x0, x1, z0, z1, rr, Y) => {
    const out = [];
    const corner = (cx, cz, a0) => {
      for (let i = 0; i <= 5; i++) {
        const a = a0 + (Math.PI / 2) * (i / 5);
        out.push(p([cx + rr * Math.cos(a), Y, cz + rr * Math.sin(a)]));
      }
    };
    corner(x0 + rr, z0 + rr, Math.PI);
    corner(x1 - rr, z0 + rr, 1.5 * Math.PI);
    corner(x1 - rr, z1 - rr, 0);
    corner(x0 + rr, z1 - rr, 0.5 * Math.PI);
    return out;
  };
  let tal = blurred(
    16,
    poly(
      [
        p([tl.x0 - 0.02, 0, tl.z0 + 0.12]),
        p([tl.x1 + 0.03, 0, tl.z0 + 0.12]),
        p([tl.x1 + 0.07, 0, tl.z0 - 0.2]),
        p([tl.x0 - 0.03, 0, tl.z0 - 0.18]),
      ],
      'fill="#23150c" opacity=".55"',
    ),
  );
  // contact shadows where the cloth meets the wood
  tal += blurred(
    3,
    poly(
      [
        p([tl.x0 - 0.004, 0, tl.z0 + 0.01]),
        p([tl.x1 + 0.004, 0, tl.z0 + 0.01]),
        p([tl.x1 + 0.006, 0, tl.z0 - 0.012]),
        p([tl.x0 - 0.006, 0, tl.z0 - 0.012]),
      ],
      'fill="#140b06" opacity=".75"',
    ) +
      poly(
        [
          p([tl.x0 + 0.005, 0, tl.z0]),
          p([tl.x0 + 0.005, 0, tl.z1]),
          p([tl.x0 - 0.012, 0, tl.z1]),
          p([tl.x0 - 0.012, 0, tl.z0]),
        ],
        'fill="#140b06" opacity=".55"',
      ),
  );
  let talInner = '';
  const nL = 4;
  for (let k = 0; k < nL; k++) {
    const jx = (rnd() - 0.5) * 0.012;
    const jz = (rnd() - 0.5) * 0.01;
    for (let st = 0; st <= 5; st++) {
      const Y = (tl.h * (k + st / 5)) / nL;
      const shadeK = 1 - st / 5;
      talInner += `<path d="${pts(rrect(tl.x0 + jx, tl.x1 + jx, tl.z0 + jz, tl.z1 + jz, tl.r, Y))}Z" fill="${mix('#efe6d6', '#a99d8a', shadeK * 0.7)}"/>`;
    }
  }
  const topF = rrect(tl.x0, tl.x1, tl.z0, tl.z1, tl.r, tl.h);
  const wool = nid('wl');
  talInner += `<defs>${ugrad(
    wool,
    [
      [0, '#fbf5ea'],
      [1, '#e3d9c8'],
    ],
    [0, topF[12][1], 0, topF[0][1]],
  )}</defs><path d="${pts(topF)}Z" fill="url(#${wool})"/>`;
  // the stripes across the top: navy, sky blue, a hair of gold
  const stripes = [
    [0.0, 0.028, C.navy],
    [0.034, 0.007, C.gold],
    [0.046, 0.011, C.sky],
    [0.062, 0.011, C.navy],
    [0.078, 0.011, C.sky],
    [0.094, 0.007, C.gold],
    [0.106, 0.028, C.navy],
  ];
  let str = '';
  for (const [o, w, c] of stripes) {
    const xa = tl.x0 + 0.03 + o;
    str += poly(
      [
        p([xa, tl.h, tl.z0]),
        p([xa + w, tl.h, tl.z0]),
        p([xa + w, tl.h, tl.z1 + 0.01]),
        p([xa, tl.h, tl.z1 + 0.01]),
      ],
      `fill="${c}" opacity=".9"`,
    );
    // and down over the folded front
    str += poly(
      [p([xa, tl.h, tl.z0]), p([xa + w, tl.h, tl.z0]), p([xa + w, 0.004, tl.z0]), p([xa, 0.004, tl.z0])],
      `fill="${mix(c, '#6d6456', 0.3)}" opacity=".85"`,
    );
  }
  talInner += str;
  talInner += `<path d="${pts(topF)}Z" fill="none" stroke="#fff8ec" stroke-width="2" opacity=".5"/>`;
  talInner += glow({
    x: p([0.25, tl.h, tl.z1])[0],
    y: p([0.25, tl.h, tl.z1])[1],
    rx: 180,
    ry: 36,
    color: '#fff7e6',
    a: 0.5,
  });
  talInner += noiseTex({
    box: [500, 1150, 520, 260],
    color: '#8f8472',
    a: 0.18,
    freq: [0.6, 0.15],
    oct: 2,
    seed: 23,
    k: 1.2,
    b: -0.3,
  });
  tal += soft({ box: [420, 1120, 640, 320], blur: 1.1, disp: 5, freq: 0.035, oct: 2, seed: 19 }, talInner);
  // the prayer book: a plain dark leather cover, gilt edges, a burgundy ribbon
  const bk = { cx: 0.285, cz: 1.33, w: 0.15, d: 0.215, h: 0.038, rot: -0.2 };
  const B = (u, v, yy) => {
    const [cu, su] = [Math.cos(bk.rot), Math.sin(bk.rot)];
    return p([bk.cx + u * cu - v * su, tl.h + yy, bk.cz + u * su + v * cu]);
  };
  const [hu, hv] = [bk.w / 2, bk.d / 2];
  let book = blurred(
    9,
    poly(
      [B(-hu - 0.01, -hv - 0.04, 0), B(hu + 0.02, -hv - 0.05, 0), B(hu + 0.02, hv, 0), B(-hu, hv, 0)],
      'fill="#2a1a10" opacity=".5"',
    ),
  );
  // the ribbon falling from the pages over the front edge
  const rb0 = B(0.02, -hv, bk.h * 0.6);
  const rb1 = p([bk.cx + 0.07, 0.0, tl.z0 - 0.03]);
  book += `<path d="M${r1(rb0[0])} ${r1(rb0[1])}C${r1(rb0[0] + 4)} ${r1(rb0[1] + 30)} ${r1(rb1[0] - 10)} ${r1(rb1[1] - 30)} ${r1(rb1[0])} ${r1(rb1[1])}" stroke="${C.burgundy}" stroke-width="7" fill="none"/>`;
  // the page block (gilt), then the boards
  book += poly(
    [
      B(-hu + 0.004, -hv + 0.002, 0.003),
      B(hu - 0.004, -hv + 0.002, 0.003),
      B(hu - 0.004, -hv + 0.002, bk.h - 0.004),
      B(-hu + 0.004, -hv + 0.002, bk.h - 0.004),
    ],
    `fill="${C.gold}"`,
  );
  book += poly(
    [
      B(hu - 0.004, -hv, 0.003),
      B(hu - 0.004, hv, 0.003),
      B(hu - 0.004, hv, bk.h - 0.004),
      B(hu - 0.004, -hv, bk.h - 0.004),
    ],
    'fill="#a5823f"',
  );
  book += poly([B(-hu, -hv, 0), B(hu, -hv, 0), B(hu, -hv, 0.004), B(-hu, -hv, 0.004)], 'fill="#2a1d18"');
  book += poly([B(hu, -hv, 0), B(hu, hv, 0), B(hu, hv, 0.004), B(hu, -hv, 0.004)], 'fill="#241915"');
  const cv = nid('cv');
  const c0 = B(-hu, hv, bk.h);
  const c1 = B(hu, -hv, bk.h);
  book += `<defs>${ugrad(
    cv,
    [
      [0, '#5d4234'],
      [0.45, '#3b2a24'],
      [1, '#281c19'],
    ],
    [c0[0], c0[1], c1[0], c1[1]],
  )}</defs>`;
  book += poly(
    [B(-hu, -hv, bk.h), B(hu, -hv, bk.h), B(hu, hv, bk.h), B(-hu, hv, bk.h)],
    `fill="url(#${cv})"`,
  );
  book += poly(
    [B(-hu, -hv, bk.h), B(hu, -hv, bk.h), B(hu, -hv, bk.h - 0.005), B(-hu, -hv, bk.h - 0.005)],
    'fill="#1f1614"',
  );
  book += `<path d="${pts([B(-hu + 0.012, -hv + 0.014, bk.h), B(hu - 0.012, -hv + 0.014, bk.h), B(hu - 0.012, hv - 0.014, bk.h), B(-hu + 0.012, hv - 0.014, bk.h)])}Z" fill="none" stroke="#6d4f3e" stroke-width="1.5" opacity=".65"/>`;
  book += `<path d="${pts([B(-hu, -hv, bk.h - 0.002), B(-hu, hv, bk.h - 0.002)])}" stroke="#6b4d3e" stroke-width="4" opacity=".8"/>`;
  const sh1 = B(-hu * 0.1, hv, bk.h);
  const sh2 = B(hu * 0.5, -hv * 0.4, bk.h);
  book += blurred(
    7,
    `<path d="M${r1(sh1[0])} ${r1(sh1[1])}L${r1(sh2[0])} ${r1(sh2[1])}" stroke="#e0c29c" stroke-width="14" opacity=".3"/>`,
  );
  tal += blurred(0.5, book);
  s += tal;

  // the air: the morning's warm haze, a few motes in the light, a lens vignette
  s += veil('#efe0c4', [
    [300, 0],
    [700, 0.07],
    [1150, 0.09],
    [1500, 0],
  ]);
  s += motes({
    area: [
      [330, 560],
      [760, 470],
      [520, 1500],
      [80, 1560],
    ],
    n: 55,
    r: [0.8, 2.2],
    a: [0.2, 0.6],
    seed: 3,
  });
  s += vignette(0.45, '#2c2426');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 2. the synagogue in the morning: a stone hall under a barrel vault, sun falling through tall arched
//    windows in long dusty shafts, rows of wooden benches, a brass chandelier, the Holy Ark at the far end

/** a shaft between an aperture and its landing, both screen polygons: fading from the aperture, blurred */
const shaftBetween = ({ from, to, color = '#fff0cf', a = 0.3, fade = 0.2, blur = 14, blend = 'screen' }) => {
  const hull = hullOf(from.concat(to));
  const c0 = from.reduce((s, q) => [s[0] + q[0] / from.length, s[1] + q[1] / from.length], [0, 0]);
  const c1 = to.reduce((s, q) => [s[0] + q[0] / to.length, s[1] + q[1] / to.length], [0, 0]);
  const g = nid('sb');
  const f = nid('sbf');
  return {
    hull,
    svg: `<defs>${ugrad(
      g,
      [
        [0, color, a],
        [0.5, color, r3(a * 0.65)],
        [1, color, r3(a * fade)],
      ],
      [c0[0], c0[1], c1[0], c1[1]],
    )}<filter id="${f}" x="-300" y="-300" width="${W + 600}" height="${H + 600}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><path d="${pts(hull)}Z" fill="url(#${g})" filter="url(#${f})" style="mix-blend-mode:${blend}"/>`,
  };
};

/** a brass chandelier (Dutch style): a baluster stem, a great ball, two tiers of S-arms with candle lights */
const chandelier = ({ x, y, s, seed = 1 }) => {
  const rnd = prng(seed * 97 + 1);
  const br = nid('br');
  let out = `<defs>${rgradDef(
    br,
    [
      [0, '#fff1c8'],
      [0.25, '#e4bd72'],
      [0.6, '#a67a38'],
      [1, '#4e3718'],
    ],
    { cx: 0.38, cy: 0.35, r: 0.7 },
  )}</defs>`;
  out += `<path d="M${r1(x)} -40V${r1(y - s * 1.1)}" stroke="#4a3a24" stroke-width="${r1(s * 0.035)}"/>`;
  // the stem: rings and knops
  for (const [dy, rx, ry] of [
    [-1.05, 0.07, 0.05],
    [-0.9, 0.1, 0.07],
    [-0.7, 0.07, 0.12],
    [-0.45, 0.12, 0.08],
    [-0.25, 0.08, 0.1],
  ])
    out += `<ellipse cx="${r1(x)}" cy="${r1(y + dy * s)}" rx="${r1(rx * s)}" ry="${r1(ry * s)}" fill="url(#${br})"/>`;
  out += `<rect x="${r1(x - 0.03 * s)}" y="${r1(y - 1.1 * s)}" width="${r1(0.06 * s)}" height="${r1(1.1 * s)}" fill="url(#${br})"/>`;
  // arms: two tiers, seen a little from below (the far arms higher on screen, fainter)
  const tiers = [
    { dy: 0.05, rx: 0.95, ry: 0.16, n: 8, up: 0.38 },
    { dy: -0.5, rx: 0.62, ry: 0.1, n: 6, up: 0.3 },
  ];
  const lights = [];
  for (const t of tiers) {
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2 + 0.3;
      const ex = x + Math.cos(a) * t.rx * s;
      const ey = y + t.dy * s + Math.sin(a) * t.ry * s;
      const front = Math.sin(a) > 0;
      const c1 = [x + Math.cos(a) * t.rx * s * 0.3, y + t.dy * s + 0.28 * s];
      const c2 = [ex - Math.cos(a) * 0.1 * s, ey + 0.3 * s];
      const arm = `<path d="M${r1(x)} ${r1(y + t.dy * s + 0.12 * s)}C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(ex)} ${r1(ey - 0.02 * s)}" stroke="${front ? '#c89a52' : '#8a6a3a'}" stroke-width="${r1(s * 0.035)}" fill="none"/>`;
      const cup = `<ellipse cx="${r1(ex)}" cy="${r1(ey)}" rx="${r1(0.07 * s)}" ry="${r1(0.025 * s)}" fill="url(#${br})"/><rect x="${r1(ex - 0.015 * s)}" y="${r1(ey - t.up * s * 0.4)}" width="${r1(0.03 * s)}" height="${r1(t.up * s * 0.4)}" fill="#e3cfa4"/>`;
      lights.push({ x: ex, y: ey - t.up * s * 0.4 - 0.03 * s, front, a });
      out = front ? out + arm + cup : arm + cup + out;
    }
  }
  // the great ball
  out += `<circle cx="${r1(x)}" cy="${r1(y + 0.28 * s)}" r="${r1(0.24 * s)}" fill="url(#${br})"/>`;
  out += `<ellipse cx="${r1(x - 0.07 * s)}" cy="${r1(y + 0.2 * s)}" rx="${r1(0.06 * s)}" ry="${r1(0.04 * s)}" fill="#fff6dc" opacity=".7"/>`;
  out += `<path d="M${r1(x)} ${r1(y + 0.52 * s)}q${r1(0.02 * s)} ${r1(0.08 * s)} 0 ${r1(0.14 * s)}" stroke="#a67a38" stroke-width="${r1(0.03 * s)}" fill="none"/>`;
  // the candle lights: small warm flames with halos
  let fl = '';
  for (const l of lights) {
    fl += glow({ x: l.x, y: l.y, rx: 0.16 * s, color: '#ffd89a', a: l.front ? 0.55 : 0.35, blend: 'screen' });
    fl += `<ellipse cx="${r1(l.x)}" cy="${r1(l.y)}" rx="${r1(0.016 * s)}" ry="${r1(0.034 * s)}" fill="#fff4d6" opacity="${l.front ? 0.95 : 0.7}"/>`;
  }
  out +=
    fl +
    glow({
      x,
      y: y - 0.1 * s,
      rx: 1.3 * s,
      ry: 0.9 * s,
      color: '#f5cf8e',
      a: 0.18 * (0.8 + rnd() * 0.4),
      blend: 'screen',
    });
  return out;
};

const shul = () => {
  const rnd = prng(222);
  const f = 740;
  const cam = camera({ f, vx: 540, vy: 1080, eye: 1.6 });
  const { p } = cam;
  const HW = 4.6; // half the hall's width
  const Zf = 12.5; // the Ark wall
  const WH = 7.2; // the walls' height (the vault springs here)
  const Z0 = 4; // nearest drawn
  const stone = (Z, Y, r) =>
    mix(
      mix('#806848', '#d2b98c', clamp(0.25 + (Z - 6) / 12 + (Y < 4 ? 0.08 : 0))),
      mix('#c9b48b', '#b89e78', r()),
      0.2 + r() * 0.15,
    );

  // the vault: a barrel of warm stone over the hall, its far lunette lit by a round window
  let s = skyFill([
    [0, '#4b3a2b'],
    [0.3, '#7a6147'],
    [0.6, '#a78a64'],
    [1, '#6d5540'],
  ]);
  const vaultArc = (Z, n = 48) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI + (Math.PI * i) / n;
      return p([HW * Math.cos(a), WH - HW * Math.sin(a), Z]);
    });
  let vault = '';
  const ribsZ = [5.2, 7.6, 10, Zf];
  for (let zi = ribsZ.length - 1; zi > 0; zi--) {
    const za = ribsZ[zi - 1];
    const zb = ribsZ[zi];
    // courses of the vault between two ribs
    for (let k = 0; k < 16; k++) {
      const a0 = Math.PI + (Math.PI * k) / 16;
      const a1 = Math.PI + (Math.PI * (k + 1)) / 16;
      const q = (a, Z) => p([HW * Math.cos(a), WH - HW * Math.sin(a), Z]);
      const lit = 0.15 + (k > 8 ? 0.12 : 0) + (zb / Zf) * 0.35;
      vault += poly(
        [q(a0, za), q(a1, za), q(a1, zb), q(a0, zb)],
        `fill="${mix(mix('#6b523a', '#cdb489', lit), '#a88c64', rnd() * 0.2)}"`,
      );
    }
  }
  // transverse ribs
  for (const Z of ribsZ.slice(0, -1)) {
    const outer = vaultArc(Z);
    const inner = vaultArc(Z + 0.35).reverse();
    vault += poly(outer.concat(inner), `fill="${mix('#a88d64', '#dcc59a', Z / Zf)}"`);
    vault += `<path d="${pts(outer)}" stroke="#6d5640" stroke-width="3" fill="none" opacity=".5"/>`;
  }
  s += under(
    stoneTex({ freq: 0.03, relief: 2, tex: 0.36, seed: 21, patch: 0.14, patchColor: '#6a5238' }),
    vault,
  );

  // the side walls: ashlar courses in perspective, windows in each bay
  let walls = '';
  const winZ = [
    [5.8, 6.9],
    [8.3, 9.3],
    [10.7, 11.6],
  ];
  const wy0 = 2.9;
  const wy1 = 5.5;
  for (const side of [-1, 1]) {
    const X = side * HW;
    walls += cam.poly(
      [
        [X, 0, Z0],
        [X, WH, Z0],
        [X, WH, Zf],
        [X, 0, Zf],
      ],
      'fill="#a58b66"',
    );
    let Y = 0;
    while (Y < WH) {
      const ch = 0.42 + rnd() * 0.1;
      let zz = Z0 - rnd() * 0.6;
      while (zz < Zf) {
        const l = 0.6 + rnd() * 0.7;
        const z1 = Math.min(Zf, zz + l);
        walls += cam.poly(
          [
            [X, Y + 0.025, Math.max(Z0, zz) + 0.03],
            [X, Math.min(WH, Y + ch) - 0.025, Math.max(Z0, zz) + 0.03],
            [X, Math.min(WH, Y + ch) - 0.025, z1 - 0.03],
            [X, Y + 0.025, z1 - 0.03],
          ],
          `fill="${stone((zz + z1) / 2, Y, rnd)}"`,
        );
        zz = z1;
      }
      Y += ch;
    }
  }
  s += under(
    stoneTex({ freq: 0.04, relief: 2.2, tex: 0.4, seed: 23, patch: 0.14, patchColor: '#6d5a42' }),
    walls,
  );
  // the windows: the glass glowing, the embrasure lit; the left side in full sun
  const apertures = [];
  let wins = '';
  for (const side of [-1, 1]) {
    for (const [za, zb] of winZ) {
      const X = side * HW;
      const hwz = (zb - za) / 2;
      const zc = (za + zb) / 2;
      const outline = [[X, wy0, za]];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (Math.PI * i) / 16;
        outline.push([X, wy1 - hwz * Math.sin(a) * 1.1, zc + hwz * Math.cos(a)]);
      }
      outline.push([X, wy0, zb]);
      const scr = outline.map(p);
      const sunny = side < 0;
      const gid = nid('wg');
      const xs = scr.map((q) => q[0]);
      wins += `<defs>${ugrad(
        gid,
        sunny
          ? [
              [0, '#fff6df'],
              [0.62, '#fbe6bd'],
              [0.66, '#e9cf9f'],
              [1, '#d4b584'],
            ]
          : [
              [0, '#b89c74'],
              [0.34, '#d7c29c'],
              [0.38, '#e8ecea'],
              [1, '#dfe8ec'],
            ],
        [Math.min(...xs), 0, Math.max(...xs), 0],
      )}</defs><path d="${pts(scr)}Z" fill="url(#${gid})"/>`;
      // a mullion and the glazing
      const m0 = p([X, wy0, zc]);
      const m1 = p([X, wy1 + hwz * 1.1, zc]);
      wins += `<path d="M${r1(m0[0])} ${r1(m0[1])}L${r1(m1[0])} ${r1(m1[1])}" stroke="${sunny ? '#caa56c' : '#9a8566'}" stroke-width="${r1((f / zc) * 0.06)}" opacity=".6"/>`;
      wins += glow({
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (m0[1] + m1[1]) / 2,
        rx: (f / zc) * 1.4,
        ry: (f / zc) * 2.4,
        color: sunny ? '#ffe7b5' : '#e9ecef',
        a: sunny ? 0.45 : 0.22,
        blend: 'screen',
      });
      if (sunny) apertures.push(outline);
    }
  }
  s += wins;

  // the far wall and the Ark
  const farWall = [p([-HW, 0, Zf]), p([-HW, WH, Zf]), ...vaultArc(Zf), p([HW, WH, Zf]), p([HW, 0, Zf])];
  let far = poly(farWall, 'fill="#d3bd93"');
  far += ashlar({
    x0: p([-HW, 0, Zf])[0],
    x1: p([HW, 0, Zf])[0],
    yTop: vaultArc(Zf)[24][1],
    yBot: p([0, 0, Zf])[1],
    course: 0.42 * (f / Zf),
    len: 0.9 * (f / Zf),
    seed: 5,
    tone: (xx, yy, r) =>
      mix(mix('#e2cda3', '#cdb58b', r()), '#f0dfb8', clamp(1 - Math.abs(xx - 540) / 260) * 0.4),
    joint: 1.2,
    jointColor: '#c2a982',
    lit: '#efe0c0',
    dark: '#b59c78',
  });
  const farC = clipOf(farWall);
  s += `${farC.defs}<g clip-path="url(#${farC.id})">${under(stoneTex({ freq: 0.05, relief: 1.8, tex: 0.35, seed: 27, patch: 0.1 }), far)}</g>`;
  // the round window above the Ark
  const [ox, oy] = p([0, 8.6, Zf]);
  const orad = 0.95 * (f / Zf);
  s += glow({ x: ox, y: oy, rx: orad * 4, color: '#fbe7bf', a: 0.35, blend: 'screen' });
  s += `<circle cx="${r1(ox)}" cy="${r1(oy)}" r="${r1(orad * 1.25)}" fill="#c9ae82"/><circle cx="${r1(ox)}" cy="${r1(oy)}" r="${r1(orad)}" fill="#fff1d2"/>`;
  let spokes = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spokes += `M${r1(ox)} ${r1(oy)}L${r1(ox + Math.cos(a) * orad)} ${r1(oy + Math.sin(a) * orad)}`;
  }
  s += `<path d="${spokes}" stroke="#d9bf8f" stroke-width="2.4" opacity=".8"/><circle cx="${r1(ox)}" cy="${r1(oy)}" r="${r1(orad * 0.3)}" fill="none" stroke="#d9bf8f" stroke-width="2.4" opacity=".8"/>`;

  // the Ark: a platform of three steps, columns, an arched crest, the curtain of burgundy velvet
  const A = (X, Y, Z = Zf - 0.05) => p([X, Y, Z]);
  let ark = '';
  for (let i = 0; i < 3; i++) {
    const zf = Zf - 1.4 + i * 0.35;
    const y0 = i * 0.18;
    ark += cam.poly(
      [
        [-2.4, y0, zf],
        [2.4, y0, zf],
        [2.4, y0 + 0.18, zf],
        [-2.4, y0 + 0.18, zf],
      ],
      `fill="${mix('#b89c74', '#d8c29a', i / 3)}"`,
    );
    ark += cam.poly(
      [
        [-2.4, y0 + 0.18, zf],
        [2.4, y0 + 0.18, zf],
        [2.4, y0 + 0.18, zf + 0.35],
        [-2.4, y0 + 0.18, zf + 0.35],
      ],
      `fill="${mix('#e6d3ac', '#f3e4c4', i / 3)}"`,
    );
  }
  // the cabinet's frame (carved wood, gilded edges)
  const cab = [A(-1.5, 0.54), A(-1.5, 4.1), A(1.5, 4.1), A(1.5, 0.54)];
  ark += poly(cab, 'fill="#5a3a26"');
  // the curtain: burgundy velvet, folds, a gold border and a gold crown, a valance with fringe
  const cx0 = A(-1.08, 0.62)[0];
  const cx1 = A(1.08, 0.62)[0];
  const cy0 = A(0, 3.55)[1];
  const cy1 = A(0, 0.62)[1];
  const vel = nid('vl');
  const vstops = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const v = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 5.5 + 0.6);
    vstops.push([r3(t), mix(mix('#8e3040', '#4a1520', v), '#6B1F2E', 0.3 + 0.3 * Math.abs(t - 0.5))]);
  }
  ark += `<defs>${ugrad(vel, vstops, [cx0, 0, cx1, 0])}</defs><rect x="${r1(cx0)}" y="${r1(cy0)}" width="${r1(cx1 - cx0)}" height="${r1(cy1 - cy0)}" fill="url(#${vel})"/>`;
  const bw = (cx1 - cx0) * 0.06;
  ark += `<rect x="${r1(cx0 + bw)}" y="${r1(cy0 + bw * 2.4)}" width="${r1(cx1 - cx0 - 2 * bw)}" height="${r1(cy1 - cy0 - bw * 3.4)}" fill="none" stroke="${C.gold}" stroke-width="${r1(bw * 0.45)}" opacity=".85"/>`;
  // the crown: a band, five points with pearls, an arch over it
  const kx = (cx0 + cx1) / 2;
  const ky = cy0 + (cy1 - cy0) * 0.42;
  const ks = (cx1 - cx0) * 0.2;
  const crownPath = `M${r1(kx - ks)} ${r1(ky + ks * 0.55)}L${r1(kx - ks * 1.1)} ${r1(ky - ks * 0.45)}L${r1(kx - ks * 0.55)} ${r1(ky + ks * 0.05)}L${r1(kx)} ${r1(ky - ks * 0.7)}L${r1(kx + ks * 0.55)} ${r1(ky + ks * 0.05)}L${r1(kx + ks * 1.1)} ${r1(ky - ks * 0.45)}L${r1(kx + ks)} ${r1(ky + ks * 0.55)}Z`;
  ark += `<path d="${crownPath}" fill="${C.gold}" opacity=".95"/><rect x="${r1(kx - ks)}" y="${r1(ky + ks * 0.5)}" width="${r1(ks * 2)}" height="${r1(ks * 0.26)}" fill="#e2c07a"/>`;
  for (const dx of [-1.1, -0.55, 0, 0.55, 1.1])
    ark += `<circle cx="${r1(kx + dx * ks)}" cy="${r1(ky - (dx === 0 ? 0.78 : Math.abs(dx) > 1 ? 0.53 : -0.02) * ks)}" r="${r1(ks * 0.09)}" fill="#f3dfae"/>`;
  // vine scrolls under the crown, in gold thread
  ark += `<path d="M${r1(kx - ks * 1.6)} ${r1(ky + ks * 1.4)}q${r1(ks * 0.8)} ${r1(-ks * 0.6)} ${r1(ks * 1.6)} 0t${r1(ks * 1.6)} 0" stroke="${C.gold}" stroke-width="${r1(ks * 0.09)}" fill="none" opacity=".8"/>`;
  // the valance with a scalloped gold fringe
  const vy0 = A(0, 3.95)[1];
  ark += `<rect x="${r1(cx0 - bw)}" y="${r1(vy0)}" width="${r1(cx1 - cx0 + 2 * bw)}" height="${r1(cy0 - vy0 + bw * 1.5)}" fill="#5a1826"/>`;
  let scal = '';
  const nsc = 7;
  for (let i = 0; i < nsc; i++) {
    const xa = cx0 - bw + ((cx1 - cx0 + 2 * bw) * i) / nsc;
    const xb = cx0 - bw + ((cx1 - cx0 + 2 * bw) * (i + 1)) / nsc;
    scal += `<path d="M${r1(xa)} ${r1(cy0 + bw * 1.5)}Q${r1((xa + xb) / 2)} ${r1(cy0 + bw * 4)} ${r1(xb)} ${r1(cy0 + bw * 1.5)}" stroke="${C.gold}" stroke-width="${r1(bw * 0.5)}" fill="#5a1826"/>`;
  }
  ark +=
    scal +
    `<rect x="${r1(cx0 - bw)}" y="${r1(vy0 + bw * 0.4)}" width="${r1(cx1 - cx0 + 2 * bw)}" height="${r1(bw * 0.35)}" fill="${C.gold}" opacity=".8"/>`;
  // the columns with gilt capitals
  for (const sd of [-1, 1]) {
    const c0 = A(sd * 1.32, 0.54);
    const c1 = A(sd * 1.32, 4.1);
    const cw = 0.16 * (f / Zf);
    const cg = nid('cl');
    ark += `<defs>${ugrad(
      cg,
      [
        [0, '#6b4a30'],
        [0.35, '#d8b77a'],
        [0.6, '#9c7445'],
        [1, '#4d3322'],
      ],
      [c0[0] - cw, 0, c0[0] + cw, 0],
    )}</defs><rect x="${r1(c0[0] - cw)}" y="${r1(c1[1])}" width="${r1(cw * 2)}" height="${r1(c0[1] - c1[1])}" fill="url(#${cg})"/><rect x="${r1(c0[0] - cw * 1.5)}" y="${r1(c1[1] - cw * 0.4)}" width="${r1(cw * 3)}" height="${r1(cw * 0.9)}" fill="${C.gold}"/>`;
  }
  // the entablature and the arched crest with a gilt crown on top
  const e0 = A(-1.7, 4.1);
  const e1 = A(1.7, 4.55);
  ark += `<rect x="${r1(e0[0])}" y="${r1(e1[1])}" width="${r1(e1[0] - e0[0])}" height="${r1(e0[1] - e1[1])}" fill="#6b4630"/><rect x="${r1(e0[0])}" y="${r1(e1[1])}" width="${r1(e1[0] - e0[0])}" height="${r1((e0[1] - e1[1]) * 0.25)}" fill="${C.gold}" opacity=".85"/>`;
  const crest = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (Math.PI * i) / 24;
    crest.push(A(1.35 * Math.cos(a), 4.55 - 1.0 * Math.sin(a)));
  }
  ark += `<path d="${pts(crest)}Z" fill="#5e3d29"/><path d="${pts(crest)}" stroke="${C.gold}" stroke-width="3" fill="none" opacity=".85"/>`;
  const [tcx, tcy] = A(0, 5.35);
  const ts = 0.34 * (f / Zf);
  ark += `<path d="M${r1(tcx - ts)} ${r1(tcy + ts * 0.5)}L${r1(tcx - ts * 1.1)} ${r1(tcy - ts * 0.4)}L${r1(tcx - ts * 0.5)} ${r1(tcy)}L${r1(tcx)} ${r1(tcy - ts * 0.7)}L${r1(tcx + ts * 0.5)} ${r1(tcy)}L${r1(tcx + ts * 1.1)} ${r1(tcy - ts * 0.4)}L${r1(tcx + ts)} ${r1(tcy + ts * 0.5)}Z" fill="#dcb766"/>`;
  s += blurred(0.9, ark);
  // the eternal light before the Ark
  const [nx, ny] = p([0, 4.9, Zf - 1.6]);
  s += `<path d="M${r1(nx)} ${r1(p([0, 9, Zf - 1.6])[1])}V${r1(ny - 12)}" stroke="#5a4630" stroke-width="1.6" opacity=".7"/>`;
  s += `<path d="M${r1(nx - 9)} ${r1(ny - 10)}H${r1(nx + 9)}L${r1(nx + 6)} ${r1(ny + 6)}Q${r1(nx)} ${r1(ny + 14)} ${r1(nx - 6)} ${r1(ny + 6)}Z" fill="#b8893f"/>`;
  s +=
    glow({ x: nx, y: ny + 2, rx: 38, color: '#ff9a5a', a: 0.6, blend: 'screen' }) +
    `<ellipse cx="${r1(nx)}" cy="${r1(ny + 1)}" rx="4" ry="5" fill="#ffd9a6"/>`;
  s += glow({ x: 540, y: p([0, 2.2, Zf])[1], rx: 260, ry: 300, color: '#f4d9a6', a: 0.28, blend: 'screen' });

  // the floor: flagstones, a burgundy runner up the aisle
  const fl0 = p([0, 0, Zf])[1];
  let floor = box(0, fl0 - 2, W, H - fl0 + 2, 'fill="#a58a66"');
  for (let zz = 2; zz < Zf;) {
    const dz = 0.7 + rnd() * 0.2;
    let xx = -HW - rnd() * 0.5;
    while (xx < HW) {
      const w = 0.6 + rnd() * 0.5;
      floor += cam.poly(
        [
          [xx + 0.02, 0, zz + 0.02],
          [xx + w - 0.02, 0, zz + 0.02],
          [xx + w - 0.02, 0, zz + dz - 0.02],
          [xx + 0.02, 0, zz + dz - 0.02],
        ],
        `fill="${mix(mix('#cdb48c', '#b59a74', rnd()), '#e3cfa6', clamp((zz - 4) / 10) * 0.5)}"`,
      );
      xx += w;
    }
    zz += dz;
  }
  const runner = [
    p([-0.6, 0.01, 1.5]),
    p([0.6, 0.01, 1.5]),
    p([0.6, 0.01, Zf - 1.45]),
    p([-0.6, 0.01, Zf - 1.45]),
  ];
  floor += poly(runner, 'fill="#5c1a27"');
  floor += clipped(
    runner,
    noiseTex({
      box: [0, 1100, W, 820],
      color: '#8a3444',
      a: 0.35,
      freq: [0.05, 0.02],
      seed: 33,
      k: 1.5,
      b: -0.5,
    }),
  );
  for (const sd of [-1, 1])
    floor += `<path d="${pts(
      stripX(
        cam,
        [
          [sd * 0.52, 0.012, 1.5],
          [sd * 0.52, 0.012, Zf - 1.45],
        ],
        0.02,
      ),
    )}Z" fill="${C.gold}" opacity=".7"/>`;
  s += under(stoneTex({ freq: 0.05, relief: 2, tex: 0.38, seed: 29, patch: 0.1 }), floor);

  // the benches: rows either side of the aisle, far to near; backs in warm wood, their top rails catching light
  let benches = '';
  for (let zz = Zf - 2.3; zz > 3.0; zz -= 0.95) {
    for (const sd of [-1, 1]) {
      const xi = sd * 0.95;
      const xo = sd * (HW - 0.3);
      const back = [
        [xi, 0.42, zz],
        [xo, 0.42, zz],
        [xo, 1.02, zz],
        [xi, 1.02, zz],
      ];
      const shadeK = clamp((zz - 2) / 9);
      benches += cam.poly(back, `fill="${mix('#5a3a24', '#8a6040', shadeK)}"`);
      // panels on the back
      for (let k = 0; k < 6; k++) {
        const xa = xi + ((xo - xi) * (k + 0.1)) / 6;
        const xb = xi + ((xo - xi) * (k + 0.9)) / 6;
        benches += cam.poly(
          [
            [xa, 0.52, zz - 0.005],
            [xb, 0.52, zz - 0.005],
            [xb, 0.9, zz - 0.005],
            [xa, 0.9, zz - 0.005],
          ],
          `fill="${mix('#4a2f1d', '#7a5436', shadeK)}" opacity=".7"`,
        );
      }
      // the top rail
      benches += cam.poly(
        [
          [xi, 1.02, zz - 0.04],
          [xo, 1.02, zz - 0.04],
          [xo, 1.02, zz + 0.06],
          [xi, 1.02, zz + 0.06],
        ],
        `fill="${mix('#a77b52', '#dcb382', shadeK)}"`,
      );
      benches += `<path d="${pts([p([xi, 1.02, zz - 0.04]), p([xo, 1.02, zz - 0.04])])}" stroke="#f1d3a2" stroke-width="${r1(Math.max(1, 12 / zz))}" opacity=".7"/>`;
      // the bench end facing the aisle: a panel with a rounded top
      const end = [
        [xi, 0, zz - 0.05],
        [xi, 1.0, zz - 0.05],
      ];
      for (let i = 0; i <= 8; i++) {
        const a = (Math.PI * i) / 8;
        end.push([xi, 1.0 + Math.sin(a) * 0.07, zz - 0.05 + (1 - Math.cos(a)) * 0.2]);
      }
      end.push([xi, 0.45, zz + 0.35], [xi, 0.45, zz + 0.4], [xi, 0, zz + 0.4]);
      benches += cam.poly(end, `fill="${mix('#6b4630', '#a47650', shadeK)}"`);
      benches += `<path d="${pts(end.slice(1, -1).map(p))}" stroke="#e9c795" stroke-width="${r1(Math.max(1, 10 / zz))}" fill="none" opacity=".55"/>`;
    }
  }
  s += blurred(0.7, benches);
  s += noiseTex({
    box: [0, 1150, W, H - 1150],
    color: '#2e1c10',
    a: 0.22,
    freq: [0.004, 0.05],
    seed: 31,
    k: 1.4,
    b: -0.4,
  });

  // the sun: shafts from the left windows across the hall, landing on the aisle and the right-hand benches
  const dir = [0.74, -0.52, -0.2];
  let shafts = '';
  let dustAreas = [];
  for (const ap of apertures) {
    const from = ap.map(p);
    const to = ap.map(([X, Y, Z]) => {
      const t = (Y - 0.5) / -dir[1];
      return p([X + dir[0] * t, 0.5, Z + dir[2] * t]);
    });
    const sh = shaftBetween({ from, to, color: '#ffe3ac', a: 0.42, fade: 0.3, blur: 6 });
    shafts += sh.svg;
    dustAreas.push(sh.hull);
    shafts += blurred(
      8,
      `<path d="${pts(to)}Z" fill="#ffe2ad" opacity=".5"/>`,
      'style="mix-blend-mode:screen"',
    );
  }
  s += shafts;
  for (const [i, area] of dustAreas.entries())
    s += motes({ area, n: 70, r: [0.7, 2.2], a: [0.25, 0.75], seed: 40 + i });

  // the chandelier hanging near us, upper right, a little soft
  s += blurred(2.6, chandelier({ x: 820, y: 330, s: 190, seed: 3 }));

  // warm haze in the air, deeper shade near us, a vignette
  s += veil('#f0dcb4', [
    [200, 0.03],
    [700, 0.08],
    [1150, 0.08],
    [1500, 0.02],
  ]);
  s += veil('#2a1c14', [
    [1300, 0],
    [1920, 0.35],
  ]);
  s += vignette(0.42, '#2c2224');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 3. the Torah: dressed in a burgundy velvet mantle, silver crowns on its rollers, a silver breastplate,
//    standing on the reading table's navy cloth in warm light, the synagogue lost in bokeh behind

/** silver: a horizontal gradient across a turned form (dark rims, a bright band, warm reflections) */
const silverGrad = (id, x0, x1, warm = 0.25) =>
  ugrad(
    id,
    [
      [0, '#2f2a2a'],
      [0.1, '#6d645e'],
      [0.24, '#d9d0c2'],
      [0.3, '#f1e9dc'],
      [0.38, mix('#b8ada0', '#d9b06a', warm)],
      [0.55, '#7d736b'],
      [0.72, '#4f4846'],
      [0.86, mix('#7a7068', '#b8905a', warm)],
      [1, '#2e2929'],
    ],
    [x0, 0, x1, 0],
  );

/** a silver crown finial on a roller: socket, knop, a pointed crown with pearls and bells, a cap, a ball */
const finial = (x, yBase, s) => {
  const g = nid('sv');
  let out = `<defs>${silverGrad(g, x - s, x + s)}</defs>`;
  const G = `url(#${g})`;
  // the socket: a slender stem swelling to a collar under the crown
  out += `<path d="M${r1(x - s * 0.17)} ${r1(yBase)}L${r1(x - s * 0.13)} ${r1(yBase - s * 0.55)}Q${r1(x - s * 0.34)} ${r1(yBase - s * 0.72)} ${r1(x - s * 0.3)} ${r1(yBase - s * 0.9)}L${r1(x + s * 0.3)} ${r1(yBase - s * 0.9)}Q${r1(x + s * 0.34)} ${r1(yBase - s * 0.72)} ${r1(x + s * 0.13)} ${r1(yBase - s * 0.55)}L${r1(x + s * 0.17)} ${r1(yBase)}Z" fill="${G}"/>`;
  out += `<rect x="${r1(x - s * 0.36)}" y="${r1(yBase - s * 1.0)}" width="${r1(s * 0.72)}" height="${r1(s * 0.1)}" rx="${r1(s * 0.04)}" fill="${G}"/>`;
  // the crown: a flared band, points with pearls, a closed cap
  const cb = yBase - s * 0.98;
  const ct = cb - s * 0.8;
  out += `<path d="M${r1(x - s * 0.72)} ${r1(cb)}L${r1(x + s * 0.72)} ${r1(cb)}L${r1(x + s * 0.8)} ${r1(ct)}L${r1(x - s * 0.8)} ${r1(ct)}Z" fill="${G}"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(cb)}" rx="${r1(s * 0.74)}" ry="${r1(s * 0.13)}" fill="${G}"/>`;
  // a gilt band with engraved lines, the crown's arches
  const gb = nid('gb');
  out += `<defs>${ugrad(
    gb,
    [
      [0, '#5a4220'],
      [0.28, '#f0d18e'],
      [0.45, '#c9a45c'],
      [0.8, '#6e5226'],
      [1, '#4a3618'],
    ],
    [x - s * 0.8, 0, x + s * 0.8, 0],
  )}</defs><path d="M${r1(x - s * 0.72)} ${r1(cb - s * 0.36)}Q${r1(x)} ${r1(cb - s * 0.26)} ${r1(x + s * 0.72)} ${r1(cb - s * 0.36)}L${r1(x + s * 0.76)} ${r1(cb - s * 0.56)}Q${r1(x)} ${r1(cb - s * 0.46)} ${r1(x - s * 0.76)} ${r1(cb - s * 0.56)}Z" fill="url(#${gb})"/>`;
  for (const u of [-0.5, -0.17, 0.17, 0.5])
    out += `<path d="M${r1(x + u * s * 1.3)} ${r1(ct)}L${r1(x + u * s * 1.1)} ${r1(cb - s * 0.1)}" stroke="#3e3836" stroke-width="${r1(s * 0.03)}" opacity=".5"/>`;
  // the points
  let pts5 = `M${r1(x - s * 0.8)} ${r1(ct)}`;
  for (let i = 0; i < 5; i++) {
    const xa = x - s * 0.8 + (s * 1.6 * i) / 5;
    const xb = x - s * 0.8 + (s * 1.6 * (i + 1)) / 5;
    pts5 += `L${r1((xa + xb) / 2)} ${r1(ct - s * (i === 2 ? 0.5 : 0.4))}L${r1(xb)} ${r1(ct)}`;
  }
  out += `<path d="${pts5}Z" fill="${G}"/>`;
  for (let i = 0; i < 5; i++) {
    const xm = x - s * 0.8 + (s * 1.6 * (i + 0.5)) / 5;
    out += `<circle cx="${r1(xm)}" cy="${r1(ct - s * (i === 2 ? 0.55 : 0.45))}" r="${r1(s * 0.08)}" fill="#f6f1e8"/>`;
  }
  // the cap and ball
  out += `<path d="M${r1(x - s * 0.5)} ${r1(ct)}Q${r1(x)} ${r1(ct - s * 1.05)} ${r1(x + s * 0.5)} ${r1(ct)}Z" fill="${G}" opacity=".95"/>`;
  out += `<circle cx="${r1(x)}" cy="${r1(ct - s * 0.72)}" r="${r1(s * 0.14)}" fill="${G}"/>`;
  // the crown's shadow on the collar
  out += `<ellipse cx="${r1(x)}" cy="${r1(cb + s * 0.06)}" rx="${r1(s * 0.5)}" ry="${r1(s * 0.06)}" fill="#1f1a1a" opacity=".35"/>`;
  return out;
};

const torah = () => {
  const rnd = prng(333);
  const cx = 540;
  // the synagogue behind, out of focus: warm air, a window's light, the shapes of arches, bokeh
  let s = skyFill([
    [0, '#34241c'],
    [0.2, '#62452f'],
    [0.42, '#94704a'],
    [0.6, '#8a6646'],
    [0.8, '#533c2e'],
    [1, '#35261f'],
  ]);
  s += glow({ x: 200, y: 420, rx: 720, ry: 840, color: '#f4d59c', a: 0.55 });
  s += glow({ x: 900, y: 640, rx: 520, ry: 700, color: '#dcae72', a: 0.32 });
  s += glow({ x: 540, y: 820, rx: 420, ry: 420, color: '#f3cf92', a: 0.25 });
  // soft arches and a pillar, far away
  s += blurred(
    26,
    `<path d="M-60 1500V620A230 230 0 0 1 400 620V1500Z" fill="#f0d49e" opacity=".22"/><path d="M700 1500V560A200 200 0 0 1 1100 560V1500Z" fill="#e6c48c" opacity=".16"/><rect x="480" y="200" width="120" height="1300" fill="#4a3526" opacity=".25"/>`,
  );
  s += bokeh({
    n: 44,
    area: [-40, 60, W + 40, 1250],
    r: [22, 78],
    colors: ['#f6d895', '#fbe7c0', '#f1c27a', '#c7d4de'],
    a: [0.14, 0.42],
    seed: 5,
    blur: 3.5,
  });
  s += bokeh({
    n: 26,
    area: [0, 100, W, 1400],
    r: [8, 20],
    colors: ['#fff0cf', '#f3cf8e'],
    a: [0.2, 0.5],
    seed: 9,
    blur: 1.5,
  });
  s += veil('#c9a372', [
    [500, 0],
    [1000, 0.12],
    [1500, 0.05],
  ]);

  // a reverent warm halo behind the scroll
  s += glow({ x: 540, y: 1000, rx: 420, ry: 560, color: '#f6d8a2', a: 0.35, blend: 'screen' });
  // the reading table: navy velvet over it, the top lit, a gold band and fringe along its edge
  const ty0 = 1548;
  const ty1 = 1622;
  let tb = `<defs>${ugrad(
    'tbt',
    [
      [0, '#39466a'],
      [1, '#4d5d80'],
    ],
    [0, ty0, 0, ty1],
  )}${ugrad(
    'tbf',
    [
      [0, '#323f60'],
      [0.4, '#26304a'],
      [1, '#1b2236'],
    ],
    [0, ty1, 0, H],
  )}</defs>`;
  tb += `<path d="M-40 ${ty0}Q540 ${ty0 - 18} ${W + 40} ${ty0}V${ty1}H-40Z" fill="url(#tbt)"/>`;
  tb += box(-40, ty1, W + 80, H - ty1 + 40, 'fill="url(#tbf)"');
  // the cloth's soft folds below the edge
  let fo = '';
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 125 + rnd() * 40;
    fo += `<path d="M${r1(x)} ${ty1 + 60}C${r1(x + 10)} ${ty1 + 180} ${r1(x - 16)} ${ty1 + 260} ${r1(x + 4)} ${H + 20}" stroke="#34466e" stroke-width="${r1(18 + rnd() * 20)}" fill="none" opacity=".35"/>`;
  }
  tb += blurred(10, fo);
  tb += `<rect x="-40" y="${ty1 + 6}" width="${W + 80}" height="30" fill="${C.gold}" opacity=".85"/><rect x="-40" y="${ty1 + 10}" width="${W + 80}" height="4" fill="#f3dca0" opacity=".7"/>`;
  let fr = '';
  for (let x = -40; x < W + 40; x += 7)
    fr += `<path d="M${x} ${ty1 + 36}l${r1((rnd() - 0.5) * 3)} ${r1(34 + rnd() * 10)}" stroke="${mix(C.gold, '#8a6a30', rnd() * 0.5)}" stroke-width="2.6"/>`;
  tb += blurred(0.8, fr);
  tb += noiseTex({
    box: [-40, ty0 - 20, W + 80, H - ty0 + 20],
    color: '#0e1424',
    a: 0.3,
    freq: [0.02, 0.006],
    seed: 45,
    k: 1.4,
    b: -0.4,
  });
  // warm light pooling on the cloth
  tb += glow({ x: 520, y: ty0 + 30, rx: 520, ry: 70, color: '#f1d59e', a: 0.35, blend: 'screen' });
  tb += glow({ x: 400, y: ty1 + 160, rx: 560, ry: 200, color: '#8fa0c4', a: 0.18, blend: 'screen' });
  s += tb;

  // the Torah: lower handles on the table, the mantle, the upper handles with the crowns
  const mTop = 930;
  const mHem = 1512;
  const topW = 206;
  const hemW = 224;
  const rollX = 100;
  // the lower handles below the hem
  for (const sd of [-1, 1]) {
    const hx = cx + sd * rollX;
    const wg = nid('wd');
    s += `<defs>${ugrad(
      wg,
      [
        [0, '#2e1a10'],
        [0.35, '#8a5a36'],
        [0.6, '#5a3620'],
        [1, '#26150c'],
      ],
      [hx - 20, 0, hx + 20, 0],
    )}</defs><rect x="${r1(hx - 13)}" y="${mHem - 10}" width="26" height="${ty0 + 10 - mHem + 14}" fill="url(#${wg})"/><ellipse cx="${r1(hx)}" cy="${ty0 + 4}" rx="30" ry="9" fill="url(#${wg})"/><ellipse cx="${r1(hx)}" cy="${mHem + 28}" rx="22" ry="7" fill="url(#${wg})"/>`;
  }
  s += glow({ x: cx, y: ty0 + 6, rx: 260, ry: 26, color: '#0e1222', a: 0.55 });
  // the mantle: a velvet cylinder, lit from the upper left, soft folds low down, the pile's sheen at the rims
  const outline = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    outline.push([cx - lerp(topW, hemW, t ** 1.4), lerp(mTop, mHem, t)]);
  }
  const hemCurve = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (Math.PI * i) / 24;
    hemCurve.push([cx + hemW * Math.cos(a), mHem + 22 * Math.sin(a) + (i % 2 ? 4 : 0)]);
  }
  const right = outline.map(([x, y]) => [2 * cx - x, y]).reverse();
  const topCurve = [];
  for (let i = 0; i <= 24; i++) {
    const a = (Math.PI * i) / 24;
    topCurve.push([cx + topW * Math.cos(a), mTop + 20 * Math.sin(a)]);
  }
  const mantle = outline.concat(hemCurve.slice(1, -1), right, topCurve.slice(1, -1));
  const vstops = [];
  const folds = [0.18, 0.31, 0.47, 0.6, 0.74, 0.86];
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    const cyl = Math.cos((t - 0.36) * Math.PI * 0.95);
    let fold = 0;
    for (const fc of folds) fold += Math.exp(-(((t - fc) / 0.035) ** 2)) * 0.35;
    const lum = clamp(0.12 + 0.62 * Math.max(0, cyl) ** 1.3 - fold * 0.5 + (t < 0.05 || t > 0.95 ? 0.15 : 0));
    vstops.push([
      r3(t),
      mix(mix('#2e0a12', '#6B1F2E', clamp(lum * 1.6)), '#b04a5a', clamp(lum - 0.55) * 1.4),
    ]);
  }
  const mg = nid('mv');
  let m = `<defs>${ugrad(mg, vstops, [cx - hemW, 0, cx + hemW, 0])}</defs><path d="${pts(mantle)}Z" fill="url(#${mg})"/>`;
  // the pile: a fine texture, and a darker fall-off towards the hem
  m += clipped(
    mantle,
    noiseTex({
      box: [300, 960, 480, 620],
      color: '#1c0509',
      a: 0.35,
      freq: [0.35, 0.12],
      oct: 2,
      seed: 41,
      k: 1.3,
      b: -0.35,
    }) +
      `<defs>${ugrad(
        'mfo',
        [
          [0, '#1a0508', 0],
          [0.6, '#1a0508', 0.1],
          [1, '#1a0508', 0.4],
        ],
        [0, mTop, 0, mHem + 20],
      )}</defs>${box(cx - 260, mTop, 520, mHem - mTop + 40, 'fill="url(#mfo)"')}`,
  );
  // folds deepening towards the hem
  const fstops = [];
  for (let k = 0; k <= 80; k++) {
    const t = k / 80;
    let v = 0;
    for (const fc of [0.12, 0.22, 0.33, 0.45, 0.56, 0.66, 0.77, 0.88])
      v += Math.exp(-(((t - fc) / 0.03) ** 2));
    fstops.push([r3(t), v > 0.5 ? '#12030a' : '#e07a8a', r3(v > 0.5 ? clamp(v) * 0.5 : 0.12)]);
  }
  m += clipped(
    mantle,
    `<defs>${ugrad('mfd', fstops, [cx - hemW, 0, cx + hemW, 0])}<linearGradient id="mfm" x1="0" y1="0" x2="0" y2="1">${stopsOf(
      [
        [0, '#fff', 0],
        [0.45, '#fff', 0.2],
        [1, '#fff', 1],
      ],
    )}</linearGradient><mask id="mfk" maskUnits="userSpaceOnUse" x="0" y="${mTop}" width="${W}" height="${mHem - mTop + 60}"><rect x="0" y="${mTop}" width="${W}" height="${mHem - mTop + 60}" fill="url(#mfm)"/></mask></defs><g mask="url(#mfk)">${blurred(3, box(cx - hemW - 10, mTop, hemW * 2 + 20, mHem - mTop + 60, 'fill="url(#mfd)"'))}</g>`,
  );
  // the velvet's sheen along the lit edge
  m += clipped(
    mantle,
    blurred(10, `<path d="${pts(outline)}" stroke="#d27886" stroke-width="18" fill="none" opacity=".35"/>`),
  );
  m += clipped(
    mantle,
    blurred(
      6,
      `<path d="${pts(topCurve.map(([x, y]) => [x, y + 8]))}" stroke="#c46272" stroke-width="10" fill="none" opacity=".45"/>`,
    ),
  );
  m += clipped(
    mantle,
    blurred(12, `<path d="${pts(right)}" stroke="#e9a27a" stroke-width="16" fill="none" opacity=".4"/>`),
  );
  m += clipped(
    mantle,
    glow({ x: cx, y: mHem + 10, rx: 260, ry: 90, color: '#e0a860', a: 0.3, blend: 'screen' }),
  );
  // gold braid along the top and the hem, a fringe under the hem
  m += `<path d="${pts(topCurve.map(([x, y]) => [x, y + 26]))}" stroke="${C.gold}" stroke-width="12" fill="none" opacity=".9"/><path d="${pts(topCurve.map(([x, y]) => [x, y + 22]))}" stroke="#f1d898" stroke-width="3" fill="none" opacity=".6"/>`;
  m += `<path d="${pts(hemCurve.map(([x, y]) => [x, y - 34]))}" stroke="${C.gold}" stroke-width="16" fill="none" opacity=".9"/><path d="${pts(hemCurve.map(([x, y]) => [x, y - 40]))}" stroke="#f1d898" stroke-width="3" fill="none" opacity=".55"/>`;
  let fringe = '';
  for (let i = 0; i <= 60; i++) {
    const a = Math.PI - (Math.PI * i) / 60;
    const x = cx + hemW * Math.cos(a);
    const y = mHem + 22 * Math.sin(a) - 12;
    fringe += `<path d="M${r1(x)} ${r1(y)}l${r1((rnd() - 0.5) * 3)} ${r1(26 + rnd() * 6)}" stroke="${mix(C.gold, '#7a5a26', clamp(0.2 + (Math.cos(a) + 1) * 0.3))}" stroke-width="3.2"/>`;
  }
  m += blurred(0.7, fringe);
  // a gold-embroidered vine low on the mantle (no lettering)
  let vine = '';
  const vy = 1425;
  vine += `<path d="M${cx - 150} ${vy}C${cx - 110} ${vy - 50} ${cx - 50} ${vy - 50} ${cx} ${vy - 10}C${cx + 50} ${vy - 50} ${cx + 110} ${vy - 50} ${cx + 150} ${vy}" stroke="${C.gold}" stroke-width="5" fill="none"/>`;
  for (const [lx, ly, rot] of [
    [cx - 118, vy - 34, -30],
    [cx - 70, vy - 46, 20],
    [cx + 70, vy - 46, -20],
    [cx + 118, vy - 34, 30],
    [cx - 30, vy - 30, -50],
    [cx + 30, vy - 30, 50],
  ])
    vine += `<ellipse cx="${lx}" cy="${ly}" rx="14" ry="7" transform="rotate(${rot} ${lx} ${ly})" fill="${C.gold}"/>`;
  vine += `<circle cx="${cx}" cy="${vy - 18}" r="11" fill="#d8b56c"/><circle cx="${cx - 150}" cy="${vy + 2}" r="7" fill="#d8b56c"/><circle cx="${cx + 150}" cy="${vy + 2}" r="7" fill="#d8b56c"/>`;
  m += clipped(
    mantle,
    `<g opacity=".85">${vine}</g>` +
      `<defs>${ugrad(
        'vsh',
        [
          [0, '#1a0508', 0],
          [0.55, '#1a0508', 0.1],
          [1, '#1a0508', 0.55],
        ],
        [cx - 220, 0, cx + 220, 0],
      )}</defs>${box(cx - 220, vy - 70, 440, 90, 'fill="url(#vsh)"')}`,
  );
  s += blurred(0.9, m);

  // the upper handles through the mantle's top, and the crowns on them
  for (const sd of [-1, 1]) {
    const hx = cx + sd * rollX;
    const wg = nid('wd');
    s += `<defs>${ugrad(
      wg,
      [
        [0, '#2e1a10'],
        [0.35, '#9a6a40'],
        [0.6, '#5a3620'],
        [1, '#26150c'],
      ],
      [hx - 16, 0, hx + 16, 0],
    )}</defs><rect x="${r1(hx - 12)}" y="${mTop - 64}" width="24" height="84" fill="url(#${wg})"/><ellipse cx="${r1(hx)}" cy="${mTop + 8}" rx="24" ry="8" fill="url(#${wg})"/>`;
  }
  let crowns = '';
  for (const sd of [-1, 1]) crowns += finial(cx + sd * rollX, mTop - 56, 80);
  s += blurred(1.1, crowns);
  // glints on the silver
  s += glints({
    items: [
      [cx - rollX - 22, mTop - 56 - 70 * 2.0, 20, 0.7],
      [cx + rollX - 26, mTop - 56 - 70 * 1.6, 14, 0.5],
      [cx - rollX - 30, mTop - 56 - 70 * 0.66, 11, 0.5],
    ],
    color: '#fff6e2',
    rot: 15,
  });

  // the breastplate: a silver shield on chains, an arched top, a gilt crown, a plain medallion, bells below
  const bx = cx;
  const bTop = 1020;
  const bw = 124;
  const bh = 246;
  const shield = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (Math.PI * i) / 20;
    shield.push([bx + bw * Math.cos(a), bTop + bw * 0.55 + bw * 0.55 * Math.sin(a)]);
  }
  const scal = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    scal.push([bx + bw - t * bw * 2, bTop + bh + (i % 2 ? 16 : 0)]);
  }
  const shieldPts = [[bx - bw, bTop + bh], ...shield, [bx + bw, bTop + bh], ...scal.slice(1, -1)];
  // chains to the rollers
  let bp = `<path d="M${bx - bw + 16} ${bTop + 40}L${cx - rollX} ${mTop + 4}M${bx + bw - 16} ${bTop + 40}L${cx + rollX} ${mTop + 4}" stroke="#b8b2a8" stroke-width="3" stroke-dasharray="5 3" opacity=".85"/>`;
  bp += `<path d="${pts(shieldPts.map(([x, y]) => [x + 10, y + 14]))}Z" fill="#1a0508" opacity=".4"/>`;
  const sg = nid('bps');
  bp += `<defs>${silverGrad(sg, bx - bw, bx + bw, 0.2)}</defs><path d="${pts(shieldPts)}Z" fill="url(#${sg})"/>`;
  // repoussé: a raised rim of beads, an inner frame
  let beads = '';
  const inset = shieldPts.map(([x, y]) => [
    bx + (x - bx) * 0.9,
    bTop + bh * 0.52 + (y - bTop - bh * 0.52) * 0.92,
  ]);
  for (let i = 0; i < inset.length; i++) {
    const [x0, y0] = inset[i];
    const [x1, y1] = inset[(i + 1) % inset.length];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 12));
    for (let k = 0; k < n; k++)
      beads += `<circle cx="${r1(x0 + ((x1 - x0) * k) / n)}" cy="${r1(y0 + ((y1 - y0) * k) / n)}" r="3" fill="#f3efe7" opacity=".75"/>`;
  }
  bp += beads;
  // the gilt crown at the top of the shield
  const kcx = bx;
  const kcy = bTop + 62;
  const ks = 42;
  bp += `<path d="M${kcx - ks} ${kcy + ks * 0.5}L${kcx - ks * 1.1} ${kcy - ks * 0.4}L${kcx - ks * 0.5} ${kcy}L${kcx} ${kcy - ks * 0.7}L${kcx + ks * 0.5} ${kcy}L${kcx + ks * 1.1} ${kcy - ks * 0.4}L${kcx + ks} ${kcy + ks * 0.5}Z" fill="#d9b25e"/><rect x="${kcx - ks}" y="${kcy + ks * 0.45}" width="${ks * 2}" height="${ks * 0.3}" fill="#c99c48"/>`;
  for (const dx of [-1.1, 0, 1.1])
    bp += `<circle cx="${r1(kcx + dx * ks)}" cy="${r1(kcy - (dx === 0 ? 0.78 : 0.5) * ks)}" r="5" fill="#fff2cf"/>`;
  // the shield's own relief: darker low down, a warm reflection up the left
  bp += clipped(
    shieldPts,
    `<defs>${ugrad(
      'bpv',
      [
        [0, '#ffffff', 0.12],
        [0.5, '#000000', 0],
        [1, '#1a1010', 0.35],
      ],
      [0, bTop, 0, bTop + bh],
    )}</defs>${box(bx - bw, bTop, bw * 2, bh + 20, 'fill="url(#bpv)"')}`,
  );
  // a repoussé rosette in the middle: lobed petals round a boss, scrolls either side (no lettering)
  const rcy = bTop + 165;
  let ros = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const [px, py] = [bx + Math.cos(a) * 26, rcy + Math.sin(a) * 26];
    ros += `<ellipse cx="${r1(px)}" cy="${r1(py)}" rx="20" ry="11" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(px)} ${r1(py)})" fill="url(#${sg})" stroke="#4a4442" stroke-width="1.5"/>`;
  }
  ros += `<circle cx="${bx}" cy="${rcy}" r="14" fill="#d9b25e"/><circle cx="${bx - 4}" cy="${rcy - 4}" r="5" fill="#fff0c8" opacity=".8"/>`;
  for (const sd of [-1, 1])
    ros += `<path d="M${bx + sd * 50} ${rcy + 50}c${sd * 30} -10 ${sd * 34} -50 ${sd * 10} -64c${sd * -14} -8 ${sd * -24} 6 ${sd * -14} 16" stroke="#4a4442" stroke-width="3" fill="none" opacity=".7"/>`;
  bp += ros;
  for (const sd of [-1, 1])
    bp += `<rect x="${bx + sd * 92 - 7}" y="${bTop + 110}" width="14" height="120" rx="5" fill="url(#${sg})" stroke="#4a4442" stroke-width="1"/><rect x="${bx + sd * 92 - 11}" y="${bTop + 104}" width="22" height="10" fill="#d9b25e"/><rect x="${bx + sd * 92 - 11}" y="${bTop + 228}" width="22" height="8" fill="#d9b25e"/>`;
  // bells under the scallops
  for (let i = 0; i < 4; i++) {
    const x = bx - bw * 0.75 + (bw * 1.5 * i) / 3;
    bp += `<path d="M${r1(x)} ${bTop + bh + 8}v16" stroke="#9d978f" stroke-width="2"/><path d="M${r1(x - 10)} ${bTop + bh + 44}Q${r1(x)} ${bTop + bh + 16} ${r1(x + 10)} ${bTop + bh + 44}Z" fill="url(#${sg})"/>`;
  }
  s += blurred(1.3, bp);
  s += glints({
    items: [
      [bx - 60, bTop + 40, 18, 0.7],
      [bx - 30, bTop + 170, 14, 0.5],
    ],
    color: '#fff6e2',
    rot: 20,
  });

  // the warm light on the scene, a little haze, a vignette
  s += glow({ x: 330, y: 900, rx: 520, ry: 620, color: '#f6d7a0', a: 0.16, blend: 'screen' });
  s += vignette(0.45, '#2a2024');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 4. Jerusalem at sunrise from a lookout: a peach and blue sky, the sun low on the right, the Old City walls
//    lit gold across the valley, the citadel's slender tower, roofs and cypresses; a stone parapet near us

/** the top of a crenellated wall from x0 to x1 (parapet at y): merlons mw wide, gaps between */
const battlement = (x0, x1, y, mh, mw, gap) => {
  const n = Math.max(1, Math.round((x1 - x0 + gap) / (mw + gap)));
  const g = n > 1 ? (x1 - x0 - n * mw) / (n - 1) : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * (mw + g);
    out.push([a, y], [a, y - mh], [a + mw, y - mh], [a + mw, y]);
  }
  return out;
};

const city = () => {
  const rnd = prng(444);
  const sunX = 860;
  const sunY = 1000;
  let s = skyFill([
    [0, '#5a7ba4'],
    [0.14, '#7390b6'],
    [0.28, '#8ea9c7'],
    [0.38, '#adbccb'],
    [0.46, '#cdc6c0'],
    [0.52, '#e3c8ae'],
    [0.56, '#ebc6a2'],
    [0.62, '#e9c39f'],
    [1, '#b1947a'],
  ]);
  // the sun just risen over the hills, veiled in haze
  s += glow({ x: sunX, y: sunY, rx: 980, ry: 760, color: '#f8d4a0', a: 0.48 });
  s += glow({ x: sunX, y: sunY, rx: 300, ry: 250, color: '#ffeacb', a: 0.6 });
  s += glow({ x: sunX, y: sunY, rx: 70, color: '#fff8ea', a: 0.95 });
  s += rays({
    x: sunX,
    y: sunY,
    n: 16,
    len: 1300,
    a0: 190,
    a1: 330,
    w: [1.5, 4],
    color: '#fbe3bb',
    a: 0.12,
    seed: 7,
    blur: 16,
  });
  // soft high clouds lit peach from below, a long low bank of haze
  s += wisps({
    color: '#f3d9c0',
    a: 0.38,
    seed: 47,
    items: [
      [260, 250, 380, 18, -3],
      [760, 190, 320, 14, 2],
      [520, 420, 460, 16, -1],
      [200, 600, 320, 10, 2],
      [880, 640, 300, 12, -2],
    ],
  });
  s += wisps({
    color: '#f7d6b4',
    a: 0.45,
    seed: 49,
    items: [
      [260, 930, 420, 14, -1],
      [620, 960, 300, 10, 1],
    ],
  });
  s += mist({ y: 1030, h: 60, color: '#f4dcc0', a: 0.4, seed: 51, n: 8 });

  // the hills beyond the city: a far ridge in haze, a nearer one
  const ridge = (y0, amp, seed) => {
    const r = prng(seed);
    const list = [[-60, 1400]];
    for (let x = -60; x <= W + 60; x += 30)
      list.push([
        x,
        y0 + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.013 + seed * 2) * amp * 0.3 + r() * 3,
      ]);
    list.push([W + 60, 1400]);
    return list;
  };
  s += blurred(2.5, poly(ridge(1062, 18, 3), 'fill="#d2b9a6"'));
  s += glow({ x: sunX, y: 1060, rx: 440, ry: 70, color: '#fce4c0', a: 0.6 });
  s += blurred(2, poly(ridge(1094, 12, 5), 'fill="#c2a894"'));
  s += mist({ y: 1100, h: 34, color: '#ecd4ba', a: 0.5, seed: 53, n: 10 });

  // the Old City: roofs climbing behind the walls, lit on their sunward sides; a few stone domes, cypresses
  let roofs = '';
  const blocks = [];
  for (let row = 0; row < 4; row++) {
    for (let x = -30; x < W + 30;) {
      const w = 34 + rnd() * 60;
      const yTop = 1112 + row * 24 + rnd() * 20 - Math.sin((x / W) * Math.PI) * 16;
      blocks.push({ x, w, yTop, row });
      x += w * (0.65 + rnd() * 0.4);
    }
  }
  for (const b of blocks) {
    const far = 1 - b.row / 4;
    const face = mix(mix('#e0c9a2', '#cdb088', rnd()), '#d9c6ae', far * 0.55);
    const side = mix('#f6d9a0', '#ead3b2', far * 0.55);
    roofs += box(b.x, b.yTop, b.w, 1300 - b.yTop, `fill="${face}"`);
    roofs += box(b.x + b.w * 0.74, b.yTop, b.w * 0.26, 1300 - b.yTop, `fill="${side}" opacity=".85"`);
    roofs += box(b.x, b.yTop, b.w, 3, `fill="${mix('#f6e3bd', '#fff0d0', rnd())}" opacity=".8"`);
    if (rnd() < 0.6) {
      const wx = b.x + b.w * (0.15 + rnd() * 0.45);
      const wy = b.yTop + 10 + rnd() * 12;
      roofs += `<path d="M${r1(wx)} ${r1(wy + 9)}V${r1(wy + 3)}A2.5 3 0 0 1 ${r1(wx + 5)} ${r1(wy + 3)}V${r1(wy + 9)}Z" fill="#8a7458" opacity=".55"/>`;
    }
  }
  // small stone domes on the roofs (no gold)
  for (let i = 0; i < 9; i++) {
    const x = 460 + rnd() * 580;
    const y = 1128 + rnd() * 50;
    const r = 9 + rnd() * 10;
    roofs += `<path d="M${r1(x - r)} ${r1(y)}A${r1(r)} ${r1(r * 0.85)} 0 0 1 ${r1(x + r)} ${r1(y)}Z" fill="${mix('#d4c5ac', '#bdb2a2', rnd())}"/><path d="M${r1(x + r * 0.2)} ${r1(y - r * 0.8)}A${r1(r)} ${r1(r * 0.85)} 0 0 1 ${r1(x + r)} ${r1(y)}H${r1(x + r * 0.2)}Z" fill="#f2dcb0" opacity=".6"/>`;
  }
  s += blurred(0.9, roofs);
  const cypress = (x, top, base, w, sd, pal) =>
    foliage({
      lobes: flame(rnd, x, top, base, w),
      pal,
      seed: sd,
      grain: 0.08,
      edge: 4,
      clump: 5,
      tex: 0.45,
      relief: 4,
      light: [1, 0, 0, 0.6],
    });
  const farCyp = { lit: '#8f9a74', mid: '#66735a', shade: '#4a5648' };
  for (const [x, h] of [
    [500, 80],
    [640, 62],
    [780, 88],
    [930, 70],
    [1030, 56],
  ])
    s += cypress(x, 1206 - h, 1222, 20, 60 + x, farCyp);
  s += mist({ y: 1150, h: 26, color: '#efdcc2', a: 0.28, seed: 55, n: 10 });

  // the citadel at the left: a massive square tower, and the slender round tower with its gallery and cap
  let cit = '';
  const tg = nid('ct');
  cit += `<defs>${ugrad(
    tg,
    [
      [0, '#b39675'],
      [0.62, '#d6bb90'],
      [0.64, '#f2d59e'],
      [1, '#e8c68d'],
    ],
    [130, 0, 310, 0],
  )}</defs>`;
  cit += `<path d="${pts([[130, 1300], ...battlement(130, 310, 1060, 15, 17, 11), [310, 1300]])}Z" fill="url(#${tg})"/>`;
  for (const [wx, wy] of [
    [168, 1110],
    [226, 1112],
    [276, 1160],
    [180, 1180],
  ])
    cit += `<path d="M${wx} ${wy + 20}V${wy + 5}A4 5 0 0 1 ${wx + 8} ${wy + 5}V${wy + 20}Z" fill="#7a6246" opacity=".55"/>`;
  cit += `<rect x="130" y="1088" width="180" height="6" fill="#f1dcae" opacity=".5"/>`;
  const mx = 372;
  const mg = nid('mn');
  cit += `<defs>${ugrad(
    mg,
    [
      [0, '#a2866a'],
      [0.5, '#d0b58c'],
      [0.62, '#f3d8a4'],
      [1, '#e0bd88'],
    ],
    [mx - 20, 0, mx + 20, 0],
  )}</defs>`;
  cit += `<path d="M${mx - 19} 1230V975H${mx + 19}V1230Z" fill="url(#${mg})"/>`;
  cit += `<rect x="${mx - 27}" y="964" width="54" height="11" fill="url(#${mg})"/><path d="M${mx - 25} 964V952H${mx + 25}V964" fill="none" stroke="#ae916e" stroke-width="3"/>`;
  cit += `<rect x="${mx - 14}" y="918" width="28" height="34" fill="url(#${mg})"/><rect x="${mx - 4}" y="926" width="8" height="15" rx="4" fill="#8a7050" opacity=".7"/>`;
  cit += `<path d="M${mx - 16} 919A16 19 0 0 1 ${mx + 16} 919Z" fill="url(#${mg})"/><path d="M${mx} 901V886" stroke="#ae916e" stroke-width="3"/>`;
  for (const y of [1010, 1080, 1150])
    cit += `<rect x="${mx - 3}" y="${y}" width="6" height="17" rx="3" fill="#8a7050" opacity=".55"/>`;
  s += blurred(0.8, under(stoneTex({ freq: 0.08, relief: 1.6, tex: 0.3, seed: 57, patch: 0.08 }), cit));

  // the walls: a long crenellated line lit gold, towers along it, a glacis under them
  const wallTop = (x) => 1218 + Math.sin(x * 0.003 + 0.4) * 6 + (x / W) * 10;
  const towers = [
    [90, 64],
    [440, 56],
    [650, 62],
    [880, 54],
    [1050, 58],
  ];
  const sil = [[-60, 1360]];
  let x0 = -60;
  for (const [tx, tw] of towers) {
    sil.push(...battlement(x0, tx - tw / 2, wallTop(x0), 11, 12, 8));
    sil.push(
      [tx - tw / 2, wallTop(tx) - 28],
      ...battlement(tx - tw / 2, tx + tw / 2, wallTop(tx) - 28, 12, 13, 8).slice(1, -1),
      [tx + tw / 2, wallTop(tx) - 28],
    );
    x0 = tx + tw / 2;
  }
  sil.push(...battlement(x0, W + 60, wallTop(x0), 11, 12, 8), [W + 60, 1372]);
  let wl = `<defs><clipPath id="wsil"><path d="${pts(sil)}Z"/></clipPath></defs><g clip-path="url(#wsil)">`;
  wl += ashlar({
    x0: -60,
    x1: W + 60,
    yTop: 1150,
    yBot: 1380,
    course: 9,
    len: 22,
    seed: 61,
    tone: (x, y, r) => mix(mix('#efcb8c', '#dcb277', r()), '#b88e62', clamp((y - 1220) / 140) * 0.6),
    joint: 1.1,
    jointColor: '#b8905f',
    lit: '#f8dfaa',
    dark: '#a07c52',
  });
  for (const [tx, tw] of towers) {
    wl += box(tx + tw / 2 - tw * 0.3, 1150, tw * 0.3, 240, 'fill="#fff0c8" opacity=".3"');
    wl += box(tx - tw / 2 - 18, 1200, 18, 180, 'fill="#8a6848" opacity=".25"');
  }
  wl += `<defs>${ugrad(
    'wsh',
    [
      [0, '#fff3d6', 0.22],
      [0.3, '#fff3d6', 0],
      [1, '#6a4a34', 0.35],
    ],
    [0, 1200, 0, 1360],
  )}</defs>${box(-60, 1150, W + 120, 240, 'fill="url(#wsh)"')}`;
  wl += '</g>';
  s += blurred(0.8, under(stoneTex({ freq: 0.09, relief: 1.4, tex: 0.3, seed: 63, patch: 0.08 }), wl));
  s += glow({ x: 680, y: 1250, rx: 720, ry: 70, color: '#ffe2ae', a: 0.32, blend: 'screen' });

  // the valley: dry golden slopes falling from the walls into morning shade and rising towards us, a few
  // wooded masses and scattered olive trees lit from the right, faint terraces, mist in the valley floor
  s += `<defs>${ugrad(
    'vly',
    [
      [0, '#c9ad7a'],
      [0.22, '#b09a72'],
      [0.5, '#8f8b78'],
      [0.62, '#8a8878'],
      [0.8, '#9c8e70'],
      [1, '#a89572'],
    ],
    [0, 1330, 0, 1700],
  )}</defs><path d="M-60 1330L${W + 60} 1346V1760H-60Z" fill="url(#vly)"/>`;
  s += noiseTex({
    box: [-60, 1330, W + 120, 430],
    color: '#5e573f',
    a: 0.3,
    freq: [0.01, 0.028],
    seed: 79,
    k: 1.5,
    b: -0.45,
  });
  s += glow({ x: 820, y: 1370, rx: 520, ry: 70, color: '#f3d49a', a: 0.35 });
  const contour = (k, x) =>
    1372 +
    k * 52 +
    k * k * 1.5 +
    Math.sin(x * (0.004 + k * 0.0006) + k * 1.7) * (5 + k * 2) +
    Math.sin(x * 0.011 + k) * 3;
  let ter = '';
  for (let k = 0; k < 6; k++) {
    const line = Array.from({ length: 40 }, (_, i) => [
      -40 + (i / 39) * (W + 80),
      contour(k, -40 + (i / 39) * (W + 80)),
    ]);
    ter += `<path d="${pts(line)}" stroke="#e3cfa3" stroke-width="2" fill="none" opacity=".22"/><path d="${pts(line.map(([x, y]) => [x, y + 3]))}" stroke="#4e4838" stroke-width="3" fill="none" opacity=".18"/>`;
  }
  s += blurred(1.4, ter);
  // wooded masses: under the citadel, along the valley floor, on the near slope
  // scattered olive trees in the open ground
  for (let row = 0; row < 6; row++) {
    const r = 10 + row * 4;
    const { ids, defs } = billowGrads({ top: '#a9a878', mid: '#66704f', bot: '#3c4640' }, [0.85, 0, 0.15, 1]);
    let sh = '';
    const puffs = [];
    for (let x = -30 + rnd() * 60; x < W + 40; x += r * (2.4 + rnd() * 3.6)) {
      if (rnd() < 0.15) continue;
      const y = contour(row, x) - r * 0.4 + (rnd() - 0.5) * 14;
      sh += `<ellipse cx="${r1(x - r * 1.3)}" cy="${r1(y + r * 0.45)}" rx="${r1(r * 1.5)}" ry="${r1(r * 0.3)}"/>`;
      for (const [dx, dy, k] of [
        [0, -0.5, 1],
        [-0.6, -0.1, 0.72],
        [0.6, -0.2, 0.75],
        [0.2, -0.85, 0.6],
      ])
        puffs.push({ x: x + dx * r, y: y + dy * r, rx: r * k, ry: r * k * 0.8, g: Math.floor(rnd() * 3) });
    }
    s += blurred(r * 0.22, sh, 'fill="#3a3528" opacity=".35"');
    s +=
      defs +
      soft(
        {
          box: [-80, contour(row, 540) - r * 5, W + 160, r * 9],
          blur: r * 0.08,
          disp: r * 0.5,
          freq: 2.4 / r,
          seed: 85 + row,
        },
        ellipses(puffs, ids),
      );
  }
  for (const [x, top, base] of [
    [250, 1318, 1430],
    [900, 1340, 1460],
  ])
    s += cypress(x, top, base, 30, 80 + x, { lit: '#7d8a62', mid: '#56644c', shade: '#3a4640' });
  s += mist({ y: 1540, h: 40, color: '#e6d8c4', a: 0.32, seed: 67, n: 12, disp: 0.4, blur: 0.5 });
  s += veil('#dcd4c6', [
    [1330, 0.04],
    [1470, 0.1],
    [1580, 0.06],
    [1700, 0],
  ]);
  // the lookout: a stone balustrade near us, its rail catching the sun
  const ry0 = 1668;
  const ry1 = 1712;
  const by1 = 1872;
  let bal = '';
  const bg = nid('bl');
  bal += `<defs>${ugrad(
    bg,
    [
      [0, '#8e7658'],
      [0.3, '#e2c99f'],
      [0.5, '#f4dfb6'],
      [0.75, '#bca17c'],
      [1, '#7e6850'],
    ],
    [0, 0, 1, 0].map((v, i) => (i % 2 ? 0 : v)),
  )}</defs>`;
  for (let x = -20; x < W + 40; x += 74) {
    const w = 46;
    const gid = nid('bs');
    bal += `<defs>${ugrad(
      gid,
      [
        [0, '#8a7254'],
        [0.35, '#d9bf95'],
        [0.55, '#f0dab0'],
        [0.8, '#b0946f'],
        [1, '#7a6249'],
      ],
      [x - w / 2, 0, x + w / 2, 0],
    )}</defs>`;
    // a vase-shaped baluster: a neck, a swelling body, a foot
    bal += `<path d="M${x - 12} ${ry1}H${x + 12}Q${x + 8} ${ry1 + 30} ${x + 14} ${ry1 + 50}Q${x + w / 2} ${ry1 + 100} ${x + 16} ${by1 - 16}H${x - 16}Q${x - w / 2} ${ry1 + 100} ${x - 14} ${ry1 + 50}Q${x - 8} ${ry1 + 30} ${x - 12} ${ry1}Z" fill="url(#${gid})"/><rect x="${x - 20}" y="${by1 - 18}" width="40" height="18" fill="url(#${gid})"/>`;
  }
  const rg = nid('rl');
  bal += `<defs>${ugrad(
    rg,
    [
      [0, '#fff0cf'],
      [0.35, '#ead3aa'],
      [1, '#9c8262'],
    ],
    [0, ry0, 0, ry1],
  )}${ugrad(
    'bb',
    [
      [0, '#b89e7a'],
      [1, '#6a5642'],
    ],
    [0, by1, 0, H],
  )}</defs><rect x="-40" y="${ry0}" width="${W + 80}" height="${ry1 - ry0}" rx="8" fill="url(#${rg})"/><rect x="-40" y="${ry1 - 4}" width="${W + 80}" height="8" fill="#6a5642" opacity=".4"/><rect x="-40" y="${by1}" width="${W + 80}" height="${H - by1 + 20}" fill="url(#bb)"/>`;
  s += under(stoneTex({ freq: 0.035, relief: 2.2, tex: 0.38, seed: 73, patch: 0.12 }), blurred(1.8, bal));
  s += glow({ x: 760, y: ry0 + 6, rx: 560, ry: 30, color: '#fff0cf', a: 0.35, blend: 'screen' });
  s += veil('#f6e2c4', [
    [850, 0],
    [1100, 0.1],
    [1350, 0.04],
  ]);
  s += vignette(0.34, '#2b3044');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 5. the dawn: a luminous, calm golden sky; a warm glow at the centre (behind where the boy's head will be),
//    gentle rays from the upper middle, a few soft clouds kept to the sides, faint bokeh, soft even light below

const dawn = () => {
  const rnd = prng(555);
  const gx = 540;
  const gy = 960;
  let s = skyFill([
    [0, '#6f86aa'],
    [0.12, '#8597b5'],
    [0.24, '#a8a3b0'],
    [0.34, '#c7aea4'],
    [0.44, '#d9b596'],
    [0.54, '#ddb48e'],
    [0.66, '#d5aa86'],
    [0.82, '#caa07f'],
    [1, '#bd9579'],
  ]);
  // the glow: broad and warm, a soft core behind the head
  s += glow({ x: gx, y: gy, rx: 1000, ry: 1150, color: '#f1c690', a: 0.5 });
  s += glow({ x: gx, y: gy, rx: 520, ry: 580, color: '#f8dcb0', a: 0.55 });
  s += glow({ x: gx, y: gy, rx: 250, ry: 270, color: '#fdebcc', a: 0.6 });
  // a few soft clouds lit gold from below, kept to the upper corners and low at the edges
  const lit = (t) => ({
    top: mix('#f3d9bb', '#f6debf', t),
    mid: mix('#d6b6a4', '#dbbba6', t),
    bot: mix('#a9959c', '#b39c9f', t),
  });
  const flip = [0.3, 1, 0.5, 0];
  s += cumulus({
    cx: 120,
    base: 540,
    width: 820,
    height: 110,
    n: 40,
    size: 78,
    rMin: 0.5,
    pal: lit,
    seed: 91,
    bands: 3,
    dir: flip,
    flatBase: 0.6,
    blur: 0.3,
    disp: 0.34,
    freqK: 1.6,
  });
  s += cumulus({
    cx: 990,
    base: 440,
    width: 760,
    height: 100,
    n: 36,
    size: 74,
    rMin: 0.5,
    pal: lit,
    seed: 93,
    bands: 3,
    dir: flip,
    flatBase: 0.6,
    blur: 0.3,
    disp: 0.34,
    freqK: 1.6,
  });
  const low = (t) => ({
    top: mix('#f4d8b6', '#f6dcba', t),
    mid: mix('#dcb89e', '#e0bda2', t),
    bot: mix('#bca090', '#c3a594', t),
  });
  s += cumulus({
    cx: 40,
    base: 1330,
    width: 520,
    height: 100,
    n: 26,
    size: 60,
    rMin: 0.5,
    pal: low,
    seed: 95,
    bands: 2,
    dir: flip,
    flatBase: 0.6,
    blur: 0.32,
    disp: 0.34,
    freqK: 1.6,
  });
  s += cumulus({
    cx: 1050,
    base: 1270,
    width: 520,
    height: 100,
    n: 26,
    size: 60,
    rMin: 0.5,
    pal: low,
    seed: 97,
    bands: 2,
    dir: flip,
    flatBase: 0.6,
    blur: 0.32,
    disp: 0.34,
    freqK: 1.6,
  });
  s += wisps({
    color: '#f2d6bc',
    a: 0.36,
    seed: 99,
    items: [
      [420, 200, 360, 14, -3],
      [760, 650, 300, 12, 2],
      [280, 720, 280, 10, -2],
      [700, 110, 260, 10, 1],
    ],
  });
  // gentle rays from the upper middle, fanning down towards the glow
  s += rays({
    x: gx,
    y: -160,
    n: 14,
    len: 2100,
    a0: 64,
    a1: 116,
    w: [2, 5],
    color: '#ffeccc',
    a: 0.24,
    seed: 101,
    blur: 26,
  });
  s += rays({
    x: gx,
    y: gy,
    n: 18,
    len: 900,
    a0: 200,
    a1: 340,
    w: [3, 7],
    color: '#ffefd4',
    a: 0.1,
    seed: 103,
    blur: 26,
  });
  // soft even light low down: far hills lost in the haze at the city's horizon, a warm veil
  const hill = [[-60, 1600]];
  for (let x = -60; x <= W + 60; x += 30)
    hill.push([x, 1230 + Math.sin(x * 0.005 + 1) * 14 + Math.sin(x * 0.017) * 5]);
  hill.push([W + 60, 1600], [W + 60, H + 40], [-60, H + 40]);
  s += blurred(6, poly(hill, 'fill="#c49a7c" opacity=".35"'));
  s += mist({ y: 1250, h: 50, color: '#e9c9a4', a: 0.4, seed: 107, n: 9 });
  s += veil('#dcb28c', [
    [1100, 0],
    [1400, 0.25],
    [1920, 0.2],
  ]);
  // faint bokeh, away from the head
  const list = [];
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = 120 + rnd() * 1650;
    if (Math.hypot((x - gx) / 260, (y - 1080) / 330) < 1) continue;
    list.push([x, y, 14 + rnd() ** 1.5 * 46, 0.08 + rnd() * 0.16, Math.floor(rnd() * 3)]);
  }
  s += bokeh({
    list,
    area: [0, 0, W, H],
    r: [0, 0],
    colors: ['#fff0d0', '#f7d59c', '#f0c48a'],
    seed: 105,
    blur: 4,
  });
  s += vignette(0.32, '#5a4a52');
  return [svgLayer(s)];
};

const scenes = {
  'scene-table': { paint: table, seed: 41, post: { gamma: 1.1, bloom: 0.4 } },
  'scene-shul': { paint: shul, seed: 42, post: { gamma: 1.1, bloom: 0.42 } },
  'scene-torah': { paint: torah, seed: 43, post: { gamma: 0.97, bloom: 0.45 } },
  'scene-city': { paint: city, seed: 44, post: { gamma: 1.2, bloom: 0.4 } },
  'scene-dawn': { paint: dawn, seed: 45, post: { gamma: 1.27, bloom: 0.45 } },
};

await paintScenes({ id: 'first-tefillin', scenes, background: '#b39a78' });
