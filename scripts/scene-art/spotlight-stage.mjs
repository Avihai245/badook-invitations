// Scroll-scene pictures of the "spotlight-stage" design (dance or stage — a bat mitzvah or a birthday):
// five full-screen 9:16 pictures of one show night, in the design's palette (stage red, gold, deep
// purple, pink): the backstage mirror ringed with bulbs, the red velvet curtain with its spotlight, stage
// beams through haze, the auditorium seen from the stage, and the finale's confetti in the spotlights.
//
//   node scripts/scene-art/spotlight-stage.mjs [scene …]            the files, and their entries in the list
//   node scripts/scene-art/spotlight-stage.mjs --draft <dir> [scene …]  drafts only
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
  vignette,
  svgLayer,
  ugrad,
  lgrad,
  stopsOf,
  rose,
} from './kit.mjs';
import {
  camera,
  worldPath,
  floorArc,
  bokeh,
  bokehField,
  beam,
  hazeTex,
  blurred,
  vgrad,
  rgrad,
} from './action-shared.mjs';

/** the design's palette */
const C = {
  red: '#9E1B32',
  redDeep: '#4a0a1c',
  redLit: '#d4495a',
  gold: '#E0B84F',
  goldDeep: '#8a6424',
  goldLit: '#f6dc8e',
  purple: '#2A1640',
  purple2: '#44235e',
  pink: '#F0A6CA',
  pinkDeep: '#c56f98',
  warm: '#ffe2b0',
  shade: '#1A0E24',
};

const SPARK = [
  [C.gold, 4],
  [C.goldLit, 3],
  [C.pink, 3],
  ['#ffd6e8', 2],
  ['#fff3dc', 2],
  ['#b07ad8', 1],
];

// ---------------------------------------------------------------------------------------------------
// the pictures

/** backstage: a mirror framed with round bulbs, a soft glow, ballet shoes and flowers on the table, blurred */
const mirror = () => {
  const rnd = prng(4101);
  const [x0, y0, x1, y1] = [150, 210, 930, 1330];
  // the wall
  let s = vgrad([
    [0, '#2c1638'],
    [0.5, '#3d1d45'],
    [1, '#2a1432'],
  ]);
  s += hazeTex({ color: '#6a3a6a', a: 0.25, freq: [0.006, 0.01], seed: 3 });
  s += glow({ x: 540, y: 760, rx: 900, ry: 900, color: '#e8a878', a: 0.35 });
  // the glass: the backstage behind us, out of focus — a warm light, a costume rail, soft bokeh
  let glass = vgrad(
    [
      [0, '#4a2750'],
      [0.45, '#6a3458'],
      [1, '#56304f'],
    ],
    [x0, y0, x1 - x0, y1 - y0],
  );
  glass += glow({ x: 700, y: 520, rx: 420, ry: 380, color: '#f3c29a', a: 0.4 });
  glass += glow({ x: 330, y: 980, rx: 380, ry: 300, color: '#c46f9a', a: 0.35 });
  let rail = '';
  for (let i = 0; i < 9; i++) {
    const x = 220 + i * 70 + rnd() * 30;
    const col = [C.pink, C.red, '#e8d0e0', C.gold, '#b07ad8'][i % 5];
    rail += `<path d="M${r1(x)} 640Q${r1(x - 40 - rnd() * 30)} 900 ${r1(x - 60)} 1200L${r1(x + 70)} 1200Q${r1(x + 50)} 900 ${r1(x + 30)} 640Z" fill="${col}" opacity=".5"/>`;
  }
  glass += blurred(26, rail);
  glass += bokeh(
    bokehField({ n: 26, box: [x0, y0, x1 - x0, 380], r: [20, 50], colors: SPARK, a: [0.15, 0.4], seed: 5 }),
    { rim: 0.2, blur: 2 },
  );
  glass += vgrad(
    [
      [0, '#ffffff', 0.08],
      [0.5, '#ffffff', 0],
    ],
    [x0, y0, x1 - x0, y1 - y0],
  );
  const gc = nid('gc');
  s += `<defs><clipPath id="${gc}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="10"/></clipPath></defs><g clip-path="url(#${gc})">${glass}</g>`;
  // the frame: painted wood, gilt
  const fg = nid('fr');
  s += `<defs>${lgrad(
    fg,
    [
      [0, C.goldLit],
      [0.3, C.gold],
      [0.7, '#b38a3a'],
      [1, C.goldDeep],
    ],
    [0, 0, 1, 1],
  )}</defs>`;
  s += blurred(
    1.2,
    `<path d="M${x0 - 60} ${y0 - 70}H${x1 + 60}V${y1 + 30}H${x0 - 60}Z M${x0} ${y0}V${y1}H${x1}V${y0}Z" fill="url(#${fg})" fill-rule="evenodd"/>` +
      `<rect x="${x0 - 4}" y="${y0 - 4}" width="${x1 - x0 + 8}" height="${y1 - y0 + 8}" fill="none" stroke="#6a4a1a" stroke-width="6" opacity=".6"/>`,
  );
  s += hazeTex({
    box: [x0 - 60, y0 - 70, x1 - x0 + 120, y1 - y0 + 100],
    color: '#5a3a10',
    a: 0.25,
    freq: [0.02, 0.02],
    seed: 7,
    k: 1.5,
    b: -0.5,
  });
  // the bulbs: along the top and down both sides, each glowing, with a faint reflection in the glass
  const bulbs = [];
  for (let i = 0; i < 7; i++) bulbs.push([x0 + 20 + ((x1 - x0 - 40) * i) / 6, y0 - 36]);
  for (let i = 0; i < 8; i++) {
    const y = y0 + 90 + ((y1 - y0 - 150) * i) / 7;
    bulbs.push([x0 - 32, y], [x1 + 32, y]);
  }
  let bl = '';
  for (const [x, y] of bulbs) {
    const calm = y > 640 && y < 1250 ? 0.7 : 1;
    s += glow({ x, y, rx: 150, ry: 150, color: '#ffc98a', a: 0.35 * calm, blend: 'screen' });
    bl += `<circle cx="${r1(x)}" cy="${r1(y)}" r="23" fill="#fff4e0" opacity="${r3(0.95 * calm)}"/>`;
    bl += glow({ x, y, rx: 44, ry: 44, color: '#ffe6c0', a: 0.9 * calm, blend: 'screen' });
  }
  s += blurred(1.6, bl);
  // the table: warm wood lit from the bulbs
  const tg = nid('tb');
  s += `<defs>${ugrad(
    tg,
    [
      [0, '#b0704e'],
      [0.25, '#7a4436'],
      [1, '#3a1c26'],
    ],
    [0, 1380, 0, H],
  )}</defs><path d="M-20 1380H${W + 20}V${H + 20}H-20Z" fill="url(#${tg})"/><rect x="-20" y="1360" width="${W + 40}" height="26" fill="#c98a5a" opacity=".8"/>`;
  s += hazeTex({
    box: [0, 1380, W, H - 1380],
    color: '#2a1018',
    a: 0.35,
    freq: [0.003, 0.03],
    oct: 3,
    seed: 9,
    k: 1.8,
    b: -0.6,
  });
  s += glow({ x: 540, y: 1420, rx: 700, ry: 160, color: '#ffc98a', a: 0.35, blend: 'screen' });
  // on the table, out of focus: a pair of pointe shoes with their ribbons, a bouquet of roses
  let things = '';
  const shoe = (x, y, rot) => {
    const g = nid('sh');
    return `<defs>${lgrad(
      g,
      [
        [0, '#ffe0ea'],
        [0.45, '#f4b3c8'],
        [1, '#c77792'],
      ],
      [0, 0, 0, 1],
    )}</defs><g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-130 0C-130 -40 -40 -50 60 -40C130 -32 170 -16 170 0C170 16 130 32 60 40C-40 50 -130 40 -130 0Z" fill="url(#${g})"/><path d="M-110 0C-110 -26 -40 -32 30 -26C60 -22 70 -10 70 0C70 10 60 22 30 26C-40 32 -110 26 -110 0Z" fill="#b8647f" opacity=".8"/><path d="M-100 -4C-100 -18 -40 -22 20 -18" stroke="#ffe6ee" stroke-width="5" fill="none" opacity=".6"/><path d="M110 -24C150 -14 150 14 110 24" stroke="#fff0f4" stroke-width="6" fill="none" opacity=".5"/></g>`;
  };
  things += shoe(300, 1560, -18) + shoe(330, 1680, 10);
  things += `<path d="M190 1550C120 1520 60 1580 20 1540M200 1600C140 1650 90 1600 30 1660M230 1690C170 1760 110 1720 40 1790M250 1730C300 1800 400 1790 470 1840" stroke="#f6c2d4" stroke-width="12" fill="none" opacity=".9" stroke-linecap="round"/>`;
  // the bouquet: stems, leaves, roses
  things += `<path d="M640 1560L1010 1790M650 1590L1000 1840M660 1540L1040 1740" stroke="#4f6b3a" stroke-width="10" opacity=".9"/>`;
  for (let i = 0; i < 9; i++)
    things += `<ellipse cx="${r1(700 + rnd() * 250)}" cy="${r1(1580 + rnd() * 180)}" rx="${r1(30 + rnd() * 16)}" ry="${r1(14 + rnd() * 6)}" transform="rotate(${r1(20 + rnd() * 30)} 800 1650)" fill="${rnd() < 0.5 ? '#5f7f46' : '#3f5f36'}"/>`;
  const rg = nid('rs');
  things += `<defs><radialGradient id="${rg}">${stopsOf([
    [0, '#7a1028'],
    [0.7, '#b0263e'],
    [1, '#d95a6e'],
  ])}</radialGradient></defs>`;
  const tones = [
    { base: '#b8263e', light: '#e2667a', deep: '#5a0a1a', heart: '#4a0614' },
    { base: '#e98aa6', light: '#fbc6d6', deep: '#9a3a5a', heart: '#7a2a44' },
  ];
  for (const [x, y, r, t] of [
    [620, 1520, 58, 0],
    [560, 1600, 50, 1],
    [690, 1610, 54, 1],
    [610, 1690, 46, 0],
    [520, 1500, 40, 0],
  ])
    things += rose(rnd, x, y, r, tones[t], rnd() * 360, 0.8, rg);
  s += blurred(7, things);
  s += glow({ x: 360, y: 1640, rx: 260, ry: 120, color: '#ffd6e2', a: 0.15, blend: 'screen' });
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.4],
    ],
    [0, 1500, W, 420],
  );
  s += vignette(0.4, C.shade, 0.48);
  return [svgLayer(s)];
};

/** the red velvet curtain with its gold fringe, a spotlight's circle on the stage floor */
const curtain = () => {
  const rnd = prng(4201);
  const floorY = 1470;
  let s = `<rect width="${W}" height="${H}" fill="${C.redDeep}"/>`;
  // the folds: vertical strips shaded dark → lit → dark, a little uneven
  let folds = '';
  for (let x = -40; x < W + 40;) {
    const w = 70 + rnd() * 50;
    const g = nid('fd');
    const lit = mix(C.red, C.redLit, 0.2 + rnd() * 0.5);
    folds += `<defs>${lgrad(
      g,
      [
        [0, '#3a0714'],
        [0.35, C.red],
        [0.55, lit],
        [0.8, '#6a1022'],
        [1, '#3a0714'],
      ],
      [0, 0, 1, 0],
    )}</defs><path d="M${r1(x)} -20C${r1(x + 6)} 600 ${r1(x - 8)} 1100 ${r1(x - 4)} ${floorY}L${r1(x + w + 4)} ${floorY}C${r1(x + w - 6)} 1100 ${r1(x + w + 8)} 600 ${r1(x + w)} -20Z" fill="url(#${g})"/>`;
    x += w;
  }
  s += blurred(2.5, folds);
  // velvet: a fine sheen
  s += hazeTex({
    box: [0, 0, W, floorY],
    color: '#ff8a9a',
    a: 0.1,
    freq: [0.02, 0.004],
    oct: 3,
    seed: 5,
    k: 1.8,
    b: -0.7,
  });
  // light: dark above, the spotlight's glow on the curtain above the floor
  s += vgrad(
    [
      [0, '#1a0510', 0.6],
      [0.35, '#1a0510', 0.25],
      [0.7, '#1a0510', 0],
      [1, '#1a0510', 0],
    ],
    [0, 0, W, floorY],
  );
  s += glow({ x: 540, y: 1250, rx: 560, ry: 640, color: '#ffb08a', a: 0.5, blend: 'screen' });
  s += glow({ x: 540, y: 1380, rx: 300, ry: 200, color: '#ffd2a8', a: 0.35, blend: 'screen' });
  // the hem's gold fringe
  let fringe = '';
  for (let x = 0; x < W; x += 7)
    fringe += `M${x} ${floorY - 34}l${r1((rnd() - 0.5) * 3)} ${r1(30 + rnd() * 8)}`;
  s += blurred(
    0.9,
    `<rect x="-10" y="${floorY - 52}" width="${W + 20}" height="20" fill="${C.gold}"/><path d="${fringe}" stroke="${C.goldLit}" stroke-width="3" opacity=".85"/>`,
  );
  s += vgrad(
    [
      [0, '#3a1a08', 0.5],
      [1, '#3a1a08', 0],
    ],
    [0, floorY - 52, W, 60],
  );
  // the valance: swags with scalloped hems and fringe
  const val = 250;
  let swag = `M-20 -20H${W + 20}V${val}`;
  const n = 4;
  for (let i = n; i > 0; i--) {
    const xa = (W * i) / n;
    const xb = (W * (i - 1)) / n;
    swag += `Q${r1((xa + xb) / 2)} ${val + 130} ${r1(xb)} ${val}`;
  }
  swag += 'Z';
  const vg = nid('vl');
  s += `<defs>${ugrad(
    vg,
    [
      [0, '#3a0714'],
      [0.6, '#7a1428'],
      [1, '#a52a3e'],
    ],
    [0, 0, 0, val + 120],
  )}</defs>`;
  s += blurred(1.5, `<path d="${swag}" fill="url(#${vg})"/>`);
  let sf = '';
  for (let i = 0; i < n; i++) {
    const [xa, xb] = [(W * i) / n, (W * (i + 1)) / n];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const x = xa + (xb - xa) * t;
      const y = val + 130 * 2 * t * (1 - t) * 1 - 4;
      sf += `M${r1(x)} ${r1(y)}l0 ${r1(22 + rnd() * 6)}`;
    }
  }
  s += blurred(1, `<path d="${sf}" stroke="${C.gold}" stroke-width="4" opacity=".9"/>`);
  for (let i = 0; i <= n; i++)
    s += glow({ x: (W * i) / n, y: val + 30, rx: 30, ry: 60, color: C.gold, a: 0.6 });
  // the stage floor: dark boards, glossy, the spotlight's circle
  const flg = nid('fl');
  s += `<defs>${ugrad(
    flg,
    [
      [0, '#3a2230'],
      [1, '#150a14'],
    ],
    [0, floorY, 0, H],
  )}</defs><rect y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#${flg})"/>`;
  let boards = '';
  for (let i = -12; i <= 12; i++) boards += `M${540 + i * 30} ${floorY}L${540 + i * 170} ${H}`;
  s += blurred(1, `<path d="${boards}" stroke="#0a0508" stroke-width="2" opacity=".5"/>`);
  s += rgrad({
    x: 540,
    y: 1665,
    rx: 360,
    ry: 120,
    stops: [
      [0, '#fff0da', 0.85],
      [0.7, '#ffd9b0', 0.6],
      [0.92, '#ffc890', 0.25],
      [1, '#ffc890', 0],
    ],
    blend: 'screen',
  });
  s += glow({ x: 540, y: 1665, rx: 600, ry: 240, color: '#ff9f7a', a: 0.25, blend: 'screen' });
  // the beam from high on the left
  s += beam({ x: -60, y: -80, ang: 64, spread: 12, len: 1950, w0: 40, color: '#ffe2c0', a: 0.18, blur: 24 });
  s += hazeTex({ color: '#ffb0a0', a: 0.1, freq: [0.003, 0.005], seed: 7 });
  s += vignette(0.42, C.shade, 0.52);
  return [svgLayer(s)];
};

/** stage light: beams of pink, purple and gold from the rig cutting through haze, pools on the floor */
const beams = () => {
  let s = vgrad([
    [0, '#150a22'],
    [0.5, '#2A1640'],
    [1, '#3a1a44'],
  ]);
  s += hazeTex({ color: '#a070c0', a: 0.55, freq: [0.0028, 0.0045], seed: 11 });
  s += glow({ x: 540, y: 900, rx: 900, ry: 1000, color: '#6a3a8a', a: 0.45 });
  // the rig: a truss across the top with moving heads
  let truss = `M-20 120H${W + 20}M-20 160H${W + 20}`;
  for (let x = -20; x < W + 20; x += 40) truss += `M${x} 120L${x + 20} 160L${x + 40} 120`;
  s += blurred(1.4, `<path d="${truss}" stroke="#0e0716" stroke-width="7" fill="none"/>`);
  const heads = [
    [90, C.pink, 64],
    [270, '#b07ad8', 80],
    [440, C.gold, 100],
    [640, C.pink, 84],
    [820, '#b07ad8', 104],
    [990, C.gold, 118],
  ];
  const second = [
    [90, C.gold, 100],
    [440, C.pink, 70],
    [640, '#b07ad8', 112],
    [990, C.pink, 96],
  ];
  for (const [x, c, ang] of second)
    s += beam({ x, y: 175, ang, spread: 7, len: 1800, w0: 20, color: c, a: 0.2, blur: 12 });
  for (const [x, c, ang] of heads)
    s += beam({ x, y: 175, ang, spread: 8, len: 1850, w0: 24, color: c, a: 0.42, blur: 12 });
  for (const [x, c] of heads) {
    s += `<rect x="${x - 26}" y="162" width="52" height="34" rx="8" fill="#140a1c"/>`;
    s += glow({ x, y: 190, rx: 70, ry: 50, color: c, a: 0.6, blend: 'screen' });
    s += glow({ x, y: 190, rx: 18, ry: 14, color: '#ffffff', a: 0.95, blend: 'screen' });
  }
  // the stage floor, glossy black, pools of light where the beams land
  const floorY = 1620;
  s += vgrad(
    [
      [0, '#26122e'],
      [1, '#0e0612'],
    ],
    [0, floorY, W, H - floorY],
  );
  for (const [x, c, ang] of heads) {
    const t = (ang * Math.PI) / 180;
    const hx = x + (Math.cos(t) / Math.sin(t)) * (floorY + 80 - 175);
    s += glow({ x: hx, y: floorY + 90, rx: 180, ry: 44, color: c, a: 0.5, blend: 'screen' });
    s += glow({ x: hx, y: floorY + 200, rx: 60, ry: 160, color: c, a: 0.18, blend: 'screen' });
  }
  s += mist({ y: floorY + 10, h: 60, color: '#b48ac8', a: 0.3, seed: 13, n: 8 });
  // a veil of haze over the middle to keep it calm
  s += vgrad(
    [
      [0, '#2a1640', 0],
      [0.35, '#2a1640', 0.3],
      [0.65, '#2a1640', 0.3],
      [1, '#2a1640', 0],
    ],
    [0, 560, W, 900],
  );
  s += vignette(0.42, C.shade, 0.5);
  return [svgLayer(s)];
};

/** the auditorium from the stage: rows of red seats, gilded balconies, a chandelier, soft house light */
const seats = () => {
  const cam = camera({ h: 2.8, tilt: -0.1, f: 760, cy: 900, pz: -2 });
  const O = -7; // the centre of the rows' arcs
  let s = vgrad([
    [0, '#1e0c20'],
    [0.4, '#351530'],
    [1, '#2a1026'],
  ]);
  // the back wall and ceiling glow, the chandelier
  s += glow({ x: 540, y: 300, rx: 700, ry: 420, color: '#c9785a', a: 0.35 });
  const chand = (x, y) => {
    let o = glow({ x, y, rx: 220, ry: 160, color: '#ffd9a0', a: 0.55, blend: 'screen' });
    o += glow({ x, y, rx: 80, ry: 70, color: '#fff3dc', a: 0.9, blend: 'screen' });
    return o;
  };
  s += chand(540, 150);
  // balconies: horseshoe fronts, gilded, with red velvet rails; deep shadow above each
  const horseshoe = (R, y, n = 90) => {
    const span = 0.85;
    const xe = R * Math.sin(span);
    const arc = Array.from({ length: n + 1 }, (_, i) => {
      const a = -span + (2 * span * i) / n;
      return [R * Math.sin(a), O + R * Math.cos(a), y];
    });
    return [[-xe, 1.5, y], ...arc, [xe, 1.5, y]];
  };
  const balcony = (R, y, depth) => {
    const front = horseshoe(R, y);
    const top = horseshoe(R, y + 1.1);
    let o = '';
    // the tier behind the front: dark, with a few warm sconces
    const back = horseshoe(R + depth, y + 3.2);
    o += `<path d="${worldPath(cam, top)}${worldPath(cam, back.slice().reverse()).replace('M', 'L')}Z" fill="#2a0f1e"/>`;
    // the gilded front
    const g = nid('bf');
    o += `<defs>${lgrad(g, [
      [0, C.goldLit],
      [0.4, C.gold],
      [1, C.goldDeep],
    ])}</defs><path d="${worldPath(cam, top)}${worldPath(cam, front.slice().reverse()).replace('M', 'L')}Z" fill="url(#${g})"/>`;
    // the red velvet rail
    const rail = horseshoe(R, y + 1.22);
    o += `<path d="${worldPath(cam, rail)}" fill="none" stroke="${C.red}" stroke-width="7" opacity=".95"/>`;
    // ornaments: small cartouches along the front
    let orn = '';
    for (let i = 3; i < front.length - 3; i += 4) {
      const [x, z] = front[i];
      const [sx, sy] = cam.at(x, z, y + 0.55);
      const k = cam.scale(x, z, y);
      orn += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="${r1(k * 0.18)}" ry="${r1(k * 0.26)}" fill="${C.goldDeep}" opacity=".55"/>`;
    }
    o += orn;
    // sconces
    for (let i = 6; i < front.length - 6; i += 12) {
      const [x, z] = front[i];
      const [sx, sy] = cam.at(x, z, y + 1.9);
      o += glow({ x: sx, y: sy, rx: 40, ry: 34, color: '#ffd9a0', a: 0.8, blend: 'screen' });
    }
    return o;
  };
  let tiers = balcony(24, 11.5, 4) + balcony(22, 7.6, 4) + balcony(20, 3.8, 4);
  s += blurred(2.2, tiers);
  // the stalls: rows of red seats in arcs, rising toward the back
  let rows = '';
  const rise = (z) => Math.max(0, z) * 0.09;
  for (let k = 24; k >= 0; k--) {
    const z = 1.8 + k * 0.95;
    const R = z - O;
    const yb = rise(z);
    const arcTop = floorArc(0, O, R, Math.PI / 2 - 0.62, Math.PI / 2 + 0.62, 70).map(([x, zz]) => [
      x,
      zz,
      yb + 0.95,
    ]);
    const arcBot = floorArc(0, O, R, Math.PI / 2 - 0.62, Math.PI / 2 + 0.62, 70).map(([x, zz]) => [
      x,
      zz,
      yb + 0.35,
    ]);
    const g = nid('rw');
    const [, ty] = cam.at(0, z, yb + 0.95);
    const [, by] = cam.at(0, z, yb + 0.35);
    rows += `<defs>${ugrad(
      g,
      [
        [0, '#d2566a'],
        [0.25, C.red],
        [1, '#4a0a1c'],
      ],
      [0, ty, 0, by],
    )}</defs><path d="${worldPath(cam, arcTop)}${worldPath(cam, arcBot.slice().reverse()).replace('M', 'L')}Z" fill="url(#${g})"/>`;
    // seat divisions
    let div = '';
    for (let a = Math.PI / 2 - 0.6; a < Math.PI / 2 + 0.6; a += 0.55 / R) {
      const [x, zz] = [R * Math.cos(a), O + R * Math.sin(a)];
      div += worldPath(cam, [
        [x, zz, yb + 0.95],
        [x, zz, yb + 0.35],
      ]);
    }
    rows += `<path d="${div}" stroke="#2a0510" stroke-width="${r1(Math.max(1, cam.scale(0, z) * 0.035))}" opacity=".6"/>`;
    // the aisle floor below the row
    rows += `<path d="${worldPath(cam, arcBot)}" stroke="#1a0610" stroke-width="${r1(cam.scale(0, z) * 0.3)}" opacity=".7" fill="none"/>`;
  }
  s += blurred(2.4, rows);
  // soft house light over it all, warmer toward the stage, the near rows out of focus
  s += glow({ x: 540, y: 1300, rx: 900, ry: 600, color: '#ffb08a', a: 0.3, blend: 'screen' });
  s += glow({ x: 540, y: 700, rx: 800, ry: 420, color: '#d88a6a', a: 0.22, blend: 'screen' });
  s += hazeTex({ color: '#d08a8a', a: 0.14, freq: [0.003, 0.005], seed: 21 });
  s += bokeh(
    bokehField({
      n: 26,
      box: [0, 200, W, 900],
      r: [16, 40],
      colors: [
        [C.goldLit, 3],
        ['#ffd9a0', 3],
        [C.pink, 1],
      ],
      a: [0.15, 0.4],
      seed: 23,
    }),
    { rim: 0.2, blur: 2 },
  );
  s += vgrad(
    [
      [0, C.shade, 0],
      [1, C.shade, 0.45],
    ],
    [0, 1500, W, 420],
  );
  s += vignette(0.42, C.shade, 0.5);
  return [svgLayer(s)];
};

/** the finale: gold and pink confetti falling through the spotlights over the stage, sparkles and bokeh */
const finale = () => {
  const rnd = prng(4501);
  let s = vgrad([
    [0, '#1e0e2e'],
    [0.5, '#2e1640'],
    [1, '#4a1f3a'],
  ]);
  s += hazeTex({ color: '#9a5a9a', a: 0.35, freq: [0.003, 0.005], seed: 31 });
  for (const [x, ang, c, a] of [
    [120, 72, C.goldLit, 0.3],
    [420, 88, C.pink, 0.3],
    [700, 96, '#fff0da', 0.28],
    [980, 112, C.gold, 0.3],
  ])
    s += beam({ x, y: -40, ang, spread: 13, len: 2000, w0: 40, color: c, a, blur: 18 });
  // the stage at the foot, glowing
  s += glow({ x: 540, y: 1840, rx: 900, ry: 260, color: '#f0a0a8', a: 0.4, blend: 'screen' });
  s += glow({ x: 540, y: 1880, rx: 500, ry: 120, color: '#ffe2b0', a: 0.45, blend: 'screen' });
  // bokeh behind
  s += bokeh(
    bokehField({
      n: 60,
      box: [0, 0, W, H],
      r: [14, 46],
      colors: SPARK,
      a: [0.12, 0.45],
      seed: 33,
      weight: (x, y) => (y > 620 && y < 1250 ? 0.3 : 1),
    }),
    { rim: 0.25, blur: 2.5 },
  );
  // confetti in three depths: far (small, sharp), mid, near (big, very soft); sparse in the middle band
  const piece = (x, y, w, h, rot, col) => {
    const g = nid('cf');
    return `<defs>${lgrad(
      g,
      [
        [0, mix(col, '#ffffff', 0.45)],
        [0.5, col],
        [1, mix(col, '#2a1030', 0.35)],
      ],
      [0, 0, 1, 1],
    )}</defs><rect x="${r1(x - w / 2)}" y="${r1(y - h / 2)}" width="${r1(w)}" height="${r1(h)}" rx="1.5" fill="url(#${g})" transform="rotate(${r1(rot)} ${r1(x)} ${r1(y)})"/>`;
  };
  const cols = [C.gold, C.goldLit, C.pink, '#e0679a', '#fff3dc', C.gold, C.pink];
  const layer = (n, size, blur, alpha) => {
    let o = '';
    for (let i = 0; i < n; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const mid = y > 600 && y < 1260;
      if (mid && rnd() < 0.75) continue;
      const w = size * (0.8 + rnd() * 0.6);
      o += piece(x, y, w, w * (0.35 + rnd() * 0.3), rnd() * 180, cols[Math.floor(rnd() * cols.length)]);
    }
    return blurred(blur, o, `opacity="${alpha}"`);
  };
  s += layer(260, 12, 0.6, 0.75);
  s += layer(120, 22, 1.8, 0.85);
  s += layer(26, 48, 7, 0.8);
  // sparkles: four-point glints
  let sp = '';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = rnd() < 0.6 ? rnd() * 600 : 1260 + rnd() * 600;
    const L = 10 + rnd() * 24;
    sp += `<path d="M${r1(x - L)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y - L)}Q${r1(x)} ${r1(y)} ${r1(x + L)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y + L)}Q${r1(x)} ${r1(y)} ${r1(x - L)} ${r1(y)}Z" fill="#fff6e0" opacity="${r3(0.5 + rnd() * 0.4)}"/>`;
    sp += glow({ x, y, rx: L * 1.6, ry: L * 1.6, color: C.goldLit, a: 0.45, blend: 'screen' });
  }
  s += blurred(0.6, sp);
  s += vignette(0.4, C.shade, 0.5);
  return [svgLayer(s)];
};

const scenes = {
  'scene-mirror': { paint: mirror, seed: 401, post: { gamma: 1.0, bloom: 0.45 } },
  'scene-curtain': { paint: curtain, seed: 402, post: { gamma: 0.92, bloom: 0.45 } },
  'scene-beams': { paint: beams, seed: 403, post: { gamma: 0.88, bloom: 0.45 } },
  'scene-seats': { paint: seats, seed: 404, post: { gamma: 0.86, bloom: 0.42 } },
  'scene-finale': { paint: finale, seed: 405, post: { gamma: 0.95, bloom: 0.45 } },
};

await paintScenes({ id: 'spotlight-stage', scenes, background: '#4a1f3a' });
