// The painting kit of the scroll scenes' placeholder pictures (renderer/scene): the helpers the
// "celestial" pictures were painted with (scripts/make-scene-placeholders.mjs) — seeded randomness,
// colors and gradients, glows, clouds, mist, light rays, foliage, trees, roses, soft blurs — and the
// runner that paints a design's scenes as HTML pages in headless Chromium at 1080×1920, finishes them
// with sharp (a soft halation, a highlight shoulder so white text stays readable, film grain) into WebP,
// and lists them in src/features/invitations/templates/placeholder-media.json.
//
// A design's pictures: scripts/scene-art/<template id>.mjs —
//
//   import { paintScenes, skyFill, glow, cumulus, svgLayer, vignette } from './kit.mjs';
//   const scenes = { 'scene-dawn': { paint: () => [svgLayer(skyFill([...]) + glow({...}))], seed: 1 } };
//   await paintScenes({ id: 'my-design', scenes, background: '#88a4c2' });
//
//   node scripts/scene-art/<id>.mjs [scene …]            the files, and their entries in the list
//   node scripts/scene-art/<id>.mjs --draft <dir> [scene …]  drafts only (the list is left alone)
//
// Everything is seeded: every run gives the same files. Pictures carry white text under a dark
// gradient, so keep them in light-to-mid tones where the texts go (the log prints each file's mean and
// max luma).
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

export const W = 1080;
export const H = 1920;

// ---------------------------------------------------------------------------------------------------
// small helpers

/** A seeded generator (the same pictures on every run). */
export const prng = (s) => {
  let seed = s;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
};
export const gaussOf = (rnd) => () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.87;
export const r1 = (n) => Math.round(n * 10) / 10;
export const r3 = (n) => Math.round(n * 1000) / 1000;
let uid = 0;
/** Ids restart for every picture (the same SVG on every run). */
export const resetIds = () => {
  uid = 0;
};
export const nid = (p) => `${p}${(uid += 1)}`;
export const rgbOf = (c) =>
  c.startsWith('#') ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) : c.match(/\d+/g).map(Number);
/** a color between a and b */
export const mix = (a, b, t) => {
  const [p, q] = [rgbOf(a), rgbOf(b)];
  return `rgb(${p.map((v, k) => Math.round(v + (q[k] - v) * t)).join(',')})`;
};

// ---------------------------------------------------------------------------------------------------
// painting blocks (each returns SVG markup)

export const stopsOf = (stops) =>
  stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
/** a linear gradient, vertical unless a vector is given (objectBoundingBox) */
export const lgrad = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`;
/** the same in page coordinates */
export const ugrad = (id, stops, [x1, y1, x2, y2]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}">${stopsOf(stops)}</linearGradient>`;

/** a full-frame vertical gradient */
export const skyFill = (stops) => {
  const id = nid('sky');
  return `<defs>${lgrad(id, stops)}</defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
};

/** a soft light: a radial gradient with a gaussian falloff */
export const glow = ({ x, y, rx, ry = rx, color, a = 1, blend = 'normal' }) => {
  const id = nid('gl');
  const stops = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    return [r3(t), color, r3(a * Math.exp(-4.2 * t * t) * (1 - t ** 8))];
  });
  return `<defs><radialGradient id="${id}">${stopsOf(stops)}</radialGradient></defs><ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="url(#${id})" style="mix-blend-mode:${blend}"/>`;
};

/**
 * The cloud filter: the group's shapes blurred, then displaced by fractal noise — soft, billowing edges
 * (the classic box-shadow + feTurbulence/feDisplacementMap cloud, in SVG).
 */
export const soft = ({ box, blur, disp, freq, oct = 4, seed = 1, fx = 1 }, inner, attrs = '') => {
  const id = nid('cf');
  const [x0, y0, w, h] = box;
  return `<defs><filter id="${id}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filterUnits="userSpaceOnUse">
<feGaussianBlur in="SourceGraphic" stdDeviation="${r1(blur)}" result="b"/>
<feTurbulence type="fractalNoise" baseFrequency="${r3(freq * fx)} ${r3(freq)}" numOctaves="${oct}" seed="${seed}" result="n"/>
<feDisplacementMap in="b" in2="n" scale="${r1(disp)}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#${id})" ${attrs}>${inner}</g>`;
};

/** three shading gradients for billows: lit top → mid → shaded base, from a palette {top, mid, bot} */
export const billowGrads = ({ top, mid, bot }, dir = [0, 0, 0, 1]) => {
  const ids = [nid('bg'), nid('bg'), nid('bg')];
  const defs =
    lgrad(
      ids[0],
      [
        [0, top],
        [0.3, mix(top, mid, 0.55)],
        [0.6, mid],
        [1, bot],
      ],
      dir,
    ) +
    lgrad(
      ids[1],
      [
        [0, mix(top, mid, 0.35)],
        [0.45, mid],
        [1, bot],
      ],
      dir,
    ) +
    lgrad(
      ids[2],
      [
        [0, top],
        [0.45, mix(top, mid, 0.4)],
        [1, mid],
      ],
      dir,
    );
  return { ids, defs: `<defs>${defs}</defs>` };
};
export const ellipses = (puffs, ids) =>
  puffs
    .map(
      (p) =>
        `<ellipse cx="${r1(p.x)}" cy="${r1(p.y)}" rx="${r1(p.rx)}" ry="${r1(p.ry)}" fill="url(#${ids[p.g ?? 0]})"${p.a !== undefined ? ` fill-opacity="${r3(p.a)}"` : ''}/>`,
    )
    .join('');

/**
 * A sea of clouds seen from above: billows sampled in depth (z from far to near, on screen by perspective
 * below the horizon hz), drawn far to near in bins, each bin softened at its own scale. pal(t) gives the
 * billows' colors at depth t (0 far … 1 near).
 */
export const cloudSea = ({
  hz,
  cam = 1150,
  zFar = 80,
  zNear = 1.35,
  r0 = 170,
  n = 2600,
  bins = 22,
  pal,
  seed = 5,
  dens = 1.6,
  flat = [0.48, 0.3],
  blur = 0.09,
  disp = 0.6,
  x0 = 0,
  x1 = W,
  clip = null,
  from = 0,
  to = 1,
  gaps = [],
}) => {
  const rnd = prng(seed * 7919 + 13);
  const gauss = gaussOf(rnd);
  const all = [];
  for (let k = 0; k < n; k++) {
    const u = rnd();
    const z = zFar * (zNear / zFar) ** u;
    const r = (r0 / z) * Math.exp(gauss() * 0.35) + 3;
    const x = x0 - r + rnd() * (x1 - x0 + 2 * r);
    const y = hz + cam / z + gauss() * r * 0.12;
    // breaks in the cloud: no billows inside a gap, fewer and smaller towards its rim
    const d = Math.min(Infinity, ...gaps.map(([gx, gy, rx, ry]) => Math.hypot((x - gx) / rx, (y - gy) / ry)));
    const keep = rnd();
    if (d < 1 || keep > (d - 1) / 0.35) {
      if (d < 1.35) continue;
    }
    all.push({
      u,
      x,
      y,
      r: d < 1.6 ? r * (0.6 + 0.4 * Math.min(1, (d - 1) / 0.6)) : r,
      g: rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2,
    });
  }
  let out = '';
  for (let b = 0; b < bins; b++) {
    const [lo, hi] = [b / bins, (b + 1) / bins];
    if (lo < from - 1e-9 || hi > to + 1e-9) continue;
    const inBin = all.filter((p) => p.u >= lo && p.u < hi);
    if (!inBin.length) continue;
    const t = (lo + hi) / 2;
    const rMed = inBin.map((p) => p.r).sort((a, c) => a - c)[inBin.length >> 1];
    const keep = inBin.slice(0, Math.round(((x1 - x0) / rMed) * dens) + 2).sort((a, c) => a.y - c.y);
    const { ids, defs } = billowGrads(pal(t));
    const puffs = keep.map((p) => ({
      x: p.x,
      y: p.y,
      rx: p.r * 1.2,
      ry: p.r * (flat[0] + flat[1] * t),
      g: p.g,
    }));
    const ys = keep.map((p) => p.y);
    const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];
    out +=
      defs +
      soft(
        {
          box: [x0 - 300, yMin - rMed * 3, x1 - x0 + 600, yMax - yMin + rMed * 6],
          blur: rMed * blur,
          disp: rMed * disp,
          freq: 2.2 / rMed,
          seed: seed + b,
        },
        ellipses(puffs, ids),
        clip ? `clip-path="url(#${clip})"` : '',
      );
  }
  return out;
};

/**
 * A heap of cumulus: puffs in a dome over a flat base, drawn top to bottom in bands (the lower billows'
 * lit tops against the shaded bases of those above), light from `dir` (a gradient vector).
 */
export const cumulus = ({
  cx,
  base,
  width,
  height,
  n = 40,
  rMin = 0.35,
  rMax = 1,
  size,
  pal,
  seed = 3,
  bands = 4,
  dir,
  blur = 0.1,
  disp = 0.65,
  flatBase = 0.3,
  skew = 0,
  freqK = 2.2,
  oct = 4,
  down = false,
  box,
}) => {
  const rnd = prng(seed * 4099 + 7);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const prof = Math.max(0.06, Math.cos(u * Math.PI * 0.5)) ** 1.2;
    const r = size * (rMin + (rMax - rMin) * rnd()) * (0.55 + 0.45 * prof);
    const y = base - r * flatBase - rnd() ** 0.75 * Math.max(0, height * prof - r);
    puffs.push({ x: cx + u * width * 0.5 + skew * (base - y), y: down ? 2 * base - y : y, r });
  }
  puffs.sort((a, b) => (down ? b.y - a.y : a.y - b.y));
  let out = '';
  const per = Math.ceil(puffs.length / bands);
  for (let b = 0; b < bands; b++) {
    const band = puffs.slice(b * per, (b + 1) * per);
    if (!band.length) continue;
    const t = bands > 1 ? b / (bands - 1) : 1;
    const { ids, defs } = billowGrads(pal(t), dir);
    const rMed = band.map((p) => p.r).sort((a, c) => a - c)[band.length >> 1];
    const ell = band.map((p) => ({
      x: p.x,
      y: p.y,
      rx: p.r * 1.08,
      ry: p.r * 0.86,
      g: rnd() < 0.6 ? 0 : rnd() < 0.5 ? 1 : 2,
    }));
    out +=
      defs +
      soft(
        {
          box:
            box ??
            (down
              ? [cx - width, base - size * 1.5, width * 2, height + size * 3.5]
              : [cx - width, base - height - size * 2, width * 2, height + size * 3.5]),
          blur: rMed * blur,
          disp: rMed * disp,
          freq: freqK / rMed,
          oct,
          seed: seed + b,
        },
        ellipses(ell, ids),
      );
  }
  return out;
};

/** a soft band of mist */
export const mist = ({
  y,
  h,
  x0 = -200,
  x1 = W + 200,
  color,
  a = 0.6,
  seed = 9,
  n = 9,
  blur = 0.35,
  disp = 0.9,
}) => {
  const rnd = prng(seed * 3037 + 5);
  const els = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + rnd() * 0.6) / n) * (x1 - x0);
    els.push(
      `<ellipse cx="${r1(x)}" cy="${r1(y + (rnd() - 0.5) * h * 0.5)}" rx="${r1(((x1 - x0) / n) * (0.9 + rnd() * 0.8))}" ry="${r1(h * (0.35 + rnd() * 0.3))}"/>`,
    );
  }
  return soft(
    {
      box: [x0 - 200, y - h * 2, x1 - x0 + 400, h * 4],
      blur: h * blur,
      disp: h * disp,
      freq: 1.2 / h,
      fx: 0.5,
      seed,
    },
    els.join(''),
    `fill="${color}" opacity="${a}"`,
  );
};

/** thin high wisps (stretched, streaky) */
export const wisps = ({ items, color, a = 0.5, seed = 21 }) => {
  const rnd = prng(seed * 2027 + 3);
  const els = items.map(
    ([x, y, w, h, rot = 0]) =>
      `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" transform="rotate(${rot} ${x} ${y})" opacity="${r3(0.6 + rnd() * 0.4)}"/>`,
  );
  return soft(
    { box: [-300, 0, W + 600, H], blur: 14, disp: 120, freq: 0.012, fx: 0.25, oct: 5, seed },
    els.join(''),
    `fill="${color}" opacity="${a}"`,
  );
};

/** a soft vignette, like a lens (a navy-grey, never black) */
export const vignette = (a = 0.35, color = '#27324a', cy = 0.48) => {
  const id = nid('vg');
  return `<defs><radialGradient id="${id}" cx="0.5" cy="${cy}" r="0.75" gradientTransform="translate(0.5 ${cy}) scale(1.35 1) translate(-0.5 -${cy})">${stopsOf(
    [
      [0.45, color, 0],
      [0.8, color, r3(a * 0.55)],
      [1, color, a],
    ],
  )}</radialGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
};

/** soft shafts of light fanning out from (x, y) between the angles a0…a1 (degrees, 0 = right, 90 = down) */
export const rays = ({
  x,
  y,
  n = 18,
  len = 1200,
  a0,
  a1,
  w = [1.5, 5],
  color,
  a = 0.3,
  seed = 5,
  blur = 10,
  blend = 'screen',
}) => {
  const rnd = prng(seed * 1597 + 11);
  const g = nid('ry');
  const f = nid('rf');
  let polys = '';
  for (let i = 0; i < n; i++) {
    const ang = ((a0 + (a1 - a0) * ((i + 0.2 + rnd() * 0.6) / n)) * Math.PI) / 180;
    const half = ((w[0] + rnd() * (w[1] - w[0])) * Math.PI) / 360;
    const l = len * (0.6 + rnd() * 0.4);
    const p1 = [x + l * Math.cos(ang - half), y + l * Math.sin(ang - half)];
    const p2 = [x + l * Math.cos(ang + half), y + l * Math.sin(ang + half)];
    polys += `<path d="${pts([[x, y], p1, p2])}Z" opacity="${r3(0.35 + rnd() * 0.65)}"/>`;
  }
  return `<defs><radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="${len}">${stopsOf(
    [
      [0, color, a],
      [0.25, color, r3(a * 0.7)],
      [0.6, color, r3(a * 0.25)],
      [1, color, 0],
    ],
  )}</radialGradient><filter id="${f}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g fill="url(#${g})" filter="url(#${f})" style="mix-blend-mode:${blend}">${polys}</g>`;
};

// ---------------------------------------------------------------------------------------------------
// geometry: polylines, rings, arcs, cubic curves, volutes and scrolls

export const pts = (list) => `M${list.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;
export const line = (a, b) => pts([a, b]);
export const ring = (cx, cy, r) =>
  `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
export const arcPts = (cx, cy, r, a0, a1, n = 64) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
export const bezPts = (p0, c1, c2, p1, n = 28) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [0, 1].map(
      (k) => u * u * u * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p1[k],
    );
  });
/** a volute: a log spiral continuing from p along the heading `ang`, turning clockwise (dir 1) or not */
export const curl = (p, ang, dir, r0, turns = 1.15, shrink = 0.42) => {
  const toC = ang + (dir * Math.PI) / 2;
  const c = [p[0] + r0 * Math.cos(toC), p[1] + r0 * Math.sin(toC)];
  const phi0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
  const lam = Math.log(1 / shrink) / (2 * Math.PI);
  const steps = Math.ceil(turns * 56);
  return Array.from({ length: steps }, (_, i) => {
    const s = ((i + 1) / steps) * turns * 2 * Math.PI;
    const r = r0 * Math.exp(-lam * s);
    return [c[0] + r * Math.cos(phi0 + dir * s), c[1] + r * Math.sin(phi0 + dir * s)];
  });
};
export const heading = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
/** a scroll: a spine (cubic) with a volute at its end (e) and/or its start (s) */
export const scroll = (p0, c1, c2, p1, e, s) => {
  let list = bezPts(p0, c1, c2, p1);
  if (e) list = list.concat(curl(p1, heading(c2, p1), e.dir, e.r, e.turns, e.shrink));
  if (s) list = curl(p0, heading(c1, p0), s.dir, s.r, s.turns, s.shrink).reverse().concat(list);
  return pts(list);
};

/** stone grain and softness over a group (a light, even texture) */
export const stoneFilter = () => {
  const id = nid('sf');
  return {
    id,
    defs: `<defs><filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">
<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="17" result="n"/>
<feColorMatrix in="n" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="g"/>
<feComposite in="SourceGraphic" in2="g" operator="arithmetic" k1="0.24" k2="0.88" result="t"/>
<feComposite in="t" in2="SourceAlpha" operator="in" result="c"/>
<feGaussianBlur in="c" stdDeviation="0.7"/></filter></defs>`,
  };
};

/** a softening blur for drawn things (photographic, not line art) */
export const blurFilter = (s) => {
  const id = nid('bf');
  return {
    id,
    defs: `<defs><filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${s}"/></filter></defs>`,
  };
};

export const svgLayer = (inner, style = '') =>
  `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;${style}">${inner}</svg>`;

/**
 * Foliage: a crown's silhouette (lobes = ellipses), its edge broken into clumps and leaves by displacement
 * at two scales, shaded as a whole (lit side → shade side) and textured by lit fractal noise at the scale
 * of the leaf clusters, like foliage in soft focus.
 */
export const foliage = ({
  lobes,
  pal,
  light = [0.15, 0.05, 0.85, 0.95],
  seed = 1,
  grain = 0.045,
  edge = 12,
  clump = 0,
  tex = 0.5,
  relief = 5,
  soften = 0.6,
  box,
  attrs = '',
}) => {
  const xs = lobes.flatMap(([x, , rx]) => [x - rx, x + rx]);
  const ys = lobes.flatMap(([, y, , ry]) => [y - ry, y + ry]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const g = nid('fg');
  const f = nid('ff');
  const b = box ?? [x0 - 80, y0 - 80, x1 - x0 + 160, y1 - y0 + 160];
  const [lx1, ly1, lx2, ly2] = light;
  const coarse = clump
    ? `<feTurbulence type="fractalNoise" baseFrequency="${r3(grain / 3.5)}" numOctaves="3" seed="${seed + 11}" result="nc"/><feDisplacementMap in="SourceGraphic" in2="nc" scale="${clump}" xChannelSelector="R" yChannelSelector="G" result="src"/>`
    : '<feOffset in="SourceGraphic" result="src"/>';
  return `<defs>${ugrad(
    g,
    [
      [0, pal.lit],
      [0.45, pal.mid],
      [1, pal.shade],
    ],
    [x0 + (x1 - x0) * lx1, y0 + (y1 - y0) * ly1, x0 + (x1 - x0) * lx2, y0 + (y1 - y0) * ly2],
  )}
<filter id="${f}" x="${r1(b[0])}" y="${r1(b[1])}" width="${r1(b[2])}" height="${r1(b[3])}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
${coarse}<feTurbulence type="fractalNoise" baseFrequency="${r3(grain)}" numOctaves="3" seed="${seed}" result="n"/>
<feDisplacementMap in="src" in2="n" scale="${edge}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
<feTurbulence type="fractalNoise" baseFrequency="${r3(grain * 0.7)}" numOctaves="4" seed="${seed + 5}" result="n2"/>
<feDiffuseLighting in="n2" surfaceScale="${relief}" diffuseConstant="1" lighting-color="#fff" result="L"><feDistantLight azimuth="225" elevation="42"/></feDiffuseLighting>
<feComponentTransfer in="L" result="T"><feFuncR type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/><feFuncG type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/><feFuncB type="linear" slope="${tex}" intercept="${r3(1 - tex * 0.55)}"/></feComponentTransfer>
<feBlend in="shape" in2="T" mode="multiply" result="m"/>
<feComposite in="m" in2="shape" operator="in" result="c"/>
<feGaussianBlur in="c" stdDeviation="${soften}"/></filter></defs>
<g filter="url(#${f})" fill="url(#${g})" ${attrs}>${lobes.map(([x, y, rx, ry]) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`).join('')}</g>`;
};

/** lobes for a round crown centred (x, y), w × h */
export const crown = (rnd, x, y, w, h, n = 9) => {
  const out = [[x, y, w * 0.36, h * 0.36]];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 0.3 + rnd() * 0.3;
    const r = 0.2 + rnd() * 0.16;
    out.push([
      x + Math.cos(a) * d * w * 0.5,
      y + Math.sin(a) * d * h * 0.5,
      r * w,
      r * h * (0.85 + rnd() * 0.3),
    ]);
  }
  return out;
};

/** lobes for a cypress: a tall flame */
export const flame = (rnd, x, top, base, w) => {
  const out = [];
  const n = Math.ceil((base - top) / (w * 0.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ww = w * 0.5 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7;
    out.push([x + (rnd() - 0.5) * w * 0.12, top + (base - top) * t, ww * (0.9 + rnd() * 0.2), w * 0.34]);
  }
  return out;
};

/**
 * A tree in soft focus: leafy clumps packed into its crown (an ellipse, or a flame for a cypress), each lit
 * from the upper left, drawn from the crown's edge to its front in bands that grow lighter, their edges
 * frayed into leaves by fine displacement; `haze` fades it into the air.
 */
export const tree = ({
  cx,
  cy,
  w,
  h,
  n = 60,
  pal,
  haze = 0,
  hazeColor = '#c9cfcd',
  seed = 1,
  shape = 'round',
  leaf = 0.05,
  bands = 3,
  dir = [0.3, 0, 0.7, 1],
  clump = 1,
  fray = 0.07,
}) => {
  const rnd = prng(seed * 6151 + 3);
  const clumps = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    let [x, y] = [Math.cos(a) * d * 0.46, Math.sin(a) * d * 0.46];
    if (shape === 'flame') {
      const t = rnd();
      y = t - 0.5;
      x = (rnd() - 0.5) * 0.9 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95)) ** 0.8;
    }
    const size = clump * ((shape === 'flame' ? 0.15 : 0.1) + rnd() * (shape === 'flame' ? 0.09 : 0.08));
    clumps.push({
      x: cx + x * w,
      y: cy + y * h,
      rx: size * w,
      ry: size * w * 0.82,
      depth: -Math.hypot(x, shape === 'flame' ? 0 : y),
    });
  }
  clumps.sort((a, b) => a.depth - b.depth);
  let out = '';
  for (let b = 0; b < bands; b++) {
    const part = clumps.slice(Math.floor((b * n) / bands), Math.floor(((b + 1) * n) / bands));
    const k = bands > 1 ? b / (bands - 1) : 1;
    const shade = (c) => mix(c, hazeColor, haze);
    const { ids, defs } = billowGrads(
      {
        top: shade(mix(pal.lit, pal.front ?? pal.lit, k)),
        mid: shade(mix(pal.mid, pal.midFront ?? pal.mid, k)),
        bot: shade(pal.shade),
      },
      dir,
    );
    out +=
      defs +
      soft(
        {
          box: [cx - w, cy - h, w * 2, h * 2],
          blur: Math.max(0.6, w * 0.012),
          disp: Math.max(w, h * 0.3) * fray,
          freq: leaf,
          oct: 4,
          seed: seed + b,
        },
        ellipses(
          part.map((p) => ({ ...p, g: Math.floor(rnd() * 3) })),
          ids,
        ),
      );
  }
  return out;
};

/** a petal seen from above: an arc at radius R, its inner edge bowed towards the heart by th */
export const crescentPts = (R, a0, span, th, n = 14) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = a0 + (span * k) / n;
    const rr = R - th * Math.sin((Math.PI * k) / n);
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });
export const arcOf = (R, a0, span, n = 14) => crescentPts(R, a0, span, 0, n);

/** a garden rose from above: a spiral of cupped petals (body, lit rim, shadow line) round a darker heart */
export const rose = (rnd, x, y, r, t, rot, squash, gradId) => {
  let out = `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(1 ${r3(squash)})"><circle r="${r1(r * 0.97)}" fill="url(#${gradId})"/>`;
  const N = r > 30 ? 12 : 9;
  for (let i = 0; i < N; i++) {
    const k = i / N;
    const R = r * (1 - k * 0.82);
    const a0 = i * 2.39996 + rnd() * 0.3;
    const span = 2.3 - k * 0.6 + rnd() * 0.5;
    const th = R * (0.32 + 0.1 * rnd());
    out += `<path d="${pts(arcOf(R, a0, span).concat(crescentPts(R, a0, span, th).reverse()))}Z" fill="${t.base}" opacity=".96"/>`;
    out += `<path d="${pts(arcOf(R, a0 + 0.08, span - 0.16).concat(crescentPts(R, a0 + 0.08, span - 0.16, th * 0.35).reverse()))}Z" fill="${t.light}" opacity=".85"/>`;
    out += `<path d="${pts(crescentPts(R, a0, span, th))}" fill="none" stroke="${t.deep}" stroke-width="${r1(Math.max(1, r * 0.035))}" opacity=".5" stroke-linecap="round"/>`;
  }
  return `${out}<circle r="${r1(r * 0.1)}" fill="${t.heart}" opacity=".75"/></g>`;
};

/** eucalyptus: a curving stem with pairs of round grey-green leaves, smaller towards its tip */
export const eucalyptus = (rnd, x, y, ang, len, bend, tones) => {
  const [dx, dy] = [Math.cos(ang), Math.sin(ang)];
  const [nx, ny] = [-dy, dx];
  const p = (t) => {
    const b = Math.sin(Math.PI * t) * bend;
    return [x + dx * len * t + nx * b, y + dy * len * t + ny * b];
  };
  let out = `<path d="${pts(Array.from({ length: 13 }, (_, i) => p(i / 12)))}" fill="none" stroke="#7b8a78" stroke-width="2" opacity=".8"/>`;
  const n = Math.max(3, Math.round(len / 26));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.4);
    const [px, py] = p(t);
    const r = (14 - t * 7) * (0.85 + rnd() * 0.3);
    for (const side of [-1, 1]) {
      const [lx, ly] = [px + nx * side * r * 0.9, py + ny * side * r * 0.9];
      out += `<ellipse cx="${r1(lx)}" cy="${r1(ly)}" rx="${r1(r)}" ry="${r1(r * 0.86)}" fill="${tones[Math.floor(rnd() * tones.length)]}"/>`;
      out += `<ellipse cx="${r1(lx - r * 0.2)}" cy="${r1(ly - r * 0.25)}" rx="${r1(r * 0.55)}" ry="${r1(r * 0.4)}" fill="#c3cdbf" opacity=".35"/>`;
    }
  }
  return out;
};

// finishing: a soft halation (the light blooms into its surroundings), a highlight shoulder (nothing
// brighter than ~0.85 luma, for the white text), film grain; then WebP

export const finish = async (
  png,
  { seed, bloom = 0.32, sigma = 26, gamma = 1, knee = 0.66, max = 0.855, grain = 3.2, quality = 84 },
) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const halo = await sharp(png).removeAlpha().blur(sigma).raw().toBuffer();
  const rnd = prng(seed);
  const out = Buffer.alloc(data.length);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 3) {
    let [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    r += Math.max(0, halo[i] - r) * bloom;
    g += Math.max(0, halo[i + 1] - g) * bloom;
    b += Math.max(0, halo[i + 2] - b) * bloom;
    let y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (gamma !== 1 && y > 0) {
      const k = y ** gamma / y;
      [r, g, b] = [r * k, g * k, b * k];
      y *= k;
    }
    if (y > knee) {
      const k = (knee + (max - knee) * (1 - Math.exp(-(y - knee) / (max - knee)))) / y;
      [r, g, b] = [r * k, g * k, b * k];
    }
    const n = (rnd() + rnd() + rnd() - 1.5) * grain * 2;
    out[i] = Math.max(0, Math.min(255, Math.round(r + n)));
    out[i + 1] = Math.max(0, Math.min(255, Math.round(g + n)));
    out[i + 2] = Math.max(0, Math.min(255, Math.round(b + n)));
    const yy = (0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]) / 255;
    sum += yy;
    if (yy > peak) peak = yy;
  }
  const webp = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality, effort: 6 })
    .toBuffer();
  return { webp, mean: sum / (data.length / 3), peak };
};

// ---------------------------------------------------------------------------------------------------
// the runner

const LIST = 'src/features/invitations/templates/placeholder-media.json';

/** The list is shared by every design's script: one writer at a time. */
const withLock = async (fn) => {
  const lock = `${LIST}.lock`;
  for (let i = 0; ; i++) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch {
      if (i > 600) throw new Error(`${lock} is held — remove it if no script is running`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  try {
    return fn();
  } finally {
    unlinkSync(lock);
  }
};

/**
 * Paints a design's scenes: `scenes` maps each picture's name (scene-*) to `{ paint, seed, post }` —
 * `paint()` returns the page's layers (HTML, bottom to top; svgLayer(...) for SVG), `seed` seeds the
 * grain, `post` tunes the finish (bloom, gamma, max, grain, quality). Writes public/templates/<id>/<name>.webp
 * and the design's entries in placeholder-media.json (or, with `--draft <dir>`, only the files, there).
 */
export async function paintScenes({ id, scenes, background = '#000', args = process.argv.slice(2) }) {
  const at = args.indexOf('--draft');
  const draft = at > -1 ? args[at + 1] : null;
  const names = args
    .filter((a, i) => a !== '--draft' && !(at > -1 && i === at + 1))
    .map((n) => (n.startsWith('scene-') ? n : `scene-${n}`));
  const unknown = names.filter((n) => !scenes[n]);
  if (unknown.length)
    throw new Error(`unknown scene(s): ${unknown.join(', ')} — one of ${Object.keys(scenes).join(', ')}`);
  const todo = names.length ? names : Object.keys(scenes);
  const dir = draft ?? `public/templates/${id}`;
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  tab.setDefaultTimeout(300_000);
  const written = {};
  try {
    for (const name of todo) {
      resetIds();
      const { paint, seed = 1, post = {} } = scenes[name];
      await tab.setContent(page(paint(), background), { waitUntil: 'load' });
      const png = await tab.screenshot({ type: 'png' });
      const { webp, mean, peak } = await finish(png, { seed, ...post });
      const file = `${name}.webp`;
      writeFileSync(`${dir}/${file}`, webp);
      written[file] = { hash: createHash('md5').update(webp).digest('hex').slice(0, 10), bytes: webp.length };
      console.log(
        `${dir}/${file}  ${Math.round(webp.length / 1024)} KB  luma mean ${mean.toFixed(2)} max ${peak.toFixed(2)}`,
      );
    }
  } finally {
    await browser.close();
  }
  if (draft) return;
  await withLock(() => {
    const list = JSON.parse(readFileSync(LIST, 'utf8'));
    const listed = { ...(list.templates[id] ?? {}), ...written };
    // the entries in the scenes' order
    list.templates[id] = Object.fromEntries(
      Object.keys(scenes)
        .map((n) => `${n}.webp`)
        .filter((f) => listed[f])
        .map((f) => [f, listed[f]]),
    );
    writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`);
  });
}

const page = (layers, background) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${background}}</style></head><body>${layers.join('')}</body></html>`;
