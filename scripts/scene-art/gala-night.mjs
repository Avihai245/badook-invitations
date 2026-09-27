// gala-night (a gala evening: a milestone birthday, a corporate event, a formal wedding): five backdrop
// pictures of one evening — tall doors with gold mouldings opening onto a red carpet, a crystal chandelier
// seen from below, a champagne tower of coupes, the ballroom laid with round tables, and a terrace above the
// city with fireworks. Near-black (never black), gold, champagne, burgundy and ivory; no people. Painted with
// the kit (./kit.mjs) and the group's helpers.
//
//   node scripts/scene-art/gala-night.mjs [--draft <dir>] [scene …]
import {
  paintScenes,
  W,
  H,
  prng,
  r1,
  r3,
  nid,
  stopsOf,
  ugrad,
  skyFill,
  glow,
  mist,
  rays,
  vignette,
  svgLayer,
  pts,
} from './kit.mjs';
import {
  poly,
  box,
  under,
  blurred,
  veil,
  camera,
  roundArch,
  opening,
  bokeh,
  glints,
  flameLight,
} from './architecture-shared.mjs';

const C = {
  ink: '#1a1512',
  gold: '#C9A65A',
  champagne: '#E8D5A8',
  burgundy: '#4A1420',
  ivory: '#F4EEE2',
  shade: '#0A0806',
  wood: '#2a1a14',
};

/** a gilded moulding: a rectangle frame drawn as a lit edge over a dark one */
const moulding = (x, y, w, h, s = 1, rx = 0) =>
  `<rect x="${r1(x + 1.5 * s)}" y="${r1(y + 2 * s)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="none" stroke="#5a4020" stroke-width="${r1(5 * s)}" opacity=".7"/><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="none" stroke="${C.gold}" stroke-width="${r1(4 * s)}"/><rect x="${r1(x - 1 * s)}" y="${r1(y - 1 * s)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="none" stroke="#f1dca0" stroke-width="${r1(1.4 * s)}" opacity=".7"/>`;

/** a wall sconce: a gilt back plate, two candle lights, their glow */
const sconce = (x, y, s) =>
  `${glow({ x, y: y - s * 1.5, rx: s * 9, color: '#f2c77e', a: 0.4, blend: 'screen' })}<path d="M${r1(x)} ${r1(y + s * 1.6)}V${r1(y - s * 0.4)}M${r1(x - s * 1.4)} ${r1(y - s * 0.6)}Q${r1(x)} ${r1(y + s * 0.8)} ${r1(x + s * 1.4)} ${r1(y - s * 0.6)}" stroke="${C.gold}" stroke-width="${r1(s * 0.28)}" fill="none"/><rect x="${r1(x - s * 1.55)}" y="${r1(y - s * 1.6)}" width="${r1(s * 0.3)}" height="${r1(s)}" fill="${C.ivory}"/><rect x="${r1(x + s * 1.25)}" y="${r1(y - s * 1.6)}" width="${r1(s * 0.3)}" height="${r1(s)}" fill="${C.ivory}"/>${flameLight(x - s * 1.4, y - s * 1.65, s * 0.7, { glowR: 4 })}${flameLight(x + s * 1.4, y - s * 1.65, s * 0.7, { glowR: 4 })}`;

// ---------------------------------------------------------------------------------------------------
// 1. the doors: tall panelled doors in gilt mouldings, ajar, light pouring out onto a red carpet

const doors = () => {
  const _rnd = prng(121);
  const f = 1000;
  const Z = 4.1;
  const cam = camera({ f, vx: 540, vy: 1010, eye: 1.6 });
  const { p } = cam;
  const DH = 4.4;
  const HW = 1.2;
  let s = skyFill([
    [0, '#1c1311'],
    [0.5, '#2a1a16'],
    [1, '#160f0d'],
  ]);
  // the wall: dark burgundy damask panels between gilded pilasters
  s += under(
    {
      id: 'wd',
      defs: `<defs><filter id="wd" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="4" result="n"/><feColorMatrix in="n" values="0 0 0 0 0.35  0 0 0 0 0.1  0 0 0 0 0.12  0 0 0 1.4 -0.55" result="c"/><feComposite in="c" in2="SourceGraphic" operator="atop"/></filter></defs>`,
    },
    box(0, 0, W, p([0, 0, Z])[1], `fill="${C.burgundy}"`),
  );
  s += glow({ x: 540, y: 700, rx: 800, ry: 900, color: '#8a3a2a', a: 0.35 });
  for (const x of [60, 1020]) {
    s += box(x - 50, 120, 100, 1300, 'fill="#3a2418"');
    s += moulding(x - 36, 150, 72, 1230, 1);
    s += box(x - 62, 100, 124, 40, `fill="${C.gold}" opacity=".85"`);
  }
  // the door case: an entablature with a gilt cartouche (no lettering), the architrave
  const [lx, ty] = p([-HW - 0.25, DH + 0.35, Z]);
  const [rx] = p([HW + 0.25, 0, Z]);
  const [, by] = p([0, 0, Z]);
  s += box(lx - 30, ty - 110, rx - lx + 60, 110, 'fill="#3a2418"');
  s += box(lx - 40, ty - 124, rx - lx + 80, 18, `fill="${C.gold}"`);
  s += `<path d="M${540 - 90} ${ty - 30}Q540 ${ty - 110} ${540 + 90} ${ty - 30}Q540 ${ty - 60} ${540 - 90} ${ty - 30}Z" fill="${C.gold}"/><circle cx="540" cy="${ty - 62}" r="14" fill="#f1dca0"/>`;
  s += box(lx, ty, rx - lx, by - ty, `fill="${C.gold}"`);
  s += box(lx + 14, ty + 14, rx - lx - 28, by - ty - 14, 'fill="#5a3c1c"');
  // the room beyond the gap: bright, warm
  const [dl, dt] = p([-HW, DH, Z]);
  const [dr] = p([HW, 0, Z]);
  s += box(dl, dt, dr - dl, by - dt, 'fill="#fbe2ae"');
  s += glow({ x: 540, y: 850, rx: 140, ry: 520, color: '#fff3d6', a: 0.9 });
  // the two leaves, each swung in by 28 degrees
  const th = (28 * Math.PI) / 180;
  const leaf = (side) => {
    const hx = side * HW;
    const ex = hx - side * HW * Math.cos(th);
    const ez = Z + HW * Math.sin(th);
    const q = [
      [hx, 0, Z],
      [hx, DH, Z],
      [ex, DH, ez],
      [ex, 0, ez],
    ].map(p);
    const g = nid('lf');
    let out = `<defs>${ugrad(
      g,
      [
        [0, '#2b1b16'],
        [0.7, '#3c241c'],
        [1, '#4a2c20'],
      ],
      [q[0][0], 0, q[2][0], 0],
    )}</defs>${poly(q, `fill="url(#${g})"`)}`;
    // panels in bilinear coordinates on the leaf
    const at = (u, v) => {
      const [x0, y0] = [q[0][0] + (q[3][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * u];
      const [x1, y1] = [q[1][0] + (q[2][0] - q[1][0]) * u, q[1][1] + (q[2][1] - q[1][1]) * u];
      return [x0 + (x1 - x0) * v, y0 + (y1 - y0) * v];
    };
    const panel = (u0, u1, v0, v1) => {
      const pp = [at(u0, v0), at(u0, v1), at(u1, v1), at(u1, v0)];
      return `<path d="${pts(pp)}Z" fill="none" stroke="#5a4020" stroke-width="7" opacity=".7" transform="translate(1.5 2)"/><path d="${pts(pp)}Z" fill="none" stroke="${C.gold}" stroke-width="5"/><path d="${pts(pp)}Z" fill="none" stroke="#f3dfa6" stroke-width="1.6" opacity=".6" transform="translate(-1 -1)"/>`;
    };
    out += panel(0.14, 0.86, 0.06, 0.42) + panel(0.14, 0.86, 0.48, 0.62) + panel(0.14, 0.86, 0.68, 0.94);
    const [hx0, hy0] = at(0.9, 0.46);
    out += `<rect x="${r1(hx0 - 5)}" y="${r1(hy0 - 40)}" width="10" height="80" rx="5" fill="#e6c77e"/>`;
    return out;
  };
  s += leaf(-1) + leaf(1);
  // the carpet: a burgundy runner with gilt edges, light spilling along it from the gap
  const cg = nid('cp');
  s += `<defs>${ugrad(
    cg,
    [
      [0, '#6e1a26'],
      [1, '#3a0d16'],
    ],
    [0, by, 0, H],
  )}</defs>`;
  s += cam.poly(
    [
      [-3, 0, 1.5],
      [3, 0, 1.5],
      [3, 0, Z],
      [-3, 0, Z],
    ],
    'fill="#1f1714"',
  );
  s += blurred(
    3,
    `${[-2.4, -1.2, 1.2, 2.4].map((X) => `<path d="${pts([p([X, 0, 1.6]), p([X, 0, Z])])}" stroke="#4a3a30" stroke-width="3" opacity=".6"/>`).join('')}${glow({ x: 60, y: 1500, rx: 60, ry: 300, color: '#e0b070', a: 0.25 })}${glow({ x: 1020, y: 1500, rx: 60, ry: 300, color: '#e0b070', a: 0.25 })}`,
  );
  s += cam.poly(
    [
      [-1.05, 0, 1.5],
      [1.05, 0, 1.5],
      [1.05, 0, Z],
      [-1.05, 0, Z],
    ],
    `fill="url(#${cg})"`,
  );
  for (const X of [-1, 1])
    s += `<path d="${pts([p([X, 0.002, 1.5]), p([X, 0.002, Z])])}" stroke="${C.gold}" stroke-width="7"/>`;
  s += blurred(
    18,
    `<path d="M500 ${by}L580 ${by}L760 ${H}L320 ${H}Z" fill="#f6d9a2" opacity=".55"/>`,
    'style="mix-blend-mode:screen"',
  );
  s += rays({
    x: 540,
    y: 900,
    n: 16,
    len: 1200,
    a0: 62,
    a1: 118,
    w: [1.5, 4],
    color: '#f8e0b0',
    a: 0.22,
    seed: 23,
    blur: 12,
  });
  s += glow({ x: 540, y: by, rx: 300, ry: 90, color: '#fbe0a8', a: 0.5, blend: 'screen' });
  // sconces either side of the door
  s += sconce(170, 760, 26) + sconce(910, 760, 26);
  s += bokeh({
    n: 14,
    area: [0, 100, W, 700],
    r: [10, 30],
    colors: ['#f2c77e', '#e8d5a8'],
    a: [0.15, 0.4],
    seed: 3,
    blur: 2,
  });
  s += veil('#2a1a16', [
    [300, 0],
    [700, 0.12],
    [1100, 0.1],
    [1300, 0],
  ]);
  s += vignette(0.5, '#140c0a');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 2. the chandelier, seen from below: rings of lights and crystal, the gilded ceiling, sparkle

const chandelier = () => {
  const rnd = prng(232);
  let s = skyFill([
    [0, '#2a1d15'],
    [0.4, '#3a281c'],
    [0.75, '#2a1c16'],
    [1, '#1a1210'],
  ]);
  // the ceiling: a gilded rosette and radiating coffers, soft
  const cx = 540;
  const cy = 470;
  let ceil = '';
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ceil += `<path d="M${r1(cx + Math.cos(a) * 200)} ${r1(cy + Math.sin(a) * 120)}L${r1(cx + Math.cos(a) * 1400)} ${r1(cy + Math.sin(a) * 900)}" stroke="${C.gold}" stroke-width="6" opacity=".35"/>`;
  }
  for (const r of [260, 420, 640, 900])
    ceil += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.62}" fill="none" stroke="${C.gold}" stroke-width="${r1(r / 70)}" opacity=".3"/>`;
  s += blurred(5, ceil);
  s += glow({ x: cx, y: cy, rx: 900, ry: 700, color: '#c9924e', a: 0.45 });
  s += glow({ x: cx, y: cy, rx: 420, ry: 320, color: '#f2c77e', a: 0.45 });
  // tiers from the top (far, small) to the bottom ring (near, wide)
  const tiers = [
    { r: 150, y: 360, n: 8 },
    { r: 260, y: 430, n: 12 },
    { r: 380, y: 520, n: 16 },
  ];
  let crystal = '';
  let lightsS = '';
  const lamp = [];
  for (const [ti, t] of tiers.entries()) {
    const ry = t.r * 0.45;
    // the ring of gilt metal
    crystal += `<ellipse cx="${cx}" cy="${t.y}" rx="${t.r}" ry="${r1(ry)}" fill="none" stroke="#b58a3e" stroke-width="${6 + ti * 2}" opacity=".8"/>`;
    // swags of crystal beads between the arms
    for (let k = 0; k < t.n; k++) {
      const a0 = (k / t.n) * Math.PI * 2;
      const a1 = ((k + 1) / t.n) * Math.PI * 2;
      for (let j = 1; j < 9; j++) {
        const u = j / 9;
        const a = a0 + (a1 - a0) * u;
        const sag = Math.sin(Math.PI * u) * (22 + ti * 10);
        const x = cx + Math.cos(a) * t.r * 1.02;
        const y = t.y + Math.sin(a) * ry * 1.02 + sag;
        crystal += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(2.2 + ti * 0.6)}" fill="#fff4dc" opacity="${r3(0.55 + rnd() * 0.4)}"/>`;
      }
      // the arm's candle light and a pendant drop
      const x = cx + Math.cos(a0) * t.r;
      const y = t.y + Math.sin(a0) * ry;
      lamp.push([x, y - 14, 10 + ti * 3]);
      crystal += `<path d="M${r1(x)} ${r1(y)}v${r1(40 + ti * 16)}" stroke="#f7ead0" stroke-width="2" opacity=".6"/><path d="M${r1(x - 6)} ${r1(y + 40 + ti * 16)}l6 ${r1(20 + ti * 4)}l6 ${r1(-20 - ti * 4)}z" fill="#fff6e4" opacity=".8"/>`;
    }
    // the arms, radiating to the column
    for (let k = 0; k < t.n; k += 2) {
      const a = (k / t.n) * Math.PI * 2;
      crystal += `<path d="M${cx} ${t.y - 30}Q${r1(cx + Math.cos(a) * t.r * 0.6)} ${r1(t.y + Math.sin(a) * ry * 0.6 + 30)} ${r1(cx + Math.cos(a) * t.r)} ${r1(t.y + Math.sin(a) * ry)}" stroke="#c9a65a" stroke-width="4" fill="none" opacity=".75"/>`;
    }
  }
  // the column and its crown of drops
  crystal += `<path d="M${cx - 26} 250H${cx + 26}L${cx + 14} 610H${cx - 14}Z" fill="#c9a65a" opacity=".85"/>`;
  for (let k = 0; k < 14; k++)
    crystal += `<path d="M${cx - 50 + k * 7.5} 600l3.5 ${r1(40 + (k % 3) * 18)}l3.5 ${r1(-40 - (k % 3) * 18)}z" fill="#fff4dc" opacity=".75"/>`;
  s += blurred(1.1, crystal);
  for (const [x, y, sz] of lamp) {
    lightsS += glow({ x, y, rx: sz * 5, color: '#f7cf86', a: 0.5, blend: 'screen' });
    lightsS += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(sz * 0.35)}" ry="${r1(sz * 0.6)}" fill="#fff4d8"/>`;
  }
  s += lightsS;
  s += glints({
    items: Array.from({ length: 40 }, () => {
      const a = rnd() * Math.PI * 2;
      const d = rnd() ** 0.7;
      return [
        cx + Math.cos(a) * 400 * d,
        470 + Math.sin(a) * 200 * d + 40,
        10 + rnd() * 26,
        0.4 + rnd() * 0.6,
        rnd() * 45,
      ];
    }),
  });
  // far below the chandelier: the ballroom's upper walls, arched windows in soft focus
  let walls = '';
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * 240;
    walls += `<path d="M${x} 1900V1420A90 90 0 0 1 ${x + 180} 1420V1900Z" fill="#3a2620"/><path d="M${x} 1900V1420A90 90 0 0 1 ${x + 180} 1420V1900" fill="none" stroke="${C.gold}" stroke-width="10" opacity=".5"/>`;
  }
  walls += `<rect x="-20" y="1250" width="${W + 40}" height="40" fill="${C.gold}" opacity=".45"/>`;
  s += blurred(9, walls);
  s += bokeh({
    n: 40,
    area: [-40, 700, W + 40, 1500],
    r: [20, 70],
    colors: ['#f2c77e', '#e8d5a8', '#fff1d0'],
    a: [0.12, 0.4],
    seed: 13,
    blur: 3,
  });
  s += bokeh({
    n: 60,
    area: [-40, 0, W + 40, 1900],
    r: [5, 14],
    colors: ['#fff1d0', '#f2c77e'],
    a: [0.2, 0.6],
    seed: 15,
    blur: 1.2,
  });
  s += veil('#1a1210', [
    [0, 0.2],
    [400, 0],
    [1200, 0.1],
    [1920, 0.3],
  ]);
  s += vignette(0.45, '#120c0a');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 3. the champagne tower: coupes stacked five high, champagne spilling down, glitter

const coupe = (x, rimY, w, { fill = 0.8, soft: _sf = 1 } = {}) => {
  const rw = w / 2;
  const bowlH = w * 0.28;
  const stemH = w * 0.5;
  const g = nid('cg');
  const lq = nid('lq');
  let out = `<defs>${ugrad(
    g,
    [
      [0, '#f7ecd4', 0.55],
      [0.25, '#f7ecd4', 0.12],
      [0.75, '#f7ecd4', 0.1],
      [1, '#f7ecd4', 0.5],
    ],
    [x - rw, 0, x + rw, 0],
  )}${ugrad(
    lq,
    [
      [0, '#f4d690'],
      [0.6, '#e2b45e'],
      [1, '#b98738'],
    ],
    [0, rimY, 0, rimY + bowlH],
  )}</defs>`;
  const bowl = `M${r1(x - rw)} ${r1(rimY)}C${r1(x - rw)} ${r1(rimY + bowlH * 0.9)} ${r1(x - rw * 0.3)} ${r1(rimY + bowlH)} ${r1(x)} ${r1(rimY + bowlH)}C${r1(x + rw * 0.3)} ${r1(rimY + bowlH)} ${r1(x + rw)} ${r1(rimY + bowlH * 0.9)} ${r1(x + rw)} ${r1(rimY)}Z`;
  const ly = rimY + bowlH * (1 - fill);
  const lw = rw * (0.35 + 0.63 * fill);
  out += `<path d="M${r1(x - lw)} ${r1(ly)}C${r1(x - lw)} ${r1(rimY + bowlH * 0.9)} ${r1(x - rw * 0.3)} ${r1(rimY + bowlH * 0.98)} ${r1(x)} ${r1(rimY + bowlH * 0.98)}C${r1(x + rw * 0.3)} ${r1(rimY + bowlH * 0.98)} ${r1(x + lw)} ${r1(rimY + bowlH * 0.9)} ${r1(x + lw)} ${r1(ly)}Z" fill="url(#${lq})"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(ly)}" rx="${r1(lw)}" ry="${r1(w * 0.05)}" fill="#f9e3a8"/>`;
  out += `<path d="${bowl}" fill="url(#${g})"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(rimY)}" rx="${r1(rw)}" ry="${r1(w * 0.07)}" fill="none" stroke="#fbf0da" stroke-width="${r1(Math.max(1.5, w * 0.014))}" opacity=".8"/>`;
  out += `<path d="M${r1(x - rw * 0.8)} ${r1(rimY + bowlH * 0.25)}Q${r1(x - rw * 0.55)} ${r1(rimY + bowlH * 0.85)} ${r1(x - rw * 0.1)} ${r1(rimY + bowlH * 0.9)}" stroke="#fffaf0" stroke-width="${r1(w * 0.02)}" fill="none" opacity=".7"/>`;
  out += `<path d="M${r1(x)} ${r1(rimY + bowlH)}V${r1(rimY + bowlH + stemH)}" stroke="#efe2c6" stroke-width="${r1(w * 0.04)}" opacity=".7"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(rimY + bowlH + stemH)}" rx="${r1(rw * 0.5)}" ry="${r1(w * 0.05)}" fill="#efe2c6" opacity=".45"/>`;
  return { svg: out, height: bowlH + stemH };
};

const champagne = () => {
  const rnd = prng(343);
  let s = skyFill([
    [0, '#231612'],
    [0.5, '#3a2418'],
    [1, '#1e1411'],
  ]);
  s += glow({ x: 540, y: 900, rx: 900, ry: 900, color: '#7a4a2a', a: 0.5 });
  s += bokeh({
    n: 36,
    area: [-60, 40, W + 60, 1250],
    r: [30, 100],
    colors: ['#f2c77e', '#e8d5a8', '#c9a65a', '#b0506a'],
    a: [0.15, 0.45],
    seed: 21,
    blur: 3,
  });
  s += bokeh({
    n: 70,
    area: [-60, 0, W + 60, 1300],
    r: [6, 20],
    colors: ['#fff1d0', '#f2c77e'],
    a: [0.2, 0.55],
    seed: 23,
    blur: 1.4,
  });
  // the table: an ivory cloth
  s += `<path d="M-60 1760Q540 1740 1140 1760V${H}H-60Z" fill="#d9c9ad"/>`;
  s += `<defs>${ugrad(
    'tbl',
    [
      [0, '#fff4dc', 0.4],
      [1, '#3a2a20', 0.6],
    ],
    [0, 1750, 0, H],
  )}</defs><path d="M-60 1760Q540 1740 1140 1760V${H}H-60Z" fill="url(#tbl)"/>`;
  // the tower
  const w = 172;
  const rows = 5;
  let tw = '';
  let rimTop = 0;
  const { height } = coupe(0, 0, w);
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    const rimY = 1760 - height - r * (height - 4);
    for (let i = 0; i < n; i++) {
      const x = 540 + (i - (n - 1) / 2) * w;
      tw += coupe(x, rimY, w, { fill: 0.78 + rnd() * 0.15 }).svg;
    }
    rimTop = rimY;
  }
  // champagne spilling from the top glass down the tower
  let spill = '';
  for (let k = 0; k < 10; k++) {
    const x0 = 540 + (rnd() - 0.5) * 400;
    const y0 = rimTop + rnd() * 400;
    spill += `<path d="M${r1(x0)} ${r1(y0)}q${r1((rnd() - 0.5) * 20)} ${r1(60 + rnd() * 60)} ${r1((rnd() - 0.5) * 30)} ${r1(120 + rnd() * 120)}" stroke="#f6d88f" stroke-width="${r1(2 + rnd() * 2)}" fill="none" opacity=".5"/>`;
  }
  s += blurred(0.8, tw + spill);
  s += glow({ x: 540, y: 1450, rx: 520, ry: 420, color: '#f2c77e', a: 0.25, blend: 'screen' });
  // glitter on the rims and the liquid
  const items = [];
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    const rimY = 1760 - height - r * (height - 4);
    for (let i = 0; i < n; i++) {
      const x = 540 + (i - (n - 1) / 2) * w;
      if (rnd() < 0.7)
        items.push([
          x - w * 0.3 + rnd() * w * 0.6,
          rimY + (rnd() - 0.5) * 12,
          14 + rnd() * 30,
          0.5 + rnd() * 0.5,
          rnd() * 40,
        ]);
    }
  }
  s += glints({ items });
  s += veil('#1e1411', [
    [100, 0.15],
    [600, 0],
    [1920, 0.05],
  ]);
  s += vignette(0.46, '#140c0a');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 4. the ballroom: round tables in ivory, candles, gold chairs, chandeliers under a high ceiling

const ballroom = () => {
  const rnd = prng(454);
  const f = 820;
  const cam = camera({ f, vx: 540, vy: 900, eye: 2.6 });
  const { p } = cam;
  let s = skyFill([
    [0, '#1e1512'],
    [0.5, '#3a261c'],
    [0.56, '#4a3020'],
    [1, '#241814'],
  ]);
  // the room: the far wall with a great lit arch, side walls with tall windows and drapes
  const HW = 9;
  const Zf = 34;
  const ceil = 9;
  s += cam.poly(
    [
      [-HW, 0, Zf],
      [HW, 0, Zf],
      [HW, ceil, Zf],
      [-HW, ceil, Zf],
    ],
    'fill="#4a3022"',
  );
  const [ax, ay] = p([0, 0, Zf]);
  const arcR = (3 * f) / Zf;
  s += `<path d="${pts(opening(roundArch(ax, ay - (4 * f) / Zf, arcR), ay))}Z" fill="#f3cf92"/>`;
  s += glow({ x: ax, y: ay - (3 * f) / Zf, rx: 260, ry: 260, color: '#f6d7a0', a: 0.6 });
  for (const side of [-1, 1]) {
    const X = side * HW;
    s += cam.poly(
      [
        [X, 0, 3],
        [X, ceil, 3],
        [X, ceil, Zf],
        [X, 0, Zf],
      ],
      `fill="${side < 0 ? '#3a2419' : '#40281c'}"`,
    );
    for (let z = 5; z < Zf - 2; z += 4.5) {
      // a tall window of night blue, drapes of burgundy either side, a gilt frame
      const win = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (Math.PI * i) / 12;
        win.push([X, 5.2 - Math.sin(a) * 0.9, z + 0.9 + Math.cos(a) * 0.9]);
      }
      s += cam.poly([[X, 1, z], ...win, [X, 1, z + 1.8]], 'fill="#23263a"');
      s += cam.poly(
        [
          [X, 0.2, z - 0.5],
          [X, 6.4, z - 0.5],
          [X, 6.4, z + 0.1],
          [X, 0.2, z],
        ],
        `fill="${C.burgundy}"`,
      );
      s += cam.poly(
        [
          [X, 0.2, z + 1.8],
          [X, 6.4, z + 1.7],
          [X, 6.4, z + 2.3],
          [X, 0.2, z + 2.3],
        ],
        `fill="${C.burgundy}"`,
      );
      s += `<path d="${pts([p([X, 6.5, z - 0.6]), p([X, 6.5, z + 2.4])])}" stroke="${C.gold}" stroke-width="${r1(Math.max(1.5, 60 / z))}" opacity=".7"/>`;
    }
  }
  // the ceiling: coffers in gilt lines
  s += cam.poly(
    [
      [-HW, ceil, 3],
      [HW, ceil, 3],
      [HW, ceil, Zf],
      [-HW, ceil, Zf],
    ],
    'fill="#2e1e16"',
  );
  let cof = '';
  for (let X = -HW; X <= HW; X += 3)
    cof += `<path d="${pts([p([X, ceil, 3]), p([X, ceil, Zf])])}" stroke="${C.gold}" stroke-width="3" opacity=".45"/>`;
  for (let z = 3; z <= Zf; z += 3)
    cof += `<path d="${pts([p([-HW, ceil, z]), p([HW, ceil, z])])}" stroke="${C.gold}" stroke-width="${r1(Math.max(1, 30 / z))}" opacity=".45"/>`;
  s += blurred(1.6, cof, 'opacity=".6"');
  // the floor: dark polished wood reflecting the lights
  s += cam.poly(
    [
      [-HW, 0, 2],
      [HW, 0, 2],
      [HW, 0, Zf],
      [-HW, 0, Zf],
    ],
    'fill="#3a241a"',
  );
  s += glow({ x: ax, y: ay + 60, rx: 500, ry: 160, color: '#e8b877', a: 0.35 });
  s += glow({ x: 540, y: 1500, rx: 900, ry: 500, color: '#8a5a34', a: 0.35 });
  let parq = '';
  for (let X = -2.4; X <= 2.4; X += 0.4)
    parq += `<path d="${pts([p([X, 0, 1.4]), p([X, 0, Zf])])}" stroke="#6a4630" stroke-width="2" opacity=".35"/>`;
  for (let z = 1.6; z < 14; z *= 1.12)
    parq += `<path d="${pts([p([-2.6, 0, z]), p([2.6, 0, z])])}" stroke="#6a4630" stroke-width="${r1(Math.max(1, 12 / z))}" opacity=".3"/>`;
  s += blurred(1.2, parq);
  s += blurred(
    10,
    `<path d="M${ax - 40} ${ay + 10}L${ax + 40} ${ay + 10}L${ax + 160} ${H}L${ax - 160} ${H}Z" fill="#f3cf92" opacity=".3"/>`,
    'style="mix-blend-mode:screen"',
  );
  // chandeliers: clusters of light hanging over the rows
  const chand = [];
  for (const z of [8, 14, 22, 30]) for (const X of [-4, 4]) chand.push([X, 6.6, z]);
  // tables, far to near
  const tables = [];
  for (const z of [27, 22.5, 18.5, 15, 12, 9.4, 7.1, 5.1, 3.6])
    for (const X of [-6.6, -3.3, 0, 3.3, 6.6])
      if (!(X === 0 && z < 8)) tables.push([X + (rnd() - 0.5) * 0.7 + (Math.round(z) % 2 ? 1.2 : 0), z]);
  let tb = '';
  for (const [X, z] of tables) {
    const sc = f / z;
    const [tx, ty] = p([X, 0.76, z]);
    const [, fy] = p([X, 0, z]);
    const rx = 0.95 * sc;
    const ry = rx * ((2.6 - 0.76) / z) * 1.05 + 2;
    // chairs peeking round the cloth: gold backs
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const cx0 = tx + Math.cos(a) * rx * 1.18;
      const cy0 = ty + Math.sin(a) * ry * 1.18;
      if (Math.sin(a) > 0.2) continue;
      tb += `<rect x="${r1(cx0 - 0.09 * sc)}" y="${r1(cy0 - 0.5 * sc)}" width="${r1(0.18 * sc)}" height="${r1(0.5 * sc)}" rx="${r1(0.05 * sc)}" fill="#a8823e" opacity=".85"/>`;
    }
    tb += `<path d="M${r1(tx - rx)} ${r1(ty)}L${r1(tx - rx * 1.02)} ${r1(fy)}Q${r1(tx)} ${r1(fy + ry)} ${r1(tx + rx * 1.02)} ${r1(fy)}L${r1(tx + rx)} ${r1(ty)}Z" fill="#e9dfcc"/>`;
    tb += `<ellipse cx="${r1(tx)}" cy="${r1(ty)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="#f4eee2"/>`;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const cx0 = tx + Math.cos(a) * rx * 1.18;
      const cy0 = ty + Math.sin(a) * ry * 1.18;
      if (Math.sin(a) <= 0.2) continue;
      tb += `<rect x="${r1(cx0 - 0.08 * sc)}" y="${r1(cy0 - 0.2 * sc)}" width="${r1(0.16 * sc)}" height="${r1(0.55 * sc)}" rx="${r1(0.05 * sc)}" fill="#b8924c" opacity=".75"/>`;
    }
    // a centrepiece: flowers and three candles
    tb += `<ellipse cx="${r1(tx)}" cy="${r1(ty - 0.12 * sc)}" rx="${r1(0.28 * sc)}" ry="${r1(0.16 * sc)}" fill="#e8c9c4"/>`;
    for (const d of [-0.18, 0, 0.18]) {
      const [cx0, cy0] = p([X + d, 1.05, z]);
      tb += `<rect x="${r1(cx0 - 0.02 * sc)}" y="${r1(cy0)}" width="${r1(0.04 * sc)}" height="${r1(0.25 * sc)}" fill="${C.ivory}"/>`;
      tb +=
        glow({ x: cx0, y: cy0, rx: 0.35 * sc, color: '#f6c77e', a: 0.55 }) +
        `<circle cx="${r1(cx0)}" cy="${r1(cy0 - 0.02 * sc)}" r="${r1(Math.max(1.2, 0.03 * sc))}" fill="#fff2d0"/>`;
    }
  }
  for (const z of [8, 14, 22, 30])
    for (const X of [-4, 4]) {
      const [rx0, ry0] = p([X, 0, z]);
      s += glow({ x: rx0, y: ry0, rx: 1.8 * (f / z), ry: 0.5 * (f / z), color: '#e8b877', a: 0.25 });
    }
  s += blurred(0.9, tb);
  for (const [X, Y, z] of chand) {
    const [cx0, cy0] = p([X, Y, z]);
    const sc = f / z;
    s += `<path d="M${r1(cx0)} 0V${r1(cy0 - 0.4 * sc)}" stroke="#6a5030" stroke-width="2" opacity=".4"/>`;
    s += glow({ x: cx0, y: cy0, rx: 2.2 * sc, color: '#f2c77e', a: 0.4, blend: 'screen' });
    s += glow({ x: cx0, y: cy0, rx: 0.7 * sc, ry: 0.45 * sc, color: '#fff0cc', a: 0.8, blend: 'screen' });
  }
  s += bokeh({
    n: 30,
    area: [0, 300, W, 1100],
    r: [8, 26],
    colors: ['#f6c77e', '#fff0cc'],
    a: [0.2, 0.5],
    seed: 31,
    blur: 1.6,
  });
  s += veil('#3a261c', [
    [300, 0.05],
    [800, 0.15],
    [1150, 0.1],
    [1500, 0],
  ]);
  s += vignette(0.5, '#140c0a');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 5. the terrace: a balustrade above the city's lights, fireworks blooming

const burst = (rnd, x, y, R, color, { n = 70, a = 1, droop = 0.18 } = {}) => {
  let out = glow({ x, y, rx: R * 1.3, color, a: 0.25 * a, blend: 'screen' });
  let streaks = '';
  let tips = '';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.08;
    const len = R * (0.75 + rnd() * 0.3);
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len + droop * len * 0.5;
    const mx = x + Math.cos(ang) * len * 0.6;
    const my = y + Math.sin(ang) * len * 0.6;
    streaks += `M${r1(x + Math.cos(ang) * len * 0.2)} ${r1(y + Math.sin(ang) * len * 0.2)}Q${r1(mx)} ${r1(my)} ${r1(ex)} ${r1(ey)}`;
    tips += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="${r1(1.6 + rnd() * 2.2)}" opacity="${r3(0.6 + rnd() * 0.4)}"/>`;
  }
  const g = nid('fw');
  out += `<defs><radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${r1(x)}" cy="${r1(y)}" r="${r1(R * 1.1)}">${stopsOf(
    [
      [0, color, 0],
      [0.3, color, 0.25 * a],
      [0.85, color, 0.9 * a],
      [1, color, 0.3 * a],
    ],
  )}</radialGradient></defs>`;
  const bf = nid('fb');
  out += `<defs><filter id="${bf}" x="${r1(x - R * 2)}" y="${r1(y - R * 2)}" width="${r1(R * 4)}" height="${r1(R * 4)}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3"/></filter></defs><g style="mix-blend-mode:screen"><path d="${streaks}" stroke="url(#${g})" stroke-width="7" fill="none" stroke-linecap="round" filter="url(#${bf})" opacity=".8"/><path d="${streaks}" stroke="url(#${g})" stroke-width="2.4" fill="none" stroke-linecap="round"/><g fill="#fff5dc" opacity="${r3(a * 0.7)}">${tips}</g></g>`;
  return out;
};

const terrace = () => {
  const rnd = prng(565);
  let s = skyFill([
    [0, '#1e1620'],
    [0.3, '#2a1d28'],
    [0.55, '#3a2530'],
    [0.66, '#5a3634'],
    [0.7, '#6e4436'],
    [1, '#2a1a18'],
  ]);
  // smoke drifting, lit by the bursts
  s += mist({ y: 520, h: 120, x0: -100, x1: 1180, color: '#6a4a48', a: 0.3, seed: 33, n: 8 });
  s += burst(rnd, 300, 330, 230, '#E8D5A8', { n: 90 });
  s += burst(rnd, 800, 430, 165, '#C9A65A', { n: 80 });
  s += burst(rnd, 620, 210, 120, '#d9707e', { n: 60, a: 0.85 });
  s += burst(rnd, 110, 620, 70, '#f4eee2', { n: 40, a: 0.5 });
  s += burst(rnd, 950, 250, 80, '#e8b86a', { n: 40, a: 0.7 });
  s += mist({ y: 820, h: 90, x0: -100, x1: 1180, color: '#5a3c3c', a: 0.25, seed: 35, n: 8 });
  // the city far below: a haze of lights to the horizon
  s += glow({ x: 540, y: 1280, rx: 1100, ry: 260, color: '#b0703e', a: 0.45 });
  let city = '';
  for (let x = -40; x < W + 40; x += 30 + rnd() * 50) {
    const h = 4 + rnd() * 26 + (rnd() < 0.06 ? 50 : 0);
    city += box(x, 1300 - h, 30 + rnd() * 40, h + 14, 'fill="#3a2a2c"');
  }
  s += `<defs>${ugrad(
    'cty',
    [
      [0, '#4a3030'],
      [1, '#2a1c1e'],
    ],
    [0, 1300, 0, 1600],
  )}</defs>${box(-20, 1308, W + 40, 300, 'fill="url(#cty)"')}`;
  s += blurred(2, city);
  s += bokeh({
    n: 320,
    area: [-40, 1290, W + 40, 1560],
    r: [2, 6],
    colors: ['#f6cf8a', '#fff0cc', '#e89a6a', '#f4eee2'],
    a: [0.3, 0.9],
    seed: 37,
    blur: 1,
  });
  s += glow({ x: 540, y: 1420, rx: 1000, ry: 200, color: '#c98a4e', a: 0.35, blend: 'screen' });
  s += bokeh({
    n: 40,
    area: [-40, 1300, W + 40, 1580],
    r: [10, 30],
    colors: ['#f6cf8a', '#e8a070'],
    a: [0.15, 0.4],
    seed: 39,
    blur: 2.5,
  });
  // the balustrade in the foreground, ivory lit warm from the terrace
  let bal = `<rect x="-20" y="1560" width="${W + 40}" height="44" fill="#cbb89a"/><rect x="-20" y="1556" width="${W + 40}" height="10" fill="#efe2c8"/>`;
  for (let x = 10; x < W; x += 72) {
    bal += `<path d="M${x} 1604H${x + 44}V1618C${x + 44} 1640 ${x + 58} 1670 ${x + 50} 1720C${x + 44} 1760 ${x + 36} 1790 ${x + 44} 1840V1920H${x}V1840C${x + 8} 1790 ${x} 1760 ${x - 6} 1720C${x - 14} 1670 ${x} 1640 ${x} 1618Z" fill="#b8a283"/>`;
    bal += `<path d="M${x + 8} 1620C${x + 4} 1660 ${x - 2} 1700 ${x + 4} 1740" stroke="#efe2c8" stroke-width="4" fill="none" opacity=".6"/>`;
  }
  s += blurred(2.2, bal);
  s += `<defs>${ugrad(
    'bsh',
    [
      [0, '#1a1210', 0],
      [1, '#1a1210', 0.6],
    ],
    [0, 1600, 0, H],
  )}</defs>${box(0, 1600, W, 320, 'fill="url(#bsh)"')}`;
  s += glow({ x: 900, y: 1700, rx: 400, ry: 250, color: '#e8b877', a: 0.25, blend: 'screen' });
  s += vignette(0.4, '#140c0e');
  return [svgLayer(s)];
};

const scenes = {
  'scene-doors': { paint: doors, seed: 61, post: { gamma: 0.92, bloom: 0.5 } },
  'scene-chandelier': { paint: chandelier, seed: 62, post: { gamma: 0.84, bloom: 0.55 } },
  'scene-champagne': { paint: champagne, seed: 63, post: { gamma: 0.86, bloom: 0.5 } },
  'scene-ballroom': { paint: ballroom, seed: 64, post: { gamma: 0.8, bloom: 0.5 } },
  'scene-terrace': { paint: terrace, seed: 65, post: { gamma: 0.8, bloom: 0.55 } },
};

await paintScenes({ id: 'gala-night', scenes, background: '#3a2a1e' });
