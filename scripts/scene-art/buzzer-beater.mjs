// Scroll-scene pictures of the "buzzer-beater" design (basketball — a bar mitzvah or a birthday): five
// full-screen 9:16 pictures of one night in the arena, in the design's palette (court wood, orange, navy,
// arena light blue): the players' tunnel opening onto the bright court, the court from its centre, the
// arena from courtside, the key and the three-point line from a low angle, and the rafters and lights.
// The app draws the ball's long arc over them and, in the last pictures, the hoop in the upper right —
// so there are no balls, hoops or backboards here, and the rafters' picture keeps its upper right clean.
//
//   node scripts/scene-art/buzzer-beater.mjs [scene …]            the files, and their entries in the list
//   node scripts/scene-art/buzzer-beater.mjs --draft <dir> [scene …]  drafts only
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
  rays,
  vignette,
  svgLayer,
  lgrad,
  ugrad,
  stopsOf,
} from './kit.mjs';
import {
  camera,
  worldPath,
  floorArc,
  floorLine,
  bokeh,
  bokehField,
  beam,
  hazeTex,
  vmask,
  blurred,
  vgrad,
  rgrad,
  wash,
} from './action-shared.mjs';

/** the design's palette */
const C = {
  wood: '#C98B4E',
  woodLit: '#e3aa6d',
  woodDark: '#8f5d33',
  woodDeep: '#5a3a24',
  orange: '#F26B1D',
  orangeSoft: '#e0823f',
  navy: '#0F1B33',
  navy2: '#1b2b4d',
  navy3: '#2a3d63',
  blue: '#9CC3FF',
  blueSoft: '#b9d3fb',
  shade: '#0B1220',
  line: '#efe4d2',
  warm: '#ffd9a6',
  white: '#f4f1ea',
};

/** the crowd's colors, out of focus */
const CROWD = [
  [C.warm, 5],
  ['#ffb46b', 3],
  [C.orange, 2],
  [C.blue, 3],
  ['#7fa2e0', 2],
  ['#f4f1ea', 2],
  ['#c7a0e8', 0.6],
];

// ---------------------------------------------------------------------------------------------------
// painting blocks

/**
 * The court's wood as the camera sees it: maple strips along x, drawn as seams of constant z, planks of
 * slightly varied tone, a streaky grain, all between z0 and z1 and x0…x1.
 */
const woodFloor = (
  cam,
  { z0, z1, x0 = -40, x1 = 40, seed = 1, lit = C.woodLit, base = C.wood, deep = C.woodDark },
) => {
  const rnd = prng(seed * 3301 + 7);
  const top = cam.at(0, z1)[1];
  let s = vgrad(
    [
      [0, mix(base, deep, 0.35)],
      [0.25, base],
      [1, mix(base, lit, 0.35)],
    ],
    [0, top - 2, W, H - top + 2],
  );
  // planks of varied tone
  let planks = '';
  for (let z = z0; z < z1;) {
    const dz = 0.06 * (1 + 0.15 * rnd()) * (1 + Math.max(0, z - 6) * 0.08);
    const sc = cam.depth(0, z) > 0.3 ? cam.scale(0, z) : 0;
    if (sc * dz > 1.2) {
      let x = x0;
      while (x < x1) {
        const len = 2 + rnd() * 3;
        const k = rnd();
        if (k < 0.45) {
          const c = k < 0.2 ? mix(base, deep, 0.25) : mix(base, lit, 0.3);
          const q = [
            [x, z],
            [x + len, z],
            [x + len, z + dz],
            [x, z + dz],
          ];
          planks += `<path d="${worldPath(cam, q.concat([q[0]]))}" fill="${c}" opacity="${r3(0.25 + rnd() * 0.3)}"/>`;
        }
        x += len;
      }
    }
    z += dz;
  }
  s += planks;
  // seams: every few strips a faint dark line
  let seams = '';
  for (let z = z0; z < z1; z += 0.24) {
    const sc = cam.scale(0, z);
    if (sc <= 0 || cam.depth(0, z) < 0.3) continue;
    if (sc * 0.24 < 3) break;
    seams += worldPath(cam, floorLine([x0, z], [x1, z], 8));
  }
  s += `<path d="${seams}" fill="none" stroke="${C.woodDeep}" stroke-width="1" opacity=".22"/>`;
  // grain: streaks along the strips
  s += hazeTex({
    box: [0, top, W, H - top],
    color: C.woodDeep,
    a: 0.35,
    freq: [0.0025, 0.06],
    oct: 3,
    seed: seed + 3,
    k: 1.8,
    b: -0.6,
  });
  s += hazeTex({
    box: [0, top, W, H - top],
    color: '#f6d2a3',
    a: 0.18,
    freq: [0.004, 0.09],
    oct: 2,
    seed: seed + 5,
    k: 1.9,
    b: -0.75,
  });
  return s;
};

/** a light's reflection in the lacquer: a vertical streak, soft and anisotropic */
const streak = ({ x, y0, y1, w, color, a = 0.5 }) => {
  const g = nid('st');
  const f = nid('stf');
  return `<defs>${ugrad(
    g,
    [
      [0, color, 0],
      [0.08, color, a],
      [0.35, color, a * 0.55],
      [1, color, 0],
    ],
    [0, y0, 0, y1],
  )}<filter id="${f}" x="-100%" y="-20%" width="300%" height="140%"><feGaussianBlur stdDeviation="${r1(w * 0.35)} 14"/></filter></defs><rect x="${r1(x - w / 2)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(y1 - y0)}" fill="url(#${g})" filter="url(#${f})" style="mix-blend-mode:screen"/>`;
};

/** the stands far off, out of focus: dark tiers, the crowd as colored bokeh, a haze of light over them */
const stands = ({
  y0,
  y1,
  seed = 1,
  n = 260,
  r = [6, 22],
  alpha = [0.25, 0.75],
  calm = null,
  base = [C.navy2, '#241c3a'],
}) => {
  let s = vgrad(
    [
      [0, base[0]],
      [1, base[1]],
    ],
    [0, y0, W, y1 - y0],
  );
  // tiers: faint lighter rails
  const rnd = prng(seed * 911 + 3);
  let tiers = '';
  for (let y = y0 + 20; y < y1; y += 26 + rnd() * 20) tiers += `M0 ${r1(y)}H${W}`;
  s += blurred(3, `<path d="${tiers}" stroke="#4a5a86" stroke-width="3" opacity=".35"/>`);
  const inCalm = (y) => calm && y > calm[0] && y < calm[1];
  const items = bokehField({
    n,
    box: [-20, y0, W + 40, y1 - y0],
    r,
    colors: CROWD,
    a: alpha,
    seed,
    weight: (x, y) => (inCalm(y) ? 0.5 : 1),
  }).map((b) => (inCalm(b.y) ? { ...b, r: b.r * 1.35, a: b.a * 0.5 } : b));
  s += bokeh(items, { rim: 0.18, blur: 2.2 });
  return s;
};

/** a row of arena floodlights: bright cells with a wide glow */
const lightRow = ({ y, x0 = 60, x1 = W - 60, n = 7, size = 26, a = 0.9, color = '#f3f6ff', glowA = 0.5 }) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1);
    s += glow({ x, y, rx: size * 6, ry: size * 4, color: C.blueSoft, a: glowA * 0.5, blend: 'screen' });
    s += glow({ x, y, rx: size * 1.6, ry: size, color, a, blend: 'screen' });
  }
  return s;
};

// ---------------------------------------------------------------------------------------------------
// the pictures

/** the players' tunnel: navy walls and ceiling lights leading to the bright court and the arena's lights */
const tunnel = () => {
  const cam = camera({ h: 1.6, f: 820, cy: 1000 });
  const Z = 6; // the mouth
  const [hw, ch] = [3, 4]; // half width, ceiling height
  const [mx0, my0] = cam.at(-hw, Z, ch);
  const [mx1, my1] = cam.at(hw, Z, 0);
  // beyond the mouth: the arena, bright
  let back = skyArena(mx0, my0, mx1, my1, cam);
  // the tunnel
  let s = '';
  const quad = (list) => `${worldPath(cam, list.concat([list[0]]))}Z`;
  const wallG = nid('wg');
  const ceilG = nid('cg');
  const floorG = nid('fg');
  s += `<defs>${ugrad(
    wallG,
    [
      [0, '#0c1428'],
      [0.6, '#1a2847'],
      [1, '#3b4d74'],
    ],
    [0, 0, 380, 0],
  )}${ugrad(
    'wgr',
    [
      [0, '#3b4d74'],
      [0.4, '#1a2847'],
      [1, '#0c1428'],
    ],
    [700, 0, W, 0],
  )}${ugrad(
    ceilG,
    [
      [0, '#0a1122'],
      [0.7, '#16223d'],
      [1, '#34466b'],
    ],
    [0, 0, 0, my0],
  )}${ugrad(
    floorG,
    [
      [0, '#4a4f63'],
      [0.25, '#262c40'],
      [1, '#0f1528'],
    ],
    [0, my1, 0, H],
  )}</defs>`;
  // ceiling, walls, floor
  s += `<path d="${quad([
    [-hw, 0.3, ch],
    [hw, 0.3, ch],
    [hw, Z, ch],
    [-hw, Z, ch],
  ])}" fill="url(#${ceilG})"/>`;
  s += `<path d="${quad([
    [-hw, 0.3, 0],
    [-hw, Z, 0],
    [-hw, Z, ch],
    [-hw, 0.3, ch],
  ])}" fill="url(#${wallG})"/>`;
  s += `<path d="${quad([
    [hw, 0.3, 0],
    [hw, Z, 0],
    [hw, Z, ch],
    [hw, 0.3, ch],
  ])}" fill="url(#wgr)"/>`;
  s += `<path d="${quad([
    [-hw, 0.3, 0],
    [hw, 0.3, 0],
    [hw, Z, 0],
    [-hw, Z, 0],
  ])}" fill="url(#${floorG})"/>`;
  // concrete texture on it all
  s += hazeTex({ color: '#8a9bc4', a: 0.12, freq: [0.02, 0.02], oct: 4, seed: 11, k: 1.5, b: -0.5 });
  // wall panels: seams, and an orange band running to the court
  let seams = '';
  for (let z = 0.6; z < Z; z += 1.1) {
    seams += worldPath(cam, [
      [-hw, z, 0],
      [-hw, z, ch],
    ]);
    seams += worldPath(cam, [
      [hw, z, 0],
      [hw, z, ch],
    ]);
  }
  s += blurred(1.2, `<path d="${seams}" stroke="#070c18" stroke-width="3" opacity=".55" fill="none"/>`);
  const band = (x) =>
    `<path d="${quad([
      [x, 0.3, 1.05],
      [x, Z, 1.05],
      [x, Z, 1.3],
      [x, 0.3, 1.3],
    ])}" fill="${C.orange}"/>`;
  const bandG = nid('bd');
  s += `<defs>${ugrad(
    bandG,
    [
      [0, C.orange, 0.35],
      [0.5, C.orange, 0.7],
      [1, '#ff9a55', 0.95],
    ],
    [0, 0, 400, 0],
  )}</defs>`;
  s += blurred(1.4, `<g opacity=".85">${band(-hw)}${band(hw)}</g>`);
  // the runner mat to the court, navy with orange edges
  s += `<path d="${quad([
    [-1.25, 0.3, 0.005],
    [1.25, 0.3, 0.005],
    [1.25, Z, 0.005],
    [-1.25, Z, 0.005],
  ])}" fill="#141d36" opacity=".9"/>`;
  s += blurred(
    1.2,
    `<path d="${worldPath(cam, floorLine([-1.18, 0.3], [-1.18, Z]))}${worldPath(cam, floorLine([1.18, 0.3], [1.18, Z]))}" stroke="${C.orange}" stroke-width="7" fill="none" opacity=".75"/>`,
  );
  // ceiling lights running to the mouth, and their glow on the ceiling
  let lamps = '';
  for (let z = 0.9; z < Z - 0.3; z += 1.1) {
    lamps += `<path d="${quad([
      [-0.42, z - 0.15, ch - 0.02],
      [0.42, z - 0.15, ch - 0.02],
      [0.42, z + 0.15, ch - 0.02],
      [-0.42, z + 0.15, ch - 0.02],
    ])}" fill="#eef4ff"/>`;
    const [lx, ly] = cam.at(0, z, ch);
    const k = cam.scale(0, z, ch);
    s += glow({ x: lx, y: ly, rx: k * 1.6, ry: k * 0.55, color: '#cfe0ff', a: 0.35, blend: 'screen' });
  }
  s += blurred(3, lamps, 'opacity=".72"');
  // the lamps' reflections in the floor
  for (let z = 0.9; z < Z - 0.3; z += 1.1) {
    const [lx, ly] = cam.at(0, z, -ch);
    const k = cam.scale(0, z, -ch);
    if (ly < H + 200)
      s += glow({ x: lx, y: ly, rx: k * 0.7, ry: k * 0.35, color: '#b9ccf0', a: 0.18, blend: 'screen' });
  }
  // light from the mouth: on the floor, spilling onto the walls' ends, a glossy reflection
  s += streak({ x: 540, y0: my1 - 4, y1: H, w: 520, color: '#f2d8b2', a: 0.35 });
  s += streak({ x: 540, y0: my1 - 4, y1: 1700, w: 170, color: '#fff0d8', a: 0.35 });
  s += glow({
    x: mx0 + 10,
    y: (my0 + my1) / 2,
    rx: 120,
    ry: 380,
    color: '#ffe0b8',
    a: 0.35,
    blend: 'screen',
  });
  s += glow({
    x: mx1 - 10,
    y: (my0 + my1) / 2,
    rx: 120,
    ry: 380,
    color: '#ffe0b8',
    a: 0.35,
    blend: 'screen',
  });
  // the mouth's rim, caught by the light
  s += blurred(
    5,
    `<path d="M${r1(mx0)} ${r1(my1)}V${r1(my0)}H${r1(mx1)}V${r1(my1)}" fill="none" stroke="#ffe9c9" stroke-width="6" opacity=".35"/>`,
  );
  // haze in the tunnel, lit from the mouth
  s += rays({
    x: 540,
    y: (my0 + my1) / 2,
    n: 22,
    len: 1300,
    a0: 100,
    a1: 260,
    w: [2, 6],
    color: '#f3dcc0',
    a: 0.14,
    seed: 5,
    blur: 14,
  });
  s += mist({ y: my1 + 40, h: 70, x0: 100, x1: 980, color: '#c9c7d0', a: 0.18, seed: 12, n: 6 });
  s += vignette(0.45, C.shade, 0.5);
  return [svgLayer(back), svgLayer(s)];
};

/** the arena seen through the tunnel's mouth (fills the whole frame; the tunnel is drawn over it) */
const skyArena = (x0, y0, x1, y1, cam) => {
  let s = wash('#58607a');
  const floorY = cam.at(0, 36)[1];
  // the far stands, bright in the haze
  s += stands({
    y0: y0 - 60,
    y1: floorY + 4,
    seed: 21,
    n: 150,
    r: [5, 14],
    alpha: [0.35, 0.85],
    base: ['#3d4a6e', '#4b3f5c'],
  });
  // the lights above, and their haze
  s += vgrad(
    [
      [0, '#e8eefc', 0.9],
      [0.45, '#c4d4f3', 0.5],
      [1, '#c4d4f3', 0],
    ],
    [0, y0 - 40, W, 220],
  );
  s += lightRow({ y: y0 + 26, x0: x0 + 60, x1: x1 - 60, n: 6, size: 22, a: 0.9, glowA: 0.8 });
  s += glow({ x: 540, y: y0 + 30, rx: 520, ry: 170, color: '#eef3ff', a: 0.45, blend: 'screen' });
  // the court: glossy wood, the far sideline, the halfway line, the centre circle
  s += woodFloor(cam, { z0: 6, z1: 34, x0: -30, x1: 30, seed: 31 });
  const lines =
    worldPath(cam, floorLine([-30, 22], [30, 22])) +
    worldPath(cam, floorLine([-30, 8], [30, 8])) +
    worldPath(cam, floorLine([0, 8], [0, 22]));
  const circ = worldPath(cam, floorArc(0, 15, 1.8));
  s += `<path d="${circ}" fill="${C.orange}" opacity=".45"/>`;
  s += blurred(
    0.8,
    `<path d="${lines}${circ}" fill="none" stroke="${C.line}" stroke-width="2.4" opacity=".75"/>`,
  );
  // reflections of the lights in the lacquer
  for (let i = 0; i < 6; i++) {
    const x = x0 + 60 + ((x1 - x0 - 120) * i) / 5;
    s += streak({ x, y0: floorY - 2, y1: y1 + 60, w: 34, color: '#f3f0ff', a: 0.45 });
  }
  // everything flooded with light and haze
  s += rgrad({
    x: 540,
    y: (y0 + y1) / 2,
    rx: 560,
    ry: 420,
    stops: [
      [0, '#fff1dc', 0.55],
      [0.5, '#f6dfc0', 0.25],
      [1, '#f6dfc0', 0],
    ],
    blend: 'screen',
  });
  s += mist({ y: floorY + 10, h: 36, x0: x0 - 40, x1: x1 + 40, color: '#e8e2da', a: 0.35, seed: 23, n: 8 });
  return s;
};

/** the court from its centre: the painted circle and lines, glossy wood reflecting the lights, the stands blurred */
const court = () => {
  const cam = camera({ h: 3.2, tilt: 0.2, f: 900, cy: 1062, pz: -7 });
  const floorTop = cam.at(0, 9.5)[1];
  let s = wash(C.navy);
  // the far stands and the roof's lights
  s += vgrad(
    [
      [0, '#101a33'],
      [0.35, '#1d2a4b'],
      [1, '#2b2a48'],
    ],
    [0, 0, W, floorTop],
  );
  s += stands({ y0: 250, y1: floorTop, seed: 41, n: 250, r: [7, 26], alpha: [0.2, 0.7], calm: [620, 1100] });
  s += lightRow({ y: 150, n: 6, size: 30, a: 0.85, glowA: 0.55 });
  s += beam({ x: 180, y: 140, ang: 72, spread: 12, len: 1100, color: '#cfe0ff', a: 0.16, blur: 20 });
  s += beam({ x: 900, y: 140, ang: 108, spread: 12, len: 1100, color: '#cfe0ff', a: 0.16, blur: 20 });
  // haze over the stands
  s += hazeTex({ box: [0, 0, W, floorTop], color: '#8fa6d6', a: 0.35, freq: [0.003, 0.006], seed: 43 });
  s += vgrad(
    [
      [0, '#9cb4e6', 0],
      [0.6, '#9cb4e6', 0.12],
      [1, '#e6c8a4', 0.28],
    ],
    [0, 300, W, floorTop - 300],
  );
  // the apron: navy, out of bounds, then the court's wood
  s += `<path d="${worldPath(cam, [
    [-40, 7.5],
    [40, 7.5],
    [40, 9.5],
    [-40, 9.5],
    [-40, 7.5],
  ])}Z" fill="#17223d"/>`;
  s += `<defs><clipPath id="crt"><path d="${worldPath(cam, [
    [-14, -6.5],
    [14, -6.5],
    [14, 7.5],
    [-14, 7.5],
    [-14, -6.5],
  ])}Z"/></clipPath></defs>`;
  s += `<g clip-path="url(#crt)">${woodFloor(cam, { z0: -6.6, z1: 7.5, x0: -16, x1: 16, seed: 45 })}`;
  // the circle painted orange, the keys' ends navy
  const circle = worldPath(cam, floorArc(0, 0, 1.8));
  s += `<path d="${circle}Z" fill="${C.orange}" opacity=".62"/>`;
  s += `<path d="${circle}Z" fill="url(#cgl)" opacity=".5"/><defs><radialGradient id="cgl" cx=".5" cy=".6" r=".6">${stopsOf(
    [
      [0, '#ffd0a0', 0.8],
      [1, '#ffd0a0', 0],
    ],
  )}</radialGradient></defs>`;
  for (const sx of [-1, 1]) {
    s += `<path d="${worldPath(cam, [
      [sx * 14, -2.45],
      [sx * 8.2, -2.45],
      [sx * 8.2, 2.45],
      [sx * 14, 2.45],
    ])}Z" fill="${C.navy2}" opacity=".85"/>`;
  }
  // reflections of the roof lights in the lacquer
  for (let i = 0; i < 6; i++) {
    const x = 60 + ((W - 120) * i) / 5;
    s += streak({ x, y0: floorTop - 4, y1: floorTop + 680, w: 64, color: '#e8efff', a: 0.52 });
  }
  s += streak({ x: 540, y0: floorTop, y1: H, w: 900, color: '#f0d2ad', a: 0.14 });
  // the lines
  let lines =
    worldPath(cam, floorLine([-14, 7.5], [14, 7.5])) + worldPath(cam, floorLine([0, -6.5], [0, 7.5]));
  lines += worldPath(cam, floorArc(0, 0, 1.8));
  for (const sx of [-1, 1]) {
    lines += worldPath(cam, floorLine([sx * 14, -2.45], [sx * 8.2, -2.45]));
    lines += worldPath(cam, floorLine([sx * 8.2, -2.45], [sx * 8.2, 2.45]));
    lines += worldPath(cam, floorLine([sx * 8.2, 2.45], [sx * 14, 2.45]));
    lines += worldPath(
      cam,
      floorArc(8.2, 0, 1.8, Math.PI / 2, (Math.PI * 3) / 2).map(([x, z]) => [sx * x, z]),
    );
    lines += worldPath(
      cam,
      floorArc(12.425, 0, 6.75, Math.PI / 2 + 0.22, (Math.PI * 3) / 2 - 0.22).map(([x, z]) => [sx * x, z]),
    );
  }
  s += blurred(0.9, `<path d="${lines}" fill="none" stroke="${C.line}" stroke-width="3.2" opacity=".82"/>`);
  s += '</g>';
  // the stands' colors reflected softly just below the sideline
  s += blurred(
    18,
    bokeh(
      bokehField({ n: 60, box: [0, floorTop, W, 90], r: [10, 26], colors: CROWD, a: [0.1, 0.3], seed: 47 }),
      { rim: 0 },
    ),
  );
  // depth: the far court softer, the near floor a little out of focus (a haze and a darker foot)
  s += vgrad(
    [
      [0, '#d9c3a6', 0.3],
      [1, '#d9c3a6', 0],
    ],
    [0, floorTop - 10, W, 200],
  );
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.45],
    ],
    [0, 1500, W, 420],
  );
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

/** from courtside: the stands as soft bokeh, spotlight beams sweeping down through the haze */
const arena = () => {
  const cam = camera({ h: 1.3, tilt: -0.1, f: 820, cy: 918 });
  const floorTop = cam.at(0, 17)[1];
  let s = vgrad(
    [
      [0, '#0b1224'],
      [0.25, '#16213f'],
      [0.5, '#27294d'],
      [1, '#33294a'],
    ],
    [0, 0, W, floorTop],
  );
  // the roof: a dark band with the lighting rig
  s += stands({
    y0: 520,
    y1: floorTop,
    seed: 51,
    n: 320,
    r: [8, 30],
    alpha: [0.2, 0.75],
    calm: [640, 1060],
    base: ['#1f2748', '#2f2748'],
  });
  // upper tier in shadow, a band of light along the fascia
  s += vgrad(
    [
      [0, '#0c1326', 1],
      [1, '#0c1326', 0],
    ],
    [0, 380, W, 220],
  );
  s += blurred(3, `<rect x="-20" y="505" width="${W + 40}" height="10" fill="${C.orange}" opacity=".55"/>`);
  s += blurred(10, `<rect x="-20" y="500" width="${W + 40}" height="24" fill="${C.orange}" opacity=".25"/>`);
  // haze
  s += hazeTex({ box: [0, 0, W, floorTop + 40], color: '#9fb6e8', a: 0.4, freq: [0.0028, 0.0045], seed: 53 });
  // spotlight beams from the rig
  const B = [
    [120, 170, 62, C.blue, 0.34],
    [300, 120, 78, '#f7f2ff', 0.3],
    [470, 150, 98, '#ffc58c', 0.26],
    [660, 120, 84, C.blue, 0.3],
    [860, 160, 112, '#f7f2ff', 0.3],
    [1000, 180, 124, C.blue, 0.3],
  ];
  for (const [x, y, ang, c, a] of B) {
    s += beam({ x, y, ang, spread: 9, len: 1500, w0: 18, color: c, a, blur: 14 });
    s += glow({ x, y, rx: 90, ry: 70, color: c, a: 0.5, blend: 'screen' });
    s += glow({ x, y, rx: 20, ry: 16, color: '#ffffff', a: 0.9, blend: 'screen' });
  }
  // the court: glossy wood, the far sideline, reflections of the beams and the crowd
  s += woodFloor(cam, { z0: 1.2, z1: 15, seed: 55 });
  s += `<path d="${worldPath(cam, [
    [-40, 15],
    [40, 15],
    [40, 17],
    [-40, 17],
    [-40, 15],
  ])}Z" fill="#17223d"/>`;
  s += blurred(
    1,
    `<path d="${worldPath(cam, floorLine([-40, 15], [40, 15]))}" stroke="${C.line}" stroke-width="3" opacity=".8"/>`,
  );
  for (const [x, , ang, c] of B) {
    const hit = x + Math.cos((ang * Math.PI) / 180) * 1000;
    s += streak({ x: hit, y0: floorTop, y1: H, w: 80, color: c, a: 0.32 });
  }
  s += blurred(
    16,
    bokeh(
      bokehField({ n: 80, box: [0, floorTop, W, 120], r: [10, 30], colors: CROWD, a: [0.15, 0.4], seed: 57 }),
      { rim: 0 },
    ),
  );
  s += mist({ y: floorTop + 20, h: 60, color: '#c9cfe6', a: 0.25, seed: 59, n: 8 });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.5],
    ],
    [0, 1450, W, 470],
  );
  s += vignette(0.42, C.shade, 0.5);
  return [svgLayer(s)];
};

/** the key and the three-point line from a low angle, raked by a hard light from the left */
const lines = () => {
  const cam = camera({ h: 0.6, tilt: 0.16, f: 620, cy: 880, px: -5.2, pz: 7.4, yaw: 1.5 });
  const hz = cam.horizon;
  const far = cam.at(0, 29)[1];
  let s = vgrad(
    [
      [0, '#0a1020'],
      [0.5, '#141c36'],
      [1, '#1f2140'],
    ],
    [0, 0, W, far],
  );
  // the far end of the arena, deep in shadow and out of focus (darker toward the upper right)
  s += stands({
    y0: 180,
    y1: far,
    seed: 61,
    n: 150,
    r: [10, 34],
    alpha: [0.12, 0.45],
    calm: [480, 900],
    base: ['#121a33', '#211c38'],
  });
  s += vgrad(
    [
      [0, '#0a1020', 0.85],
      [1, '#0a1020', 0],
    ],
    [0, 0, W, 480],
  );
  s += rgrad({
    x: 880,
    y: 380,
    rx: 520,
    ry: 460,
    stops: [
      [0, '#0a1020', 0.6],
      [1, '#0a1020', 0],
    ],
  });
  // the side light: a hard lamp low on the left, its haze
  s += glow({ x: -40, y: 600, rx: 560, ry: 400, color: '#ffd7a8', a: 0.55, blend: 'screen' });
  s += glow({ x: 10, y: 620, rx: 120, ry: 90, color: '#fff3e0', a: 0.8, blend: 'screen' });
  s += rays({
    x: -30,
    y: 620,
    n: 16,
    len: 1500,
    a0: -6,
    a1: 40,
    w: [1.5, 4],
    color: '#ffd9ae',
    a: 0.22,
    seed: 63,
    blur: 12,
  });
  s += beam({ x: -30, y: 630, ang: 14, spread: 16, len: 1400, w0: 60, color: '#ffd9ae', a: 0.22, blur: 22 });
  // the court's wood from the baseline on, the navy apron behind it
  const wood = { lit: '#e9b176', base: '#bf8148', deep: '#6d4527' };
  s += woodFloor(cam, { z0: 0, z1: 28, x0: -16, x1: 16, seed: 65, ...wood });
  // the key, painted orange
  const key = [
    [-2.45, 0],
    [2.45, 0],
    [2.45, 5.8],
    [-2.45, 5.8],
    [-2.45, 0],
  ];
  s += `<path d="${worldPath(cam, key)}Z" fill="${C.orange}" opacity=".42"/>`;
  let ln = worldPath(cam, floorLine([-7.5, 14], [7.5, 14])) + worldPath(cam, floorArc(0, 14, 1.8));
  ln += worldPath(cam, floorLine([-7.5, 0], [-7.5, 28], 120));
  ln += worldPath(cam, floorLine([-2.45, 0], [-2.45, 5.8]));
  ln += worldPath(cam, floorLine([2.45, 0], [2.45, 5.8]));
  ln += worldPath(cam, floorLine([-2.45, 5.8], [2.45, 5.8]));
  ln += worldPath(cam, floorArc(0, 5.8, 1.8, 0, Math.PI * 2, 90));
  ln += worldPath(cam, floorLine([-6.6, 0], [-6.6, 2.99]));
  ln += worldPath(cam, floorLine([6.6, 0], [6.6, 2.99]));
  const ang = Math.acos(6.6 / 6.75);
  ln += worldPath(cam, floorArc(0, 1.575, 6.75, ang, Math.PI - ang, 240));
  for (const z of [1.75, 2.6, 3.45, 4.3]) {
    ln +=
      worldPath(cam, floorLine([-2.45, z], [-2.75, z], 4)) +
      worldPath(cam, floorLine([2.45, z], [2.75, z], 4));
  }
  s += blurred(0.8, `<path d="${ln}" fill="none" stroke="${C.line}" stroke-width="3.6" opacity=".85"/>`);
  // the rake of light across the floor: bright on the left, falling off to the right
  const lightG = nid('lk');
  s += `<defs>${ugrad(
    lightG,
    [
      [0, '#ffcf98', 0.62],
      [0.4, '#ffcf98', 0.26],
      [0.78, '#ffcf98', 0],
    ],
    [0, 0, W, 0],
  )}</defs><rect y="${r1(hz)}" width="${W}" height="${r1(H - hz)}" fill="url(#${lightG})" style="mix-blend-mode:screen"/>`;
  const shadeG = nid('lk');
  s += `<defs>${ugrad(
    shadeG,
    [
      [0.35, C.shade, 0],
      [1, C.shade, 0.66],
    ],
    [0, 0, W, 0],
  )}</defs><rect y="${r1(hz)}" width="${W}" height="${r1(H - hz)}" fill="url(#${shadeG})"/>`;
  // the lamp's glare in the lacquer, streaks toward us
  s += streak({ x: 130, y0: hz + 8, y1: H, w: 200, color: '#ffe2bb', a: 0.5 });
  s += streak({ x: 330, y0: hz + 16, y1: 1500, w: 70, color: '#fff0da', a: 0.25 });
  // the near floor out of focus
  const nb = vmask(
    [
      [0, 0],
      [1, 1],
    ],
    [1380, H],
  );
  s +=
    nb.defs +
    `<g mask="url(#${nb.id})">${blurred(8, woodFloor(cam, { z0: 2, z1: 9, x0: -9, x1: -3, seed: 67, ...wood }) + `<path d="${ln}" fill="none" stroke="${C.line}" stroke-width="5" opacity=".8"/>`)}</g>`;
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.45],
    ],
    [0, 1450, W, 470],
  );
  s += mist({ y: hz + 24, h: 44, color: '#d4c2b0', a: 0.2, seed: 69, n: 8 });
  s += vignette(0.45, C.shade, 0.52);
  return [svgLayer(s)];
};

/** looking up into the rafters: trusses and banks of lights on the left, beams through the haze; the upper right dark and clean */
const rim = () => {
  let s = vgrad(
    [
      [0, '#111b33'],
      [0.4, '#1e2c52'],
      [0.75, '#30355b'],
      [1, '#463652'],
    ],
    [0, 0, W, H],
  );
  // the lit haze under the roof, strongest on the left
  s += glow({ x: 240, y: 380, rx: 1000, ry: 1000, color: '#6f8bca', a: 0.8 });
  s += glow({ x: 380, y: 1150, rx: 700, ry: 520, color: '#7d86b8', a: 0.35 });
  s += glow({ x: 300, y: 1500, rx: 900, ry: 600, color: '#7a5a6a', a: 0.35 });
  s += hazeTex({ color: '#a3bbec', a: 0.4, freq: [0.0025, 0.004], seed: 71 });
  // the trusses: long beams converging far below the frame (we look up), in the left half
  const vp = [860, 2700];
  const truss = (x0, y0, len, w, a) => {
    // a lattice girder from (x0, y0) toward the vanishing point
    const [dx, dy] = [vp[0] - x0, vp[1] - y0];
    const L = Math.hypot(dx, dy);
    const [ux, uy] = [dx / L, dy / L];
    const [nx, ny] = [-uy, ux];
    const p = (t, side) => [
      x0 + ux * len * t + nx * w * side * (1 - t * 0.5),
      y0 + uy * len * t + ny * w * side * (1 - t * 0.5),
    ];
    let d = pts([p(0, -1), p(1, -1)]) + pts([p(0, 1), p(1, 1)]);
    const n = 14;
    for (let i = 0; i < n; i++) d += pts([p(i / n, -1), p((i + 0.5) / n, 1), p((i + 1) / n, -1)]);
    return `<path d="${d}" fill="none" stroke="#070b16" stroke-width="${r1(w * 0.18)}" opacity="${a}" stroke-linejoin="round"/>`;
  };
  let tr = '';
  tr += truss(-120, -60, 1500, 60, 0.9);
  tr += truss(180, -80, 1300, 46, 0.85);
  tr += truss(-260, 520, 1300, 44, 0.8);
  // cross girders, nearly level, fewer toward the bottom
  const cross = (y, x1, w, a) => {
    let d = `M-40 ${y}L${x1} ${r1(y + 30)}M-40 ${y + w}L${x1} ${r1(y + 30 + w * 0.8)}`;
    for (let x = -40; x < x1; x += w * 1.1)
      d += `M${r1(x)} ${y}L${r1(x + w * 0.55)} ${r1(y + w)}L${r1(x + w * 1.1)} ${y}`;
    return `<path d="${d}" fill="none" stroke="#070b16" stroke-width="${r1(w * 0.14)}" opacity="${a}"/>`;
  };
  tr += cross(250, 470, 54, 0.85) + cross(640, 390, 40, 0.7);
  s += blurred(3.2, tr, 'opacity=".85"');
  // banks of floodlights on the girders, blazing
  const bank = (x, y, w, h, a) => {
    let o = glow({ x, y, rx: w * 2.6, ry: h * 3.2, color: '#a9c6ff', a: 0.45 * a, blend: 'screen' });
    o += `<rect x="${r1(x - w / 2)}" y="${r1(y - h / 2)}" width="${w}" height="${h}" rx="6" fill="#dfe9ff" opacity="${r3(0.8 * a)}"/>`;
    for (let i = 0; i < 3; i++)
      o += glow({
        x: x - w / 3 + (i * w) / 3,
        y,
        rx: w * 0.3,
        ry: h * 0.6,
        color: '#ffffff',
        a: 0.9 * a,
        blend: 'screen',
      });
    return o;
  };
  let banks = '';
  banks += bank(140, 280, 90, 40, 1) + bank(300, 300, 80, 36, 0.95) + bank(450, 320, 70, 32, 0.85);
  banks += bank(90, 690, 64, 30, 0.8) + bank(230, 700, 58, 26, 0.75);
  banks += bank(360, 120, 70, 30, 0.7);
  s += blurred(1.5, banks);
  // beams through the haze, down and to the right, crossing below the clean corner
  s += beam({ x: 140, y: 290, ang: 58, spread: 11, len: 1700, w0: 60, color: C.blue, a: 0.3, blur: 18 });
  s += beam({ x: 300, y: 310, ang: 70, spread: 10, len: 1600, w0: 50, color: '#eaf0ff', a: 0.26, blur: 16 });
  s += beam({ x: 450, y: 330, ang: 84, spread: 9, len: 1500, w0: 44, color: '#ffc793', a: 0.2, blur: 16 });
  s += beam({ x: 90, y: 700, ang: 40, spread: 12, len: 1300, w0: 40, color: C.blue, a: 0.22, blur: 18 });
  // the upper tier's rim at the bottom: a dark curve, the crowd's lights
  const rimG = nid('rimg');
  s += `<defs>${lgrad(rimG, [
    [0, '#1a1830'],
    [1, '#0d1122'],
  ])}</defs><path d="M-40 1640Q540 1480 1120 1600V${H + 40}H-40Z" fill="url(#${rimG})" opacity=".92"/>`;
  s += blurred(
    2,
    `<path d="M-40 1640Q540 1480 1120 1600" fill="none" stroke="${C.orange}" stroke-width="5" opacity=".55"/>`,
  );
  s += bokeh(
    bokehField({
      n: 120,
      box: [-20, 1560, W + 40, 360],
      r: [6, 20],
      colors: CROWD,
      a: [0.2, 0.6],
      seed: 73,
      weight: (x, y) => (y > 1600 - x * 0.05 ? 1 : 0.2),
    }),
    { rim: 0.3, blur: 1.5 },
  );
  // keep the upper right dark and clean
  s += rgrad({
    x: 900,
    y: 360,
    rx: 620,
    ry: 700,
    stops: [
      [0, '#0b1222', 0.75],
      [0.6, '#0b1222', 0.45],
      [1, '#0b1222', 0],
    ],
  });
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

const scenes = {
  'scene-tunnel': { paint: tunnel, seed: 101, post: { gamma: 1.02, bloom: 0.45 } },
  'scene-court': { paint: court, seed: 102, post: { gamma: 1.0, bloom: 0.42 } },
  'scene-arena': { paint: arena, seed: 103, post: { gamma: 1.0, bloom: 0.45 } },
  'scene-lines': { paint: lines, seed: 104, post: { gamma: 1.0, bloom: 0.42 } },
  'scene-rim': { paint: rim, seed: 105, post: { gamma: 1.0, bloom: 0.45 } },
};

await paintScenes({ id: 'buzzer-beater', scenes, background: '#3a2a22' });
