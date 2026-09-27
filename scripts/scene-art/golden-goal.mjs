// Scroll-scene pictures of the "golden-goal" design (football — a bar mitzvah or a birthday): five
// full-screen 9:16 pictures of one floodlit match night, in the design's palette (pitch greens in mowing
// stripes, night navy, floodlight white, a lime accent): the stadium bowl from above, the tunnel onto the
// pitch, the pitch and its centre circle in light fog, the stands' flags and scarves as bokeh, and the
// penalty area looking toward the goal end. The app draws the ball's curving flight over them and, at the
// end, the goal in the upper middle — so there are no balls or goals here, and the last picture keeps its
// upper middle to a dark, soft stand.
//
//   node scripts/scene-art/golden-goal.mjs [scene …]            the files, and their entries in the list
//   node scripts/scene-art/golden-goal.mjs --draft <dir> [scene …]  drafts only
import {
  W,
  H,
  paintScenes,
  prng,
  mix,
  r1,
  r3,
  nid,
  glow,
  mist,
  rays,
  vignette,
  svgLayer,
  ugrad,
} from './kit.mjs';
import {
  camera,
  worldPath,
  floorArc,
  floorLine,
  bokeh,
  bokehField,
  beam,
  stars,
  hazeTex,
  blurred,
  vgrad,
  rgrad,
} from './action-shared.mjs';

/** the design's palette */
const C = {
  green: '#2E7D32',
  green2: '#3E9A42',
  greenLit: '#62b45f',
  greenDeep: '#1b4f22',
  navy: '#0C1A2E',
  navy2: '#16294a',
  navy3: '#23395f',
  lime: '#C6F432',
  flood: '#f2f6ff',
  floodWarm: '#fff3dc',
  shade: '#081421',
  line: '#eef3ea',
};

/** the crowd's colors, out of focus: scarves and flags, shirts, phone lights */
const CROWD = [
  [C.lime, 3],
  ['#8fd46a', 2],
  [C.green2, 2],
  ['#f2f6ff', 3],
  ['#ffe2b0', 2],
  ['#6f93d8', 2],
  ['#2f4f8f', 2],
];

// ---------------------------------------------------------------------------------------------------
// painting blocks

/** grass under floodlights: a base, mowing stripes (bands of constant x or z, w metres), a fine texture */
const grass = (cam, { x0, x1, z0, z1, along = 'x', w = 5.25, top, seed = 1, stripeA = 0.38 }) => {
  let s = vgrad(
    [
      [0, mix(C.green, '#9cc79c', 0.4)],
      [0.12, mix(C.green2, '#9cc79c', 0.15)],
      [0.5, C.green2],
      [1, C.green],
    ],
    [0, top - 2, W, H - top + 2],
  );
  let d = '';
  if (along === 'x') {
    for (let x = x0, i = 0; x < x1; x += w, i++)
      if (i % 2)
        d += `${worldPath(cam, [
          [x, z0],
          [x + w, z0],
          [x + w, z1],
          [x, z1],
          [x, z0],
        ])}Z`;
  } else {
    for (let z = z0, i = 0; z < z1; z += w, i++)
      if (i % 2)
        d += `${worldPath(cam, [
          [x0, z],
          [x1, z],
          [x1, z + w],
          [x0, z + w],
          [x0, z],
        ])}Z`;
  }
  s += blurred(0.8, `<path d="${d}" fill="${C.greenLit}" opacity="${stripeA}"/>`);
  s += hazeTex({
    box: [0, top, W, H - top],
    color: '#0d3812',
    a: 0.4,
    freq: [0.03, 0.09],
    oct: 3,
    seed: seed + 1,
    k: 1.8,
    b: -0.62,
  });
  s += hazeTex({
    box: [0, top, W, H - top],
    color: '#a8dc9c',
    a: 0.16,
    freq: [0.05, 0.14],
    oct: 2,
    seed: seed + 2,
    k: 1.9,
    b: -0.8,
  });
  return s;
};

/** a stand out of focus: dark tiers, the crowd as bokeh; calmer (sparser, softer) inside calm = [y0, y1] */
const crowdStand = ({
  y0,
  y1,
  seed = 1,
  n = 240,
  r = [7, 24],
  alpha = [0.2, 0.7],
  calm = null,
  base = [C.navy2, '#132238'],
}) => {
  let s = vgrad(
    [
      [0, base[0]],
      [1, base[1]],
    ],
    [0, y0, W, y1 - y0],
  );
  const rnd = prng(seed * 977 + 5);
  let tiers = '';
  for (let y = y0 + 18; y < y1; y += 22 + rnd() * 18) tiers += `M0 ${r1(y)}H${W}`;
  s += blurred(3, `<path d="${tiers}" stroke="#39507e" stroke-width="3" opacity=".3"/>`);
  const inCalm = (y) => calm && y > calm[0] && y < calm[1];
  const items = bokehField({
    n,
    box: [-20, y0, W + 40, y1 - y0],
    r,
    colors: CROWD,
    a: alpha,
    seed,
    weight: (x, y) => (inCalm(y) ? 0.45 : 1),
  }).map((b) => (inCalm(b.y) ? { ...b, r: b.r * 1.4, a: b.a * 0.45 } : b));
  s += bokeh(items, { rim: 0.18, blur: 2.2 });
  return s;
};

/** floodlights on a roof's edge: a row of bright lamps with a wide glare */
const floodRow = ({ y, x0 = 40, x1 = W - 40, n = 9, size = 14, a = 0.95, glowA = 0.55, tilt = 0 }) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const x = x0 + (x1 - x0) * t;
    const yy = y + tilt * (t - 0.5);
    s += glow({ x, y: yy, rx: size * 9, ry: size * 6, color: '#cfe0ff', a: glowA * 0.45, blend: 'screen' });
    s += glow({ x, y: yy, rx: size * 1.8, ry: size * 1.2, color: C.flood, a, blend: 'screen' });
  }
  return s;
};

/** a plain LED board along the pitch (no writing): a glowing lime band */
const ledBoard = (y0, y1, a = 0.7) =>
  vgrad(
    [
      [0, '#e6ff9a', a],
      [0.5, C.lime, a * 0.9],
      [1, '#7fa51f', a * 0.8],
    ],
    [-20, y0, W + 40, y1 - y0],
  ) +
  glow({ x: 540, y: (y0 + y1) / 2, rx: 800, ry: (y1 - y0) * 3, color: C.lime, a: a * 0.25, blend: 'screen' });

// ---------------------------------------------------------------------------------------------------
// the pictures

/** the stadium bowl at night from above: floodlights blazing on the roof's rim, the city round it, a deep blue sky */
const stadium = () => {
  const cam = camera({ h: 150, tilt: 0.55, f: 800, cy: 1130, pz: -150 });
  const hz = cam.horizon;
  let s = vgrad(
    [
      [0, '#08122a'],
      [0.35, '#0f2148'],
      [0.8, '#1d3766'],
      [1, '#3b5585'],
    ],
    [0, 0, W, hz + 4],
  );
  s += stars({
    n: 160,
    box: [0, 0, W, hz - 80],
    seed: 11,
    a: [0.2, 0.7],
    size: [0.5, 1.4],
    bright: 0.02,
    weight: (x, y) => 1 - y / hz,
  });
  s += glow({ x: 540, y: hz + 10, rx: 1100, ry: 160, color: '#6f86b8', a: 0.45 });
  // the city: blocks of dark, streets of warm lights, hazier toward the horizon
  s += vgrad(
    [
      [0, '#2e3e5e'],
      [0.1, '#1b2944'],
      [1, '#0d182c'],
    ],
    [0, hz, W, H - hz],
  );
  const rnd = prng(1201);
  let lights = '';
  const light = (x, z, col, sz, al) => {
    if (cam.depth(x, z) < 5) return;
    const [sx, sy] = cam.at(x, z);
    if (sx < -20 || sx > W + 20 || sy < hz || sy > H + 20) return;
    const k = Math.min(1.6, cam.scale(x, z) * 3.2);
    lights += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(sz * (0.45 + k))}" fill="${col}" opacity="${r3(al)}"/>`;
  };
  // districts: clusters of windows and street lamps, denser toward the stadium
  for (let i = 0; i < 900; i++) {
    const z = -120 + rnd() ** 1.35 * 3200;
    const x = (rnd() - 0.5) * (600 + z * 2.2);
    if (Math.abs(x) < 150 && Math.abs(z) < 130) continue;
    const m = 4 + Math.floor(rnd() * 14);
    const warm = rnd();
    for (let j = 0; j < m; j++) {
      const col = warm < 0.7 ? (rnd() < 0.6 ? '#ffd9a0' : '#ffbf73') : rnd() < 0.5 ? '#e6eeff' : '#ffe8c4';
      light(x + (rnd() - 0.5) * 70, z + (rnd() - 0.5) * 50, col, 1.1, 0.25 + rnd() * 0.55);
    }
  }
  // avenues of amber lamps at a few angles
  for (const [x0, z0, ang, len] of [
    [-900, 60, 0.35, 3200],
    [700, -40, -0.45, 3000],
    [-200, 400, 0.05, 2600],
    [-2000, 900, 1.35, 4200],
  ]) {
    for (let t = 0; t < len; t += 14 + t * 0.012)
      light(x0 + Math.sin(ang) * t, z0 + Math.cos(ang) * t, '#ffb35c', 1.2, 0.55);
  }
  s += blurred(0.9, lights);
  s += blurred(4, lights.replace(/opacity="[\d.]+"/g, 'opacity=".3"'), 'style="mix-blend-mode:screen"');
  // haze over the far city
  s += vgrad(
    [
      [0, '#5d74a2', 0],
      [0.16, '#5d74a2', 0.75],
      [0.45, '#3a5080', 0.3],
      [1, '#3a5080', 0],
    ],
    [0, hz - 70, W, 520],
  );
  // the stadium: superellipse rings (x half-length a, z half-width b, height y)
  const ring = (a, b, y, n = 160) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      const [c, sn] = [Math.cos(t), Math.sin(t)];
      return [a * Math.sign(c) * Math.abs(c) ** 0.55, b * Math.sign(sn) * Math.abs(sn) ** 0.55, y];
    });
  // the outer wall (facade) lit lime-green, then the bowl's inside from the top of the stands down
  const facade = (y) => worldPath(cam, ring(112, 92, y));
  s += `<path d="${facade(0)}Z" fill="#12213a"/>`;
  s += blurred(8, `<path d="${facade(34)}" fill="none" stroke="${C.lime}" stroke-width="14" opacity=".3"/>`);
  s += blurred(2, `<path d="${facade(34)}" fill="none" stroke="#e6ffb0" stroke-width="3" opacity=".4"/>`);
  s += `<path d="${facade(40)}Z" fill="#1b2a47"/>`;
  const steps = 12;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const a = 100 - t * 38;
    const b = 80 - t * 36;
    const y = 40 - t * 38;
    const col = mix('#2b3656', '#3e4a6a', t);
    s += `<path d="${worldPath(cam, ring(a, b, y))}Z" fill="${col}"/>`;
  }
  // the crowd: speckles of light on the stands
  let crowd = '';
  for (let i = 0; i < 1400; i++) {
    const t = rnd();
    const ang = rnd() * Math.PI * 2;
    const [c, sn] = [Math.cos(ang), Math.sin(ang)];
    const a = 99 - t * 36;
    const b = 79 - t * 34;
    const y = 39 - t * 36;
    const [sx, sy] = cam.at(
      a * Math.sign(c) * Math.abs(c) ** 0.55,
      b * Math.sign(sn) * Math.abs(sn) ** 0.55,
      y,
    );
    const col = ['#f3f6ff', '#dff78a', '#ffe6b8', '#9fd49a'][Math.floor(rnd() * 4)];
    crowd += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(0.8 + rnd() * 1.4)}" fill="${col}" opacity="${r3(0.25 + rnd() * 0.5)}"/>`;
  }
  s += blurred(0.6, crowd);
  // the pitch, floodlit
  const top = cam.at(0, 45)[1];
  s += `<defs><clipPath id="pch"><path d="${worldPath(cam, [
    [-62, -44],
    [62, -44],
    [62, 44],
    [-62, 44],
    [-62, -44],
  ])}Z"/></clipPath></defs><g clip-path="url(#pch)">${grass(cam, { x0: -62, x1: 62, z0: -44, z1: 44, top, seed: 13, w: 5.25, stripeA: 0.45 })}`;
  let ln = worldPath(cam, [
    [-52.5, -34],
    [52.5, -34],
    [52.5, 34],
    [-52.5, 34],
    [-52.5, -34],
  ]);
  ln += worldPath(cam, floorLine([0, -34], [0, 34])) + worldPath(cam, floorArc(0, 0, 9.15));
  for (const sx of [-1, 1]) {
    ln += worldPath(cam, [
      [sx * 52.5, -20.16],
      [sx * 36, -20.16],
      [sx * 36, 20.16],
      [sx * 52.5, 20.16],
    ]);
    ln += worldPath(cam, [
      [sx * 52.5, -9.16],
      [sx * 47, -9.16],
      [sx * 47, 9.16],
      [sx * 52.5, 9.16],
    ]);
  }
  s += blurred(0.6, `<path d="${ln}" fill="none" stroke="${C.line}" stroke-width="1.6" opacity=".8"/>`);
  s += '</g>';
  // the roof: an annulus at the top of the stands, its inner rim lined with floodlights
  const outer = worldPath(cam, ring(108, 88, 46));
  const inner = worldPath(cam, ring(80, 60, 46).reverse());
  const roofG = nid('rf');
  s += `<defs>${ugrad(
    roofG,
    [
      [0, '#5f7197'],
      [0.5, '#3d4c6e'],
      [1, '#26324d'],
    ],
    [0, cam.at(0, 90, 46)[1], 0, cam.at(0, -90, 46)[1]],
  )}</defs><path d="${outer}Z${inner}Z" fill="url(#${roofG})" fill-rule="evenodd"/>`;
  s += hazeTex({ color: '#9fb2d8', a: 0.1, freq: [0.02, 0.03], seed: 15, k: 1.4, b: -0.4 });
  // the lamps along the inner rim
  let lamps = '';
  let glows = '';
  for (const [x, z] of ring(80, 60, 46, 64).slice(0, 64)) {
    const [sx, sy] = cam.at(x, z, 46);
    lamps += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="3.2" fill="#ffffff"/>`;
    glows += glow({ x: sx, y: sy, rx: 26, ry: 20, color: '#dfe9ff', a: 0.6, blend: 'screen' });
  }
  s += blurred(0.8, lamps) + glows;
  // the light over the bowl, lighting the night haze
  const [bx, by] = cam.at(0, 0, 20);
  s += glow({ x: bx, y: by - 60, rx: 760, ry: 620, color: '#bcd0f5', a: 0.5, blend: 'screen' });
  s += glow({ x: bx, y: by - 10, rx: 340, ry: 200, color: '#f0f6ff', a: 0.3, blend: 'screen' });
  s += hazeTex({ color: '#9fb4e0', a: 0.22, freq: [0.003, 0.005], seed: 17 });
  s += vignette(0.4, C.shade, 0.55);
  return [svgLayer(s)];
};

/** the tunnel's mouth: an arched concrete tunnel, the floodlit pitch and the far stand flooding it with light */
const tunnel = () => {
  const cam = camera({ h: 1.7, f: 820, cy: 1000 });
  const Z = 7;
  const [hw, wallH, R] = [3, 2.6, 3];
  // the section of the tunnel (wall, arch, wall) at depth z
  const section = (z, n = 40) => {
    const list = [[-hw, z, 0]];
    for (let i = 0; i <= n; i++) {
      const t = Math.PI - (Math.PI * i) / n;
      list.push([R * Math.cos(t), z, wallH + R * Math.sin(t)]);
    }
    list.push([hw, z, 0]);
    return list;
  };
  const mouth = worldPath(cam, section(Z));
  const mouthFloorY = cam.at(0, Z)[1];
  // beyond: the pitch, the far stand, the floodlights and the night
  let b = vgrad(
    [
      [0, '#0c1a2e'],
      [0.25, '#1b3156'],
      [0.36, '#4f6a98'],
      [1, '#4f6a98'],
    ],
    [0, 0, W, H],
  );
  const standTop = cam.at(0, 80, 34)[1];
  const standBase = cam.at(0, 72, 0)[1];
  b += crowdStand({
    y0: standTop,
    y1: standBase + 4,
    seed: 21,
    n: 120,
    r: [5, 14],
    alpha: [0.3, 0.8],
    base: ['#34496f', '#3d5470'],
  });
  b += floodRow({ y: standTop - 6, x0: 150, x1: 930, n: 8, size: 10, a: 0.95, glowA: 0.9 });
  b += ledBoard(standBase - 14, standBase + 2, 0.75);
  b += grass(cam, { x0: -60, x1: 60, z0: Z, z1: 72, top: standBase, seed: 23, w: 5.25 });
  const lines =
    worldPath(cam, floorLine([-60, 38], [-60, 38])) +
    worldPath(cam, floorLine([-60, 38], [60, 38])) +
    worldPath(cam, floorLine([0, 38], [0, 72])) +
    worldPath(cam, floorArc(0, 55, 9.15));
  b += blurred(0.8, `<path d="${lines}" fill="none" stroke="${C.line}" stroke-width="2.2" opacity=".75"/>`);
  // flooded with light
  b += rgrad({
    x: 540,
    y: 860,
    rx: 620,
    ry: 520,
    stops: [
      [0, '#f4f8ff', 0.6],
      [0.5, '#dfe9ff', 0.28],
      [1, '#dfe9ff', 0],
    ],
    blend: 'screen',
  });
  b += mist({ y: standBase + 20, h: 40, x0: 100, x1: 980, color: '#dfe7f0', a: 0.4, seed: 25, n: 8 });
  // the tunnel: everything but the mouth
  let s = `<path d="M-10 -10H${W + 10}V${H + 10}H-10Z${mouth}Z" fill="#101a2c" fill-rule="evenodd"/>`;
  // the vault and walls lit from the mouth: a radial light, and the ribs of the vault
  s += `<defs><clipPath id="tn"><path d="M-10 -10H${W + 10}V${H + 10}H-10Z${mouth}Z" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#tn)">`;
  s += rgrad({
    x: 540,
    y: 900,
    rx: 820,
    ry: 980,
    stops: [
      [0, '#6e84a8', 0.9],
      [0.4, '#3a4d70', 0.6],
      [1, '#131e33', 0],
    ],
  });
  s += hazeTex({ color: '#a4b3cc', a: 0.14, freq: [0.018, 0.018], seed: 27, k: 1.5, b: -0.5 });
  // the floor: dark, wet-glossy, reflecting the mouth
  const floorG = nid('tf');
  s += `<defs>${ugrad(
    floorG,
    [
      [0, '#3c4c5e'],
      [0.3, '#1f2b3c'],
      [1, '#0e1624'],
    ],
    [0, mouthFloorY, 0, H],
  )}</defs><path d="${worldPath(cam, [
    [-hw, 0.4],
    [hw, 0.4],
    [hw, Z],
    [-hw, Z],
    [-hw, 0.4],
  ])}Z" fill="url(#${floorG})"/>`;
  const refl = nid('rl');
  s += `<defs><filter id="${refl}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10 22"/></filter></defs><path d="M${r1(540 - 300)} ${r1(mouthFloorY)}L${r1(540 + 300)} ${r1(mouthFloorY)}L${r1(540 + 520)} ${H}L${r1(540 - 520)} ${H}Z" fill="#9fcf8a" opacity=".22" filter="url(#${refl})" style="mix-blend-mode:screen"/>`;
  s += `<path d="M${r1(540 - 90)} ${r1(mouthFloorY)}L${r1(540 + 90)} ${r1(mouthFloorY)}L${r1(540 + 170)} ${H}L${r1(540 - 170)} ${H}Z" fill="#e8f2ff" opacity=".2" filter="url(#${refl})" style="mix-blend-mode:screen"/>`;
  // the ribs: each section drawn as a dark band with a lit inner edge
  let ribs = '';
  let ribLit = '';
  for (let z = 1.2; z < Z; z += 1.25) {
    const p = worldPath(cam, section(z).slice(1, -1));
    const k = cam.scale(0, z);
    ribs += `<path d="${p}" fill="none" stroke="#0a111f" stroke-width="${r1(k * 0.28)}" opacity=".55"/>`;
    ribLit += `<path d="${worldPath(cam, section(z + 0.18).slice(1, -1))}" fill="none" stroke="#9fb3d6" stroke-width="${r1(k * 0.05)}" opacity="${r3(0.2 + 0.4 * (z / Z))}"/>`;
  }
  s += blurred(3, ribs + ribLit);
  // lamps on the crown, and lime strips along the foot of the walls
  for (let z = 1.8; z < Z; z += 1.25) {
    const [lx, ly] = cam.at(0, z, wallH + R - 0.05);
    const k = cam.scale(0, z);
    s += glow({ x: lx, y: ly, rx: k * 0.9, ry: k * 0.4, color: '#e6efff', a: 0.55, blend: 'screen' });
  }
  s += blurred(
    2,
    `<path d="${worldPath(cam, floorLine([-hw + 0.02, 0.4, 0.12], [-hw + 0.02, Z, 0.12]))}${worldPath(cam, floorLine([hw - 0.02, 0.4, 0.12], [hw - 0.02, Z, 0.12]))}" stroke="${C.lime}" stroke-width="6" fill="none" opacity=".8"/>`,
  );
  s += blurred(
    9,
    `<path d="${worldPath(cam, floorLine([-hw + 0.02, 0.4, 0.12], [-hw + 0.02, Z, 0.12]))}${worldPath(cam, floorLine([hw - 0.02, 0.4, 0.12], [hw - 0.02, Z, 0.12]))}" stroke="${C.lime}" stroke-width="14" fill="none" opacity=".35"/>`,
  );
  s += '</g>';
  // the mouth's edge caught by the light
  s += blurred(4, `<path d="${mouth}" fill="none" stroke="#e8f1ff" stroke-width="6" opacity=".4"/>`);
  // light pouring in: rays and haze
  s += rays({
    x: 540,
    y: 820,
    n: 26,
    len: 1300,
    a0: 20,
    a1: 160,
    w: [1.5, 5],
    color: '#eaf2ff',
    a: 0.2,
    seed: 29,
    blur: 12,
  });
  s += mist({ y: mouthFloorY + 60, h: 90, x0: 60, x1: 1020, color: '#c9d4e2', a: 0.18, seed: 31, n: 6 });
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(b), svgLayer(s)];
};

/** the pitch from the halfway line, high in the stand: mowing stripes, the centre circle, floodlights, light fog */
const pitch = () => {
  const cam = camera({ h: 30, tilt: 0.35, f: 900, cy: 1030, pz: -45 });
  const _hz = cam.horizon;
  const standBase = cam.at(0, 40)[1];
  const standTop = cam.at(0, 84, 40)[1];
  let s = vgrad(
    [
      [0, '#071226'],
      [0.6, '#10234a'],
      [1, '#1c3563'],
    ],
    [0, 0, W, standTop + 20],
  );
  s += stars({
    n: 60,
    box: [0, 0, W, standTop - 120],
    seed: 33,
    a: [0.2, 0.6],
    size: [0.5, 1.2],
    bright: 0.02,
  });
  s += crowdStand({
    y0: standTop,
    y1: standBase + 6,
    seed: 35,
    n: 220,
    r: [6, 18],
    alpha: [0.2, 0.65],
    calm: [640, 1100],
  });
  s += ledBoard(standBase - 14, standBase + 2, 0.55);
  s += floodRow({ y: standTop - 10, n: 9, size: 12, a: 0.95, glowA: 0.8 });
  // beams from the floodlights down through the fog
  for (const [x, ang] of [
    [130, 72],
    [400, 84],
    [680, 96],
    [950, 108],
  ])
    s += beam({
      x,
      y: standTop - 10,
      ang,
      spread: 18,
      len: 1500,
      w0: 30,
      color: '#dfe9ff',
      a: 0.12,
      blur: 26,
    });
  // the pitch
  s += `<defs><clipPath id="pp"><path d="${worldPath(cam, [
    [-70, -40],
    [70, -40],
    [70, 40],
    [-70, 40],
    [-70, -40],
  ])}Z"/></clipPath></defs><g clip-path="url(#pp)">`;
  s += grass(cam, { x0: -73.5, x1: 73.5, z0: -40, z1: 40, top: standBase, seed: 37, w: 5.25, stripeA: 0.42 });
  let ln = worldPath(cam, floorLine([-70, 34], [70, 34]));
  ln += worldPath(cam, floorLine([-70, -34], [70, -34]));
  ln += worldPath(cam, floorLine([0, -34], [0, 34]));
  ln += worldPath(cam, floorArc(0, 0, 9.15, 0, Math.PI * 2, 160));
  s += blurred(0.8, `<path d="${ln}" fill="none" stroke="${C.line}" stroke-width="3" opacity=".82"/>`);
  const [sx, sy] = cam.at(0, 0);
  s += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="5" ry="3" fill="${C.line}" opacity=".8"/>`;
  s += '</g>';
  // pools of floodlight on the grass, fog drifting over it
  s += glow({ x: 540, y: 1220, rx: 700, ry: 380, color: '#d9f0c8', a: 0.18, blend: 'screen' });
  s += mist({ y: standBase + 30, h: 60, color: '#d5e0e8', a: 0.4, seed: 39, n: 9 });
  s += mist({ y: standBase + 180, h: 90, color: '#d0dbe4', a: 0.22, seed: 41, n: 7 });
  s += hazeTex({
    box: [0, standTop, W, H - standTop],
    color: '#dbe6f2',
    a: 0.18,
    freq: [0.0025, 0.006],
    seed: 43,
  });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.45],
    ],
    [0, 1450, W, 470],
  );
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

/** the stands: flags and scarves as bokeh colour under the floodlights (no faces) */
const crowd = () => {
  const cam = camera({ h: 1.7, tilt: -0.55, f: 820, cy: 860 });
  const standBase = cam.at(0, 8, 1.1)[1];
  const roofY = cam.at(0, 22, 34)[1];
  let s = vgrad(
    [
      [0, '#08132a'],
      [1, '#142a52'],
    ],
    [0, 0, W, roofY + 10],
  );
  // under the roof, the stand's face rising from the pitch
  s += crowdStand({
    y0: roofY - 4,
    y1: standBase,
    seed: 45,
    n: 420,
    r: [12, 40],
    alpha: [0.22, 0.7],
    calm: [700, 1120],
    base: ['#1a2f55', '#1d3a4f'],
  });
  // flags and scarves held up: soft stripes of colour, waving, out of focus
  const rnd = prng(4501);
  let flags = '';
  const flagCols = [
    [C.lime, C.navy2],
    ['#f2f6ff', C.green2],
    [C.green2, C.lime],
    ['#2f4f8f', '#f2f6ff'],
  ];
  const wave = (x, y, w, h, [c1, c2], rot) => {
    const g = nid('fl');
    const k = rnd() * 0.3 + 0.15;
    const path = `M${r1(x)} ${r1(y)}C${r1(x + w * 0.35)} ${r1(y - h * k)} ${r1(x + w * 0.65)} ${r1(y + h * k)} ${r1(x + w)} ${r1(y)}L${r1(x + w)} ${r1(y + h)}C${r1(x + w * 0.65)} ${r1(y + h + h * k)} ${r1(x + w * 0.35)} ${r1(y + h - h * k)} ${r1(x)} ${r1(y + h)}Z`;
    return `<defs>${ugrad(
      g,
      [
        [0, c1],
        [0.5, c1],
        [0.5, c2],
        [1, c2],
      ],
      [x, y, x, y + h],
    )}</defs><path d="${path}" fill="url(#${g})" transform="rotate(${r1(rot)} ${r1(x + w / 2)} ${r1(y + h / 2)})"/>`;
  };
  // big flags high in the stand and low near the front, few in the calm middle
  for (let i = 0; i < 16; i++) {
    const high = i < 9;
    const y = high ? roofY + 30 + rnd() * 220 : 1120 + rnd() * (standBase - 1200);
    const x = -60 + rnd() * (W + 60);
    const w = 150 + rnd() * 140;
    flags += wave(
      x,
      y,
      w,
      w * (0.55 + rnd() * 0.2),
      flagCols[Math.floor(rnd() * flagCols.length)],
      (rnd() - 0.5) * 30,
    );
  }
  // scarves: rows of short bars held over heads
  for (let i = 0; i < 70; i++) {
    const y = roofY + 40 + rnd() * (standBase - roofY - 80);
    if (y > 720 && y < 1100 && rnd() < 0.7) continue;
    const x = rnd() * W;
    const [c1, c2] = flagCols[Math.floor(rnd() * flagCols.length)];
    const w = 70 + rnd() * 60;
    flags += `<g transform="rotate(${r1((rnd() - 0.5) * 16)} ${r1(x)} ${r1(y)})"><rect x="${r1(x - w / 2)}" y="${r1(y)}" width="${r1(w / 2)}" height="18" fill="${c1}"/><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w / 2)}" height="18" fill="${c2}"/></g>`;
  }
  s += blurred(9, flags, 'opacity=".72"');
  // the roof's underside and its floodlights, blazing down
  s += vgrad(
    [
      [0, '#0b1528', 1],
      [1, '#0b1528', 0],
    ],
    [0, 0, W, roofY + 30],
  );
  s += floodRow({ y: roofY, x0: -20, x1: W + 20, n: 7, size: 24, a: 1, glowA: 1.1, tilt: 30 });
  s += glow({ x: 540, y: roofY, rx: 900, ry: 260, color: '#dfe9ff', a: 0.35, blend: 'screen' });
  for (const [x, ang] of [
    [60, 78],
    [330, 88],
    [620, 96],
    [900, 104],
  ])
    s += beam({ x, y: roofY, ang, spread: 16, len: 1500, w0: 40, color: '#dfe9ff', a: 0.16, blur: 22 });
  s += hazeTex({ color: '#a6bde6', a: 0.22, freq: [0.003, 0.005], seed: 47 });
  // the front: the LED board, the grass
  s += ledBoard(standBase - 60, standBase, 0.6);
  s += grass(cam, {
    x0: -60,
    x1: 60,
    z0: 0.5,
    z1: 8,
    along: 'z',
    w: 2.6,
    top: standBase,
    seed: 49,
    stripeA: 0.4,
  });
  s += glow({ x: 540, y: standBase + 30, rx: 800, ry: 120, color: C.lime, a: 0.18, blend: 'screen' });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.5],
    ],
    [0, standBase + 60, W, H - standBase - 60],
  );
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

/** the penalty area from behind the spot, looking to the goal end (no goal): a dark, soft stand behind the line */
const box = () => {
  const cam = camera({ h: 1.7, tilt: 0.05, f: 760, cy: 700 });
  const GL = 13; // the goal line, metres ahead
  const standBase = cam.at(0, GL + 8, 0)[1];
  const standTop = cam.at(0, GL + 60, 32)[1];
  let s = vgrad(
    [
      [0, '#071225'],
      [1, '#0f2141'],
    ],
    [0, 0, W, standTop + 20],
  );
  s += stars({ n: 50, box: [0, 0, W, standTop - 60], seed: 51, a: [0.2, 0.55], size: [0.5, 1.2], bright: 0 });
  // the stand behind the goal: dark, soft, calm in the upper middle
  s += crowdStand({
    y0: standTop,
    y1: standBase + 4,
    seed: 53,
    n: 170,
    r: [8, 24],
    alpha: [0.14, 0.5],
    calm: [standTop, standBase],
    base: ['#0f1d38', '#152640'],
  });
  s += rgrad({
    x: 540,
    y: (standTop + standBase) / 2,
    rx: 420,
    ry: 300,
    stops: [
      [0, '#0a1528', 0.55],
      [1, '#0a1528', 0],
    ],
  });
  s += ledBoard(standBase - 12, standBase + 2, 0.5);
  // floodlights in the top corners
  s += glow({ x: 40, y: standTop - 30, rx: 360, ry: 260, color: '#dfe9ff', a: 0.45, blend: 'screen' });
  s += glow({ x: 1040, y: standTop - 30, rx: 360, ry: 260, color: '#dfe9ff', a: 0.45, blend: 'screen' });
  s += floodRow({ y: standTop - 28, x0: -10, x1: 200, n: 3, size: 12, a: 0.95, glowA: 0.7 });
  s += floodRow({ y: standTop - 28, x0: 880, x1: 1090, n: 3, size: 12, a: 0.95, glowA: 0.7 });
  s += beam({
    x: 60,
    y: standTop - 28,
    ang: 62,
    spread: 16,
    len: 1500,
    w0: 30,
    color: '#dfe9ff',
    a: 0.14,
    blur: 24,
  });
  s += beam({
    x: 1020,
    y: standTop - 28,
    ang: 118,
    spread: 16,
    len: 1500,
    w0: 30,
    color: '#dfe9ff',
    a: 0.14,
    blur: 24,
  });
  // the grass: stripes across, the goal line, the six-yard box, the spot
  s += grass(cam, {
    x0: -40,
    x1: 40,
    z0: 0.4,
    z1: GL + 8,
    along: 'z',
    w: 2.75,
    top: standBase,
    seed: 55,
    stripeA: 0.42,
  });
  let ln = worldPath(cam, floorLine([-30, GL], [30, GL]));
  ln += worldPath(cam, [
    [-9.16, GL],
    [-9.16, GL - 5.5],
    [9.16, GL - 5.5],
    [9.16, GL],
  ]);
  ln +=
    worldPath(cam, [
      [-20.16, 0.5],
      [-20.16, GL],
    ]) +
    worldPath(cam, [
      [20.16, 0.5],
      [20.16, GL],
    ]);
  s += blurred(0.8, `<path d="${ln}" fill="none" stroke="${C.line}" stroke-width="3.2" opacity=".85"/>`);
  const [px, py] = cam.at(0, GL - 11);
  const k = cam.scale(0, GL - 11);
  s += blurred(
    0.8,
    `<ellipse cx="${r1(px)}" cy="${r1(py)}" rx="${r1(k * 0.08)}" ry="${r1(k * 0.08 * 0.35)}" fill="${C.line}" opacity=".75"/>`,
  );
  // floodlight pools, fog over the far grass
  s += glow({ x: 540, y: standBase + 260, rx: 700, ry: 260, color: '#e1f3cf', a: 0.2, blend: 'screen' });
  s += glow({ x: 180, y: standBase + 520, rx: 520, ry: 200, color: '#e1f3cf', a: 0.12, blend: 'screen' });
  s += glow({ x: 900, y: standBase + 700, rx: 520, ry: 220, color: '#e1f3cf', a: 0.1, blend: 'screen' });
  s += mist({ y: standBase + 16, h: 40, color: '#d3dee8', a: 0.35, seed: 57, n: 9 });
  s += hazeTex({
    box: [0, standTop, W, H - standTop],
    color: '#d6e2ee',
    a: 0.12,
    freq: [0.0025, 0.006],
    seed: 59,
  });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.45],
    ],
    [0, 1480, W, 440],
  );
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

const scenes = {
  'scene-stadium': { paint: stadium, seed: 201, post: { gamma: 1.0, bloom: 0.5 } },
  'scene-tunnel': { paint: tunnel, seed: 202, post: { gamma: 1.0, bloom: 0.45 } },
  'scene-pitch': { paint: pitch, seed: 203, post: { gamma: 1.0, bloom: 0.45 } },
  'scene-crowd': { paint: crowd, seed: 204, post: { gamma: 1.0, bloom: 0.45 } },
  'scene-box': { paint: box, seed: 205, post: { gamma: 1.0, bloom: 0.42 } },
};

await paintScenes({ id: 'golden-goal', scenes, background: '#1d3b2a' });
