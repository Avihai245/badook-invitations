// jerusalem-gold (a bar mitzvah in golden Jerusalem): five backdrop pictures of one walk through the Old
// City — a gate in the morning, an alley of arches and lanterns, the great ashlar stones at golden hour, the
// folds of a prayer shawl in window light, the walls lit gold at night — in Jerusalem stone, gold and sky
// blue. Nothing written anywhere, no people. Painted with the kit (./kit.mjs) and the group's helpers.
//
//   node scripts/scene-art/jerusalem-gold.mjs [--draft <dir>] [scene …]
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
  rays,
  vignette,
  svgLayer,
  pts,
  tree,
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
  pointedArch,
  opening,
  stoneTex,
  ashlar,
  stars,
  paneLantern,
  cloth,
} from './architecture-shared.mjs';

const C = {
  stone: '#E8DCC4',
  stone2: '#D9C7A2',
  gold: '#C9A45C',
  sky: '#7FA2C3',
  deep: '#2C3E5C',
  shade: '#1B2436',
  lit: '#efdfbd',
  warm: '#f2dcaa',
  stoneShade: '#b09470',
  stoneDark: '#86704f',
  haze: '#e3d8c2',
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** the top of a crenellated wall from x0 to x1 (parapet at y): merlons mw wide with pointed caps */
const battlement = (x0, x1, y, mh, mw, gap, cap = 0) => {
  const n = Math.max(1, Math.round((x1 - x0 + gap) / (mw + gap)));
  const g = n > 1 ? (x1 - x0 - n * mw) / (n - 1) : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * (mw + g);
    out.push(
      [a, y],
      [a, y - mh],
      ...(cap ? [[a + mw / 2, y - mh - cap]] : []),
      [a + mw, y - mh],
      [a + mw, y],
    );
  }
  return out;
};

// ---------------------------------------------------------------------------------------------------
// 1. the gate: a pale golden gatehouse in the morning, a tall pointed arch framing calm light

const gate = () => {
  const rnd = prng(101);
  const cx = 540;
  const foot = 1500;
  const vy = 1392;
  let s = skyFill([
    [0, '#5b82ad'],
    [0.1, '#6a8fb8'],
    [0.2, C.sky],
    [0.27, '#9bb4c8'],
    [0.32, '#bccbd1'],
    [0.38, '#d6d6cc'],
    [1, '#d9d1bd'],
  ]);
  s += glow({ x: 140, y: 150, rx: 950, ry: 760, color: '#f4e1b6', a: 0.45 });
  s += glow({ x: 140, y: 150, rx: 260, color: '#f8ecd2', a: 0.55 });
  s += wisps({
    color: '#efe7d8',
    a: 0.32,
    seed: 23,
    items: [
      [660, 140, 360, 16, -4],
      [300, 290, 300, 12, 3],
      [920, 300, 260, 12, -2],
      [560, 400, 360, 10, 1],
    ],
  });
  // cypresses beyond the curtain walls
  const cyp = (x, top, base, w, sd, hz) =>
    foliage({
      lobes: flame(rnd, x, top, base, w),
      pal: {
        lit: mix('#9aa377', C.haze, hz),
        mid: mix('#66775a', C.haze, hz),
        shade: mix('#44564a', C.haze, hz),
      },
      seed: sd,
      grain: 0.07,
      edge: 8,
      clump: 10,
      tex: 0.5,
      relief: 5,
      light: [0, 0, 1, 0.4],
    });
  s += cyp(40, 400, 640, 74, 11, 0.38) + cyp(128, 452, 640, 60, 13, 0.45);
  s += cyp(1000, 420, 640, 76, 15, 0.38) + cyp(1072, 486, 640, 58, 17, 0.45);
  s += mist({ y: 600, h: 40, x0: -100, x1: 1180, color: '#dcd8cc', a: 0.5, seed: 19, n: 8 });

  // the walls: a gatehouse (crenellated, taller) between two curtain walls
  const curtainY = 612;
  const houseY = 452;
  const sil = [
    [-60, foot + 60],
    ...battlement(-60, 205, curtainY, 50, 44, 30, 9),
    [205, houseY],
    ...battlement(205, 875, houseY, 66, 52, 30, 12),
    [875, curtainY],
    ...battlement(875, 1140, curtainY, 50, 44, 30, 9),
    [1140, foot + 60],
  ];
  const tone = (x, y, r) => {
    const base = mix(C.stone, C.stone2, 0.2 + r() * 0.65);
    const t = clamp(((y - 420) / 1300) * 0.5 + (x - 120) / 2800);
    return mix(mix(base, '#efd7a6', r() * 0.4), '#b89f78', t);
  };
  const tex = stoneTex({ freq: 0.03, relief: 2.6, tex: 0.42, seed: 5, patch: 0.14, patchColor: '#8a7355' });
  let wall = `<defs><clipPath id="sil"><path d="${pts(sil)}Z"/></clipPath></defs><g clip-path="url(#sil)">`;
  wall += ashlar({
    x0: -60,
    x1: 1140,
    yTop: 380,
    yBot: foot + 60,
    course: 41,
    len: 92,
    seed: 3,
    tone,
    joint: 3,
    jointColor: '#b7a07c',
    lit: '#f6ead0',
    dark: '#9c8563',
  });
  wall += '</g>';
  s += under(tex, wall);
  // light and shade on the walls: the curtains set back in soft shade, the gatehouse's shadow to the right
  let sh = `<defs><clipPath id="sil2"><path d="${pts(sil)}Z"/></clipPath></defs><g clip-path="url(#sil2)">`;
  sh += box(-60, 500, 265, 1100, 'fill="#8b7a62" opacity=".2"');
  sh += box(875, 500, 280, 1100, 'fill="#6f6556" opacity=".3"');
  sh += soft(
    { box: [860, 520, 220, 1100], blur: 10, disp: 6, freq: 0.02 },
    box(875, 600, 70, 1000),
    'fill="#5d5647" opacity=".32"',
  );
  // the string course under the gatehouse's parapet, with its shadow
  sh += box(205, 470, 670, 14, 'fill="#f1e2c2"');
  sh += `<defs>${ugrad(
    'scs',
    [
      [0, '#6a5a44', 0.4],
      [1, '#6a5a44', 0],
    ],
    [0, 484, 0, 506],
  )}</defs>${box(205, 484, 670, 22, 'fill="url(#scs)"')}`;
  // arrow slits
  for (const x of [372, 708])
    sh += `<path d="M${x - 6} 640V575A6 6 0 0 1 ${x + 6} 575V640Z" fill="#6f5d44" opacity=".75"/>`;
  // the ground's warm bounce low on the walls, a cooler shade high up on the right
  sh += `<defs>${ugrad(
    'gb',
    [
      [0, '#7a6a52', 0],
      [1, '#7a6a52', 0.28],
    ],
    [0, 1100, 0, 1500],
  )}</defs>${box(-60, 1100, 1200, 460, 'fill="url(#gb)"')}`;
  sh += '</g>';
  s += sh;

  // the arch: a recessed frame of voussoirs, then the opening
  const inner = { hw: 142, spring: 1012, rise: 252 };
  const outer = { hw: 200, spring: 992, rise: 330 };
  const outerPts = opening(pointedArch(cx, outer.spring, outer.hw, outer.rise), foot);
  const innerArch = pointedArch(cx, inner.spring, inner.hw, inner.rise);
  const innerPts = opening(innerArch, foot);
  let fr = `<defs><clipPath id="ofr"><path d="${pts(outerPts)}Z"/></clipPath></defs><g clip-path="url(#ofr)">`;
  fr += box(300, 600, 480, 950, 'fill="#dcc9a3"');
  // voussoirs: joints along the normals of the two arcs
  const R = (inner.rise ** 2 + inner.hw ** 2) / (2 * inner.hw);
  let joints = '';
  const top = Math.atan2(-inner.rise, cx - (cx - inner.hw + R)) + 2 * Math.PI;
  for (let i = 1; i < 9; i++) {
    const a = Math.PI + ((top - Math.PI) * i) / 9;
    const c0 = cx - inner.hw + R;
    const [px, py] = [c0 + R * Math.cos(a), inner.spring + R * Math.sin(a)];
    const [qx, qy] = [c0 + (R + 110) * Math.cos(a), inner.spring + (R + 110) * Math.sin(a)];
    joints += `M${r1(px)} ${r1(py)}L${r1(qx)} ${r1(qy)}M${r1(2 * cx - px)} ${r1(py)}L${r1(2 * cx - qx)} ${r1(qy)}`;
  }
  // the jambs' courses
  for (let y = inner.spring + 40; y < foot; y += 44)
    joints += `M300 ${y}H${cx - inner.hw}M${cx + inner.hw} ${y}H780`;
  fr += `<path d="${joints}" stroke="#a48c68" stroke-width="3" fill="none"/><path d="${joints}" stroke="#f5e8cc" stroke-width="1.5" fill="none" transform="translate(-1.5 -1.5)" opacity=".6"/>`;
  fr += `<path d="M${cx} ${inner.spring - inner.rise}V${inner.spring - inner.rise - 80}" stroke="#a48c68" stroke-width="3"/>`;
  // the recess's shadow along its upper left edge
  fr += soft(
    { box: [280, 600, 520, 960], blur: 9, disp: 4, freq: 0.03 },
    `<path d="${pts(outerPts)}" fill="none" stroke="#5f503c" stroke-width="26" transform="translate(9 12)"/>`,
    'opacity=".38"',
  );
  fr += '</g>';
  s += under(stoneTex({ freq: 0.035, relief: 2.4, tex: 0.4, seed: 9, patch: 0.1 }), fr);

  // the passage through the gate and the calm light beyond it
  const k = 0.7;
  const farPts = innerPts.map(([x, y]) => [cx + (x - cx) * k, vy + (y - vy) * k]);
  let op = `<defs><clipPath id="opn"><path d="${pts(innerPts)}Z"/></clipPath><radialGradient id="pas" cx="0.5" cy="0.62" r="0.62">${stopsOf(
    [
      [0, '#d9c196'],
      [0.6, '#a58c66'],
      [1, '#7b6649'],
    ],
  )}</radialGradient><linearGradient id="bey" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, '#f1e6cc'],
    [0.5, '#f4e3bd'],
    [1, '#e9d2a2'],
  ])}</linearGradient></defs><g clip-path="url(#opn)">`;
  op += box(cx - inner.hw - 5, 700, 2 * inner.hw + 10, 820, 'fill="url(#pas)"');
  // the passage's right wall catches the morning light near the mouth
  op += poly(
    [
      [innerPts[innerPts.length - 1][0], foot],
      [farPts[farPts.length - 1][0], farPts[farPts.length - 1][1]],
      [farPts[farPts.length - 12][0], farPts[farPts.length - 12][1]],
      [innerPts[innerPts.length - 12][0], innerPts[innerPts.length - 12][1]],
    ],
    'fill="#cdb48a" opacity=".55"',
  );
  op += `<path d="${pts(farPts)}Z" fill="url(#bey)"/>`;
  op += glow({ x: cx, y: 1180, rx: 200, ry: 300, color: '#fbf0d6', a: 0.7 });
  // faint shapes of the street inside, lost in the light
  op += blurred(
    6,
    `<path d="M${cx - 95} 1470V1180L${cx - 60} 1150V1470Z" fill="#dcc8a2" opacity=".5"/><path d="M${cx + 50} 1470V1210H${cx + 100}V1470Z" fill="#d8c29a" opacity=".45"/>`,
  );
  op += '</g>';
  s += op;
  s += glow({ x: cx, y: 1200, rx: 330, ry: 420, color: '#f6e5bf', a: 0.35, blend: 'screen' });

  // the plaza: flagstones in perspective, the light from the gate spilling onto them
  const cam = camera({ f: 1000, vx: cx, vy, eye: 1.6 });
  const Zg = (1000 * 1.6) / (foot - vy);
  let pav = box(0, foot, W, H - foot, 'fill="#8f7a5c"');
  let zz = Zg;
  let _row = 0;
  while (zz > 2.2) {
    const z1 = zz - 0.85 - rnd() * 0.25;
    let X = -14 + rnd() * 1.2;
    while (X < 14) {
      const w = 0.9 + rnd() * 0.7;
      const c = mix(mix('#dcc7a0', '#cdb68d', rnd()), '#a8916c', clamp((Zg - zz) / 10) * 0.5 + rnd() * 0.15);
      pav += cam.poly(
        [
          [X + 0.04, 0, zz - 0.04],
          [X + w - 0.04, 0, zz - 0.04],
          [X + w - 0.04, 0, z1 + 0.04],
          [X + 0.04, 0, z1 + 0.04],
        ],
        `fill="${c}"`,
      );
      X += w;
    }
    zz = z1;
    _row += 1;
  }
  s += under(stoneTex({ freq: 0.05, relief: 2, tex: 0.4, seed: 13, patch: 0.1 }), pav);
  s += glow({ x: cx, y: 1560, rx: 260, ry: 70, color: '#f3dcae', a: 0.5, blend: 'screen' });
  s += `<defs>${ugrad(
    'plz',
    [
      [0, '#7d6c55', 0],
      [1, '#6b5c49', 0.4],
    ],
    [0, foot, 0, H],
  )}</defs>${box(0, foot, W, H - foot, 'fill="url(#plz)"')}`;

  // an olive tree in soft focus at the left, framing the view
  const olive = { lit: '#b4b894', front: '#c0c29e', mid: '#7f8a6c', midFront: '#8a9474', shade: '#505b4b' };
  let ol = `<path d="M-10 1940C40 1840 10 1760 70 1680C110 1620 60 1560 120 1470M70 1680C140 1650 190 1600 230 1540M118 1500C90 1440 40 1420 10 1380" stroke="#5a5044" stroke-width="44" fill="none" stroke-linecap="round"/><path d="M-10 1940C40 1840 10 1760 70 1680C110 1620 60 1560 120 1470" stroke="#8a7d68" stroke-width="12" fill="none" opacity=".5" transform="translate(-10 0)"/>`;
  for (const [x, y, w, h, sd] of [
    [-20, 1330, 330, 230, 31],
    [150, 1290, 300, 200, 33],
    [60, 1440, 360, 200, 35],
    [250, 1450, 210, 150, 37],
    [-40, 1520, 240, 180, 39],
  ])
    ol += tree({ cx: x, cy: y, w, h, n: 60, pal: olive, seed: sd, leaf: 0.07, bands: 3, fray: 0.1 });
  s += blurred(3.2, ol);
  // morning air, shafts of sun, a lens vignette
  s += veil('#e8dcc4', [
    [300, 0],
    [800, 0.1],
    [1400, 0.16],
    [1920, 0.05],
  ]);
  s += rays({
    x: 120,
    y: 120,
    n: 12,
    len: 1800,
    a0: 22,
    a1: 62,
    w: [1.5, 4],
    color: '#f6e6c2',
    a: 0.16,
    seed: 17,
    blur: 16,
  });
  s += vignette(0.34, '#2a3246');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 2. the alley: arches over worn steps, brass lanterns, warm light spilling in from the far end

const alley = () => {
  const rnd = prng(202);
  const f = 1080;
  const cam = camera({ f, vx: 540, vy: 1110, eye: 1.6 });
  const { p } = cam;
  const A = 1.6;
  // the floor: a level stretch, a flight, a landing, a shorter flight, the far level
  const segs = [{ z0: 1.2, z1: 3.3, y: 0 }];
  let z = 3.3;
  let y = 0;
  for (let i = 0; i < 6; i++) {
    y += 0.13;
    segs.push({ z0: z, z1: z + 0.36, y });
    z += 0.36;
  }
  segs.push({ z0: z, z1: z + 2.7, y });
  z += 2.7;
  for (let i = 0; i < 4; i++) {
    y += 0.13;
    segs.push({ z0: z, z1: z + 0.38, y });
    z += 0.38;
  }
  segs.push({ z0: z, z1: 40, y });
  const floorAt = (zz) => (segs.find((sg) => zz >= sg.z0 && zz < sg.z1) ?? segs[segs.length - 1]).y;
  const arches = [4.1, 7.3, 10.7, 14.1];
  const thick = 0.62;
  const zEnd = arches[arches.length - 1] + thick;
  const light = (zz) => smooth(3, zEnd + 1, zz) ** 0.85;
  const stoneAt = (zz, Y, r) =>
    mix(
      mix('#846e50', '#eed9ad', light(zz)),
      mix(C.stone, C.stone2, r()),
      0.14 + r() * 0.12 + clamp((Y - 2) / 14) * 0.12,
    );

  // beyond: a sunlit square, a bright wall and a pale sky, all melting into the light
  let s = skyFill([
    [0, '#c9d4d6'],
    [0.35, '#e9e2cf'],
    [0.5, '#f4e5c2'],
    [0.62, '#efd9aa'],
    [1, '#d6bd8f'],
  ]);
  s += cam.poly(
    [
      [-6, 0.9, 24],
      [6, 0.9, 24],
      [6, 9, 24],
      [-6, 9, 24],
    ],
    'fill="#f1dfb6"',
  );
  s += glow({ x: 540, y: 960, rx: 420, ry: 520, color: '#fbeecf', a: 0.8 });

  // the side walls: courses of blocks in perspective, darker near us, gold towards the light
  let walls = '';
  for (const side of [-1, 1]) {
    const X = side * A;
    walls += cam.poly(
      [
        [X, -1, 1.5],
        [X, 12, 1.5],
        [X, 12, zEnd + 0.05],
        [X, -1, zEnd + 0.05],
      ],
      `fill="${mix('#7d6a4e', '#c9b186', 0.5)}"`,
    );
    let Y = -0.6;
    while (Y < 12) {
      const ch = 0.34 + rnd() * 0.12;
      let zz = 1.5 + rnd() * 0.6;
      while (zz < zEnd) {
        const l = 0.55 + rnd() * 0.65;
        const z1 = Math.min(zEnd, zz + l);
        walls += cam.poly(
          [
            [X, Y + 0.02, zz + 0.025],
            [X, Y + ch - 0.02, zz + 0.025],
            [X, Y + ch - 0.02, z1 - 0.025],
            [X, Y + 0.02, z1 - 0.025],
          ],
          `fill="${stoneAt((zz + z1) / 2, Y, rnd)}"`,
        );
        zz = z1;
      }
      Y += ch;
    }
  }
  // a blue door on the landing (left), a shuttered window (right)
  const onWall = (X, list) => list.map(([zz, Y]) => p([X, Y, zz]));
  const doorZ = [6.0, 6.95];
  const dY = floorAt(6.4);
  const doorArch = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / 12;
    return [6.475 + 0.475 * Math.cos(a), dY + 1.75 - 0.475 * Math.sin(a)];
  });
  walls += poly(
    onWall(-A, [
      [doorZ[0] - 0.12, dY],
      ...doorArch.map(([zz, Y]) => [zz + (zz < 6.475 ? -0.12 : 0.12), Y + 0.12]),
      [doorZ[1] + 0.12, dY],
    ]),
    'fill="#b59d78"',
  );
  walls += poly(
    onWall(-A, [[doorZ[0], dY], ...doorArch, [doorZ[1], dY]]),
    `fill="${mix('#4f6f8f', '#e0c9a0', 0.25)}"`,
  );
  walls += `<path d="${pts(
    onWall(-A, [
      [6.475, dY + 0.1],
      [6.475, dY + 1.9],
    ]),
  )}" stroke="#3d566f" stroke-width="3" opacity=".6"/>`;
  const wz = [8.5, 9.15];
  const wY = floorAt(8.8) + 2.5;
  walls += poly(
    onWall(A, [
      [wz[0], wY],
      [wz[0], wY + 0.9],
      [wz[1], wY + 0.9],
      [wz[1], wY],
    ]),
    'fill="#5b4a36"',
  );
  walls += poly(
    onWall(A, [
      [wz[0] - 0.3, wY - 0.05],
      [wz[0] - 0.3, wY + 0.95],
      [wz[0], wY + 0.95],
      [wz[0], wY - 0.05],
    ]),
    `fill="${mix('#5f82a3', '#e6cfa3', 0.35)}"`,
  );
  walls += poly(
    onWall(A, [
      [wz[1], wY - 0.05],
      [wz[1], wY + 0.95],
      [wz[1] + 0.3, wY + 0.95],
      [wz[1] + 0.3, wY - 0.05],
    ]),
    `fill="${mix('#5f82a3', '#e6cfa3', 0.4)}"`,
  );

  // the steps: lit treads, risers in shade (the light is ahead of us)
  let steps = '';
  for (let i = segs.length - 1; i >= 0; i--) {
    const sg = segs[i];
    const z1 = Math.min(sg.z1, zEnd + 12);
    const lt = light((sg.z0 + z1) / 2);
    steps += cam.poly(
      [
        [-A, sg.y, sg.z0],
        [A, sg.y, sg.z0],
        [A, sg.y, z1],
        [-A, sg.y, z1],
      ],
      `fill="${mix('#a58f6c', '#efdcb2', lt)}"`,
    );
    if (i > 0) {
      const y0 = segs[i - 1].y;
      steps += cam.poly(
        [
          [-A, y0, sg.z0],
          [A, y0, sg.z0],
          [A, sg.y, sg.z0],
          [-A, sg.y, sg.z0],
        ],
        `fill="${mix('#6f5c43', '#b79f78', lt)}"`,
      );
      steps += `<path d="${pts([p([-A, sg.y, sg.z0]), p([A, sg.y, sg.z0])])}" stroke="#f3e2bd" stroke-width="${r1(Math.max(1, 30 / sg.z0))}" opacity="${r3(0.35 + lt * 0.4)}"/>`;
    }
  }
  // flagstone joints on the level stretches
  for (const sg of [segs[0], segs[7]])
    for (let zz = sg.z0 + 0.5; zz < sg.z1 - 0.1; zz += 0.6 + rnd() * 0.3)
      steps += `<path d="${pts([p([-A, sg.y, zz]), p([A, sg.y, zz])])}" stroke="#8a7657" stroke-width="${r1(Math.max(0.8, 5 / zz))}" opacity=".45"/>`;

  // the arches: faces in shade, their undersides lit from ahead
  const archAt = (zz) => {
    const Ys = floorAt(zz) + 2.3;
    const curve = pointedArch(0, -Ys, A, 1.95, 24).map(([X, yy]) => [X, -yy]);
    return { Ys, curve };
  };
  let archesSvg = '';
  const lanterns = [];
  for (let i = arches.length - 1; i >= 0; i--) {
    const zz = arches[i];
    const { curve } = archAt(zz);
    const lt = light(zz);
    const face = [[-A, 14], ...curve, [A, 14]].map(([X, Y]) => p([X, Y, zz]));
    const back = curve.map(([X, Y]) => p([X, Y, zz + thick]));
    const front = curve.map(([X, Y]) => p([X, Y, zz]));
    const gid = nid('in');
    archesSvg += `<defs>${ugrad(
      gid,
      [
        [0, mix('#b99d70', '#f1dcae', lt)],
        [1, mix('#8d7654', '#d8bf92', lt)],
      ],
      [0, back[12][1], 0, front[12][1]],
    )}</defs>${poly(front.concat(back.reverse()), `fill="url(#${gid})"`)}`;
    const cid = nid('af');
    let blocks = '';
    const scale = f / zz;
    for (let yy = -40; yy < front[12][1] + 10; yy += 0.4 * scale) {
      let xx = 540 - A * scale - rnd() * 0.6 * scale;
      while (xx < 540 + A * scale) {
        const l = (0.5 + rnd() * 0.6) * scale;
        blocks += box(
          xx + 1.5,
          yy + 1.5,
          l - 3,
          0.4 * scale - 3,
          `fill="${mix(mix('#7f6a4d', '#d8c095', lt * 0.85), C.stone2, rnd() * 0.25)}"`,
        );
        xx += l;
      }
    }
    archesSvg += `<defs><clipPath id="${cid}"><path d="${pts(face)}Z"/></clipPath></defs><g clip-path="url(#${cid})">${box(0, -50, W, front[12][1] + 60, `fill="${mix('#6c5a41', '#bca479', lt)}"`)}${blocks}</g>`;
    archesSvg += `<path d="${pts(front)}" fill="none" stroke="${mix('#caa979', '#f6e3ba', lt)}" stroke-width="${r1(Math.max(1.5, 14 / zz))}" opacity=".7"/>`;
    const apex = curve[12];
    lanterns.push({ zz: zz + 0.25, X: 0, Y: apex[1] - 1.45, drop: 0.9 });
  }
  const tex = stoneTex({ freq: 0.04, relief: 2.4, tex: 0.44, seed: 21, patch: 0.12, patchColor: '#7a6448' });
  s += under(tex, walls + steps + archesSvg);
  // the lanterns hanging under the arches (far to near)
  for (const l of lanterns) {
    const [lx, ly] = p([l.X, l.Y, l.zz]);
    const sc = f / l.zz;
    s += paneLantern({
      x: lx,
      y: ly,
      s: 0.13 * sc,
      drop: l.drop * sc,
      glass: '#f7cf82',
      metal: '#4a3a27',
      halo: 0.9,
    });
  }
  // a potted plant on the landing, a bracket lantern on the right wall
  const [px, py] = p([A - 0.35, floorAt(6.6), 6.6]);
  s += blurred(
    1.2,
    `<path d="M${r1(px - 30)} ${r1(py)}L${r1(px - 24)} ${r1(py - 46)}H${r1(px + 24)}L${r1(px + 30)} ${r1(py)}Z" fill="#a86a46"/>${foliage(
      {
        lobes: crown(rnd, px, py - 80, 150, 110, 8),
        pal: { lit: '#9aa56b', mid: '#687a4c', shade: '#46553a' },
        seed: 41,
        grain: 0.09,
        edge: 7,
        clump: 8,
        tex: 0.5,
      },
    )}<g fill="#c9544a" opacity=".85"><circle cx="${r1(px - 30)}" cy="${r1(py - 110)}" r="7"/><circle cx="${r1(px + 18)}" cy="${r1(py - 128)}" r="6"/><circle cx="${r1(px + 44)}" cy="${r1(py - 88)}" r="6"/></g>`,
  );
  const [bx, by] = p([A, floorAt(5) + 2.55, 5.0]);
  s += `<path d="M${r1(bx)} ${r1(by - 18)}H${r1(bx - 60)}V${r1(by)}" stroke="#3f3225" stroke-width="5" fill="none"/>`;
  s += paneLantern({ x: bx - 60, y: by + 4, s: 26, glass: '#f7cf82', metal: '#4a3a27', halo: 1 });

  // the light pouring in from the far end, warm haze, a vignette
  s += glow({ x: 540, y: 980, rx: 700, ry: 900, color: '#f5dfb0', a: 0.4, blend: 'screen' });
  s += glow({ x: 540, y: 1180, rx: 380, ry: 260, color: '#f7e4bb', a: 0.35, blend: 'screen' });
  s += rays({
    x: 540,
    y: 980,
    n: 14,
    len: 1300,
    a0: 55,
    a1: 125,
    w: [2, 5],
    color: '#f6e0b2',
    a: 0.18,
    seed: 29,
    blur: 14,
  });
  s += veil('#efdcb4', [
    [0, 0.05],
    [900, 0.18],
    [1250, 0.12],
    [1920, 0],
  ]);
  s += vignette(0.42, '#2d2a2c');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 3. the great stones: huge drafted ashlars at golden hour, capers in the joints, light raking across

const capers = (rnd, x, y, size, dir = 1) => {
  let out = '';
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 + dir * (-0.4 + rnd() * 1.6) - dir * 0.3;
    const len = size * (0.5 + rnd() * 0.7);
    const bend = (rnd() - 0.5) * size * 0.6;
    const p0 = [x, y];
    const p1 = [x + Math.cos(a) * len * 0.5 + bend, y + Math.sin(a) * len * 0.5];
    const p2 = [x + Math.cos(a) * len + bend * 0.5, y + Math.sin(a) * len + size * 0.15];
    out += `<path d="M${r1(p0[0])} ${r1(p0[1])}Q${r1(p1[0])} ${r1(p1[1])} ${r1(p2[0])} ${r1(p2[1])}" stroke="#6b6a3f" stroke-width="${r1(size * 0.018)}" fill="none"/>`;
    for (let t = 0.2; t < 1; t += 0.13) {
      const q = [
        (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
        (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
      ];
      const side = rnd() < 0.5 ? -1 : 1;
      leaves.push([
        q[0] + side * size * 0.045,
        q[1] + (rnd() - 0.5) * size * 0.04,
        size * (0.036 + rnd() * 0.026),
      ]);
    }
    if (rnd() < 0.3) leaves.push([p2[0], p2[1], -size * 0.05]);
  }
  for (const [lx, ly, r] of leaves) {
    if (r < 0) {
      // a flower: four white petals, a spray of purple stamens
      const rr = -r;
      out += `<g transform="translate(${r1(lx)} ${r1(ly)})"><ellipse rx="${r1(rr)}" ry="${r1(rr * 0.7)}" fill="#f4ede4" transform="rotate(20)"/><ellipse rx="${r1(rr * 0.7)}" ry="${r1(rr)}" fill="#efe4dc" transform="rotate(20)"/>${Array.from(
        { length: 9 },
        (_, k) => {
          const a = -Math.PI / 2 + (k - 4) * 0.22;
          return `<path d="M0 0L${r1(Math.cos(a) * rr * 1.7)} ${r1(Math.sin(a) * rr * 1.7)}" stroke="#a25c86" stroke-width="1.2"/><circle cx="${r1(Math.cos(a) * rr * 1.75)}" cy="${r1(Math.sin(a) * rr * 1.75)}" r="1.8" fill="#c77aa6"/>`;
        },
      ).join('')}</g>`;
    } else {
      const c = mix(mix('#6f8a5c', '#a9b98e', rnd()), '#566b48', rnd() * 0.4);
      out += `<ellipse cx="${r1(lx)}" cy="${r1(ly)}" rx="${r1(r)}" ry="${r1(r * 0.86)}" fill="${c}"/><ellipse cx="${r1(lx - r * 0.25)}" cy="${r1(ly - r * 0.3)}" rx="${r1(r * 0.5)}" ry="${r1(r * 0.35)}" fill="#dfe3c3" opacity=".35"/><ellipse cx="${r1(lx + r * 0.2)}" cy="${r1(ly + r * 0.35)}" rx="${r1(r * 0.8)}" ry="${r1(r * 0.4)}" fill="#3f4f35" opacity=".25"/>`;
    }
  }
  return out;
};

const wallScene = () => {
  const rnd = prng(303);
  const WW = 1560;
  const HH = 2420;
  const reg = [0, 0, WW, HH];
  const courses = [430, 410, 395, 380, 360, 232, 222];
  const joint = 20;
  const margin = 42;
  let stones = '';
  let yb = HH;
  const cracks = [];
  courses.forEach((ch, ci) => {
    const y0 = yb - ch;
    let x = -rnd() * 700;
    const small = ci >= 5;
    while (x < WW) {
      const l = small ? 260 + rnd() * 320 : 640 + rnd() * 700;
      const [bx, by, bw, bh] = [x + joint / 2, y0 + joint / 2, l - joint, ch - joint];
      const tint = rnd() < 0.25 ? '#c2ad8e' : rnd() < 0.5 ? '#e9cf9c' : '#d7b47e';
      const base = mix(mix('#dcb983', '#cfae7c', rnd()), tint, 0.25 + rnd() * 0.35);
      stones += `<rect x="${r1(bx)}" y="${r1(by)}" width="${r1(bw)}" height="${r1(bh)}" rx="18" fill="${mix(base, '#9a7a52', 0.3)}"/>`;
      const m = small ? 8 : margin;
      stones += `<rect x="${r1(bx + m)}" y="${r1(by + m)}" width="${r1(bw - 2 * m)}" height="${r1(bh - 2 * m)}" rx="14" fill="${base}"/>`;
      if (!small) {
        stones += `<path d="M${r1(bx + m)} ${r1(by + bh - m)}V${r1(by + m + 6)}" stroke="#f9e6bb" stroke-width="8" opacity=".7"/>`;
        stones += `<path d="M${r1(bx + bw - m + 6)} ${r1(by + m + 4)}V${r1(by + bh - m + 6)}H${r1(bx + m + 8)}" stroke="#4f3822" stroke-width="13" fill="none" opacity=".4"/>`;
      }
      stones += `<rect x="${r1(bx)}" y="${r1(by)}" width="${r1(bw)}" height="${r1(bh)}" rx="18" fill="url(#stSh)"/>`;
      cracks.push([x, y0]);
      x += l;
    }
    yb = y0;
  });
  let wall = box(0, 0, WW, HH, 'fill="#4a3624"');
  wall += `<defs><linearGradient id="stSh" x1="0" y1="0" x2="1" y2="0.3">${stopsOf([
    [0, '#fff3d2', 0.3],
    [0.3, '#fff3d2', 0],
    [0.7, '#3a2816', 0.1],
    [1, '#3a2816', 0.34],
  ])}</linearGradient></defs>`;
  wall += under(
    stoneTex({
      freq: 0.011,
      oct: 5,
      relief: 7,
      tex: 0.6,
      az: 192,
      el: 22,
      seed: 3,
      patch: 0.3,
      patchFreq: 0.005,
      patchColor: '#8a6a44',
      region: reg,
    }),
    soft({ box: reg, blur: 1.2, disp: 18, freq: 0.016, oct: 3, seed: 4 }, stones),
  );
  // rain stains running down from the joints
  let stains = '';
  for (let i = 0; i < 26; i++) {
    const [cx0, cy0] = cracks[Math.floor(rnd() * cracks.length)];
    const x = cx0 + 20 + rnd() * 400;
    stains += `<rect x="${r1(x)}" y="${r1(cy0 + 10)}" width="${r1(8 + rnd() * 26)}" height="${r1(90 + rnd() * 260)}" fill="#5d4630" opacity="${r3(0.08 + rnd() * 0.12)}"/>`;
  }
  wall += `<defs><filter id="sb" x="0" y="0" width="${WW}" height="${HH}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="9 22"/></filter></defs><g filter="url(#sb)">${stains}</g>`;
  // capers and a tuft of hyssop growing from the joints
  let life = '';
  const hy = HH - courses[0];
  const hy2 = hy - courses[1];
  life +=
    capers(rnd, 360, hy2 + 4, 250, 1) +
    capers(rnd, 1170, HH - 1822, 280, -1) +
    capers(rnd, 300, HH - 2030, 190, 1);
  const tuft = (x, y, sz) =>
    Array.from({ length: 16 }, (_, k) => {
      const a = -Math.PI / 2 + (k - 8) * 0.13;
      return `<path d="M${x} ${y}q${r1(Math.cos(a) * sz * 0.3)} ${r1(Math.sin(a) * sz * 0.5)} ${r1(Math.cos(a) * sz)} ${r1(Math.sin(a) * sz)}" stroke="${k % 2 ? '#6f7d4e' : '#8f9a62'}" stroke-width="3.5" fill="none"/>`;
    }).join('');
  life += tuft(820, hy + 4, 80) + tuft(1400, hy2 + 4, 60);
  wall += `<defs><filter id="lf" x="0" y="0" width="${WW}" height="${HH}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="1.1"/></filter></defs><g filter="url(#lf)">${life}</g>`;
  // the golden light raking in from the left, the far side of the wall in warm shade
  wall += `<defs>${ugrad(
    'rk',
    [
      [0, '#fff0c8', 0.26],
      [0.4, '#fff0c8', 0],
      [0.68, '#40291a', 0.12],
      [1, '#34231a', 0.4],
    ],
    [0, 300, WW, 1300],
  )}</defs>${box(0, 0, WW, HH, 'fill="url(#rk)"')}`;
  const svg = `<svg width="${WW}" height="${HH}" viewBox="0 0 ${WW} ${HH}" style="position:absolute;left:0;top:0">${wall}</svg>`;
  const tilted = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1500px;perspective-origin:540px 1250px;overflow:hidden"><div style="position:absolute;left:${(W - WW) / 2}px;top:${H - HH + 60}px;width:${WW}px;height:${HH}px;transform-origin:${WW / 2}px ${HH}px;transform:rotateX(12deg)">${svg}</div></div>`;
  let front = glow({ x: 40, y: 140, rx: 900, ry: 900, color: '#f7d895', a: 0.32, blend: 'screen' });
  front += veil('#eed4a0', [
    [320, 0],
    [620, 0.16],
    [1020, 0.16],
    [1320, 0],
  ]);
  front += rays({
    x: -120,
    y: 260,
    n: 10,
    len: 2000,
    a0: 8,
    a1: 40,
    w: [2, 5],
    color: '#f8dfa6',
    a: 0.14,
    seed: 37,
    blur: 18,
  });
  front += vignette(0.42, '#3a2c22');
  return [
    svgLayer(
      skyFill([
        [0, '#e9c48a'],
        [1, '#8e6d48'],
      ]),
    ),
    tilted,
    svgLayer(front),
  ];
};

// ---------------------------------------------------------------------------------------------------
// 4. the prayer shawl: soft folds of white wool, blue stripes, fringes, in warm window light

const tallit = () => {
  const rnd = prng(404);
  let pat = box(-100, -100, W + 200, H + 200, 'fill="#f3eee4"');
  // two bands of stripes, deep blue and sky blue, with a hair of gold
  const band = (y0) => {
    const list = [
      [0, 58, C.deep],
      [72, 10, C.gold],
      [88, 12, C.sky],
      [112, 12, C.deep],
      [136, 12, C.sky],
      [160, 10, C.gold],
      [176, 58, C.deep],
    ];
    return list.map(([o, h, c]) => box(-200, y0 + o, W + 400, h, `fill="${c}"`)).join('');
  };
  pat += band(150) + band(1330);
  pat += `<filter id="weave" x="-100" y="-100" width="${W + 200}" height="${H + 200}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.22" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0.5 -0.12"/></filter>${box(-100, -100, W + 200, H + 200, 'filter="url(#weave)" opacity=".22"')}`;
  // the hem: the cloth ends low in the frame; below it, a warm dark table
  const hem = [];
  for (let i = 0; i <= 40; i++) {
    const x = -60 + (i / 40) * (W + 120);
    hem.push([x, 1680 + (x / W) * 70 + Math.sin(i * 0.9) * 10]);
  }
  let s = skyFill([
    [0, '#6d5a47'],
    [1, '#3d3129'],
  ]);
  s += glow({ x: 300, y: 1800, rx: 700, ry: 300, color: '#9c7e5d', a: 0.5 });
  s += `<defs><clipPath id="hem"><path d="M-60 -60H${W + 60}V${r1(hem[hem.length - 1][1])}${pts(hem.slice().reverse()).replace('M', 'L')}Z"/></clipPath></defs>`;
  // the fringe along the hem, and a knotted tassel at the corner
  let fr = '';
  for (let i = 0; i < 230; i++) {
    const t = i / 230;
    const x0 = -40 + t * (W + 80);
    const y0 = 1680 + (x0 / W) * 70 + Math.sin(t * 40 * 0.9) * 10 - 4;
    const len = 70 + rnd() * 50;
    const sw = (rnd() - 0.5) * 30;
    fr += `<path d="M${r1(x0)} ${r1(y0)}q${r1(sw * 0.3)} ${r1(len * 0.5)} ${r1(sw)} ${r1(len)}" stroke="${mix('#efe7d8', '#bfb3a0', rnd() * 0.6)}" stroke-width="${r1(1.6 + rnd() * 1.4)}" fill="none"/>`;
  }
  const tx = 860;
  const ty = 1735;
  let tas = '';
  for (let k = 0; k < 8; k++) {
    const sw = (k - 3.5) * 9 + (rnd() - 0.5) * 8;
    tas += `<path d="M${tx} ${ty}C${tx + sw * 0.2} ${ty + 90} ${tx + sw} ${ty + 150} ${r1(tx + sw * 1.6)} ${ty + 240}" stroke="#f1eadc" stroke-width="3" fill="none"/>`;
  }
  for (let k = 0; k < 5; k++)
    tas += `<ellipse cx="${tx}" cy="${ty + 22 + k * 18}" rx="9" ry="7" fill="#f4eee2" stroke="#cfc4b1" stroke-width="1.5"/>`;
  s += blurred(0.8, fr + tas);
  s += `<path d="${pts(hem)}" stroke="#2c2621" stroke-width="16" fill="none" opacity=".35" transform="translate(0 8)"/>`;
  s += cloth({
    pattern: pat,
    angle: 74,
    period: [110, 360],
    seed: 11,
    bendFreq: 0.0024,
    bend: 320,
    surface: 24,
    az: 212,
    el: 36,
    lightColor: '#fff0da',
    ambient: 0.3,
    diffuse: 0.92,
    spec: 0.28,
    zig: 40,
    clip: 'hem',
  });
  // window light: a warm pane of light across the cloth, the far side cooler
  s += `<g clip-path="url(#hem)">${soft(
    { box: [-200, -200, W + 400, H + 400], blur: 60, disp: 40, freq: 0.004 },
    `<path d="M-100 200L700 -100L1180 700L200 1500Z"/>`,
    'fill="#ffe2ad" opacity=".22" style="mix-blend-mode:screen"',
  )}${glow({ x: 1020, y: 1500, rx: 800, ry: 700, color: '#6f86a6', a: 0.3, blend: 'multiply' })}</g>`;
  s += veil('#f1e3c6', [
    [350, 0],
    [700, 0.12],
    [1100, 0.1],
    [1300, 0],
  ]);
  s += vignette(0.4, '#3b3440');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 5. night: the Old City walls lit gold from afar, the citadel's tower in silhouette, stars

const night = () => {
  const rnd = prng(505);
  let s = skyFill([
    [0, '#1d2b49'],
    [0.2, '#253759'],
    [0.38, C.deep],
    [0.5, '#3a5075'],
    [0.57, '#4f6486'],
    [0.62, '#6c7690'],
    [0.66, '#7d7a86'],
    [1, '#2a3450'],
  ]);
  s += stars({ n: 190, y0: 0, y1: 950, seed: 5, color: '#f3ecdf' });
  s += glow({ x: 860, y: 260, rx: 200, color: '#dfe4ee', a: 0.2 });
  s += glow({ x: 540, y: 1230, rx: 1200, ry: 420, color: '#d9a866', a: 0.38 });
  s += wisps({
    color: '#8d8896',
    a: 0.3,
    seed: 41,
    items: [
      [300, 900, 420, 14, -2],
      [820, 960, 380, 12, 2],
      [560, 1060, 520, 10, 0],
    ],
  });
  // roofs and domes beyond the wall, in blue silhouette with a few lit windows
  let city = '';
  for (let x = -30; x < W + 40; x += 40 + rnd() * 60) {
    const h = 20 + rnd() * 50;
    city += box(x, 1175 - h, 50 + rnd() * 50, h + 20, 'fill="#3c4766"');
  }
  city += `<path d="M640 1150A70 62 0 0 1 780 1150Z" fill="#46506c"/><rect x="636" y="1146" width="148" height="30" fill="#414b67"/><path d="M706 1088V1070" stroke="#46506c" stroke-width="4"/>`;
  city += `<path d="M880 1160A44 40 0 0 1 968 1160Z" fill="#434d69"/>`;
  for (let i = 0; i < 26; i++)
    city += `<rect x="${r1(20 + rnd() * 1040)}" y="${r1(1130 + rnd() * 40)}" width="5" height="7" fill="#f1c77e" opacity="${r3(0.4 + rnd() * 0.5)}"/>`;
  s += blurred(1.2, city);
  // the wall, floodlit from below: gold at its foot, softer up to the battlements
  const top = (x) => 1188 + (x / W) * 34;
  const wallTop = [];
  for (let x = -40; x < W + 40; x += 28) {
    const yy = top(x);
    const tower = (x + 40) % 280 < 84;
    const lift = tower ? 34 : 0;
    wallTop.push(
      [x, yy - lift],
      [x, yy - lift - 16],
      [x + 16, yy - lift - 16],
      [x + 16, yy - lift],
      [x + 28, yy - lift],
    );
  }
  const wallPath = `M-40 1360${pts(wallTop).replace('M', 'L')}L${W + 40} 1372Z`;
  s += `<defs><linearGradient id="wl" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, '#7c5d40'],
    [0.3, '#a07650'],
    [0.75, '#d6a466'],
    [1, '#e4b674'],
  ])}</linearGradient><clipPath id="wc"><path d="${wallPath}"/></clipPath></defs>`;
  let wl = `<path d="${wallPath}" fill="url(#wl)"/><g clip-path="url(#wc)">`;
  wl += ashlar({
    x0: -40,
    x1: W + 40,
    yTop: 1130,
    yBot: 1390,
    course: 12,
    len: 30,
    seed: 63,
    tone: (x, y, r) => mix(mix('#7c5d40', '#e2b271', smooth(1170, 1370, y)), '#c89a60', r() * 0.3),
    joint: 1.4,
    jointColor: '#6a4e34',
    lit: '#f0c888',
    dark: '#5d4430',
  });
  for (let x = 30; x < W; x += 120 + rnd() * 70)
    wl += glow({ x, y: 1370, rx: 70, ry: 170, color: '#ffe2a6', a: 0.45 });
  for (let x = -40; x < W + 40; x += 280)
    wl += `<defs>${ugrad(
      'tw' + x,
      [
        [0, '#3a2a1f', 0.45],
        [1, '#3a2a1f', 0],
      ],
      [x + 84, 0, x + 120, 0],
    )}</defs>${box(x + 84, 1120, 40, 280, `fill="url(#tw${x})"`)}`;
  wl += `<defs>${ugrad(
    'wtop',
    [
      [0, '#2b2230', 0.5],
      [1, '#2b2230', 0],
    ],
    [0, 1150, 0, 1250],
  )}</defs>${box(-40, 1120, W + 80, 140, 'fill="url(#wtop)"')}`;
  wl += '</g>';
  s += blurred(0.9, wl);
  s += glow({ x: 540, y: 1200, rx: 1000, ry: 120, color: '#f0c27a', a: 0.28, blend: 'screen' });
  // the citadel: a massive square tower, floodlit, and the slender round tower in silhouette
  let cit = `<defs><linearGradient id="ct" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, '#5c4a44'],
    [0.45, '#9a7550'],
    [1, '#e1b170'],
  ])}</linearGradient></defs><path d="M70 1210V1010H86V992H108V1010H128V992H150V1010H170V992H192V1010H212V992H234V1010H250V1210Z" fill="url(#ct)"/><path d="M226 1010V1210H250V1010Z" fill="#3a2a22" opacity=".35"/><rect x="120" y="1060" width="8" height="30" fill="#3b2c24" opacity=".6"/><rect x="186" y="1060" width="8" height="30" fill="#3b2c24" opacity=".6"/>`;
  const mx = 360;
  const shaft = `M${mx - 26} 1215V890H${mx + 26}V1215Z`;
  cit += `<defs><linearGradient id="mn" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, '#1f2940'],
    [0.6, '#27304a'],
    [0.86, '#6e5a44'],
    [1, '#c9985a'],
  ])}</linearGradient></defs>`;
  cit += `<path d="${shaft}" fill="url(#mn)"/><rect x="${mx - 40}" y="872" width="80" height="18" fill="#1d2640"/><path d="M${mx - 36} 872V856H${mx + 36}V872" fill="none" stroke="#1d2640" stroke-width="4"/>`;
  cit += `<rect x="${mx - 18}" y="820" width="36" height="52" fill="#1f2941"/><path d="M${mx - 20} 822A20 26 0 0 1 ${mx + 20} 822Z" fill="#1d2640"/><path d="M${mx} 796V770" stroke="#1d2640" stroke-width="3"/>`;
  cit += `<rect x="${mx - 5}" y="930" width="10" height="26" rx="5" fill="#caa36a" opacity=".55"/><rect x="${mx - 5}" y="1010" width="10" height="26" rx="5" fill="#caa36a" opacity=".45"/>`;
  s += blurred(1, cit);
  s += glow({ x: mx, y: 1180, rx: 90, ry: 140, color: '#f4c880', a: 0.35, blend: 'screen' });
  // the valley below: dark olive trees, a road with a few lamps
  const dark = { lit: '#44536c', mid: '#2e3b52', shade: '#1d2639' };
  let wood = [];
  for (let x = -80; x < W + 100; x += 70 + rnd() * 60)
    wood = wood.concat(crown(rnd, x, 1470 + rnd() * 60, 170 + rnd() * 80, 110 + rnd() * 50, 5));
  wood = wood.concat([[540, 1760, 900, 260]]);
  s += `<path d="M-40 1372L${W + 40} 1384V${H}H-40Z" fill="#1f283c"/>`;
  s += glow({ x: 540, y: 1400, rx: 1000, ry: 120, color: '#b98a58', a: 0.3 });
  s += foliage({
    lobes: wood,
    pal: dark,
    seed: 51,
    grain: 0.05,
    edge: 9,
    clump: 20,
    tex: 0.25,
    relief: 4,
    light: [0.5, 0, 0.5, 1],
  });
  const road = (t) => [-40 + t * 1180, 1500 + Math.sin(t * 5.2 + 0.6) * 46 + t * 50];
  for (const t of [0.04, 0.13, 0.19, 0.31, 0.38, 0.47, 0.6, 0.66, 0.78, 0.87, 0.95]) {
    const [x, y] = road(t);
    s +=
      glow({ x, y, rx: 30, color: '#f6cf8a', a: 0.7 }) +
      `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="#fff0cf"/>`;
  }
  s += `<path d="${pts(Array.from({ length: 40 }, (_, i) => road(i / 39)))}" stroke="#c99a62" stroke-width="3" fill="none" opacity=".25"/>`;
  s += foliage({
    lobes: flame(rnd, 70, 1380, 1950, 120),
    pal: { lit: '#26324a', mid: '#1f293e', shade: '#182033' },
    seed: 55,
    grain: 0.07,
    edge: 7,
    clump: 10,
    tex: 0.2,
  });
  s += foliage({
    lobes: flame(rnd, 1010, 1420, 1950, 110),
    pal: { lit: '#26324a', mid: '#1f293e', shade: '#182033' },
    seed: 57,
    grain: 0.07,
    edge: 7,
    clump: 10,
    tex: 0.2,
  });
  s += mist({ y: 1400, h: 50, x0: -100, x1: 1180, color: '#8a8aa0', a: 0.22, seed: 59, n: 9 });
  s += vignette(0.3, '#141b2c');
  return [svgLayer(s)];
};

const scenes = {
  'scene-gate': { paint: gate, seed: 31, post: { gamma: 1.18, bloom: 0.38 } },
  'scene-alley': { paint: alley, seed: 32, post: { gamma: 1.08, bloom: 0.45 } },
  'scene-wall': { paint: wallScene, seed: 33, post: { gamma: 1.1, bloom: 0.36, quality: 76 } },
  'scene-tallit': { paint: tallit, seed: 34, post: { gamma: 1.15, bloom: 0.4, quality: 74, grain: 2.6 } },
  'scene-night': { paint: night, seed: 35, post: { gamma: 1, bloom: 0.5 } },
};

await paintScenes({ id: 'jerusalem-gold', scenes, background: '#b9a37a' });
