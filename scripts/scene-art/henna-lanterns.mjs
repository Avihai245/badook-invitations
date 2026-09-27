// henna-lanterns (a henna night): five backdrop pictures of one warm night — a keyhole doorway in zellige
// under a brass lantern, a riad courtyard full of lanterns round a tiled fountain, the henna tray with its
// candles, petals and dates, red and gold cloth by a darbuka, and the rooftops under strings of lanterns.
// Deep red, saffron, gold, teal and cream; no people. Painted with the kit (./kit.mjs) and the group's helpers.
//
//   node scripts/scene-art/henna-lanterns.mjs [--draft <dir>] [scene …]
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
  skyFill,
  glow,
  mist,
  vignette,
  svgLayer,
  pts,
} from './kit.mjs';
import {
  box,
  under,
  blurred,
  veil,
  camera,
  horseshoe,
  opening,
  stoneTex,
  stars,
  bokeh,
  glints,
  flameLight,
  piercedLantern,
  cloth,
} from './architecture-shared.mjs';

const C = {
  red: '#8E1B2B',
  saffron: '#E3A72F',
  gold: '#C99A3E',
  teal: '#1F6F6B',
  cream: '#F1E3C8',
  shade: '#2A0E12',
  plaster: '#b8704a',
  night: '#1d2a4a',
};

/** zellige: a tile of eight-pointed stars, small crosses and grout lines, as an SVG pattern */
const zellige = (
  id,
  T,
  { star = C.teal, core = C.saffron, cross = C.red, ground = C.cream, grout = '#e9dcc3', rot = 0 } = {},
) => {
  const starPts = (cx, cy, R, r) =>
    Array.from({ length: 16 }, (_, k) => {
      const a = (k * Math.PI) / 8 - Math.PI / 2;
      const rr = k % 2 ? r : R;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    });
  const c = T / 2;
  const diamond = (x, y, d) =>
    pts([
      [x, y - d],
      [x + d, y],
      [x, y + d],
      [x - d, y],
    ]) + 'Z';
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${T}" height="${T}" patternTransform="rotate(${rot})">
<rect width="${T}" height="${T}" fill="${ground}"/>
<path d="${pts(starPts(c, c, T * 0.46, T * 0.33))}Z" fill="${star}" stroke="${grout}" stroke-width="${r1(T * 0.03)}"/>
<path d="${pts(starPts(c, c, T * 0.22, T * 0.15))}Z" fill="${core}" stroke="${grout}" stroke-width="${r1(T * 0.025)}"/>
${[
  [0, 0],
  [T, 0],
  [0, T],
  [T, T],
]
  .map(
    ([x, y]) =>
      `<path d="${diamond(x, y, T * 0.17)}" fill="${cross}" stroke="${grout}" stroke-width="${r1(T * 0.025)}"/>`,
  )
  .join('')}
<path d="${diamond(c, 0, T * 0.07)}${diamond(0, c, T * 0.07)}${diamond(T, c, T * 0.07)}${diamond(c, T, T * 0.07)}" fill="${C.gold}"/>
</pattern>`;
};

/** a band of zellige with a gloss (tiles catch the light unevenly) */
const zelligeBand = (x, y, w, h, T, opts = {}, extra = '') => {
  const id = nid('zl');
  const gl = nid('zg');
  return `<defs>${zellige(id, T, opts)}<filter id="${gl}" x="${x}" y="${y}" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${r3(1 / T)}" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.85  0.9 0 0 0 -0.35" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gg"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gg"/></feMerge></filter></defs><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="url(#${id})" filter="url(#${gl})" ${extra}/>`;
};

/** light thrown through a lantern's piercings: a scatter of small warm stars round it */
const specks = (rnd, x, y, R, n, color = '#f6c56e') => {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = R * (0.35 + rnd() * 0.65);
    const sx = x + Math.cos(a) * d;
    const sy = y + Math.sin(a) * d * 0.9;
    const s = 3 + rnd() * 6;
    out += `<path d="M${r1(sx)} ${r1(sy - s)}L${r1(sx + s * 0.3)} ${r1(sy - s * 0.3)}L${r1(sx + s)} ${r1(sy)}L${r1(sx + s * 0.3)} ${r1(sy + s * 0.3)}L${r1(sx)} ${r1(sy + s)}L${r1(sx - s * 0.3)} ${r1(sy + s * 0.3)}L${r1(sx - s)} ${r1(sy)}L${r1(sx - s * 0.3)} ${r1(sy - s * 0.3)}Z" fill="${color}" opacity="${r3((0.25 + rnd() * 0.45) * (1 - d / R) ** 0.5)}"/>`;
  }
  return blurred(1.2, out, 'style="mix-blend-mode:screen"');
};

/** a floor lantern: a candle behind pierced brass, standing on the ground */
const floorLantern = (x, y, s, seed) =>
  piercedLantern({
    x,
    y: y - s * 2.2,
    s,
    glass: '#f2b653',
    metal: '#5a3b1d',
    hi: '#b9893f',
    seed,
    halo: 0.8,
  });

// ---------------------------------------------------------------------------------------------------
// 1. the doorway: a keyhole arch framed in zellige, a teal door studded in brass, a lantern glowing

const door = () => {
  const rnd = prng(111);
  const cx = 540;
  const yc = 860;
  const R = 232;
  const foot = 1600;
  let s = skyFill([
    [0, '#5e2a22'],
    [0.4, '#8a4430'],
    [0.7, '#7a3a2a'],
    [1, '#4a1f1a'],
  ]);
  // the plaster wall, warm where the lantern lights it
  s += under(
    stoneTex({
      freq: 0.012,
      oct: 4,
      relief: 2.2,
      tex: 0.35,
      seed: 5,
      patch: 0.22,
      patchFreq: 0.004,
      patchColor: '#5a2418',
    }),
    box(0, 0, W, foot, 'fill="#a5583b"'),
  );
  s += glow({ x: 250, y: 720, rx: 700, ry: 760, color: '#f0a553', a: 0.5 });
  s += glow({ x: 850, y: 1300, rx: 500, ry: 600, color: '#d88345', a: 0.25 });
  // the frame: a rectangle (alfiz) of carved plaster, the arch's band of zellige
  const arch = horseshoe(cx, yc, R, 0.72);
  const outerArch = horseshoe(cx, yc, R + 46, 0.72);
  s += box(cx - R - 110, yc - R - 130, 2 * (R + 110), foot - (yc - R - 130), 'fill="#c9885a"');
  s += box(
    cx - R - 110,
    yc - R - 130,
    2 * (R + 110),
    foot - (yc - R - 130),
    'fill="none" stroke="#e0ad7a" stroke-width="10" opacity=".7"',
  );
  // carved spandrels: a lattice of small lozenges
  let carve = '';
  for (let y = yc - R - 110; y < yc + 40; y += 26)
    for (let x = cx - R - 94; x < cx + R + 94; x += 26)
      carve += `<path d="M${x} ${y + 13}L${x + 13} ${y}L${x + 26} ${y + 13}L${x + 13} ${y + 26}Z" fill="none" stroke="#9c5a37" stroke-width="2.5" opacity=".55"/>`;
  s += `<defs><clipPath id="spd"><rect x="${cx - R - 100}" y="${yc - R - 120}" width="${2 * (R + 100)}" height="${R + 160}"/></clipPath></defs><g clip-path="url(#spd)">${carve}</g>`;
  // the zellige band round the arch
  const zid = nid('zl');
  s += `<defs>${zellige(zid, 34)}</defs><path d="${pts(opening(outerArch, foot))}Z" fill="url(#${zid})"/>`;
  s += `<path d="${pts(opening(outerArch, foot))}" fill="none" stroke="${C.gold}" stroke-width="6"/>`;
  // the door: teal boards, brass studs, a ring knocker
  const dg = nid('dr');
  s += `<defs><linearGradient id="${dg}" x1="0" y1="0" x2="1" y2="0">${stopsOf([
    [0, '#16514f'],
    [0.3, '#22736d'],
    [0.7, '#1c625d'],
    [1, '#123f3e'],
  ])}</linearGradient></defs>`;
  const doorPath = `${pts(opening(arch, foot))}Z`;
  s += `<path d="${doorPath}" fill="url(#${dg})"/>`;
  let boards = '';
  for (let x = cx - 180; x < cx + 180; x += 40) boards += `M${x} ${yc - R}V${foot}`;
  s += `<defs><clipPath id="dcp"><path d="${doorPath}"/></clipPath></defs><g clip-path="url(#dcp)"><path d="${boards}" stroke="#0f3736" stroke-width="3" opacity=".5"/>`;
  // studs in an arch pattern and a central lozenge
  let studs = '';
  const stud = (x, y, r = 5) =>
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="#d9ad5c"/><circle cx="${r1(x - r * 0.3)}" cy="${r1(y - r * 0.3)}" r="${r1(r * 0.4)}" fill="#fbe2a8"/>`;
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI / 2 + 0.72 + ((2 * Math.PI - 1.44) * i) / 26;
    studs += stud(cx + (R - 26) * Math.cos(a), yc + (R - 26) * Math.sin(a));
  }
  for (let y = yc + 180; y < foot - 30; y += 44) studs += stud(cx - 160, y) + stud(cx + 160, y);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    studs += stud(cx + Math.cos(a) * 70, 1170 + Math.sin(a) * 100, 4.5);
  }
  s += `${studs}</g>`;
  s += `<circle cx="${cx}" cy="1170" r="26" fill="none" stroke="#c99a3e" stroke-width="7"/><circle cx="${cx}" cy="1140" r="9" fill="#c99a3e"/>`;
  s += `<path d="${pts(arch)}" fill="none" stroke="#0d2f2e" stroke-width="10" opacity=".6"/>`;
  // the dado of zellige along the wall, a threshold of marble
  s += zelligeBand(0, 1330, cx - R - 110, foot - 1330, 48);
  s += zelligeBand(cx + R + 110, 1330, W - (cx + R + 110), foot - 1330, 48);
  s +=
    box(0, 1318, cx - R - 110, 14, `fill="${C.gold}"`) + box(cx + R + 110, 1318, W, 14, `fill="${C.gold}"`);
  s += box(cx - R - 60, foot - 10, 2 * (R + 60), 30, 'fill="#e6d3b5"');
  // the floor: terracotta tiles going away from us
  const cam = camera({ f: 900, vx: cx, vy: 1180, eye: 1.6 });
  let tiles = box(0, foot, W, H - foot, 'fill="#6b2a1f"');
  for (let z = 2.1; z < 3.6; z += 0.3)
    for (let X = -3; X < 3; X += 0.3)
      tiles += cam.poly(
        [
          [X + 0.012, 0, z + 0.012],
          [X + 0.288, 0, z + 0.012],
          [X + 0.288, 0, z + 0.288],
          [X + 0.012, 0, z + 0.288],
        ],
        `fill="${mix('#9a4a33', '#b8643f', rnd())}"`,
      );
  s += `<defs><clipPath id="flr"><rect x="0" y="${foot + 20}" width="${W}" height="${H - foot}"/></clipPath></defs><g clip-path="url(#flr)">${tiles}</g>`;
  s += glow({ x: cx, y: foot + 120, rx: 600, ry: 140, color: '#f0a553', a: 0.3 });
  // the hanging lantern on its bracket, its light thrown round it
  s += `<path d="M40 560H250V600" stroke="#4a2f18" stroke-width="9" fill="none"/><path d="M40 530V600" stroke="#4a2f18" stroke-width="12"/>`;
  s += piercedLantern({
    x: 250,
    y: 700,
    s: 58,
    glass: '#f4b85c',
    metal: '#5a3a1a',
    hi: '#c08f45',
    seed: 3,
    halo: 1.3,
    chain: 40,
  });
  s += specks(rnd, 250, 760, 330, 70);
  // floor lanterns at the door's feet
  s += floorLantern(cx - R - 150, 1720, 34, 5) + floorLantern(cx + R + 160, 1740, 40, 7);
  s += glow({ x: cx - R - 150, y: 1700, rx: 200, ry: 120, color: '#f2b653', a: 0.3, blend: 'screen' });
  s += glow({ x: cx + R + 160, y: 1720, rx: 220, ry: 130, color: '#f2b653', a: 0.3, blend: 'screen' });
  s += veil('#b8603a', [
    [350, 0],
    [700, 0.1],
    [1100, 0.08],
    [1350, 0],
  ]);
  s += vignette(0.5, '#2a0e12');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 2. the riad courtyard: arcades, a tiled fountain, lanterns everywhere, cushions along the walls

const courtyard = () => {
  const rnd = prng(222);
  const cam = camera({ f: 950, vx: 540, vy: 1180, eye: 1.6 });
  const { p } = cam;
  let s = skyFill([
    [0, '#1b2646'],
    [0.1, '#2a3560'],
    [0.2, '#4a4468'],
    [1, '#2b2f4c'],
  ]);
  s += stars({ n: 50, y0: 0, y1: 240, seed: 3, a: [0.3, 0.8], big: 3 });
  // the far arcade (Z = 9): three horseshoe arches on slender columns, a gallery above
  const Zf = 9;
  const sc = 950 / Zf;
  const baseY = p([0, 0, Zf])[1];
  const wallTop = p([0, 7.8, Zf])[1];
  s += box(-40, wallTop, W + 80, baseY - wallTop, 'fill="#c07a4c"');
  s += under(
    stoneTex({ freq: 0.02, relief: 2, tex: 0.35, seed: 9, patch: 0.2, patchColor: '#6a2a1c' }),
    box(-40, wallTop, W + 80, baseY - wallTop, 'fill="#b56d45"'),
  );
  // the gallery: a carved wooden balustrade under small arches
  const galY = p([0, 4.3, Zf])[1];
  for (let i = 0; i < 7; i++) {
    const gx = 540 + (i - 3) * 1.25 * sc;
    const g = horseshoe(gx, galY - 1.6 * sc, 0.45 * sc, 0.6, 30);
    s += `<path d="${pts(opening(g, galY))}Z" fill="#4a1e1a"/>`;
    s += glow({ x: gx, y: galY - 1.1 * sc, rx: 0.5 * sc, ry: 0.8 * sc, color: '#e39a45', a: 0.55 });
  }
  let rail = box(-40, galY - 0.9 * sc, W + 80, 0.9 * sc, 'fill="#5a2a1a"');
  for (let x = -40; x < W + 40; x += 0.18 * sc)
    rail += `<path d="M${r1(x)} ${r1(galY - 0.85 * sc)}v${r1(0.8 * sc)}" stroke="#8a4a2a" stroke-width="${r1(0.06 * sc)}"/>`;
  s += rail;
  s += box(-40, galY, W + 80, 0.25 * sc, `fill="${C.gold}" opacity=".8"`);
  // the arcade below
  const archX = [-1, 0, 1].map((k) => 540 + k * 2.4 * sc);
  const spring = p([0, 2.3, Zf])[1];
  for (const ax of archX) {
    const a = horseshoe(ax, spring, 0.95 * sc, 0.62, 40);
    const op = `${pts(opening(a, baseY))}Z`;
    // through the arch: the gallery's back wall, lamp-lit, a doorway, the floor
    s += `<defs><clipPath id="c${Math.round(ax)}"><path d="${op}"/></clipPath></defs><g clip-path="url(#c${Math.round(ax)})">${box(ax - 1.3 * sc, spring - 1.4 * sc, 2.6 * sc, 4 * sc, 'fill="#94502f"')}${box(ax - 0.35 * sc, baseY - 1.9 * sc, 0.7 * sc, 1.9 * sc, 'fill="#4a1c16"')}${box(ax - 1.3 * sc, baseY - 0.35 * sc, 2.6 * sc, 0.4 * sc, 'fill="#6a2c20"')}${glow({ x: ax, y: spring, rx: 1.1 * sc, ry: 1.3 * sc, color: '#f0a553', a: 0.45 })}${box(ax - 1.3 * sc, spring - 1.4 * sc, 0.25 * sc, 4 * sc, 'fill="#3a1614" opacity=".45"')}</g>`;
    s += `<path d="${pts(horseshoe(ax, spring, 0.99 * sc, 0.62, 40))}" fill="none" stroke="#e8c08a" stroke-width="${r1(0.05 * sc)}" opacity=".8"/>`;
  }
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const x = 540 + k * 2.4 * sc;
    s += box(x - 0.1 * sc, spring - 0.1 * sc, 0.2 * sc, baseY - spring + 0.1 * sc, 'fill="#d9a877"');
    s += box(x - 0.16 * sc, spring - 0.25 * sc, 0.32 * sc, 0.18 * sc, `fill="${C.gold}"`);
  }
  // zellige dado along the arcade's foot, cushions on a low bench
  s += zelligeBand(-40, baseY - 0.8 * sc, W + 80, 0.8 * sc, 26);
  let cush = '';
  for (let x = -20; x < W; x += 0.9 * sc) {
    const c = [C.red, C.saffron, '#a8352e', C.teal][Math.floor(rnd() * 4)];
    cush += `<rect x="${r1(x)}" y="${r1(baseY - 0.95 * sc)}" width="${r1(0.8 * sc)}" height="${r1(0.55 * sc)}" rx="${r1(0.18 * sc)}" fill="${c}"/><rect x="${r1(x + 0.1 * sc)}" y="${r1(baseY - 0.9 * sc)}" width="${r1(0.6 * sc)}" height="${r1(0.12 * sc)}" rx="4" fill="#f6d6a0" opacity=".35"/>`;
  }
  s += blurred(0.8, cush);
  // the side walls in perspective, their arches receding
  for (const side of [-1, 1]) {
    const X = side * 4.2;
    s += cam.poly(
      [
        [X, 0, 2.5],
        [X, 7.8, 2.5],
        [X, 7.8, Zf],
        [X, 0, Zf],
      ],
      `fill="${side < 0 ? '#8e4a31' : '#9e5638'}"`,
    );
    for (const z0 of [3.2, 5.8]) {
      const pts3 = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 + 0.62 + ((2 * Math.PI - 1.24) * i) / 24;
        pts3.push([X, 2.2 - 0.95 * Math.sin(a) * -1 + 0, z0 + 1 + 0.95 * Math.cos(a)]);
      }
      const q = [[X, 0, pts3[0][2]], ...pts3, [X, 0, pts3[pts3.length - 1][2]]];
      s += cam.poly(q, 'fill="#351412"');
      const [gx, gy] = p([X, 1.6, z0 + 1]);
      s += glow({
        x: gx,
        y: gy,
        rx: 1.3 * (950 / (z0 + 1)),
        ry: 1.6 * (950 / (z0 + 1)),
        color: '#c8743a',
        a: 0.5,
      });
    }
  }
  // the floor: marble and zellige in perspective
  let fl = cam.poly(
    [
      [-4.2, 0, 1.6],
      [4.2, 0, 1.6],
      [4.2, 0, Zf],
      [-4.2, 0, Zf],
    ],
    'fill="#c9a07a"',
  );
  for (let z = 1.6; z < Zf; z += 0.6)
    for (let X = -4.2; X < 4.2; X += 0.6) {
      const k = (Math.round(z / 0.6) + Math.round(X / 0.6)) % 2;
      fl += cam.poly(
        [
          [X, 0, z],
          [X + 0.6, 0, z],
          [X + 0.6, 0, z + 0.6],
          [X, 0, z + 0.6],
        ],
        `fill="${k ? '#d9b98f' : '#3a5a52'}" opacity="${k ? 0.55 : 0.5}"`,
      );
    }
  s += blurred(1.4, fl);
  s += glow({ x: 540, y: 1330, rx: 700, ry: 200, color: '#f2b25c', a: 0.35, blend: 'screen' });
  // the fountain: an octagonal basin in zellige, a bowl, water catching the light
  const fz = 4.2;
  const fs = 950 / fz;
  const [fx, fy] = p([0, 0.55, fz]);
  const fw = 1.6 * fs;
  const fid = nid('zl');
  s += `<defs>${zellige(fid, 22)}</defs>`;
  s += `<path d="M${r1(fx - fw)} ${r1(fy)}L${r1(fx - fw * 0.7)} ${r1(fy - fs * 0.25)}H${r1(fx + fw * 0.7)}L${r1(fx + fw)} ${r1(fy)}V${r1(fy + 0.55 * fs)}H${r1(fx - fw)}Z" fill="url(#${fid})"/>`;
  s += `<path d="M${r1(fx - fw)} ${r1(fy)}L${r1(fx - fw * 0.7)} ${r1(fy - fs * 0.25)}H${r1(fx + fw * 0.7)}L${r1(fx + fw)} ${r1(fy)}Z" fill="#3a6b73"/>`;
  s += `<path d="M${r1(fx - fw)} ${r1(fy)}L${r1(fx - fw * 0.7)} ${r1(fy - fs * 0.25)}H${r1(fx + fw * 0.7)}L${r1(fx + fw)} ${r1(fy)}Z" fill="none" stroke="#f0d9b0" stroke-width="6"/>`;
  s += glow({
    x: fx,
    y: fy - fs * 0.12,
    rx: fw * 0.8,
    ry: fs * 0.12,
    color: '#f6c67a',
    a: 0.45,
    blend: 'screen',
  });
  s += `<path d="M${r1(fx - 0.08 * fs)} ${r1(fy - 0.1 * fs)}V${r1(fy - 0.7 * fs)}H${r1(fx + 0.08 * fs)}V${r1(fy - 0.1 * fs)}Z" fill="#e6cfa8"/><ellipse cx="${r1(fx)}" cy="${r1(fy - 0.72 * fs)}" rx="${r1(0.5 * fs)}" ry="${r1(0.1 * fs)}" fill="#d9b98a"/><ellipse cx="${r1(fx)}" cy="${r1(fy - 0.75 * fs)}" rx="${r1(0.42 * fs)}" ry="${r1(0.07 * fs)}" fill="#6fa3a0"/>`;
  s += blurred(
    3,
    `<path d="M${r1(fx)} ${r1(fy - 0.95 * fs)}q-40 20 -70 ${r1(0.2 * fs)}M${r1(fx)} ${r1(fy - 0.95 * fs)}q40 20 70 ${r1(0.2 * fs)}" stroke="#e8f0ee" stroke-width="5" fill="none" opacity=".5"/>`,
  );
  // lanterns: in each arch, along the side walls, standing on the floor
  for (const ax of archX)
    s += piercedLantern({
      x: ax,
      y: spring - 0.2 * sc,
      s: 0.2 * sc,
      seed: Math.round(ax),
      halo: 1.2,
      chain: 0.6 * sc,
    });
  for (const [X, Y, z] of [
    [-3.4, 3.4, 3.6],
    [3.4, 3.4, 3.6],
    [-3.6, 3.2, 6.6],
    [3.6, 3.2, 6.6],
  ]) {
    const [lx, ly] = p([X, Y, z]);
    s += piercedLantern({
      x: lx,
      y: ly,
      s: 0.26 * (950 / z),
      seed: Math.round(lx),
      halo: 1.1,
      chain: 0.8 * (950 / z),
    });
  }
  for (const [X, z, k] of [
    [-2.4, 2.6, 1],
    [2.6, 2.8, 2],
    [-1.6, 6.5, 3],
    [1.8, 6.8, 4],
    [-3.2, 5, 5],
  ]) {
    const [lx, ly] = p([X, 0, z]);
    s += floorLantern(lx, ly, 0.16 * (950 / z), k);
  }
  // potted palms at the sides
  const palm = { lit: '#6f8a58', mid: '#4a6340', shade: '#2e3f2c' };
  for (const [x, y, _sd] of [
    [70, 1260, 7],
    [1010, 1270, 9],
  ]) {
    let fronds = '';
    for (let k = 0; k < 11; k++) {
      const a = -Math.PI / 2 + (k - 5) * 0.28;
      fronds += `<path d="M${x} ${y}q${r1(Math.cos(a) * 120)} ${r1(Math.sin(a) * 160 - 40)} ${r1(Math.cos(a) * 260)} ${r1(Math.sin(a) * 200 + 80)}" stroke="${k % 2 ? palm.lit : palm.mid}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    }
    s += blurred(
      2.5,
      `${fronds}<path d="M${x - 50} ${y + 60}L${x - 40} ${y + 200}H${x + 40}L${x + 50} ${y + 60}Z" fill="#9a4a2f"/>`,
    );
  }
  s += veil('#6a2a24', [
    [0, 0.25],
    [500, 0.05],
    [1000, 0.05],
    [1920, 0.2],
  ]);
  s += vignette(0.45, '#2a0e12');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 3. the henna tray: a bowl of henna, candles, rose petals, dates, gold cloth; the room a blur behind

const petal = (x, y, r, rot, c) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})"><path d="M0 ${r1(-r)}C${r1(r * 0.9)} ${r1(-r * 0.8)} ${r1(r)} ${r1(r * 0.4)} 0 ${r1(r * 0.8)}C${r1(-r)} ${r1(r * 0.4)} ${r1(-r * 0.9)} ${r1(-r * 0.8)} 0 ${r1(-r)}Z" fill="${c}"/><path d="M0 ${r1(-r * 0.7)}C${r1(r * 0.4)} ${r1(-r * 0.4)} ${r1(r * 0.4)} ${r1(r * 0.2)} 0 ${r1(r * 0.5)}" stroke="#e05a5f" stroke-width="2" fill="none" opacity=".45"/></g>`;

const tray = () => {
  const rnd = prng(333);
  let s = skyFill([
    [0, '#3a1216'],
    [0.5, '#5a1c1e'],
    [1, '#2c0d10'],
  ]);
  s += glow({ x: 300, y: 600, rx: 700, ry: 700, color: '#a0412a', a: 0.5 });
  s += glow({ x: 850, y: 900, rx: 600, ry: 700, color: '#b35a2a', a: 0.4 });
  s += bokeh({
    n: 30,
    area: [-60, 40, W + 60, 1150],
    r: [34, 100],
    colors: ['#E3A72F', '#f0b860', '#d0564a', '#f3d49a'],
    a: [0.18, 0.5],
    seed: 7,
    blur: 3,
  });
  s += bokeh({
    n: 50,
    area: [-60, 0, W + 60, 1200],
    r: [8, 24],
    colors: ['#f6c56e', '#f09a5a'],
    a: [0.2, 0.5],
    seed: 9,
    blur: 1.5,
  });
  // gold cloth under the tray, folds catching the candlelight
  const pat = box(-100, -100, W + 200, H + 200, 'fill="#a87a34"');
  s += `<defs><clipPath id="gc"><path d="M-60 1180C200 1120 700 1150 1140 1100V${H + 60}H-60Z"/></clipPath></defs>`;
  s += cloth({
    pattern: pat,
    angle: 20,
    period: [130, 240],
    seed: 13,
    bendFreq: 0.0024,
    bend: 130,
    surface: 14,
    az: 240,
    el: 42,
    lightColor: '#ffe3b0',
    ambient: 0.32,
    diffuse: 0.85,
    spec: 0.55,
    specExp: 14,
    zig: 0,
    clip: 'gc',
  });
  // the brass tray, engraved, seen at an angle
  const tx = 540;
  const ty = 1520;
  const tg = nid('tg');
  s += `<defs><radialGradient id="${tg}" cx="0.4" cy="0.35" r="0.8">${stopsOf([
    [0, '#f1cf82'],
    [0.45, '#c99a3e'],
    [0.85, '#8a6122'],
    [1, '#5e3d14'],
  ])}</radialGradient></defs>`;
  s += `<ellipse cx="${tx + 10}" cy="${ty + 30}" rx="500" ry="190" fill="#1d0a0a" opacity=".5"/>`;
  s += `<ellipse cx="${tx}" cy="${ty}" rx="490" ry="178" fill="url(#${tg})"/>`;
  s += `<ellipse cx="${tx}" cy="${ty}" rx="470" ry="168" fill="none" stroke="#f3d690" stroke-width="4" opacity=".6"/>`;
  let eng = '';
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    eng += `<path d="M${r1(tx + Math.cos(a) * 400)} ${r1(ty + Math.sin(a) * 140)}Q${r1(tx + Math.cos(a + 0.07) * 440)} ${r1(ty + Math.sin(a + 0.07) * 156)} ${r1(tx + Math.cos(a + 0.13) * 400)} ${r1(ty + Math.sin(a + 0.13) * 140)}" stroke="#7a5418" stroke-width="2.5" fill="none" opacity=".5"/>`;
  }
  eng += `<ellipse cx="${tx}" cy="${ty}" rx="380" ry="134" fill="none" stroke="#7a5418" stroke-width="2" opacity=".45"/>`;
  s += blurred(0.6, eng);
  // the bowl of henna: a teal glazed bowl with a gold rim, the paste swirled
  const bx = 470;
  const by = 1470;
  const bg = nid('bw');
  s += `<defs><linearGradient id="${bg}" x1="0" y1="0" x2="1" y2="0">${stopsOf([
    [0, '#123f3d'],
    [0.35, '#2a8b83'],
    [0.6, C.teal],
    [1, '#0f3533'],
  ])}</linearGradient></defs>`;
  s += `<path d="M${bx - 190} ${by - 40}Q${bx - 170} ${by + 120} ${bx} ${by + 130}Q${bx + 170} ${by + 120} ${bx + 190} ${by - 40}Z" fill="url(#${bg})"/>`;
  s += `<ellipse cx="${bx}" cy="${by - 40}" rx="190" ry="58" fill="#c99a3e"/><ellipse cx="${bx}" cy="${by - 38}" rx="174" ry="50" fill="#5b4a22"/>`;
  s += blurred(
    1.2,
    `<ellipse cx="${bx}" cy="${by - 34}" rx="168" ry="46" fill="#6d6a2c"/><path d="M${bx - 110} ${by - 30}C${bx - 60} ${by - 70} ${bx + 60} ${by - 60} ${bx + 90} ${by - 30}C${bx + 40} ${by - 10} ${bx - 50} ${by - 5} ${bx - 70} ${by - 30}" stroke="#8a8640" stroke-width="10" fill="none"/><path d="M${bx - 40} ${by - 38}c20 -18 50 -10 50 6" stroke="#9c9a50" stroke-width="7" fill="none"/>`,
  );
  let bowlDeco = '';
  for (let k = 0; k < 9; k++) {
    const x = bx - 150 + k * 37;
    bowlDeco += `<path d="M${x} ${by + 10}l12 -16l12 16l-12 16z" fill="#e8c77f" opacity=".7"/>`;
  }
  s += `<defs><clipPath id="bwc"><path d="M${bx - 190} ${by - 40}Q${bx - 170} ${by + 120} ${bx} ${by + 130}Q${bx + 170} ${by + 120} ${bx + 190} ${by - 40}Z"/></clipPath></defs><g clip-path="url(#bwc)">${bowlDeco}</g>`;
  // dates in a little dish
  const dx0 = 770;
  const dy0 = 1600;
  s += `<ellipse cx="${dx0}" cy="${dy0}" rx="120" ry="42" fill="#d9b56a"/><ellipse cx="${dx0}" cy="${dy0 - 4}" rx="104" ry="34" fill="#8a5a24"/>`;
  let dates = '';
  for (let i = 0; i < 9; i++) {
    const x = dx0 - 70 + (i % 5) * 34 + (i > 4 ? 17 : 0);
    const y = dy0 - 14 - (i > 4 ? 18 : 0);
    dates += `<ellipse cx="${x}" cy="${y}" rx="24" ry="14" fill="#4a1c12" transform="rotate(${r1((rnd() - 0.5) * 40)} ${x} ${y})"/><ellipse cx="${x - 6}" cy="${y - 5}" rx="10" ry="4" fill="#b0664a" opacity=".5"/>`;
  }
  s += dates;
  // candles: small pillars with flames
  for (const [x, y, h, w] of [
    [260, 1560, 120, 44],
    [690, 1440, 160, 50],
    [860, 1470, 100, 40],
    [330, 1450, 80, 38],
  ]) {
    const cg = nid('cd');
    s += `<defs><linearGradient id="${cg}" x1="0" y1="0" x2="1" y2="0">${stopsOf([
      [0, '#c9a57f'],
      [0.4, '#f6e7cc'],
      [1, '#b08a64'],
    ])}</linearGradient></defs><path d="M${x - w / 2} ${y - h}V${y}Q${x} ${y + 10} ${x + w / 2} ${y}V${y - h}Z" fill="url(#${cg})"/><ellipse cx="${x}" cy="${y - h}" rx="${w / 2}" ry="${w * 0.14}" fill="#fbecd0"/><path d="M${x} ${y - h}V${y - h - 12}" stroke="#3a2a1a" stroke-width="2"/>`;
    s += flameLight(x, y - h - 10, 34, { glowR: 5 });
  }
  // rose petals scattered on the tray
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    const x = tx + Math.cos(a) * 430 * d;
    const y = ty + Math.sin(a) * 150 * d;
    if (Math.hypot((x - bx) / 190, (y - by) / 110) < 1.05) continue;
    s += petal(x, y, 13 + rnd() * 9, rnd() * 360, mix(C.red, '#c0303a', rnd()));
  }
  s += veil('#3a1216', [
    [200, 0.15],
    [700, 0.05],
    [1150, 0],
  ]);
  s += vignette(0.42, '#2a0e12');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 4. red and gold cloth with mehndi patterns, a darbuka, warm bokeh

const mehndi = (T) => {
  // one repeat of a mehndi motif: a paisley with dots and a vine, a small rosette between
  const id = nid('mh');
  const g = '#e2b24f';
  const p = `M${T * 0.3} ${T * 0.62}C${T * 0.18} ${T * 0.45} ${T * 0.26} ${T * 0.22} ${T * 0.46} ${T * 0.22}C${T * 0.66} ${T * 0.22} ${T * 0.72} ${T * 0.42} ${T * 0.6} ${T * 0.54}C${T * 0.52} ${T * 0.62} ${T * 0.42} ${T * 0.66} ${T * 0.3} ${T * 0.62}C${T * 0.36} ${T * 0.76} ${T * 0.3} ${T * 0.84} ${T * 0.2} ${T * 0.86}`;
  let dots = '';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    dots += `<circle cx="${r1(T * 0.46 + Math.cos(a) * T * 0.3)}" cy="${r1(T * 0.42 + Math.sin(a) * T * 0.24)}" r="${r1(T * 0.012)}" fill="${g}"/>`;
  }
  let ros = '';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ros += `<ellipse cx="${r1(T * 0.9 + Math.cos(a) * T * 0.05)}" cy="${r1(T * 0.9 + Math.sin(a) * T * 0.05)}" rx="${r1(T * 0.035)}" ry="${r1(T * 0.015)}" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(T * 0.9 + Math.cos(a) * T * 0.05)} ${r1(T * 0.9 + Math.sin(a) * T * 0.05)})" fill="none" stroke="${g}" stroke-width="${r1(T * 0.008)}"/>`;
  }
  return {
    id,
    def: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${T}" height="${T}" patternTransform="rotate(-14)"><path d="${p}" fill="none" stroke="${g}" stroke-width="${r1(T * 0.014)}"/><path d="M${T * 0.36} ${T * 0.52}C${T * 0.34} ${T * 0.4} ${T * 0.42} ${T * 0.32} ${T * 0.5} ${T * 0.34}C${T * 0.58} ${T * 0.37} ${T * 0.56} ${T * 0.48} ${T * 0.48} ${T * 0.5}" fill="none" stroke="${g}" stroke-width="${r1(T * 0.01)}"/><circle cx="${T * 0.47}" cy="${T * 0.42}" r="${r1(T * 0.025)}" fill="${g}"/>${dots}${ros}<circle cx="${T * 0.9}" cy="${T * 0.9}" r="${r1(T * 0.018)}" fill="${g}"/><path d="M0 ${T * 0.05}Q${T * 0.25} ${T * 0.12} ${T * 0.5} ${T * 0.05}T${T} ${T * 0.05}" fill="none" stroke="${g}" stroke-width="${r1(T * 0.008)}" stroke-dasharray="${r1(T * 0.02)} ${r1(T * 0.015)}"/></pattern>`,
  };
};

const fabric = () => {
  const _rnd = prng(444);
  let s = skyFill([
    [0, '#3a1014'],
    [1, '#2a0c10'],
  ]);
  s += glow({ x: 850, y: 380, rx: 600, ry: 600, color: '#b0502a', a: 0.5 });
  s += bokeh({
    n: 26,
    area: [300, 0, W + 80, 900],
    r: [36, 110],
    colors: ['#E3A72F', '#f0b860', '#e0604c'],
    a: [0.2, 0.55],
    seed: 11,
    blur: 3.5,
  });
  s += bokeh({
    n: 40,
    area: [200, 0, W + 60, 1000],
    r: [8, 22],
    colors: ['#f6c56e'],
    a: [0.2, 0.5],
    seed: 13,
    blur: 1.5,
  });
  // the red cloth, patterned in gold, flowing across from the left
  const m = mehndi(170);
  const pat = `<defs>${m.def}</defs>${box(-100, -100, W + 200, H + 200, `fill="${C.red}"`)}${box(-100, -100, W + 200, H + 200, `fill="url(#${m.id})"`)}${box(-100, 720, W + 200, 60, 'fill="#c99a3e"')}${box(-100, 790, W + 200, 14, 'fill="#e3b75a"')}`;
  s += `<defs><clipPath id="rc"><path d="M-60 -60H520C700 200 820 420 1140 560V1500C800 1520 500 1640 -60 1700Z"/></clipPath></defs>`;
  s += cloth({
    pattern: pat,
    angle: 62,
    period: [130, 280],
    seed: 17,
    bendFreq: 0.0022,
    bend: 260,
    surface: 30,
    az: 50,
    el: 36,
    lightColor: '#ffd9a6',
    ambient: 0.3,
    diffuse: 0.95,
    spec: 0.55,
    specExp: 16,
    zig: 36,
    clip: 'rc',
  });
  // a gold cloth flowing below it
  const gpat = `${box(-100, -100, W + 200, H + 200, 'fill="#c99a3e"')}`;
  s += `<defs><clipPath id="gc2"><path d="M-60 1640C400 1560 760 1500 1140 1440V${H + 60}H-60Z"/></clipPath></defs>`;
  s += cloth({
    pattern: gpat,
    angle: 20,
    period: [140, 260],
    seed: 19,
    bendFreq: 0.0024,
    bend: 120,
    surface: 14,
    az: 60,
    el: 40,
    lightColor: '#ffe3b0',
    ambient: 0.3,
    diffuse: 0.85,
    spec: 0.6,
    specExp: 14,
    zig: 0,
    clip: 'gc2',
  });
  // the darbuka: a goblet drum inlaid with pearl and brass, its skin catching the light
  const dx = 770;
  const top = 1250;
  const dg = nid('db');
  s += `<defs><linearGradient id="${dg}" x1="0" y1="0" x2="1" y2="0">${stopsOf([
    [0, '#5a3a1a'],
    [0.3, '#c99a3e'],
    [0.5, '#f1d08a'],
    [0.7, '#a87a30'],
    [1, '#4a2e12'],
  ])}</linearGradient></defs>`;
  const body = `M${dx - 170} ${top}C${dx - 170} ${top + 160} ${dx - 60} ${top + 250} ${dx - 45} ${top + 330}C${dx - 40} ${top + 400} ${dx - 110} ${top + 460} ${dx - 120} ${top + 520}H${dx + 120}C${dx + 110} ${top + 460} ${dx + 40} ${top + 400} ${dx + 45} ${top + 330}C${dx + 60} ${top + 250} ${dx + 170} ${top + 160} ${dx + 170} ${top}Z`;
  s += `<ellipse cx="${dx + 20}" cy="${top + 530}" rx="200" ry="40" fill="#1c0708" opacity=".5"/>`;
  s += `<path d="${body}" fill="url(#${dg})"/>`;
  let inlay = '';
  for (let k = 0; k < 10; k++) {
    const x = dx - 150 + k * 32;
    inlay += `<path d="M${x} ${top + 60}l16 26l16 -26z" fill="${k % 2 ? '#e9e2d6' : C.teal}" opacity=".85"/><path d="M${x} ${top + 118}l16 -26l16 26z" fill="${k % 2 ? C.teal : '#e9e2d6'}" opacity=".85"/>`;
  }
  inlay += `<path d="M${dx - 170} ${top + 50}H${dx + 170}M${dx - 170} ${top + 128}H${dx + 170}" stroke="#f1d08a" stroke-width="5"/>`;
  for (let k = 0; k < 6; k++)
    inlay += `<circle cx="${dx - 100 + k * 40}" cy="${top + 190}" r="9" fill="#e9e2d6" opacity=".8"/>`;
  s += `<defs><clipPath id="dbc"><path d="${body}"/></clipPath></defs><g clip-path="url(#dbc)">${inlay}${box(dx - 180, top, 90, 540, 'fill="#1c0a08" opacity=".35"')}${box(dx + 90, top, 90, 540, 'fill="#1c0a08" opacity=".4"')}</g>`;
  s += `<ellipse cx="${dx}" cy="${top}" rx="172" ry="46" fill="#c9983e"/><ellipse cx="${dx}" cy="${top - 2}" rx="160" ry="40" fill="#efe0c2"/><ellipse cx="${dx - 30}" cy="${top - 8}" rx="80" ry="16" fill="#fbf1dc" opacity=".6"/>`;
  s += glints({
    items: [
      [dx - 40, top + 150, 30, 0.7, 15],
      [dx + 100, top + 80, 18, 0.5, 15],
    ],
  });
  s += veil('#2a0e12', [
    [200, 0.1],
    [800, 0],
    [1920, 0.1],
  ]);
  s += vignette(0.44, '#2a0e12');
  return [svgLayer(s)];
};

// ---------------------------------------------------------------------------------------------------
// 5. the rooftops under strings of lanterns, a deep blue sky full of stars

const skyScene = () => {
  const rnd = prng(555);
  let s = skyFill([
    [0, '#16213f'],
    [0.25, '#1d2b52'],
    [0.5, '#27396a'],
    [0.64, '#3a4a7a'],
    [0.72, '#56577e'],
    [0.78, '#6a5470'],
    [1, '#3a2a3a'],
  ]);
  s += stars({ n: 220, y0: 0, y1: 1150, seed: 15, color: '#f4efe0', big: 9 });
  s += glow({ x: 540, y: 1500, rx: 1100, ry: 500, color: '#c77a45', a: 0.35 });
  // rooftops: flat roofs, stepped merlons, a square tower, lit windows
  let roofs = '';
  const skyline = [];
  let x = -40;
  while (x < W + 40) {
    const w = 90 + rnd() * 160;
    const h = 1380 + rnd() * 120 - (rnd() < 0.15 ? 180 : 0);
    skyline.push([x, h, w]);
    x += w;
  }
  for (const [x0, h, w] of skyline) {
    roofs += box(x0, h, w + 2, H - h, `fill="${mix('#3a2230', '#4a2a32', rnd())}"`);
    for (let mx = x0 + 6; mx < x0 + w - 16; mx += 26)
      roofs += `<path d="M${mx} ${h}v-12h6v-6h6v6h6v12z" fill="#3a2230"/>`;
    for (let k = 0; k < 3; k++)
      if (rnd() < 0.5) {
        const wx = x0 + 20 + rnd() * (w - 50);
        const wy = h + 50 + rnd() * 200;
        roofs += `<path d="M${r1(wx)} ${r1(wy + 36)}V${r1(wy + 10)}A12 12 0 0 1 ${r1(wx + 24)} ${r1(wy + 10)}V${r1(wy + 36)}Z" fill="#f2b458"/>`;
        roofs += glow({ x: wx + 12, y: wy + 22, rx: 50, color: '#f2a94e', a: 0.4 });
      }
  }
  roofs +=
    box(760, 1120, 120, 400, 'fill="#3d2431"') +
    `<path d="M760 1120v-16h14v-10h14v10h14v-10h14v10h14v-10h14v10h14v-10h14v16z" fill="#3d2431"/>`;
  roofs += `<path d="M806 1230V1190A14 14 0 0 1 834 1190V1230Z" fill="#f2b458"/>`;
  roofs += glow({ x: 820, y: 1210, rx: 60, color: '#f2a94e', a: 0.45 });
  s += blurred(1, roofs);
  s += mist({ y: 1420, h: 40, x0: -100, x1: 1180, color: '#8a5a60', a: 0.25, seed: 17, n: 8 });
  // strings of lanterns sagging across the sky
  const strings = [
    { a: [-40, 170], b: [W + 40, 250], sag: 170, n: 9, s: 24 },
    { a: [-40, 360], b: [W + 40, 300], sag: 140, n: 8, s: 20 },
    { a: [-40, 1200], b: [W + 40, 1150], sag: 110, n: 10, s: 22 },
  ];
  const glass = ['#f2b653', '#e98a3c', '#d9534a', '#f2c46a', '#3aa39a'];
  for (const st of strings) {
    const pt = (t) => [
      st.a[0] + (st.b[0] - st.a[0]) * t,
      st.a[1] + (st.b[1] - st.a[1]) * t + st.sag * 4 * t * (1 - t),
    ];
    s += `<path d="${pts(Array.from({ length: 41 }, (_, i) => pt(i / 40)))}" stroke="#2a1a1a" stroke-width="2.5" fill="none" opacity=".85"/>`;
    for (let i = 1; i < st.n; i++) {
      const t = (i + (rnd() - 0.5) * 0.3) / st.n;
      const [lx, ly] = pt(t);
      const drop = 20 + rnd() * 30;
      s += piercedLantern({
        x: lx,
        y: ly + drop + st.s * 1.8,
        s: st.s * (0.8 + rnd() * 0.4),
        glass: glass[Math.floor(rnd() * glass.length)],
        seed: i + st.n,
        halo: 1,
        chain: drop,
      });
    }
  }
  s += veil('#1d2b52', [
    [420, 0],
    [700, 0.12],
    [1000, 0],
  ]);
  s += vignette(0.36, '#1a1426');
  return [svgLayer(s)];
};

const scenes = {
  'scene-door': { paint: door, seed: 51, post: { gamma: 1, bloom: 0.45, quality: 76 } },
  'scene-courtyard': { paint: courtyard, seed: 52, post: { gamma: 1, bloom: 0.5, quality: 78 } },
  'scene-tray': { paint: tray, seed: 53, post: { gamma: 0.95, bloom: 0.5, quality: 80 } },
  'scene-fabric': { paint: fabric, seed: 54, post: { gamma: 0.95, bloom: 0.45, quality: 68, grain: 2.6 } },
  'scene-sky': { paint: skyScene, seed: 55, post: { gamma: 0.88, bloom: 0.5 } },
};

await paintScenes({ id: 'henna-lanterns', scenes, background: '#7a2a24' });
