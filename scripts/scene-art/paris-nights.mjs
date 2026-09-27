// paris-nights (an engagement: an evening in Paris): five backdrop pictures of one evening — a street at
// dusk with a café's warm awning over wet cobbles, an iron lattice tower against a pink-gold sunset over
// zinc roofs, a bridge of ornate lamps over a pink-lilac river, the tower lit gold at blue hour, and a ring
// box between candlelight and champagne. Dusty rose, navy, champagne and lamp gold; no signs, no lettering,
// no people. Painted with the kit (./kit.mjs) and the group's helpers.
//
//   node scripts/scene-art/paris-nights.mjs [--draft <dir>] [scene …]
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
  skyFill,
  glow,
  soft,
  mist,
  wisps,
  cumulus,
  vignette,
  svgLayer,
  pts,
  foliage,
  crown,
} from './kit.mjs';
import {
  poly,
  box,
  blurred,
  veil,
  camera,
  stars,
  bokeh,
  glints,
  flameLight,
  paneLantern,
} from './architecture-shared.mjs';

const C = {
  rose: '#E3B7B0',
  navy: '#1F2A44',
  champagne: '#D9C29A',
  gold: '#F2C27B',
  shade: '#1B1F33',
  lilac: '#a993b4',
  zinc: '#7f8299',
  cream: '#e6d6c4',
};
const _clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------------------------------
// the lattice tower: four legs on a great arch, two platforms, a tapering pylon, the lantern at the top

const towerParts = (x, base, h) => {
  const hw = (t) => h * (0.19 * Math.exp(-3.48 * t) + 0.004 * (1 - t));
  const inner = (t) => h * 0.108 * Math.max(0, 1 - t / 0.35) ** 1.2;
  const Y = (t) => base - t * h;
  const legL = [];
  const legIn = [];
  for (let i = 0; i <= 30; i++) {
    const t = (0.35 * i) / 30;
    legL.push([x - hw(t), Y(t)]);
    legIn.push([x - inner(t), Y(t)]);
  }
  const shaftL = [];
  for (let i = 0; i <= 30; i++) {
    const t = 0.35 + (0.49 * i) / 30;
    shaftL.push([x - hw(t), Y(t)]);
  }
  const mirror = (list) => list.map(([a, b]) => [2 * x - a, b]);
  return { hw, inner, Y, legL, legIn, shaftL, mirror };
};

const tower = ({ x, base, h, mode = 'sil', ink = '#2a2b40', fillA = 0.5, seed = 1, sparkle = 0 }) => {
  const rnd = prng(seed * 97 + 1);
  const { hw, inner, Y, legL, legIn, shaftL, mirror } = towerParts(x, base, h);
  const sw = Math.max(1, h * 0.0045);
  const legPoly = legL.concat(legIn.slice().reverse());
  const shaftPoly = shaftL.concat(mirror(shaftL).reverse());
  let out = '';
  const lit = mode === 'lit';
  const body = lit ? '#e9b765' : ink;
  // the lacework: translucent panels crossed by bracing
  out += `<g fill="${body}" opacity="${fillA}">${poly(legPoly)}${poly(mirror(legPoly))}${poly(shaftPoly)}</g>`;
  let lace = '';
  const brace = (edgeA, edgeB, step) => {
    for (let i = 0; i + step < edgeA.length; i += step) {
      lace += `M${r1(edgeA[i][0])} ${r1(edgeA[i][1])}L${r1(edgeB[i + step][0])} ${r1(edgeB[i + step][1])}M${r1(edgeB[i][0])} ${r1(edgeB[i][1])}L${r1(edgeA[i + step][0])} ${r1(edgeA[i + step][1])}`;
    }
  };
  brace(legL, legIn, 2);
  brace(mirror(legL), mirror(legIn), 2);
  brace(shaftL, mirror(shaftL), 2);
  // horizontal struts
  for (let i = 0; i < shaftL.length; i += 2)
    lace += `M${r1(shaftL[i][0])} ${r1(shaftL[i][1])}H${r1(2 * x - shaftL[i][0])}`;
  out += `<path d="${lace}" stroke="${lit ? '#f7d58e' : ink}" stroke-width="${r1(sw * 0.55)}" fill="none" opacity="${lit ? 0.75 : 0.8}"/>`;
  // the main members: the legs' edges, the pylon's edges
  const edges = [legL, legIn, mirror(legL), mirror(legIn), shaftL, mirror(shaftL)];
  out += edges
    .map(
      (e) =>
        `<path d="${pts(e)}" stroke="${lit ? '#ffe2a2' : ink}" stroke-width="${r1(sw * 1.5)}" fill="none"/>`,
    )
    .join('');
  // the great arch between the legs, the platforms, the top
  const ax = inner(0.02);
  const arch = Array.from({ length: 25 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / 24;
    return [x + ax * Math.cos(a), Y(0.03) + (Y(0.145) - Y(0.03)) * -Math.sin(a)];
  });
  out += `<path d="${pts(arch)}" stroke="${lit ? '#ffe2a2' : ink}" stroke-width="${r1(sw * 2)}" fill="none"/>`;
  const plat = (t, th, k) =>
    box(x - hw(t) * k, Y(t) - h * th, hw(t) * 2 * k, h * th, `fill="${lit ? '#ffdc98' : ink}"`);
  out += plat(0.17, 0.022, 1.12) + plat(0.35, 0.014, 1.2) + plat(0.84, 0.01, 1.8);
  // the lantern at the top and the mast
  out += `<path d="M${r1(x - h * 0.012)} ${r1(Y(0.84))}L${r1(x - h * 0.007)} ${r1(Y(0.93))}H${r1(x + h * 0.007)}L${r1(x + h * 0.012)} ${r1(Y(0.84))}Z" fill="${lit ? '#ffe2a2' : ink}"/>`;
  out += `<path d="M${r1(x)} ${r1(Y(0.93))}V${r1(Y(1))}" stroke="${lit ? '#ffe2a2' : ink}" stroke-width="${r1(sw * 1.1)}"/>`;
  if (lit) {
    out = glow({ x, y: Y(0.3), rx: h * 0.45, ry: h * 0.7, color: '#f2b85e', a: 0.3, blend: 'screen' }) + out;
    const items = [];
    for (let i = 0; i < sparkle; i++) {
      const t = rnd() ** 1.25 * 0.9;
      const w = hw(t);
      const xi = x + (rnd() * 2 - 1) * w * (t < 0.35 ? 1 : 0.9);
      if (t < 0.3 && Math.abs(xi - x) < inner(t)) continue;
      items.push([xi, Y(t), 4 + rnd() * 10, 0.5 + rnd() * 0.5]);
    }
    out += glints({ items, color: '#fff6e2' });
  }
  return out;
};

// ---------------------------------------------------------------------------------------------------
// 1. the street at dusk: cream façades, iron balconies, a café's awning, wet cobbles

const street = () => {
  const rnd = prng(606);
  const f = 1000;
  const cam = camera({ f, vx: 540, vy: 1300, eye: 1.6 });
  const { p } = cam;
  const XF = 7.5;
  const top = 18.4;
  const zF = 160;
  let s = skyFill([
    [0, '#3a3f68'],
    [0.14, '#565683'],
    [0.28, '#8e7fa3'],
    [0.4, '#c9a2ab'],
    [0.5, '#e0b8ad'],
    [0.6, '#ecc9a6'],
    [0.68, '#efd2a9'],
    [1, '#d8b39e'],
  ]);
  s += glow({ x: 540, y: 1230, rx: 700, ry: 520, color: '#f4d3a2', a: 0.55 });
  s += wisps({
    color: '#f1c9b4',
    a: 0.35,
    seed: 61,
    items: [
      [540, 380, 300, 14, -3],
      [470, 560, 260, 12, 2],
      [620, 700, 220, 10, -1],
    ],
  });
  // the far end: façades lost in the evening haze
  s += cam.poly(
    [
      [-XF, 0, zF],
      [XF, 0, zF],
      [XF, 22, zF],
      [-XF, 22, zF],
    ],
    'fill="#dcb9ad"',
  );
  let fac = '';
  let lights = '';
  const refl = [];
  for (const side of [-1, 1]) {
    const X = side * XF;
    const wallCol = side < 0 ? '#a08f98' : '#c9b0a6';
    const g = nid('fc');
    const [n0] = p([X, 0, 3]);
    const [f0] = p([X, 0, zF]);
    fac += `<defs>${ugrad(
      g,
      [
        [0, mix(wallCol, '#6c6278', 0.25)],
        [0.5, wallCol],
        [1, '#dcb9ad'],
      ],
      [n0, 0, f0, 0],
    )}</defs>`;
    fac += cam.poly(
      [
        [X, 0, 3],
        [X, top, 3],
        [X, top, zF],
        [X, 0, zF],
      ],
      `fill="url(#${g})"`,
    );
    // separate buildings along the street: each its own shade of stone
    for (let z = 3, k = 0; z < zF; k += 1) {
      const len = 14 + rnd() * 10;
      const z1 = Math.min(zF, z + len);
      fac += cam.poly(
        [
          [X, 0, z],
          [X, top, z],
          [X, top, z1],
          [X, 0, z1],
        ],
        `fill="${rnd() < 0.5 ? '#f4e6da' : '#6d6070'}" opacity="${r3(0.05 + rnd() * 0.1)}"`,
      );
      fac += `<path d="${pts([p([X, 0, z1]), p([X, top + 3, z1])])}" stroke="#5e5468" stroke-width="${r1(Math.max(1, 60 / z1))}" opacity=".35"/>`;
      z = z1;
    }
    // cornices and floor bands
    for (const yy of [4.0, 7.2, 10.2, 13.2, 16.2, top]) {
      fac += `<path d="${pts([p([X, yy, 3]), p([X, yy, zF])])}" stroke="#f1e2d0" stroke-width="3" opacity=".55"/>`;
      fac += `<path d="${pts([p([X, yy - 0.12, 3]), p([X, yy - 0.12, zF])])}" stroke="#6b5f72" stroke-width="3" opacity=".35"/>`;
    }
    // windows, bay by bay; lit ones glow
    for (let z = 3.4; z < 75; z += 3.1) {
      for (const [k, yy] of [4.7, 7.8, 10.8, 13.8, 16.7].entries()) {
        const h = k === 4 ? 1.5 : 2.1;
        const litW = rnd() < 0.2;
        const q = [
          [X, yy, z],
          [X, yy + h, z],
          [X, yy + h, z + 1.25],
          [X, yy, z + 1.25],
        ];
        const glass = litW
          ? mix('#f2c27b', '#e89f63', rnd() * 0.4)
          : mix('#5a5775', '#b18fa2', 0.3 + rnd() * 0.3);
        fac += cam.poly(q, `fill="${glass}"`);
        fac += `<path d="${pts([p([X, yy + h * 0.62, z]), p([X, yy + h * 0.62, z + 1.25])])}M${pts([p([X, yy, z + 0.62]), p([X, yy + h, z + 0.62])]).slice(1)}" stroke="#3b3547" stroke-width="${r1(Math.max(0.6, 40 / z))}" opacity=".5"/>`;
        if (litW) {
          const [lx, ly] = p([X, yy + h / 2, z + 0.62]);
          lights += glow({ x: lx, y: ly, rx: Math.max(10, 900 / z), color: '#f5c77f', a: 0.35 });
          if (k < 2) refl.push([lx, ly, 900 / z]);
        }
      }
      // shopfronts on the ground floor
      const shopLit = rnd() < 0.6;
      fac += cam.poly(
        [
          [X, 0.3, z],
          [X, 3.3, z],
          [X, 3.3, z + 2.6],
          [X, 0.3, z + 2.6],
        ],
        `fill="${shopLit ? mix('#f2c27b', '#d98e5a', rnd() * 0.5) : '#4b4460'}"`,
      );
      if (shopLit) {
        const [lx, ly] = p([X, 1.8, z + 1.3]);
        lights += glow({ x: lx, y: ly, rx: Math.max(14, 1600 / z), color: '#f6c67a', a: 0.45 });
        refl.push([lx, ly, 1600 / z]);
      }
    }
    // continuous iron balconies on the second and fifth floors
    for (const yy of [4.6, 13.7]) {
      const Xb = X - side * 0.45;
      fac += cam.poly(
        [
          [Xb, yy, 3],
          [Xb, yy + 1, 3],
          [Xb, yy + 1, zF],
          [Xb, yy, zF],
        ],
        'fill="#2b2a3d" opacity=".42"',
      );
      let bars = '';
      for (let z = 3; z < 40; z += 0.28) bars += `M${pts([p([Xb, yy, z]), p([Xb, yy + 1, z])]).slice(1)}`;
      fac += `<path d="${bars}" stroke="#2b2a3d" stroke-width="1.6" opacity=".55"/>`;
      fac += `<path d="${pts([p([Xb, yy + 1, 3]), p([Xb, yy + 1, zF])])}" stroke="#23222f" stroke-width="4" opacity=".8"/>`;
    }
    // the mansard roof: zinc, dormers, chimneys
    const Xr = X - side * 2;
    fac += cam.poly(
      [
        [X, top, 3],
        [Xr, top + 3.2, 3],
        [Xr, top + 3.2, zF],
        [X, top, zF],
      ],
      `fill="${side < 0 ? '#6f718a' : '#8a8aa0'}"`,
    );
    for (let z = 4; z < 90; z += 3.1)
      fac += cam.poly(
        [
          [X - side * 0.5, top + 0.4, z],
          [X - side * 0.5, top + 1.9, z],
          [X - side * 0.5, top + 1.9, z + 1.1],
          [X - side * 0.5, top + 0.4, z + 1.1],
        ],
        `fill="${rnd() < 0.3 ? '#efc07c' : '#58566d'}"`,
      );
    for (let z = 5 + rnd() * 3; z < 120; z += 7 + rnd() * 8) {
      const cw = 0.7;
      fac += cam.poly(
        [
          [Xr, top + 3.2, z],
          [Xr, top + 5, z],
          [Xr, top + 5, z + cw],
          [Xr, top + 3.2, z + cw],
        ],
        'fill="#9a7f78"',
      );
      for (let k = 0; k < 3; k++) {
        const [cx0, cy0] = p([Xr, top + 5, z + 0.15 + k * 0.2]);
        fac += `<rect x="${r1(cx0 - 1.2)}" y="${r1(cy0 - 12 * (8 / z))}" width="${r1(Math.max(1.5, 14 / z))}" height="${r1(Math.max(2, 90 / z))}" fill="#b97a5e"/>`;
      }
    }
  }
  s += blurred(0.9, fac);
  s += lights;
  // the café on the left: its awning, the warm room behind, little tables on the pavement
  const aw = [
    [-XF, 3.3, 7.5],
    [-XF + 2.2, 2.55, 7.5],
    [-XF + 2.2, 2.55, 19],
    [-XF, 3.3, 19],
  ];
  const agid = nid('aw');
  s += `<defs>${ugrad(
    agid,
    [
      [0, '#b86a6e'],
      [1, '#d69994'],
    ],
    [0, p([-XF, 3.3, 10])[1], 0, p([-XF + 2.2, 2.55, 10])[1]],
  )}</defs>`;
  s += cam.poly(
    [
      [-XF, 0.2, 7.5],
      [-XF, 3.2, 7.5],
      [-XF, 3.2, 19],
      [-XF, 0.2, 19],
    ],
    'fill="#f0bd78"',
  );
  s += glow({ x: p([-XF, 1.6, 11])[0], y: p([-XF, 1.6, 11])[1], rx: 260, ry: 200, color: '#f6c67f', a: 0.6 });
  s += cam.poly(aw, `fill="url(#${agid})"`);
  // stripes on the awning and its scalloped valance
  let st = '';
  for (let z = 7.5; z < 19; z += 0.55)
    st += cam.poly(
      [
        [-XF, 3.3, z],
        [-XF + 2.2, 2.55, z],
        [-XF + 2.2, 2.55, z + 0.27],
        [-XF, 3.3, z + 0.27],
      ],
      'fill="#f1d8cf" opacity=".35"',
    );
  s += st;
  s += cam.poly(
    [
      [-XF + 2.2, 2.55, 7.5],
      [-XF + 2.2, 2.25, 7.5],
      [-XF + 2.2, 2.25, 19],
      [-XF + 2.2, 2.55, 19],
    ],
    'fill="#9d5a5f"',
  );
  // string lights under the awning's edge
  for (let z = 7.8; z < 19; z += 0.7) {
    const [lx, ly] = p([-XF + 2.1, 2.15, z]);
    s +=
      glow({ x: lx, y: ly, rx: Math.max(6, 160 / z), color: '#ffd99a', a: 0.8 }) +
      `<circle cx="${r1(lx)}" cy="${r1(ly)}" r="${r1(Math.max(1, 24 / z))}" fill="#fff1cf"/>`;
  }
  // tables and chairs in silhouette against the café's glow
  let furn = '';
  for (const [tz, tx] of [
    [9, -5.9],
    [11.5, -5.6],
    [14.2, -5.9],
    [17, -5.6],
  ]) {
    const [x0, y0] = p([tx, 0.75, tz]);
    const [, yb] = p([tx, 0, tz]);
    const r = 0.35 * (f / tz);
    furn += `<ellipse cx="${r1(x0)}" cy="${r1(y0)}" rx="${r1(r)}" ry="${r1(r * 0.25)}" fill="#3a2e38"/><path d="M${r1(x0)} ${r1(y0)}V${r1(yb)}" stroke="#3a2e38" stroke-width="${r1(Math.max(1.5, 30 / tz))}"/>`;
    for (const d of [-1, 1]) {
      const [cx0, cy0] = p([tx + d * 0.55, 0.45, tz]);
      const [, cyb] = p([tx + d * 0.55, 0, tz]);
      const [, cyt] = p([tx + d * 0.55, 0.95, tz]);
      furn += `<path d="M${r1(cx0 - d * r * 0.3)} ${r1(cyb)}V${r1(cy0)}H${r1(cx0 + d * r * 0.3)}V${r1(cyb)}M${r1(cx0 + d * r * 0.3)} ${r1(cy0)}V${r1(cyt)}" stroke="#3a2e38" stroke-width="${r1(Math.max(1.2, 22 / tz))}" fill="none"/>`;
    }
  }
  s += blurred(0.8, furn);
  // street lamps along both pavements
  for (const side of [-1, 1])
    for (let z = side < 0 ? 24 : 10; z < 110; z += 16) {
      const X = side * 5.1;
      const [bx, by] = p([X, 0, z]);
      const [tx, ty] = p([X, 4.1, z]);
      const sc = f / z;
      s += `<path d="M${r1(bx)} ${r1(by)}V${r1(ty)}" stroke="#2c2a3a" stroke-width="${r1(Math.max(1.2, 0.12 * sc))}"/>`;
      s += paneLantern({
        x: tx,
        y: ty - 0.55 * sc,
        s: 0.22 * sc,
        glass: '#f7cf86',
        metal: '#2c2a3a',
        halo: 1,
      });
      refl.push([tx, ty - 0.3 * sc, 1.4 * sc]);
    }
  // the road: wet cobbles near us, a sheen of sky and lamp light down the street
  const roadG = nid('rd');
  s += `<defs>${ugrad(
    roadG,
    [
      [0, '#9a8295'],
      [0.25, '#5d5670'],
      [1, '#34324a'],
    ],
    [0, 1290, 0, H],
  )}</defs>`;
  s += cam.poly(
    [
      [-XF, 0, 2],
      [XF, 0, 2],
      [XF, 0, zF],
      [-XF, 0, zF],
    ],
    `fill="url(#${roadG})"`,
  );
  // the pavements' kerbs
  for (const side of [-1, 1])
    s += `<path d="${pts([p([side * 4.6, 0.02, 2.4]), p([side * 4.6, 0.02, zF])])}" stroke="#b69fae" stroke-width="3" opacity=".45"/>`;
  let cob = '';
  for (let z = 1.9; z < 12; z += 0.11) {
    const off = (Math.round(z / 0.11) % 2) * 0.07;
    for (let X = -4.6 + off; X < 4.6; X += 0.14) {
      const [x0, y0] = p([X, 0, z]);
      const [x1] = p([X + 0.12, 0, z]);
      const [, y1] = p([X, 0, z + 0.095]);
      const shine = rnd();
      cob += `<rect x="${r1(x0)}" y="${r1(y1)}" width="${r1(x1 - x0)}" height="${r1(y0 - y1)}" rx="${r1((x1 - x0) * 0.4)}" fill="${mix('#4d4763', '#3d3a52', shine)}" opacity=".55"/>`;
    }
  }
  s += blurred(1.1, cob);
  // reflections: streaks of warm light below each lamp and window
  let rf = '';
  for (const [x, y, sz] of refl) {
    const yr = 1290 + (1290 - y) * 1.05;
    if (yr > H + 200) continue;
    rf += `<ellipse cx="${r1(x)}" cy="${r1(yr)}" rx="${r1(Math.max(4, sz * 0.12))}" ry="${r1(Math.max(20, (yr - 1290) * 0.55))}" fill="#f6c77f" opacity=".45"/>`;
  }
  s += soft(
    { box: [-100, 1200, W + 200, 900], blur: 8, disp: 26, freq: 0.03, fx: 3 },
    rf,
    'style="mix-blend-mode:screen"',
  );
  s += glow({ x: 540, y: 1320, rx: 260, ry: 90, color: '#f1c3a5', a: 0.45, blend: 'screen' });
  // evening air
  s += veil('#d8b2ac', [
    [500, 0],
    [1000, 0.16],
    [1300, 0.2],
    [1500, 0],
  ]);
  s += vignette(0.4, '#262a42');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 2. the tower at sunset over zinc roofs and chimneys: a calm pink-gold sky, the tower low to the right

const rooftops = (rnd, { y0: _y0, rows, pal, seed: _seed = 1, litP = 0.25, chim = 1 }) => {
  let out = '';
  rows.forEach((row, _ri) => {
    const { y, h, col, haze } = row;
    let x = -80 - rnd() * 100;
    while (x < W + 80) {
      const w = 140 + rnd() * 220;
      const ry = y + (rnd() - 0.5) * 30;
      const slope = h * (0.6 + rnd() * 0.3);
      const c = mix(col, pal.haze, haze);
      // a mansard: steep zinc with a flat top, a stone band under it
      out += `<path d="M${r1(x)} ${r1(ry + h)}L${r1(x + w * 0.1)} ${r1(ry + h - slope)}H${r1(x + w * 0.9)}L${r1(x + w)} ${r1(ry + h)}Z" fill="${c}"/>`;
      out += `<path d="M${r1(x + w * 0.1)} ${r1(ry + h - slope)}H${r1(x + w * 0.9)}" stroke="${mix('#e8c9b5', pal.haze, haze)}" stroke-width="3" opacity=".6"/>`;
      out += box(x - 4, ry + h, w + 8, 400, `fill="${mix(mix('#b89f9e', col, 0.4), pal.haze, haze)}"`);
      out += box(x - 6, ry + h - 2, w + 12, 8, `fill="${mix('#ead1bf', pal.haze, haze)}" opacity=".7"`);
      // dormers
      for (let dx = x + 24 + rnd() * 30; dx < x + w - 40; dx += 90 + rnd() * 70) {
        const lit = rnd() < litP;
        out += `<path d="M${r1(dx - 3)} ${r1(ry + h - slope * 0.2)}V${r1(ry + h - slope * 0.72)}L${r1(dx + 11)} ${r1(ry + h - slope * 0.86)}L${r1(dx + 25)} ${r1(ry + h - slope * 0.72)}V${r1(ry + h - slope * 0.2)}Z" fill="${mix(mix(col, '#9a98ae', 0.35), pal.haze, haze)}"/>`;
        out += box(
          dx + 4,
          ry + h - slope * 0.62,
          14,
          slope * 0.36,
          `fill="${lit ? '#e9b877' : mix('#3e3c55', pal.haze, haze * 0.8)}" opacity=".85"`,
        );
        if (lit) out += glow({ x: dx + 11, y: ry + h - slope * 0.45, rx: 36, color: '#f2c27b', a: 0.3 });
      }
      // chimney stacks with their pots
      if (chim && rnd() < 0.8) {
        const cx0 = x + w * (0.2 + rnd() * 0.6);
        const ch = 40 + rnd() * 50;
        out += box(cx0, ry + h - slope - ch, 44, ch + 4, `fill="${mix('#a88578', pal.haze, haze)}"`);
        for (let k = 0; k < 4; k++)
          out += box(
            cx0 + 4 + k * 10,
            ry + h - slope - ch - 14,
            7,
            16,
            `fill="${mix('#c07e5e', pal.haze, haze)}"`,
          );
      }
      x += w + rnd() * 10;
    }
  });
  return out;
};

const towerSunset = () => {
  const rnd = prng(707);
  let s = skyFill([
    [0, '#3d4068'],
    [0.14, '#5b5584'],
    [0.28, '#8f78a0'],
    [0.42, '#c796a5'],
    [0.54, C.rose],
    [0.62, '#ebc4a4'],
    [0.7, '#f1cf98'],
    [0.76, '#f2c886'],
    [1, '#d8a88c'],
  ]);
  s += glow({ x: 330, y: 1390, rx: 1100, ry: 700, color: '#f5cf92', a: 0.55 });
  s += glow({ x: 330, y: 1410, rx: 240, ry: 160, color: '#fbe6bb', a: 0.75 });
  const _pal = (t) => ({
    top: mix('#f4cfa6', '#f1c79a', t),
    mid: mix('#c99aa6', '#d3a2a2', t),
    bot: mix('#9a84a6', '#a88aa4', t),
  });
  s += wisps({
    color: '#f0c3ae',
    a: 0.45,
    seed: 71,
    items: [
      [260, 700, 420, 16, -3],
      [760, 620, 380, 14, 2],
      [520, 860, 520, 18, -1],
      [180, 1000, 380, 12, 2],
    ],
  });
  s += wisps({
    color: '#f3cfae',
    a: 0.4,
    seed: 79,
    items: [
      [860, 1150, 300, 12, -2],
      [180, 1230, 280, 10, 2],
    ],
  });
  // the tower in silhouette, softened by the air
  s += blurred(1.1, tower({ x: 790, base: 1470, h: 760, ink: '#3b3552', fillA: 0.42, seed: 3 }));
  s += glow({ x: 790, y: 1300, rx: 320, ry: 200, color: '#f3c893', a: 0.25, blend: 'screen' });
  // the roofs: rows from far (hazy rose) to near (navy zinc), dormers lit
  const hazeC = '#d9aaa0';
  s += blurred(
    2.4,
    rooftops(rnd, {
      rows: [{ y: 1380, h: 70, col: '#8a7f9c', haze: 0.55 }],
      pal: { haze: hazeC },
      litP: 0.15,
    }),
  );
  s += mist({ y: 1450, h: 40, x0: -100, x1: 1180, color: '#e0b3a2', a: 0.45, seed: 77, n: 8 });
  s += blurred(
    1.8,
    rooftops(rnd, {
      rows: [{ y: 1480, h: 110, col: '#6f6a88', haze: 0.3 }],
      pal: { haze: hazeC },
      litP: 0.25,
    }),
  );
  s += mist({ y: 1600, h: 50, x0: -100, x1: 1180, color: '#d8a9a0', a: 0.35, seed: 78, n: 8 });
  s += blurred(
    1.4,
    rooftops(rnd, {
      rows: [{ y: 1650, h: 170, col: '#4f4d6a', haze: 0.08 }],
      pal: { haze: hazeC },
      litP: 0.35,
    }),
  );
  s += veil('#e7b9a6', [
    [600, 0],
    [1100, 0.1],
    [1400, 0.16],
    [1920, 0.04],
  ]);
  s += vignette(0.36, '#2c2d48');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 3. the bridge of lamps over the river, the water holding a pink-lilac sky

const candelabra = (x, y, s, { lit = 1 } = {}) => {
  // a post with a pedestal and a crown of globes
  let out = `<path d="M${r1(x - s * 0.5)} ${r1(y)}H${r1(x + s * 0.5)}L${r1(x + s * 0.3)} ${r1(y - s * 1.2)}H${r1(x - s * 0.3)}Z" fill="#2f2c3f"/>`;
  out += `<path d="M${r1(x)} ${r1(y - s * 1.2)}V${r1(y - s * 4.6)}" stroke="#2f2c3f" stroke-width="${r1(s * 0.22)}"/>`;
  out += `<path d="M${r1(x - s * 1.1)} ${r1(y - s * 4.4)}Q${r1(x)} ${r1(y - s * 3.8)} ${r1(x + s * 1.1)} ${r1(y - s * 4.4)}" stroke="#2f2c3f" stroke-width="${r1(s * 0.14)}" fill="none"/>`;
  const globes = [
    [x - s * 1.1, y - s * 4.75, 0.42],
    [x + s * 1.1, y - s * 4.75, 0.42],
    [x, y - s * 5.2, 0.5],
  ];
  for (const [gx, gy, r] of globes) {
    out += glow({ x: gx, y: gy, rx: s * 4.2 * lit, color: '#f5c87f', a: 0.4, blend: 'screen' });
    out += `<circle cx="${r1(gx)}" cy="${r1(gy)}" r="${r1(s * r)}" fill="#fbe4b4"/>`;
  }
  return out;
};

const bridge = () => {
  const rnd = prng(808);
  let s = skyFill([
    [0, '#474a78'],
    [0.14, '#62608e'],
    [0.28, '#9582a8'],
    [0.4, '#c29ab0'],
    [0.5, '#dbb1b3'],
    [0.56, '#e8c3b2'],
    [0.61, '#eccfb4'],
    [0.64, '#e6c6b4'],
    [1, '#6c6488'],
  ]);
  s += glow({ x: 620, y: 1120, rx: 900, ry: 420, color: '#f3d3aa', a: 0.5 });
  const pal = (t) => ({
    top: mix('#f2cdb4', '#f4d4b6', t),
    mid: mix('#c49fb4', '#cda6b2', t),
    bot: mix('#9486aa', '#9c8cab', t),
  });
  s += wisps({
    color: '#f0c8b8',
    a: 0.35,
    seed: 81,
    items: [
      [300, 520, 420, 14, -2],
      [800, 680, 380, 14, 2],
      [520, 830, 520, 16, -1],
    ],
  });
  s += cumulus({
    cx: 250,
    base: 1010,
    width: 560,
    height: 120,
    n: 26,
    size: 46,
    pal,
    seed: 83,
    bands: 3,
    dir: [0.3, 1, 0.5, 0],
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 900,
    base: 960,
    width: 480,
    height: 100,
    n: 22,
    size: 42,
    pal,
    seed: 85,
    bands: 3,
    dir: [0.3, 1, 0.5, 0],
    flatBase: 0.5,
  });
  // the far bank: rooflines and a dome in the haze
  let far = '';
  for (let x = -40; x < W + 60; x += 60 + rnd() * 90)
    far += box(x, 1100 - rnd() * 40, 70 + rnd() * 70, 120, 'fill="#9d88a6"');
  far += `<path d="M180 1060A70 76 0 0 1 320 1060Z" fill="#9784a3"/><rect x="176" y="1056" width="148" height="60" fill="#9784a3"/><path d="M250 986V960" stroke="#9784a3" stroke-width="5"/>`;
  s += blurred(2, far);
  s += mist({ y: 1120, h: 36, x0: -100, x1: 1180, color: '#dcb6b4', a: 0.5, seed: 87, n: 8 });
  // the water: the sky again, darker, broken by ripples
  const wg = nid('wt');
  s += `<defs>${ugrad(
    wg,
    [
      [0, '#d9b4b8'],
      [0.12, '#c7a2b6'],
      [0.4, '#8f7ea3'],
      [1, '#4d4b72'],
    ],
    [0, 1190, 0, H],
  )}</defs>${box(0, 1190, W, H - 1190, `fill="url(#${wg})"`)}`;
  let rip = '';
  for (let i = 0; i < 160; i++) {
    const y = 1200 + rnd() ** 1.7 * 720;
    const w = 20 + ((y - 1190) / 720) * 160 * (0.4 + rnd());
    rip += `<ellipse cx="${r1(rnd() * W)}" cy="${r1(y)}" rx="${r1(w)}" ry="${r1(1 + ((y - 1190) / 720) * 3)}" fill="${rnd() < 0.5 ? '#f1cfc0' : '#5b547c'}" opacity="${r3(0.2 + rnd() * 0.25)}"/>`;
  }
  s += blurred(1, rip);
  // the bridge: a low stone arch, a balustrade, lamps along it, pillars at the ends
  const deckY = 1150;
  const archTop = 1190;
  const span = [
    [-80, 1330],
    [1160, 1330],
  ];
  const bridgeCol = '#8a7892';
  let br = `<path d="M-100 ${deckY - 30}H${W + 100}V${deckY + 30}H-100Z" fill="${bridgeCol}"/>`;
  br += `<path d="M-100 ${deckY + 30}H${W + 100}V${archTop + 10}Q${W / 2} ${archTop - 10} -100 ${archTop + 10}Z" fill="${bridgeCol}"/>`;
  // the soffit of the arch, dark, and the far bank glimpsed under it
  br += `<path d="M${span[0][0]} ${span[0][1]}Q${W / 2} ${archTop - 60} ${span[1][0]} ${span[1][1]}L${span[1][0]} ${archTop + 30}Q${W / 2} ${archTop - 20} ${span[0][0]} ${archTop + 30}Z" fill="#5e5274"/>`;
  // balustrade
  let bal = `<rect x="-100" y="${deckY - 62}" width="${W + 200}" height="8" fill="#b7a3b1"/>`;
  for (let x = -90; x < W + 90; x += 16)
    bal += `<path d="M${x} ${deckY - 54}c-5 8 5 14 0 22c-5 8 5 10 0 12" stroke="#8d7a95" stroke-width="6" fill="none"/>`;
  bal += `<rect x="-100" y="${deckY - 34}" width="${W + 200}" height="6" fill="#a08ea3"/>`;
  br += bal;
  br += `<path d="M-100 ${deckY - 26}H${W + 100}" stroke="#d9c0bd" stroke-width="3" opacity=".6"/>`;
  // garlands of carved ornament along the arch's face
  let orn = '';
  for (let x = 20; x < W; x += 110)
    orn += `<circle cx="${x}" cy="${deckY + 8}" r="11" fill="#c9a877" opacity=".75"/>`;
  br += orn;
  s += blurred(0.8, br);
  // the lamps (standing on the parapet), reflected below
  const lampXs = [70, 300, 540, 780, 1010];
  let lamps = '';
  let refl = '';
  for (const lx of lampXs) {
    lamps += candelabra(lx, deckY - 62, 22);
    refl += `<ellipse cx="${lx}" cy="${deckY + 300}" rx="9" ry="150" fill="#f6c97f" opacity=".32"/><ellipse cx="${lx}" cy="${deckY + 200}" rx="22" ry="40" fill="#f6c97f" opacity=".22"/>`;
  }
  // the end pillars with gilded crowns
  for (const px of [-20, W + 20]) {
    lamps += box(px - 50, 760, 100, deckY - 760, 'fill="#8a7892"');
    lamps += box(px - 58, 750, 116, 20, 'fill="#b19cae"');
    lamps += `<path d="M${px - 40} 750Q${px} 650 ${px + 40} 750Z" fill="#c9a26a"/>`;
    lamps += glow({ x: px, y: 700, rx: 90, color: '#e9c07e', a: 0.35, blend: 'screen' });
  }
  s += blurred(0.7, lamps);
  s += soft(
    { box: [-100, 1150, W + 200, 800], blur: 7, disp: 44, freq: 0.035, fx: 5 },
    refl,
    'style="mix-blend-mode:screen"',
  );
  // the bridge's reflection, darker, broken
  s += soft(
    { box: [-100, 1180, W + 200, 400], blur: 4, disp: 22, freq: 0.03, fx: 4 },
    `<path d="M-100 1236Q${W / 2} 1216 ${W + 100} 1236V1270Q${W / 2} 1250 -100 1270Z" fill="#524a6e" opacity=".5"/>`,
  );
  s += glow({ x: 540, y: 1400, rx: 700, ry: 260, color: '#e9c0b8', a: 0.25, blend: 'screen' });
  s += veil('#d8b3b5', [
    [500, 0],
    [950, 0.12],
    [1200, 0.12],
    [1500, 0],
  ]);
  s += vignette(0.38, '#2a2c48');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 4. blue hour: the tower lit gold, glittering, the river below

const sparkle = () => {
  const rnd = prng(909);
  let s = skyFill([
    [0, '#1f2a4a'],
    [0.2, '#283661'],
    [0.4, '#3a4a7c'],
    [0.56, '#57609a'],
    [0.66, '#7c72a2'],
    [0.72, '#a28aa6'],
    [0.76, '#8e7c9c'],
    [1, '#2b3052'],
  ]);
  s += stars({ n: 80, y0: 0, y1: 600, seed: 9, color: '#eef0fa', a: [0.2, 0.6], big: 3 });
  s += glow({ x: 700, y: 1400, rx: 1000, ry: 380, color: '#c79aa8', a: 0.35 });
  s += wisps({
    color: '#8f86ae',
    a: 0.3,
    seed: 91,
    items: [
      [260, 820, 420, 14, -2],
      [880, 760, 360, 12, 2],
    ],
  });
  // the far bank: trees and roofs in blue silhouette, windows lit
  const dark = { lit: '#43507a', mid: '#333e63', shade: '#252d4c' };
  let wood = [];
  for (let x = -80; x < W + 100; x += 60 + rnd() * 60)
    wood = wood.concat(crown(rnd, x, 1400 + rnd() * 30, 150 + rnd() * 70, 110 + rnd() * 50, 5));
  s += foliage({
    lobes: wood,
    pal: dark,
    seed: 93,
    grain: 0.05,
    edge: 9,
    clump: 18,
    tex: 0.3,
    relief: 4,
    light: [0.5, 0, 0.5, 1],
  });
  // the tower, lit gold
  const tw = tower({ x: 720, base: 1450, h: 1110, mode: 'lit', fillA: 0.3, seed: 5, sparkle: 150 });
  s += blurred(0.9, tw);
  s += glow({ x: 720, y: 1300, rx: 420, ry: 260, color: '#f0b862', a: 0.3, blend: 'screen' });
  // the embankment and the river
  s += box(-20, 1455, W + 40, 40, 'fill="#3b3f63"');
  s += `<path d="M-20 1458H${W + 20}" stroke="#d9b07a" stroke-width="3" opacity=".5"/>`;
  for (let x = 30; x < W; x += 140)
    s +=
      glow({ x, y: 1450, rx: 22, color: '#f6cf8a', a: 0.8 }) +
      `<circle cx="${x}" cy="1450" r="3" fill="#fff0cf"/>`;
  const wg = nid('wt');
  s += `<defs>${ugrad(
    wg,
    [
      [0, '#46507e'],
      [0.4, '#343e68'],
      [1, '#222a48'],
    ],
    [0, 1495, 0, H],
  )}</defs>${box(0, 1495, W, H - 1495, `fill="url(#${wg})"`)}`;
  // the tower's reflection: broken gold streaks
  let rf = '';
  for (let i = 0; i < 90; i++) {
    const y = 1500 + rnd() ** 1.3 * 420;
    const spread = 60 + (y - 1500) * 0.35;
    rf += `<ellipse cx="${r1(720 + (rnd() - 0.5) * spread)}" cy="${r1(y)}" rx="${r1(10 + rnd() * 40)}" ry="${r1(2 + rnd() * 3)}" fill="${rnd() < 0.6 ? '#f2c27b' : '#fbe2b0'}" opacity="${r3(0.3 + rnd() * 0.5)}"/>`;
  }
  s += blurred(1.2, rf);
  let lampRf = '';
  for (let x = 30; x < W; x += 140)
    lampRf += `<ellipse cx="${x}" cy="${r1(1570 + rnd() * 40)}" rx="6" ry="${r1(50 + rnd() * 50)}" fill="#f6cf8a" opacity=".22"/>`;
  s += soft(
    { box: [-100, 1480, W + 200, 300], blur: 4, disp: 26, freq: 0.04, fx: 5 },
    lampRf,
    'style="mix-blend-mode:screen"',
  );
  s += glow({ x: 720, y: 1620, rx: 200, ry: 220, color: '#f2c27b', a: 0.2, blend: 'screen' });
  s += veil('#39457a', [
    [300, 0],
    [700, 0.12],
    [1100, 0.1],
    [1300, 0],
  ]);
  s += vignette(0.34, '#161b30');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 5. the ring: an open box on a café table, candlelight, two glasses of champagne, warm bokeh

const flute = (x, base, h, { a = 1 } = {}) => {
  const w = h * 0.13;
  const bowlTop = base - h;
  const bowlBot = base - h * 0.45;
  const g = nid('fg');
  const ch = nid('ch');
  let out = `<defs>${ugrad(
    g,
    [
      [0, '#f6e7c8', 0.55],
      [0.2, '#f6e7c8', 0.1],
      [0.75, '#f6e7c8', 0.08],
      [1, '#f6e7c8', 0.45],
    ],
    [x - w, 0, x + w, 0],
  )}${ugrad(
    ch,
    [
      [0, '#f6d38e', 0.9],
      [0.5, '#e8b35f', 0.85],
      [1, '#c98a45', 0.9],
    ],
    [0, bowlTop + h * 0.12, 0, bowlBot],
  )}</defs>`;
  const bowl = `M${r1(x - w)} ${r1(bowlTop)}C${r1(x - w)} ${r1(bowlTop + h * 0.3)} ${r1(x - w * 0.5)} ${r1(bowlBot - h * 0.02)} ${r1(x)} ${r1(bowlBot)}C${r1(x + w * 0.5)} ${r1(bowlBot - h * 0.02)} ${r1(x + w)} ${r1(bowlTop + h * 0.3)} ${r1(x + w)} ${r1(bowlTop)}Z`;
  const wine = `M${r1(x - w * 0.97)} ${r1(bowlTop + h * 0.12)}C${r1(x - w * 0.97)} ${r1(bowlTop + h * 0.33)} ${r1(x - w * 0.5)} ${r1(bowlBot - h * 0.03)} ${r1(x)} ${r1(bowlBot - h * 0.01)}C${r1(x + w * 0.5)} ${r1(bowlBot - h * 0.03)} ${r1(x + w * 0.97)} ${r1(bowlTop + h * 0.33)} ${r1(x + w * 0.97)} ${r1(bowlTop + h * 0.12)}Z`;
  out += `<g opacity="${a}"><path d="${wine}" fill="url(#${ch})"/><path d="${bowl}" fill="url(#${g})" stroke="#f3e2c2" stroke-width="2" stroke-opacity=".5"/>`;
  out += `<path d="M${r1(x)} ${r1(bowlBot)}V${r1(base - 4)}" stroke="#efe0c2" stroke-width="${r1(w * 0.09)}" opacity=".6"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(base)}" rx="${r1(w * 0.75)}" ry="${r1(w * 0.14)}" fill="none" stroke="#efe0c2" stroke-width="3" opacity=".55"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(bowlTop + h * 0.12)}" rx="${r1(w * 0.97)}" ry="${r1(w * 0.12)}" fill="#fbe7b8" opacity=".55"/>`;
  out += `<path d="M${r1(x - w * 0.72)} ${r1(bowlTop + h * 0.05)}C${r1(x - w * 0.75)} ${r1(bowlTop + h * 0.25)} ${r1(x - w * 0.45)} ${r1(bowlBot - h * 0.08)} ${r1(x - w * 0.2)} ${r1(bowlBot - h * 0.04)}" stroke="#fff6e4" stroke-width="${r1(w * 0.08)}" fill="none" opacity=".55"/>`;
  const rnd = prng(Math.round(x));
  for (let i = 0; i < 18; i++)
    out += `<circle cx="${r1(x + (rnd() - 0.5) * w * 0.9)}" cy="${r1(bowlTop + h * 0.15 + rnd() * (bowlBot - bowlTop - h * 0.2))}" r="${r1(1 + rnd() * 2)}" fill="#fff4d6" opacity=".7"/>`;
  return `${out}</g>`;
};

const ring = () => {
  const _rnd = prng(1001);
  let s = skyFill([
    [0, '#2a2233'],
    [0.4, '#3b2b33'],
    [0.62, '#4b3531'],
    [1, '#2b2129'],
  ]);
  // warm bokeh: café lights far behind
  s += glow({ x: 300, y: 700, rx: 700, ry: 600, color: '#8a5a44', a: 0.45 });
  s += glow({ x: 850, y: 500, rx: 600, ry: 500, color: '#7a4d52', a: 0.4 });
  s += bokeh({
    n: 34,
    area: [-60, 60, W + 60, 1150],
    r: [30, 95],
    colors: ['#f2c27b', '#e3b7b0', '#d9c29a', '#f6d7a0'],
    a: [0.18, 0.5],
    seed: 3,
    blur: 3,
  });
  s += bokeh({
    n: 60,
    area: [-60, 0, W + 60, 1200],
    r: [8, 26],
    colors: ['#f6cf8a', '#f1c1b0'],
    a: [0.2, 0.55],
    seed: 5,
    blur: 1.6,
  });
  // the table: a pale marble top seen at a low angle, lit by the candle
  const ty = 1260;
  const tg = nid('tb');
  s += `<defs>${ugrad(
    tg,
    [
      [0, '#9a7a68'],
      [0.25, '#76584c'],
      [1, '#3a2a2a'],
    ],
    [0, ty, 0, H],
  )}</defs><path d="M-100 ${ty}Q${W / 2} ${ty - 30} ${W + 100} ${ty}V${H}H-100Z" fill="url(#${tg})"/>`;
  s += `<path d="M-100 ${ty}Q${W / 2} ${ty - 30} ${W + 100} ${ty}" stroke="#d8b98c" stroke-width="5" fill="none" opacity=".55"/>`;
  s += blurred(
    6,
    `<path d="M-40 1500C200 1440 400 1560 700 1470S1000 1560 1140 1500" stroke="#d9c3b6" stroke-width="3" fill="none" opacity=".3"/><path d="M-40 1700C300 1640 500 1760 800 1690" stroke="#d9c3b6" stroke-width="2" fill="none" opacity=".25"/>`,
  );
  s += glow({ x: 330, y: 1330, rx: 520, ry: 170, color: '#f2c27b', a: 0.35, blend: 'screen' });
  // the glasses, a little behind the box (softer)
  s += blurred(1.6, flute(770, 1300, 520) + flute(905, 1285, 540));
  s += glow({ x: 830, y: 1000, rx: 200, ry: 300, color: '#f2c27b', a: 0.15, blend: 'screen' });
  // the candle in its glass
  const cx0 = 250;
  s += `<path d="M${cx0 - 62} 1175H${cx0 + 62}L${cx0 + 56} 1330Q${cx0} 1346 ${cx0 - 56} 1330Z" fill="#f2c27b" opacity=".22"/>`;
  s += `<path d="M${cx0 - 50} 1230H${cx0 + 50}V1318Q${cx0} 1330 ${cx0 - 50} 1318Z" fill="#efe1c8"/>`;
  s += `<ellipse cx="${cx0}" cy="1230" rx="50" ry="10" fill="#f9ecd2"/>`;
  s += flameLight(cx0, 1222, 46, { glowR: 6 });
  s += `<path d="M${cx0 - 62} 1175V1325M${cx0 + 62} 1175V1325" stroke="#fbe6be" stroke-width="3" opacity=".4"/>`;
  s += glow({ x: cx0, y: 1195, rx: 180, ry: 200, color: '#f7c77a', a: 0.4, blend: 'screen' });
  // the ring box: dusty rose velvet, open, the ring on its cushion
  const bx = 540;
  const by = 1430;
  const bw = 150;
  const vg = nid('vv');
  s += `<defs><linearGradient id="${vg}" x1="0" y1="0" x2="1" y2="0">${stopsOf([
    [0, '#6a3440'],
    [0.35, '#b47880'],
    [0.6, '#98606a'],
    [1, '#5a2c38'],
  ])}</linearGradient></defs>`;
  let bxs = `<ellipse cx="${bx + 20}" cy="${by + 88}" rx="${bw * 1.3}" ry="30" fill="#1f1618" opacity=".5"/>`;
  // the lid, standing open behind
  bxs += `<path d="M${bx - bw} ${by - 60}L${bx - bw + 8} ${by - 270}Q${bx} ${by - 290} ${bx + bw - 8} ${by - 270}L${bx + bw} ${by - 60}Z" fill="url(#${vg})"/>`;
  bxs += `<path d="M${bx - bw + 22} ${by - 80}L${bx - bw + 28} ${by - 250}Q${bx} ${by - 266} ${bx + bw - 28} ${by - 250}L${bx + bw - 22} ${by - 80}Z" fill="#e8d4c4"/>`;
  bxs += `<path d="M${bx - bw + 22} ${by - 80}L${bx - bw + 28} ${by - 250}Q${bx} ${by - 266} ${bx + bw - 28} ${by - 250}" fill="none" stroke="#b69a8a" stroke-width="4" opacity=".6"/>`;
  // the base
  bxs += `<path d="M${bx - bw} ${by - 60}H${bx + bw}V${by + 70}Q${bx} ${by + 84} ${bx - bw} ${by + 70}Z" fill="url(#${vg})"/>`;
  bxs += `<path d="M${bx - bw} ${by - 60}Q${bx} ${by - 40} ${bx + bw} ${by - 60}Q${bx} ${by - 78} ${bx - bw} ${by - 60}Z" fill="#8a525a"/>`;
  bxs += `<path d="M${bx - bw + 16} ${by - 58}Q${bx} ${by - 44} ${bx + bw - 16} ${by - 58}Q${bx} ${by - 70} ${bx - bw + 16} ${by - 58}Z" fill="#5a2f39"/>`;
  bxs += `<path d="M${bx - bw} ${by - 60}H${bx + bw}" stroke="#d9a9a8" stroke-width="3" opacity=".5"/>`;
  // the ring: a gold band standing in its slot, a stone catching the light
  const rg = nid('rg');
  bxs += `<defs><linearGradient id="${rg}" x1="0" y1="0" x2="1" y2="1">${stopsOf([
    [0, '#fbe3a4'],
    [0.4, '#d9a74f'],
    [0.7, '#f5d38c'],
    [1, '#a8762f'],
  ])}</linearGradient></defs>`;
  bxs += `<ellipse cx="${bx}" cy="${by - 108}" rx="38" ry="46" fill="none" stroke="url(#${rg})" stroke-width="11"/>`;
  bxs += `<path d="M${bx - 16} ${by - 160}L${bx} ${by - 180}L${bx + 16} ${by - 160}L${bx} ${by - 146}Z" fill="#f4f1ee"/><path d="M${bx - 16} ${by - 160}L${bx} ${by - 180}L${bx} ${by - 146}Z" fill="#cfd6e4"/>`;
  s += blurred(0.7, bxs);
  s += glints({
    items: [
      [bx, by - 164, 60, 0.95, 20],
      [bx + 30, by - 110, 18, 0.6, 20],
      [770, 870, 26, 0.5, 20],
      [905, 850, 22, 0.45, 20],
    ],
  });
  s += veil('#3b2a30', [
    [300, 0.1],
    [800, 0.05],
    [1150, 0],
  ]);
  s += vignette(0.4, '#1f1820');
  return [svgLayer(s)];
};

const scenes = {
  'scene-street': { paint: street, seed: 41, post: { gamma: 1.06, bloom: 0.42 } },
  'scene-tower': { paint: towerSunset, seed: 42, post: { gamma: 1.12, bloom: 0.4 } },
  'scene-bridge': { paint: bridge, seed: 43, post: { gamma: 1.1, bloom: 0.42 } },
  'scene-sparkle': { paint: sparkle, seed: 44, post: { gamma: 1, bloom: 0.5 } },
  'scene-ring': { paint: ring, seed: 45, post: { gamma: 0.95, bloom: 0.5 } },
};

await paintScenes({ id: 'paris-nights', scenes, background: '#9a7d86' });
