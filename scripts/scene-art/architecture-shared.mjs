// Helpers shared by the "architecture" group's pictures (jerusalem-gold, paris-nights, henna-lanterns,
// gala-night), on top of the painting kit (./kit.mjs): a pinhole camera for streets and halls, arch outlines
// (pointed, horseshoe, round), ashlar courses, a stone relief texture, stars, lens bokeh, glints, lanterns,
// and a folded-fabric filter (a heightmap of folds, bent by noise, lit, the pattern following the folds).
import { W, H, prng, r1, r3, nid, mix, stopsOf, ugrad, glow, soft, blurFilter, pts, arcPts } from './kit.mjs';

export const poly = (list, attrs = '') => `<path d="${pts(list)}Z" ${attrs}/>`;
export const box = (x, y, w, h, attrs = '') =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" ${attrs}/>`;
/** a group under a {id, defs} filter */
export const under = (f, inner, attrs = '') => `${f.defs}<g filter="url(#${f.id})" ${attrs}>${inner}</g>`;
export const blurred = (s, inner, attrs = '') => under(blurFilter(s), inner, attrs);

/** a full-frame veil of one color, its opacity given at heights: [[y, a], …] */
export const veil = (color, stops, blend = 'normal') => {
  const id = nid('vl');
  return `<defs>${ugrad(
    id,
    stops.map(([y, a]) => [r3(y / H), color, a]),
    [0, 0, 0, H],
  )}</defs><rect width="${W}" height="${H}" fill="url(#${id})" style="mix-blend-mode:${blend}"/>`;
};

/** a pinhole camera looking down +Z: X right, Y up (metres), the horizon at vy */
export const camera = ({ f = 900, vx = W / 2, vy = H / 2, eye = 1.6 } = {}) => {
  const p = ([X, Y, Z]) => [vx + (f * X) / Z, vy - (f * (Y - eye)) / Z];
  return { p, f, vx, vy, eye, poly: (list, attrs) => poly(list.map(p), attrs) };
};

// ---------------------------------------------------------------------------------------------------
// arches (outlines as point lists, springing at ySpring, from the left jamb over to the right one)

/** a pointed (two-centred) arch: half-width hw, rising h above its springing line */
export const pointedArch = (cx, ySpring, hw, h, n = 36) => {
  const R = (h * h + hw * hw) / (2 * hw);
  const c = cx - hw + R;
  const top = Math.atan2(-h, cx - c) + 2 * Math.PI;
  const left = arcPts(c, ySpring, R, Math.PI, top, n);
  const right = left.map(([x, y]) => [2 * cx - x, y]).reverse();
  return left.concat(right.slice(1));
};
/** a round arch */
export const roundArch = (cx, ySpring, hw, n = 40) => arcPts(cx, ySpring, hw, Math.PI, 2 * Math.PI, n);
/** a horseshoe (keyhole) arch: a circle of radius r centred at (cx, yc), open below by the angle `open` */
export const horseshoe = (cx, yc, r, open = 0.75, n = 60) =>
  arcPts(cx, yc, r, Math.PI / 2 + open, 2.5 * Math.PI - open, n);
/** an opening: the arch plus its jambs down to yFoot */
export const opening = (arch, yFoot) => [[arch[0][0], yFoot], ...arch, [arch[arch.length - 1][0], yFoot]];

// ---------------------------------------------------------------------------------------------------
// stone

/**
 * Stone relief: the group lit by fractal noise (pits and grain), a slow second noise for weathered patches,
 * kept inside the group's own shape.
 */
export const stoneTex = ({
  freq = 0.035,
  oct = 4,
  relief = 3,
  tex = 0.45,
  az = 225,
  el = 42,
  seed = 7,
  patch = 0.18,
  patchFreq = 0.004,
  patchColor = '#6d5a3e',
  region = [0, 0, W, H],
} = {}) => {
  const id = nid('sx');
  return {
    id,
    defs: `<defs><filter id="${id}" x="${region[0]}" y="${region[1]}" width="${region[2]}" height="${region[3]}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" result="n"/>
<feDiffuseLighting in="n" surfaceScale="${relief}" diffuseConstant="1" lighting-color="#fff" result="L"><feDistantLight azimuth="${az}" elevation="${el}"/></feDiffuseLighting>
<feComponentTransfer in="L" result="T"><feFuncR type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/><feFuncG type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/><feFuncB type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/></feComponentTransfer>
<feBlend in="SourceGraphic" in2="T" mode="multiply" result="m"/>
<feTurbulence type="fractalNoise" baseFrequency="${patchFreq}" numOctaves="3" seed="${seed + 3}" result="p"/>
<feColorMatrix in="p" type="matrix" values="0 0 0 0 ${r3(parseInt(patchColor.slice(1, 3), 16) / 255)}  0 0 0 0 ${r3(parseInt(patchColor.slice(3, 5), 16) / 255)}  0 0 0 0 ${r3(parseInt(patchColor.slice(5, 7), 16) / 255)}  ${r3(patch * 4)} 0 0 0 ${r3(-patch * 1.7)}" result="pc"/>
<feComposite in="pc" in2="m" operator="atop" result="w"/>
<feComposite in="w" in2="SourceGraphic" operator="in"/></filter></defs>`,
  };
};

/**
 * Ashlar courses on a flat face (x0…x1, from yTop down to yBot): blocks of varied length and tone, a joint
 * of `joint` px, a lit top-left arris and a shaded lower edge; `tone(x, y)` gives each block's base colour.
 */
export const ashlar = ({
  x0,
  x1,
  yTop,
  yBot,
  course,
  len,
  seed = 1,
  tone,
  joint = 3,
  jointColor,
  lit,
  dark,
  margin = 0,
}) => {
  const rnd = prng(seed * 7121 + 5);
  let s = `<rect x="${r1(x0)}" y="${r1(yTop)}" width="${r1(x1 - x0)}" height="${r1(yBot - yTop)}" fill="${jointColor}"/>`;
  let y = yTop;
  let row = 0;
  while (y < yBot - 1) {
    const ch = typeof course === 'function' ? course(y, row) : course * (0.85 + rnd() * 0.3);
    const hh = Math.min(ch, yBot - y);
    let x = x0 - rnd() * len;
    while (x < x1) {
      const lw = len * (0.55 + rnd() * 0.9);
      const [bx, by, bw, bh] = [x + joint / 2, y + joint / 2, lw - joint, hh - joint];
      const c = tone(x + lw / 2, y + hh / 2, rnd);
      s += `<rect x="${r1(bx)}" y="${r1(by)}" width="${r1(bw)}" height="${r1(bh)}" fill="${c}"/>`;
      if (margin) {
        // the drafted margin: a slightly darker frame round a raised boss
        s += `<rect x="${r1(bx + margin)}" y="${r1(by + margin)}" width="${r1(Math.max(0, bw - 2 * margin))}" height="${r1(Math.max(0, bh - 2 * margin))}" fill="${mix(c, lit, 0.12)}"/>`;
        s += `<path d="M${r1(bx + margin)} ${r1(by + bh - margin)}V${r1(by + margin)}H${r1(bx + bw - margin)}" fill="none" stroke="${lit}" stroke-width="${r1(Math.max(1, margin * 0.18))}" opacity=".55"/>`;
        s += `<path d="M${r1(bx + bw - margin)} ${r1(by + margin)}V${r1(by + bh - margin)}H${r1(bx + margin)}" fill="none" stroke="${dark}" stroke-width="${r1(Math.max(1, margin * 0.22))}" opacity=".45"/>`;
      }
      s += `<path d="M${r1(bx)} ${r1(by + bh)}V${r1(by)}H${r1(bx + bw)}" fill="none" stroke="${lit}" stroke-width="${r1(Math.max(1, joint * 0.5))}" opacity=".6"/>`;
      s += `<path d="M${r1(bx + bw)} ${r1(by)}V${r1(by + bh)}H${r1(bx)}" fill="none" stroke="${dark}" stroke-width="${r1(Math.max(1, joint * 0.6))}" opacity=".5"/>`;
      x += lw;
    }
    y += hh;
    row += 1;
  }
  return s;
};

// ---------------------------------------------------------------------------------------------------
// night sky, lens and light

export const stars = ({
  n = 140,
  x0 = 0,
  x1 = W,
  y0 = 0,
  y1 = 760,
  seed = 1,
  color = '#f6eedf',
  r = [0.7, 1.9],
  a = [0.25, 0.9],
  big = 7,
} = {}) => {
  const rnd = prng(seed * 911 + 7);
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = y0 + rnd() ** 1.35 * (y1 - y0);
    const k = 1 - ((y - y0) / (y1 - y0)) * 0.75;
    s += `<circle cx="${r1(x0 + rnd() * (x1 - x0))}" cy="${r1(y)}" r="${r1(r[0] + rnd() * (r[1] - r[0]))}" fill="${color}" opacity="${r3(k * (a[0] + rnd() * (a[1] - a[0])))}"/>`;
  }
  const g = nid('st');
  s += `<defs><radialGradient id="${g}">${stopsOf([
    [0, color, 1],
    [0.18, color, 0.55],
    [1, color, 0],
  ])}</radialGradient></defs>`;
  for (let i = 0; i < big; i++)
    s += `<circle cx="${r1(x0 + 40 + rnd() * (x1 - x0 - 80))}" cy="${r1(y0 + rnd() ** 1.2 * (y1 - y0) * 0.8)}" r="${r1(6 + rnd() * 6)}" fill="url(#${g})" opacity="${r3(0.5 + rnd() * 0.4)}"/>`;
  return s;
};

/** out-of-focus lights: discs with a brighter rim, blurred, screened over the picture */
export const bokeh = ({
  n = 30,
  area: [x0, y0, x1, y1],
  r: [rMin, rMax],
  colors,
  a: [aMin, aMax] = [0.25, 0.6],
  seed = 1,
  blur = 2.5,
  blend = 'screen',
  list = null,
}) => {
  const rnd = prng(seed * 577 + 3);
  const grads = colors.map((c) => {
    const id = nid('bk');
    return {
      id,
      def: `<radialGradient id="${id}">${stopsOf([
        [0, c, 0.62],
        [0.7, c, 0.72],
        [0.9, c, 1],
        [1, c, 0],
      ])}</radialGradient>`,
    };
  });
  const items =
    list ??
    Array.from({ length: n }, () => [
      x0 + rnd() * (x1 - x0),
      y0 + rnd() * (y1 - y0),
      rMin + rnd() ** 1.6 * (rMax - rMin),
      aMin + rnd() * (aMax - aMin),
      Math.floor(rnd() * grads.length),
    ]);
  const els = items
    .map(
      ([x, y, r, a, k]) =>
        `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="url(#${grads[(k ?? 0) % grads.length].id})" opacity="${r3(a)}"/>`,
    )
    .join('');
  const f = blurFilter(blur);
  return `<defs>${grads.map((g) => g.def).join('')}</defs>${f.defs}<g filter="url(#${f.id})" style="mix-blend-mode:${blend}">${els}</g>`;
};

/** glints: four-pointed sparkles (two tapering streaks and a small glow), screened */
export const glints = ({ items, color = '#fff4dc', rot = 0 }) => {
  const g = nid('gt');
  let s = `<defs><radialGradient id="${g}">${stopsOf([
    [0, color, 1],
    [0.12, color, 0.75],
    [0.4, color, 0.2],
    [1, color, 0],
  ])}</radialGradient></defs><g style="mix-blend-mode:screen">`;
  for (const [x, y, size, a = 1, rr = rot] of items)
    s += `<g opacity="${r3(a)}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rr)})"><ellipse rx="${r1(size)}" ry="${r1(Math.max(0.8, size * 0.05))}" fill="url(#${g})"/><ellipse rx="${r1(Math.max(0.8, size * 0.05))}" ry="${r1(size)}" fill="url(#${g})"/><circle r="${r1(size * 0.28)}" fill="url(#${g})"/></g>`;
  return `${s}</g>`;
};

/** a flame: a teardrop of warm light with a bright core, and its glow */
export const flameLight = (x, y, h, { a = 1, glowR = 5, color = '#f6c46e' } = {}) => {
  const id = nid('fl');
  const w = h * 0.3;
  return `${glow({ x, y: y - h * 0.4, rx: h * glowR, ry: h * glowR, color, a: 0.35 * a, blend: 'screen' })}<defs><radialGradient id="${id}" cx="0.5" cy="0.7" r="0.6">${stopsOf(
    [
      [0, '#fff6dc', 1],
      [0.45, '#fbd98f', 0.95],
      [1, '#e8913a', 0.6],
    ],
  )}</radialGradient></defs><path d="M${r1(x)} ${r1(y - h)}C${r1(x + w * 0.35)} ${r1(y - h * 0.6)} ${r1(x + w)} ${r1(y - h * 0.3)} ${r1(x)} ${r1(y)}C${r1(x - w)} ${r1(y - h * 0.3)} ${r1(x - w * 0.35)} ${r1(y - h * 0.6)} ${r1(x)} ${r1(y - h)}Z" fill="url(#${id})" opacity="${r3(a)}"/>`;
};

// ---------------------------------------------------------------------------------------------------
// lanterns

/**
 * A pierced brass lantern (Moroccan): a finial and an onion cap, a bulging body of lit glass behind a
 * pierced metal skin (rows of glowing holes), a pointed foot; (x, y) is the top of the body, s its half-width.
 */
export const piercedLantern = ({
  x,
  y,
  s,
  glass = '#f4c46c',
  metal = '#5e4122',
  hi = '#b88a4a',
  seed = 1,
  halo = 1,
  chain = 0,
}) => {
  const rnd = prng(seed * 313 + 1);
  const bodyH = s * 1.9;
  const body = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    body.push([x - s * (0.78 + 0.28 * Math.sin(Math.PI * t)), y + bodyH * t]);
  }
  const bodyPath = body.concat(body.map(([bx, by]) => [2 * x - bx, by]).reverse());
  const gl = nid('lg');
  const mt = nid('lm');
  let out = '';
  if (halo) {
    out += glow({
      x,
      y: y + bodyH * 0.5,
      rx: s * 9 * halo,
      ry: s * 9 * halo,
      color: glass,
      a: 0.28,
      blend: 'screen',
    });
    out += glow({ x, y: y + bodyH * 0.5, rx: s * 3.2, ry: s * 3.4, color: glass, a: 0.45, blend: 'screen' });
  }
  if (chain)
    out += `<path d="M${r1(x)} ${r1(y - s * 2.1 - chain)}V${r1(y - s * 1.9)}" stroke="${metal}" stroke-width="${r1(Math.max(1.2, s * 0.06))}" opacity=".85"/>`;
  out += `<defs><radialGradient id="${gl}" cx="0.5" cy="0.55" r="0.6">${stopsOf([
    [0, '#fff1cf'],
    [0.5, glass],
    [1, mix(glass, metal, 0.35)],
  ])}</radialGradient>${ugrad(
    mt,
    [
      [0, metal],
      [0.3, hi],
      [0.55, metal],
      [1, mix(metal, '#1c120a', 0.4)],
    ],
    [x - s, 0, x + s, 0],
  )}</defs>`;
  // cap: a finial ring, an onion dome, a collar
  out += `<circle cx="${r1(x)}" cy="${r1(y - s * 1.75)}" r="${r1(s * 0.13)}" fill="none" stroke="${hi}" stroke-width="${r1(s * 0.06)}"/>`;
  out += `<path d="M${r1(x)} ${r1(y - s * 1.62)}C${r1(x + s * 0.2)} ${r1(y - s * 1.2)} ${r1(x + s * 0.95)} ${r1(y - s * 0.75)} ${r1(x + s * 0.72)} ${r1(y - s * 0.12)}L${r1(x - s * 0.72)} ${r1(y - s * 0.12)}C${r1(x - s * 0.95)} ${r1(y - s * 0.75)} ${r1(x - s * 0.2)} ${r1(y - s * 1.2)} ${r1(x)} ${r1(y - s * 1.62)}Z" fill="url(#${mt})"/>`;
  // light escaping through the cap's piercings
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    out += `<circle cx="${r1(x - s * 0.55 + t * s * 1.1)}" cy="${r1(y - s * 0.42 - Math.sin(Math.PI * t) * s * 0.18)}" r="${r1(s * 0.055)}" fill="#ffe7b0" opacity=".85"/>`;
  }
  out += `<rect x="${r1(x - s * 0.82)}" y="${r1(y - s * 0.14)}" width="${r1(s * 1.64)}" height="${r1(s * 0.16)}" rx="${r1(s * 0.05)}" fill="${hi}"/>`;
  // body: lit glass, then the pierced skin
  out += `<path d="${pts(bodyPath)}Z" fill="url(#${gl})"/>`;
  let holes = '';
  const rows = 9;
  for (let j = 0; j < rows; j++) {
    const t = (j + 0.5) / rows;
    const half = s * (0.78 + 0.28 * Math.sin(Math.PI * t));
    const cols = 7;
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5 + (j % 2) * 0.5) / cols - 0.5;
      if (Math.abs(u) > 0.47) continue;
      const px = x + Math.sin(u * Math.PI) * half * 0.95;
      const shrink = Math.cos(u * Math.PI) ** 0.6;
      holes += `<ellipse cx="${r1(px)}" cy="${r1(y + bodyH * t)}" rx="${r1(s * 0.09 * shrink)}" ry="${r1(s * 0.085)}"/>`;
    }
  }
  const mk = nid('lk');
  out += `<defs><mask id="${mk}" maskUnits="userSpaceOnUse" x="${r1(x - s * 2)}" y="${r1(y - s)}" width="${r1(s * 4)}" height="${r1(bodyH + s * 2)}"><rect x="${r1(x - s * 2)}" y="${r1(y - s)}" width="${r1(s * 4)}" height="${r1(bodyH + s * 2)}" fill="#fff"/><g fill="#000">${holes}</g></mask></defs>`;
  out += `<path d="${pts(bodyPath)}Z" fill="url(#${mt})" opacity=".82" mask="url(#${mk})"/>`;
  // ribs and bands
  for (const u of [-0.33, 0, 0.33])
    out += `<path d="${pts(body.map(([bx, by]) => [x + (x - bx) * Math.sin(u * Math.PI) * 0.95, by]))}" fill="none" stroke="${hi}" stroke-width="${r1(s * 0.05)}" opacity=".5"/>`;
  out += `<rect x="${r1(x - s * 0.84)}" y="${r1(y + bodyH - s * 0.08)}" width="${r1(s * 1.68)}" height="${r1(s * 0.14)}" fill="${hi}"/>`;
  out += `<path d="M${r1(x - s * 0.7)} ${r1(y + bodyH + s * 0.05)}L${r1(x + s * 0.7)} ${r1(y + bodyH + s * 0.05)}L${r1(x)} ${r1(y + bodyH + s * 0.75)}Z" fill="url(#${mt})"/>`;
  out += `<circle cx="${r1(x)}" cy="${r1(y + bodyH + s * 0.85)}" r="${r1(s * 0.1)}" fill="${hi}"/>`;
  out += glow({
    x,
    y: y + bodyH * 0.45,
    rx: s * 1.3,
    ry: s * 1.5,
    color: '#ffe3a6',
    a: 0.35 * (0.8 + rnd() * 0.4),
    blend: 'screen',
  });
  return out;
};

/** a glass-paned street lantern: a cap, lit panes in a dark frame, a bracket from above */
export const paneLantern = ({ x, y, s, glass = '#f6cf86', metal = '#3e3326', halo = 1, drop = 0 }) => {
  const g = nid('pl');
  let out = '';
  if (halo) {
    out += glow({ x, y: y + s, rx: s * 8 * halo, ry: s * 8 * halo, color: glass, a: 0.26, blend: 'screen' });
    out += glow({ x, y: y + s, rx: s * 2.6, ry: s * 2.8, color: glass, a: 0.5, blend: 'screen' });
  }
  if (drop)
    out += `<path d="M${r1(x)} ${r1(y - s * 0.9 - drop)}V${r1(y - s * 0.7)}" stroke="${metal}" stroke-width="${r1(Math.max(1.2, s * 0.08))}"/>`;
  out += `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, '#fff0cc'],
    [0.6, glass],
    [1, mix(glass, '#c07a30', 0.4)],
  ])}</linearGradient></defs>`;
  out += `<path d="M${r1(x - s * 0.18)} ${r1(y - s * 0.7)}H${r1(x + s * 0.18)}L${r1(x + s * 0.8)} ${r1(y)}H${r1(x - s * 0.8)}Z" fill="${metal}"/>`;
  out += `<path d="M${r1(x - s * 0.7)} ${r1(y)}H${r1(x + s * 0.7)}L${r1(x + s * 0.5)} ${r1(y + s * 1.9)}H${r1(x - s * 0.5)}Z" fill="url(#${g})"/>`;
  out += `<path d="M${r1(x)} ${r1(y)}V${r1(y + s * 1.9)}M${r1(x - s * 0.7)} ${r1(y)}L${r1(x - s * 0.5)} ${r1(y + s * 1.9)}M${r1(x + s * 0.7)} ${r1(y)}L${r1(x + s * 0.5)} ${r1(y + s * 1.9)}" stroke="${metal}" stroke-width="${r1(Math.max(1, s * 0.09))}" opacity=".85"/>`;
  out += `<path d="M${r1(x - s * 0.6)} ${r1(y + s * 1.9)}H${r1(x + s * 0.6)}L${r1(x + s * 0.2)} ${r1(y + s * 2.3)}H${r1(x - s * 0.2)}Z" fill="${metal}"/>`;
  return out;
};

// ---------------------------------------------------------------------------------------------------
// fabric

/**
 * Folded cloth: `pattern` (full-frame markup: the cloth's colours and weave) takes its folds from a
 * heightmap — a gradient across the folds (periodic, fold widths varying), bent by slow noise — which lights
 * it (diffuse + a soft sheen) and shifts the pattern where the cloth rises, so stripes and motifs follow the
 * folds. `angle` is the direction the folds run (degrees, 0 = right, 90 = down).
 */
export const cloth = ({
  pattern,
  angle = 80,
  period = [120, 260],
  seed = 1,
  bendFreq = 0.0022,
  bend = 180,
  surface = 26,
  az = 225,
  el = 38,
  lightColor = '#fff6e6',
  ambient = 0.28,
  diffuse = 1,
  spec = 0.35,
  specExp = 14,
  zig = 26,
  floor = 0.18,
  clip = '',
  extra = '',
}) => {
  const rnd = prng(seed * 4801 + 9);
  // the gradient runs across the folds, over the frame's diagonal
  const a = ((angle + 90) * Math.PI) / 180;
  const half = Math.hypot(W, H) / 2 + 200;
  const [dx, dy] = [Math.cos(a) * half, Math.sin(a) * half];
  const len = 2 * half;
  const stops = [];
  let pos = 0;
  let ph = rnd() * Math.PI * 2;
  let per = period[0] + rnd() * (period[1] - period[0]);
  let depth = 0.6 + rnd() * 0.4;
  while (pos <= len) {
    const hgt = floor + (1 - floor) * (0.5 + 0.5 * Math.sin(ph) * depth);
    stops.push([
      r3(pos / len),
      `rgb(${Array(3)
        .fill(Math.round(hgt * 255))
        .join(',')})`,
    ]);
    const step = per / 16;
    pos += step;
    const before = Math.floor(ph / (2 * Math.PI));
    ph += (2 * Math.PI) / 16;
    if (Math.floor(ph / (2 * Math.PI)) !== before) {
      per = period[0] + rnd() * (period[1] - period[0]);
      depth = 0.55 + rnd() * 0.45;
    }
  }
  const hg = nid('ch');
  const mk = nid('cm');
  const f = nid('cf');
  return `<defs>${ugrad(hg, stops, [W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy])}
<mask id="${mk}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="${W + 200}" height="${H + 200}"><rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="url(#${hg})"/></mask>
<filter id="${f}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${bendFreq}" numOctaves="2" seed="${seed}" result="t"/>
<feDisplacementMap in="SourceGraphic" in2="t" scale="${bend}" xChannelSelector="R" yChannelSelector="G" result="g"/>
<feGaussianBlur in="g" stdDeviation="2.2" result="gb"/>
<feDiffuseLighting in="gb" surfaceScale="${surface}" diffuseConstant="${diffuse}" lighting-color="${lightColor}" result="L"><feDistantLight azimuth="${az}" elevation="${el}"/></feDiffuseLighting>
<feSpecularLighting in="gb" surfaceScale="${surface}" specularConstant="${spec}" specularExponent="${specExp}" lighting-color="${lightColor}" result="S"><feDistantLight azimuth="${az}" elevation="${el + 12}"/></feSpecularLighting>
<feColorMatrix in="g" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="o"/>
<feColorMatrix in="gb" type="matrix" values="0 0 0 0 0.5  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1" result="dm"/>
<feDisplacementMap in="o" in2="dm" scale="${zig}" xChannelSelector="R" yChannelSelector="G" result="c"/>
<feComposite in="c" in2="L" operator="arithmetic" k1="1" k2="${ambient}" k3="0" k4="0" result="lit"/>
<feComposite in="S" in2="lit" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
</filter></defs><g ${clip ? `clip-path="url(#${clip})"` : ''} ${extra}><g filter="url(#${f})"><g mask="url(#${mk})">${pattern}</g></g></g>`;
};

export { soft };
