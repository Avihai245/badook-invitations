// Placeholder backgrounds for the "celestial" design (שער השמיים), until the owner's real pictures are in
// the template-media bucket: eight full-screen 9:16 scenes of one continuous journey — a closed gate in the
// sky, the gate open with light pouring through, up into the clouds, above them, down through them, the
// venue emerging below, the ceremony's floral arch, the evening sky — in one palette (sky blue, white,
// cream, a touch of champagne gold), so the invitation's scroll-driven cross-fades read as one film.
// Painted as HTML pages (CSS + inline SVG: clouds from blurred shapes displaced by fractal noise, skies as
// gradients, the architecture drawn and softened by haze), screenshotted by headless Chromium at 1080×1920
// and finished with sharp (a soft halation, a highlight shoulder, film grain) into WebP. Everything is
// seeded, so every run gives the same files.
//
// They carry white text under a navy scrim, so they stay in light mid-tones: the highlights roll off below
// ~0.85 luma and the average sits around 0.45–0.6 (the log prints both for each file).
//
// Written to public/templates/celestial/<file> (shipped with the app — MASTER_PROMPT §1.1: public/templates
// keeps only placeholders) and listed with a content hash in src/features/invitations/templates/
// placeholder-media.json, which the renderer reads (renderer/assets.ts): a file the bucket has always wins
// over its placeholder.
//
// Usage: node scripts/make-scene-placeholders.mjs [scene …]   (default: all eight; e.g. `gate dusk`)
// The files are committed; re-run only to change them. Swapping in the real pictures: upload them to the
// bucket (docs/template-media.md) under the same names, then `npm run media:sync` and deploy.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const ID = 'celestial';
const DIR = `public/templates/${ID}`;
const LIST = 'src/features/invitations/templates/placeholder-media.json';
const W = 1080;
const H = 1920;

/** The one palette of the journey. */
const C = {
  zenith: '#4b6c98',
  high: '#6485ad',
  sky: '#88a4c2',
  low: '#abbdce',
  horizon: '#cdcac2',
  cream: '#e4d8c3',
  ivory: '#e6dfd2',
  champagne: '#d6bf95',
  gold: '#c3a878',
  goldDeep: '#98815a',
  cloudTop: '#e2d5c0',
  cloudMid: '#b3b9c5',
  cloudBase: '#8190a7',
  haze: '#c7cacd',
  shade: '#6b788f',
};

// ---------------------------------------------------------------------------------------------------
// small helpers

/** A seeded generator (the same pictures on every run). */
const prng = (s) => {
  let seed = s;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
};
const gaussOf = (rnd) => () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.87;
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
let uid = 0;
const nid = (p) => `${p}${(uid += 1)}`;
const rgbOf = (c) =>
  c.startsWith('#') ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) : c.match(/\d+/g).map(Number);
/** a color between a and b */
const mix = (a, b, t) => {
  const [p, q] = [rgbOf(a), rgbOf(b)];
  return `rgb(${p.map((v, k) => Math.round(v + (q[k] - v) * t)).join(',')})`;
};

// ---------------------------------------------------------------------------------------------------
// painting blocks (each returns SVG markup)

const stopsOf = (stops) =>
  stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
/** a linear gradient, vertical unless a vector is given (objectBoundingBox) */
const lgrad = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`;
/** the same in page coordinates */
const ugrad = (id, stops, [x1, y1, x2, y2]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}">${stopsOf(stops)}</linearGradient>`;

/** a full-frame vertical gradient */
const skyFill = (stops) => {
  const id = nid('sky');
  return `<defs>${lgrad(id, stops)}</defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
};

/** a soft light: a radial gradient with a gaussian falloff */
const glow = ({ x, y, rx, ry = rx, color, a = 1, blend = 'normal' }) => {
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
const soft = ({ box, blur, disp, freq, oct = 4, seed = 1, fx = 1 }, inner, attrs = '') => {
  const id = nid('cf');
  const [x0, y0, w, h] = box;
  return `<defs><filter id="${id}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filterUnits="userSpaceOnUse">
<feGaussianBlur in="SourceGraphic" stdDeviation="${r1(blur)}" result="b"/>
<feTurbulence type="fractalNoise" baseFrequency="${r3(freq * fx)} ${r3(freq)}" numOctaves="${oct}" seed="${seed}" result="n"/>
<feDisplacementMap in="b" in2="n" scale="${r1(disp)}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#${id})" ${attrs}>${inner}</g>`;
};

/** three shading gradients for billows: lit top → mid → shaded base, from a palette {top, mid, bot} */
const billowGrads = ({ top, mid, bot }, dir = [0, 0, 0, 1]) => {
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
const ellipses = (puffs, ids) =>
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
const cloudSea = ({
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
const cumulus = ({
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
const mist = ({
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
const wisps = ({ items, color, a = 0.5, seed = 21 }) => {
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
const vignette = (a = 0.35, color = '#27324a', cy = 0.48) => {
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
const rays = ({
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
// the gate: two cream stone pillars, two ivory wrought-iron leaves, a sunburst fanlight under an arch
// and a crest; the ironwork as centre lines (bars, scrolls, fine work), drawn as round bars in three
// strokes — shade side, body, highlight — then softened.

const GATE = {
  cx: 540,
  pl: 208,
  pr: 872,
  hingeL: 268,
  hingeR: 812,
  bottom: 1446,
  spring: 806,
  rOut: 272,
  rIn: 224,
};

const pts = (list) => `M${list.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;
const line = (a, b) => pts([a, b]);
const ring = (cx, cy, r) =>
  `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
const arcPts = (cx, cy, r, a0, a1, n = 64) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
const bezPts = (p0, c1, c2, p1, n = 28) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [0, 1].map(
      (k) => u * u * u * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p1[k],
    );
  });
/** a volute: a log spiral continuing from p along the heading `ang`, turning clockwise (dir 1) or not */
const curl = (p, ang, dir, r0, turns = 1.15, shrink = 0.42) => {
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
const heading = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
/** a scroll: a spine (cubic) with a volute at its end (e) and/or its start (s) */
const scroll = (p0, c1, c2, p1, e, s) => {
  let list = bezPts(p0, c1, c2, p1);
  if (e) list = list.concat(curl(p1, heading(c2, p1), e.dir, e.r, e.turns, e.shrink));
  if (s) list = curl(p0, heading(c1, p0), s.dir, s.r, s.turns, s.shrink).reverse().concat(list);
  return pts(list);
};

/** the left leaf's ironwork (the right one is its mirror) */
const leafWork = () => {
  const { hingeL: X0, cx, bottom: YB } = GATE;
  const X1 = cx - 4;
  const top = (x) => 846 + (1000 - Math.sqrt(1000 ** 2 - (x - cx) ** 2));
  const bars = [
    line([X0, top(X0) - 4], [X0, YB]),
    line([X1, top(X1) - 2], [X1, YB]),
    line([X0, YB], [X1, YB]),
    line([X0, YB - 84], [X1, YB - 84]),
    line([X0, 1172], [X1, 1172]),
    line([X0, 1134], [X1, 1134]),
    pts(Array.from({ length: 33 }, (_, i) => [X0 + ((X1 - X0) * i) / 32, top(X0 + ((X1 - X0) * i) / 32)])),
  ];
  const fine = [];
  const gold = [];
  const n = 8;
  for (let i = 1; i <= n; i++) {
    const x = X0 + ((X1 - X0) * i) / (n + 1);
    fine.push(line([x, top(x)], [x, YB]));
    gold.push({ x, y: top(x) - 11, r: 6.5 });
  }
  gold.push({ x: X0, y: top(X0) - 14, r: 8 });
  for (let x = X0 + 16.5; x < X1 - 8; x += 33.2) {
    fine.push(ring(x, YB - 42, 13.5));
    fine.push(ring(x, 1153, 10.5));
  }
  const m = (X0 + X1) / 2;
  const scrolls = [
    // the lyre: two C-scrolls rising from the collar, curling inwards at the top
    scroll([m, 1128], [m - 74, 1112], [m - 112, 1030], [m - 72, 968], { dir: 1, r: 25, turns: 1.3 }),
    scroll([m, 1128], [m + 74, 1112], [m + 112, 1030], [m + 72, 968], { dir: -1, r: 25, turns: 1.3 }),
    scroll([m, 1128], [m - 8, 1104], [m - 30, 1090], [m - 42, 1097], { dir: -1, r: 9, turns: 1.15 }),
    scroll([m, 1128], [m + 8, 1104], [m + 30, 1090], [m + 42, 1097], { dir: 1, r: 9, turns: 1.15 }),
    // the lower panel: a pair of long S-scrolls meeting under the collar
    scroll(
      [X0 + 22, 1350],
      [X0 + 92, 1340],
      [m - 22, 1262],
      [m, 1206],
      { dir: 1, r: 17, turns: 1.2 },
      { dir: 1, r: 14 },
    ),
    scroll(
      [X1 - 22, 1350],
      [X1 - 92, 1340],
      [m + 22, 1262],
      [m, 1206],
      { dir: -1, r: 17, turns: 1.2 },
      { dir: -1, r: 14 },
    ),
  ];
  return { bars, scrolls, fine, gold };
};

/** the fixed ironwork above the leaves: transom, sunburst fanlight, the arch's band of rings, the crest */
const overthrowWork = () => {
  const { cx, spring: S, rOut, rIn, hingeL, hingeR } = GATE;
  const rMid = (rOut + rIn) / 2;
  const bars = [
    line([hingeL, S], [hingeR, S]),
    pts(arcPts(cx, S, rOut, Math.PI, 2 * Math.PI)),
    pts(arcPts(cx, S, rIn, Math.PI, 2 * Math.PI)),
  ];
  const fine = [pts(arcPts(cx, S, 150, Math.PI, 2 * Math.PI, 48))];
  const nRays = 14;
  for (let i = 1; i < nRays; i++) {
    const a = Math.PI + (Math.PI * i) / nRays;
    fine.push(
      line([cx + 58 * Math.cos(a), S + 58 * Math.sin(a)], [cx + rIn * Math.cos(a), S + rIn * Math.sin(a)]),
    );
  }
  const nRings = 24;
  for (let i = 0; i < nRings; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5)) / nRings;
    fine.push(ring(cx + rMid * Math.cos(a), S + rMid * Math.sin(a), 15));
  }
  // between the rays, small rings on the middle arc
  for (let i = 0; i < nRays; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5)) / nRays;
    fine.push(ring(cx + 150 * Math.cos(a), S + 150 * Math.sin(a), 8));
  }
  const top = S - rOut;
  const scrolls = [
    // the crest: two C-scrolls lying on the arch, their volutes turned up; a pair of small ones under the star
    scroll([cx - 8, top - 4], [cx - 60, top - 40], [cx - 150, top - 26], [cx - 176, top + 14], {
      dir: 1,
      r: 20,
      turns: 1.25,
    }),
    scroll([cx + 8, top - 4], [cx + 60, top - 40], [cx + 150, top - 26], [cx + 176, top + 14], {
      dir: -1,
      r: 20,
      turns: 1.25,
    }),
    scroll([cx, top - 6], [cx - 4, top - 30], [cx - 26, top - 44], [cx - 40, top - 36], { dir: -1, r: 10 }),
    scroll([cx, top - 6], [cx + 4, top - 30], [cx + 26, top - 44], [cx + 40, top - 36], { dir: 1, r: 10 }),
    // the spandrels: scrolls climbing from the pillars' tops along the arch
    scroll([hingeL + 2, S - 30], [hingeL + 6, S - 120], [hingeL + 40, S - 190], [hingeL + 70, S - 214], {
      dir: 1,
      r: 18,
      turns: 1.2,
    }),
    scroll([hingeR - 2, S - 30], [hingeR - 6, S - 120], [hingeR - 40, S - 190], [hingeR - 70, S - 214], {
      dir: -1,
      r: 18,
      turns: 1.2,
    }),
  ];
  const gold = [{ x: cx, y: top - 58, r: 11, star: 22 }];
  return { bars, scrolls, fine, gold, hub: { x: cx, y: S, r: 58 } };
};

/** stroke the ironwork: a soft ambient shadow, the shade side, the ivory body, a highlight — a round bar */
const ironInk = (work, { mirror = false, lightY = [520, 1460], shadow = 1 } = {}) => {
  const grad = nid('ig');
  const amb = nid('ia');
  const defs = `<defs>${ugrad(
    grad,
    [
      [0, '#f0e9dd'],
      [0.5, C.ivory],
      [1, mix(C.ivory, C.haze, 0.6)],
    ],
    [0, lightY[0], 0, lightY[1]],
  )}<filter id="${amb}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
  const all = (w) => [
    ...work.bars.map((d) => [d, w + 3]),
    ...work.scrolls.map((d) => [d, w + 0.5]),
    ...work.fine.map((d) => [d, w - 1]),
  ];
  const layer = (color, dx, dy, dw, op, extra = '') => {
    const paths = all(6.5)
      .map(([d, sw]) => `<path d="${d}" stroke-width="${r1(Math.max(1.2, sw + dw))}"/>`)
      .join('');
    const inner = mirror ? `<g transform="translate(${2 * GATE.cx} 0) scale(-1 1)">${paths}</g>` : paths;
    return `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}" transform="translate(${dx} ${dy})" ${extra}>${inner}</g>`;
  };
  return (
    defs +
    layer('#46526b', 2.4, 3.4, 3, 0.2 * shadow, `filter="url(#${amb})"`) +
    layer('#5d6980', 1.3, 1.8, 1.6, 0.55) +
    layer(`url(#${grad})`, 0, 0, 0, 1) +
    layer('#fbf6ec', -0.8, -1, -4.6, 0.8)
  );
};

/** champagne-gold details: ball finials, the fanlight's hub, the crest's star */
const goldInk = (work, { mirror = false } = {}) => {
  const g = nid('au');
  const defs = `<defs><radialGradient id="${g}" cx="0.36" cy="0.32" r="0.75">${stopsOf([
    [0, '#f1e3c4'],
    [0.35, C.champagne],
    [0.8, C.gold],
    [1, C.goldDeep],
  ])}</radialGradient></defs>`;
  const mx = (x) => (mirror ? 2 * GATE.cx - x : x);
  let out = defs;
  for (const b of work.gold) {
    if (b.star) {
      const star = Array.from({ length: 16 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 8;
        const r = i % 2 ? b.star * 0.42 : i % 4 ? b.star * 0.8 : b.star;
        return [mx(b.x) + r * Math.cos(a), b.y + r * Math.sin(a)];
      });
      out += `<path d="${pts(star)}Z" fill="url(#${g})"/><circle cx="${mx(b.x)}" cy="${b.y}" r="${b.r * 0.55}" fill="#efe0c0"/>`;
    } else out += `<circle cx="${r1(mx(b.x))}" cy="${r1(b.y)}" r="${b.r}" fill="url(#${g})"/>`;
  }
  if (work.hub) {
    const { x, y, r } = work.hub;
    const rays = Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI + (Math.PI * (i + 0.5)) / 9;
      return line(
        [x + r * 0.42 * Math.cos(a), y + r * 0.42 * Math.sin(a)],
        [x + r * 0.86 * Math.cos(a), y + r * 0.86 * Math.sin(a)],
      );
    }).join('');
    out += `<path d="M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}Z" fill="url(#${g})"/><path d="${rays}" stroke="#f2e6cc" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M${x - r * 0.3} ${y}A${r * 0.3} ${r * 0.3} 0 0 1 ${x + r * 0.3} ${y}Z" fill="#efe0c0"/>`;
  }
  return out;
};

/** the centre medallion across the two leaves: a gilded ring with a small sunburst */
const medallion = (half) => {
  const { cx } = GATE;
  const cy = 1030;
  const g = nid('md');
  const clip = half
    ? `<clipPath id="${g}c"><rect x="${half === 'left' ? 0 : cx}" y="0" width="${cx}" height="${H}"/></clipPath>`
    : '';
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 34 : 44;
    return line([cx + 13 * Math.cos(a), cy + 13 * Math.sin(a)], [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }).join('');
  return `<defs>${clip}</defs><g ${half ? `clip-path="url(#${g}c)"` : ''}>
<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${C.goldDeep}" stroke-width="9" opacity=".45" transform="translate(1.3 1.8)"/>
<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${C.champagne}" stroke-width="7"/>
<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="#f0e2c4" stroke-width="2" opacity=".7" transform="translate(-.7 -.9)"/>
<path d="${rays}" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy}" r="12" fill="${C.champagne}"/></g>`;
};

/** a cream stone pillar with a ball finial, lit from the front right */
const pillar = (pc) => {
  const g = nid('st');
  const face = ugrad(
    g,
    [
      [0, '#9aa0ab'],
      [0.1, '#c9c0b0'],
      [0.48, '#e0d5c1'],
      [0.86, '#d9cebb'],
      [1, '#bdb6ab'],
    ],
    [pc - 74, 0, pc + 74, 0],
  );
  const ball = nid('bl');
  const drop = nid('dr');
  const block = (x0, x1, y0, y1) =>
    `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#${g})"/>`;
  const lineAt = (x0, x1, y, color, w, op) =>
    `<path d="M${x0} ${y}H${x1}" stroke="${color}" stroke-width="${w}" opacity="${op}"/>`;
  // the soft shadow a projecting moulding casts on the face below it
  const shadowBelow = (x0, x1, y, h) =>
    `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="url(#${drop})"/>`;
  const hi = '#f1e9da';
  const lo = '#7f8797';
  return `<defs>${face}${lgrad(drop, [
    [0, '#56617a', 0.42],
    [1, '#56617a', 0],
  ])}<radialGradient id="${ball}" cx="0.62" cy="0.3" r="0.8">${stopsOf([
    [0, '#efe6d6'],
    [0.45, '#d8cdb9'],
    [1, '#98a0ac'],
  ])}</radialGradient></defs><g>
${block(pc - 70, pc + 70, 1368, 1520)}${lineAt(pc - 70, pc + 70, 1369, hi, 2, 0.8)}
${block(pc - 64, pc + 64, 1354, 1368)}${lineAt(pc - 64, pc + 64, 1355, hi, 2, 0.8)}${shadowBelow(pc - 70, pc + 70, 1368, 14)}
${block(pc - 58, pc + 58, 800, 1354)}
<rect x="${pc - 42}" y="840" width="84" height="484" fill="#b9b3aa" opacity=".22"/>
<path d="M${pc - 42} 1324V840H${pc + 42}V1324" fill="none" stroke="${lo}" stroke-width="5" opacity=".38" transform="translate(1.2 2.5)"/>
<path d="M${pc - 42} 1324H${pc + 42}" stroke="${hi}" stroke-width="3" opacity=".7"/>
<path d="M${pc - 42} 1324V840" stroke="${hi}" stroke-width="2.5" opacity=".45"/>
${shadowBelow(pc - 58, pc + 58, 800, 30)}
${block(pc - 66, pc + 66, 786, 800)}${lineAt(pc - 66, pc + 66, 787, hi, 2, 0.8)}${shadowBelow(pc - 66, pc + 66, 786, 8)}
${block(pc - 74, pc + 74, 764, 786)}${lineAt(pc - 74, pc + 74, 765, hi, 2.5, 0.9)}${lineAt(pc - 74, pc + 74, 785, lo, 2.5, 0.35)}
${block(pc - 60, pc + 60, 754, 764)}${lineAt(pc - 60, pc + 60, 755, hi, 1.5, 0.7)}
${block(pc - 30, pc + 30, 734, 754)}${lineAt(pc - 30, pc + 30, 735, hi, 2, 0.8)}${shadowBelow(pc - 60, pc + 60, 764, 6)}
<ellipse cx="${pc}" cy="734" rx="23" ry="6" fill="#b3ada4"/>
<circle cx="${pc}" cy="697" r="35" fill="url(#${ball})"/>
</g>`;
};

/** stone grain and softness over a group (a light, even texture) */
const stoneFilter = () => {
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
const blurFilter = (s) => {
  const id = nid('bf');
  return {
    id,
    defs: `<defs><filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${s}"/></filter></defs>`,
  };
};

// ---------------------------------------------------------------------------------------------------
// the scenes: each returns the page's layers (HTML), drawn bottom to top

const svgLayer = (inner, style = '') =>
  `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;${style}">${inner}</svg>`;

/** the sky behind the gate: blue deepening upwards, a warm light high behind the arch, cumulus far off */
const gateSky = ({ warm = 0 } = {}) => {
  let s = skyFill([
    [0, '#46679a'],
    [0.18, C.zenith],
    [0.36, C.high],
    [0.5, C.sky],
    [0.62, C.low],
    [0.7, mix(C.low, C.horizon, 0.6)],
    [0.76, C.horizon],
    [1, mix(C.horizon, C.cloudMid, 0.5)],
  ]);
  s += glow({ x: 540, y: 690, rx: 820, ry: 860, color: '#e6d3b2', a: 0.3 + warm * 0.2 });
  s += glow({ x: 540, y: 640, rx: 320, ry: 360, color: '#ecdcbf', a: 0.2 + warm * 0.3 });
  s += wisps({
    color: '#dfe0de',
    a: 0.28,
    items: [
      [230, 260, 320, 20, -5],
      [820, 340, 360, 16, 4],
      [570, 160, 280, 12, -2],
      [110, 500, 240, 14, 3],
      [960, 570, 230, 12, -4],
    ],
  });
  // cumulus banks far off, behind the pillars, their tops in the warm light
  const far = (t) => ({
    top: mix('#e4d6bf', C.horizon, 0.25 + 0.2 * t),
    mid: mix('#b8bdc7', C.horizon, 0.3 + 0.15 * t),
    bot: mix('#98a3b6', C.horizon, 0.4 + 0.1 * t),
  });
  const dir = [0.6, 0, 0.4, 1];
  s += cumulus({
    cx: 120,
    base: 1340,
    width: 560,
    height: 430,
    n: 34,
    size: 100,
    pal: far,
    seed: 31,
    bands: 4,
    dir,
  });
  s += cumulus({
    cx: 965,
    base: 1335,
    width: 600,
    height: 470,
    n: 36,
    size: 104,
    pal: far,
    seed: 41,
    bands: 4,
    dir,
  });
  s += cumulus({
    cx: 560,
    base: 1350,
    width: 760,
    height: 190,
    n: 30,
    size: 66,
    pal: far,
    seed: 51,
    bands: 3,
    dir,
  });
  return s;
};

/**
 * The cloud floor the gate stands on (lit from behind: warm rims, shaded bodies): `far` is what lies beyond
 * the gate (drawn before it), `near` what lies in front, with a bank of billows and mist around its foot.
 */
const FLOOR = { hz: 1335, cam: 900, zFar: 40, zNear: 1.22, r0: 150, n: 1700, bins: 18, seed: 61 };
const U_GATE = 0.5; // the depth of the gate's foot (u of 1470 on screen)
const floorPal = (warm) => (t) => ({
  top: mix(mix('#e3d4bb', '#ead6b2', warm), C.horizon, 0.45 * (1 - t)),
  mid: mix('#aeb5c3', C.horizon, 0.55 * (1 - t)),
  bot: mix('#7a88a0', '#bcc1c6', 0.6 * (1 - t)),
});
const gateFloorFar = ({ warm = 0 } = {}) =>
  glow({ x: 540, y: 1345, rx: 1100, ry: 60, color: '#d9d2c4', a: 0.6 }) +
  cloudSea({ ...FLOOR, pal: floorPal(warm), to: U_GATE });
const gateFloorNear = ({ warm = 0 } = {}) => {
  let s = mist({ y: 1440, h: 56, x0: 150, x1: 930, color: '#d3d1cc', a: 0.55, seed: 73, n: 6 });
  // a bank of billows around the foot of the gate
  const bank = (t) => ({
    top: mix('#e2d4bc', '#ead7b4', warm),
    mid: mix('#b3b9c6', '#c9c8c6', 0.3 * (1 - t)),
    bot: '#8492a8',
  });
  s += cumulus({
    cx: 540,
    base: 1560,
    width: 1500,
    height: 150,
    n: 46,
    size: 70,
    rMin: 0.5,
    pal: bank,
    seed: 81,
    bands: 3,
    flatBase: 0.1,
  });
  s += cloudSea({ ...FLOOR, pal: floorPal(warm), from: U_GATE });
  s += mist({ y: 1560, h: 60, x0: -100, x1: 1180, color: '#cfd0d0', a: 0.3, seed: 74, n: 9 });
  return s;
};

const gateClosed = () => {
  const stone = stoneFilter();
  const soften = blurFilter(0.65);
  const leaf = leafWork();
  const over = overthrowWork();
  let s = gateSky();
  s += gateFloorFar();
  s += stone.defs + soften.defs;
  s += `<g filter="url(#${soften.id})">${ironInk(over)}${goldInk(over)}${ironInk(leaf)}${ironInk(leaf, { mirror: true })}${goldInk(leaf)}${goldInk(leaf, { mirror: true })}${medallion()}</g>`;
  s += `<g filter="url(#${stone.id})">${pillar(GATE.pl)}${pillar(GATE.pr)}</g>`;
  // a veil of atmosphere over the gate, thicker low down
  s += `<defs>${ugrad(
    'air',
    [
      [0, C.low, 0.06],
      [0.6, C.horizon, 0.1],
      [1, C.horizon, 0.4],
    ],
    [0, 460, 0, 1500],
  )}</defs><rect width="${W}" height="${H}" fill="url(#air)"/>`;
  s += gateFloorNear();
  s += vignette(0.32);
  return [svgLayer(s)];
};

/** the gate open: its leaves swung inwards (a CSS 3D turn), warm light pouring through from beyond */
const gateOpen = () => {
  const stone = stoneFilter();
  const soften = blurFilter(0.65);
  const leaf = leafWork();
  const over = overthrowWork();
  let back = gateSky({ warm: 1 });
  back += gateFloorFar({ warm: 1 });
  // the light beyond: a low golden sun behind a heap of cloud over there, framed by the opening
  back += glow({ x: 540, y: 1100, rx: 620, ry: 740, color: '#eecf98', a: 0.42 });
  back += glow({ x: 540, y: 1170, rx: 230, ry: 300, color: '#f5dfb2', a: 0.7 });
  const beyond = (t) => ({
    top: mix('#f5e3c0', '#f0d9ae', t),
    mid: mix('#cdb89a', '#c4b39c', t),
    bot: mix('#a29a94', '#9a9798', t),
  });
  back += cumulus({
    cx: 455,
    base: 1338,
    width: 300,
    height: 190,
    n: 22,
    size: 58,
    pal: beyond,
    seed: 91,
    bands: 3,
    dir: [0.5, 0, 0.5, 1],
  });
  back += cumulus({
    cx: 650,
    base: 1342,
    width: 280,
    height: 140,
    n: 18,
    size: 50,
    pal: beyond,
    seed: 93,
    bands: 3,
    dir: [0.5, 0, 0.5, 1],
  });
  back += glow({ x: 548, y: 1250, rx: 120, ry: 90, color: '#f8e7c4', a: 0.45 });
  back += glow({ x: 540, y: 1345, rx: 420, ry: 60, color: '#f1dcb6', a: 0.45 });
  // the leaves, each in its own frame, turned about its hinge (in the shade, the light behind them)
  const leafFrame = (mirror) => {
    const [x0, y0, w, h] = mirror ? [534, 800, 290, 660] : [256, 800, 290, 660];
    const hinge = mirror ? GATE.hingeR - x0 : GATE.hingeL - x0;
    const fid = `${soften.id}${mirror ? 'r' : 'l'}`;
    const svg = `<svg width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}">${soften.defs.replace(soften.id, fid)}<g filter="url(#${fid})">${ironInk(leaf, { mirror })}${goldInk(leaf, { mirror })}${medallion(mirror ? 'right' : 'left')}</g></svg>`;
    return `<div style="position:absolute;left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;transform-origin:${hinge}px 50%;transform:rotateY(${mirror ? -66 : 66}deg);filter:brightness(.84) saturate(.9)">${svg}</div>`;
  };
  let front = stone.defs + soften.defs;
  const dim = nid('dim');
  front += `<defs><filter id="${dim}"><feComponentTransfer><feFuncR type="linear" slope=".84"/><feFuncG type="linear" slope=".85"/><feFuncB type="linear" slope=".9"/></feComponentTransfer></filter></defs>`;
  front += `<g filter="url(#${dim})"><g filter="url(#${soften.id})">${ironInk(over)}${goldInk(over)}</g><g filter="url(#${stone.id})">${pillar(GATE.pl)}${pillar(GATE.pr)}</g></g>`;
  // warm rim light on the pillars' inner edges, from the light between them
  const rim = nid('rim');
  front += `<defs>${ugrad(
    rim,
    [
      [0, '#f3dcb0', 0],
      [0.3, '#f3dcb0', 0.7],
      [1, '#f3dcb0', 0.2],
    ],
    [0, 760, 0, 1420],
  )}</defs><path d="M${GATE.pl + 57} 800V1360M${GATE.pr - 57} 800V1360M${GATE.pl + 72} 766V786M${GATE.pr - 72} 766V786" stroke="url(#${rim})" stroke-width="3" filter="url(#${soften.id})"/>`;
  front += `<defs>${ugrad(
    'air2',
    [
      [0, C.low, 0.05],
      [0.6, C.horizon, 0.06],
      [1, C.horizon, 0.3],
    ],
    [0, 460, 0, 1500],
  )}</defs><rect width="${W}" height="${H}" fill="url(#air2)"/>`;
  front += gateFloorNear({ warm: 1 });
  // the light spilling out onto the clouds in front, and shafts of it in the air
  front += glow({ x: 540, y: 1520, rx: 460, ry: 250, color: '#f0d4a2', a: 0.4, blend: 'screen' });
  front += rays({
    x: 540,
    y: 1180,
    n: 26,
    len: 1300,
    a0: 15,
    a1: 165,
    w: [1.2, 4.5],
    color: '#f3dcb2',
    a: 0.5,
    seed: 7,
    blur: 8,
  });
  front += rays({
    x: 540,
    y: 1150,
    n: 16,
    len: 950,
    a0: -160,
    a1: -20,
    w: [1, 3.5],
    color: '#f3dcb2',
    a: 0.2,
    seed: 9,
    blur: 12,
  });
  front += vignette(0.38);
  return [
    svgLayer(back),
    `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1500px;perspective-origin:540px 1000px">${leafFrame(false)}${leafFrame(true)}</div>`,
    svgLayer(front),
  ];
};

/** rising into the clouds: towers of cumulus on both sides, a heap below, the sky clearing upwards, rays */
const ascent = () => {
  let s = skyFill([
    [0, '#3e6194'],
    [0.22, '#56789f'],
    [0.45, '#7f9dbd'],
    [0.66, '#a6b8ca'],
    [0.85, '#bfc5ca'],
    [1, '#b5bcc6'],
  ]);
  // the sun high up, off to the right
  s += glow({ x: 690, y: 120, rx: 900, ry: 760, color: '#e9d7b8', a: 0.4 });
  s += glow({ x: 690, y: 120, rx: 260, ry: 240, color: '#f2e3c6', a: 0.6 });
  s += wisps({
    color: '#e2e1dc',
    a: 0.3,
    seed: 23,
    items: [
      [300, 330, 330, 16, -8],
      [760, 520, 300, 14, 6],
      [180, 700, 260, 12, -4],
    ],
  });
  const lit = (t) => ({
    top: mix('#e6d7bf', '#e2d4bf', t),
    mid: mix('#bcc2cc', '#b1b8c5', t),
    bot: mix('#96a2b6', '#8290a7', t),
  });
  const far = (t) => ({ top: mix('#dcd4c7', '#d8d2c8', t), mid: '#b9c1cc', bot: '#a0acbd' });
  const dir = [0.7, 0, 0.3, 1];
  // far heaps in the gap, hazy
  s += cumulus({
    cx: 560,
    base: 1250,
    width: 420,
    height: 230,
    n: 26,
    size: 60,
    pal: far,
    seed: 101,
    bands: 3,
    dir,
  });
  s += cumulus({
    cx: 420,
    base: 1330,
    width: 360,
    height: 150,
    n: 20,
    size: 50,
    pal: far,
    seed: 103,
    bands: 3,
    dir,
  });
  // the towers, their upper heaps first
  s += cumulus({
    cx: 120,
    base: 1020,
    width: 360,
    height: 470,
    n: 34,
    size: 105,
    pal: lit,
    seed: 111,
    bands: 4,
    dir,
    skew: 0.12,
  });
  s += cumulus({
    cx: 990,
    base: 1160,
    width: 360,
    height: 420,
    n: 32,
    size: 100,
    pal: lit,
    seed: 113,
    bands: 4,
    dir,
    skew: -0.1,
  });
  s += cumulus({
    cx: 150,
    base: 1560,
    width: 560,
    height: 620,
    n: 44,
    size: 140,
    pal: lit,
    seed: 115,
    bands: 5,
    dir,
  });
  s += cumulus({
    cx: 960,
    base: 1620,
    width: 560,
    height: 560,
    n: 42,
    size: 140,
    pal: lit,
    seed: 117,
    bands: 5,
    dir,
  });
  // the heap below, rising towards us
  s += cumulus({
    cx: 540,
    base: 2150,
    width: 1500,
    height: 720,
    n: 64,
    size: 170,
    pal: lit,
    seed: 119,
    bands: 5,
    dir,
    flatBase: 0,
  });
  s += rays({
    x: 690,
    y: 80,
    n: 20,
    len: 1500,
    a0: 70,
    a1: 150,
    w: [1.5, 5],
    color: '#f2e2c2',
    a: 0.26,
    seed: 13,
    blur: 12,
  });
  // wisps rushing past, close by
  s += mist({ y: 260, h: 110, x0: 700, x1: 1300, color: '#dcdbd6', a: 0.35, seed: 121, n: 3 });
  s += mist({ y: 1760, h: 140, x0: -300, x1: 500, color: '#d6d5d1', a: 0.35, seed: 123, n: 3 });
  s += vignette(0.34);
  return [svgLayer(s)];
};

/** above the clouds: a calm sea of cloud to the horizon, the sky clear from deep to pale blue, a low warm sun */
const above = () => {
  const hz = Math.round(0.585 * H);
  let s = skyFill([
    [0, '#415f8f'],
    [0.2, '#5a7ba6'],
    [0.4, '#86a2c0'],
    [0.52, '#adbccb'],
    [0.585, '#cdc9c0'],
    [0.6, '#c3c4c6'],
    [1, '#8595ad'],
  ]);
  s += glow({ x: 0.62 * W, y: hz - 30, rx: 950, ry: 560, color: '#e6cfa8', a: 0.5 });
  s += glow({ x: 0.62 * W, y: hz - 8, rx: 360, ry: 150, color: '#efdab6', a: 0.55 });
  s += wisps({
    color: '#dfe0dd',
    a: 0.2,
    seed: 25,
    items: [
      [260, 300, 360, 12, -3],
      [800, 420, 320, 10, 2],
    ],
  });
  // a few far heads rising out of the sea, on the horizon
  const far = () => ({ top: '#dcd1c0', mid: '#c2c3c4', bot: '#b3b8bf' });
  s += cumulus({
    cx: 150,
    base: hz + 14,
    width: 260,
    height: 70,
    n: 16,
    size: 22,
    pal: far,
    seed: 131,
    bands: 2,
  });
  s += cumulus({
    cx: 930,
    base: hz + 12,
    width: 220,
    height: 50,
    n: 12,
    size: 18,
    pal: far,
    seed: 133,
    bands: 2,
  });
  s += cloudSea({
    hz,
    cam: 1150,
    zFar: 80,
    zNear: 1.3,
    r0: 175,
    n: 2800,
    bins: 24,
    seed: 141,
    pal: (t) => {
      const haze = Math.max(0, 1 - t * 1.3);
      return {
        top: mix('#e4d4bb', '#d8cfc3', haze * 0.6),
        mid: mix('#aeb4c1', '#cbcac6', haze),
        bot: mix('#77869f', '#c0c3c6', haze),
      };
    },
  });
  s += glow({ x: W / 2, y: hz + 6, rx: 1500, ry: 70, color: '#d8d0c3', a: 0.5 });
  s += vignette(0.3);
  return [svgLayer(s)];
};

/**
 * An aerial camera: ground points (x across, z ahead, in metres) to the screen, from `h` metres up,
 * looking down by `tilt` radians; the horizon sits at cy − f·tan(tilt).
 */
const aerial = ({ h, tilt, f = 1000, cx = W / 2, cy = H / 2 }) => {
  const [sn, cs] = [Math.sin(tilt), Math.cos(tilt)];
  const depth = (z, y = 0) => (h - y) * sn + z * cs;
  return {
    depth,
    at: (x, z, y = 0) => {
      const d = depth(z, y);
      return [cx + (f * x) / d, cy - (f * (z * sn - (h - y) * cs)) / d];
    },
    scale: (z, y = 0) => f / depth(z, y),
    horizon: cy - f * Math.tan(tilt),
  };
};

/** a smooth value noise in [0, 1] (for large patterns laid over the land) */
const valueNoise = (seed) => {
  const r = prng(seed);
  const g = Array.from({ length: 64 * 64 }, () => r());
  const at = (i, j) => g[(((j % 64) + 64) % 64) * 64 + (((i % 64) + 64) % 64)];
  return (x, y) => {
    const [i, j] = [Math.floor(x), Math.floor(y)];
    const [u, v] = [x - i, y - j].map((t) => t * t * (3 - 2 * t));
    return (
      (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v
    );
  };
};

/**
 * The land far below, as the aerial camera sees it: a patchwork of fields (lighter where the sun lies on
 * them), hedgerows, woods, a silver river, a lane to a white estate among trees, the shadows of clouds —
 * each hazed by its distance.
 */
const landscape = (cam, { zMin, zMax, hazeColor, hazeK }) => {
  const rnd = prng(5501);
  const light = valueNoise(71);
  const greens = [
    '#9aae88',
    '#a4b58e',
    '#91a687',
    '#aab794',
    '#95a98c',
    '#b4bb93',
    '#9db08f',
    '#a9b08f',
    '#bcbd98',
  ];
  const hazeAt = (z) => 1 - Math.exp(-z / hazeK);
  const col = (c, z, lit) =>
    mix(mix(c, lit > 0.5 ? '#c3c79e' : '#7f977f', Math.abs(lit - 0.5) * 0.9), hazeColor, hazeAt(z));
  const poly = (list) => `${pts(list.map(([x, z]) => cam.at(x, z)))}Z`;
  let s = `<rect y="${r1(cam.horizon)}" width="${W}" height="${r1(H - cam.horizon)}" fill="${mix('#7a917a', hazeColor, 0.4)}"/>`;
  // fields: rows of strips with shared, slanted boundaries, on a grid turned against the view
  const turn = 0.38;
  const [tc, ts] = [Math.cos(turn), Math.sin(turn)];
  const toGround = ([u, v]) => [u * tc - v * ts, u * ts + v * tc];
  const onScreen = (list) =>
    list.some(([x, y]) => x > -60 && x < W + 60 && y > cam.horizon - 10 && y < H + 60);
  let fields = '';
  const span = zMax * 0.75;
  for (let v = -span; v < span;) {
    const base = 210;
    const cellH = base * (0.6 + rnd() * 0.9);
    let [ua, ub] = [-span, -span];
    while (ua < span) {
      const w = base * (0.5 + rnd() * 1.3);
      const slant = (rnd() - 0.5) * base * 0.6;
      const [na, nb] = [ua + w, ua + w + slant];
      const inset = 6;
      const q = [
        [ua + inset, v + inset],
        [na - inset, v + inset],
        [nb - inset, v + cellH - inset],
        [ub + inset, v + cellH - inset],
      ].map(toGround);
      [ua, ub] = [na, nb];
      if (q.some(([, z]) => z < zMin * 0.5) || q.every(([, z]) => z > zMax)) continue;
      const scr = q.map(([x, z]) => cam.at(x, Math.max(z, 1)));
      if (!onScreen(scr)) continue;
      const [gx, gz] = q[0];
      fields += `<path d="${pts(scr)}Z" fill="${col(greens[Math.floor(rnd() * greens.length)], gz, light(gx / 1100, gz / 1100))}"/>`;
    }
    v += cellH;
  }
  s += fields;
  // mottling, like crops and grass seen from far up
  s += `<filter id="lmm" x="0" y="${r1(cam.horizon)}" width="${W}" height="${r1(H - cam.horizon)}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.45  0 0 0 0 0.33  0.9 0 0 0 -0.3"/></filter><rect y="${r1(cam.horizon)}" width="${W}" height="${r1(H - cam.horizon)}" filter="url(#lmm)" opacity=".35"/>`;
  // woods
  let woods = '';
  for (let k = 0; k < 60; k++) {
    const z = zMin + rnd() ** 1.3 * (zMax - zMin) * 0.6;
    const x = (rnd() - 0.5) * cam.depth(z) * 1.3;
    const [a, b] = [80 + rnd() * 240, 60 + rnd() * 160];
    const outline = Array.from({ length: 18 }, (_, i) => {
      const t = (i / 18) * Math.PI * 2;
      const w = 0.75 + 0.25 * Math.sin(t * 3 + k);
      return [x + Math.cos(t) * a * w, z + Math.sin(t) * b * w];
    });
    woods += `<path d="${poly(outline)}" fill="${mix('#738b6f', hazeColor, Math.min(1, hazeAt(z) * 1.1 + 0.18))}"/>`;
  }
  s += soft(
    { box: [0, cam.horizon - 20, W, H], blur: 2, disp: 8, freq: 0.07, seed: 6 },
    woods,
    'opacity=".75"',
  );
  // the river: a band of water, its width in metres
  const course = bezPts([-3200, 9000], [-400, 5200], [2600, 5400], [300, 1400], 90).concat(
    bezPts([300, 1400], [-600, 900], [-300, 500], [200, 200], 30).slice(1),
  );
  const band = (list, w) => {
    const L = [];
    const R = [];
    list.forEach(([x, z], i) => {
      const [x2, z2] = list[Math.min(i + 1, list.length - 1)];
      const [x1, z1] = list[Math.max(i - 1, 0)];
      const len = Math.hypot(x2 - x1, z2 - z1) || 1;
      const [nx, nz] = [-(z2 - z1) / len, (x2 - x1) / len];
      L.push([x + (nx * w) / 2, z + (nz * w) / 2]);
      R.push([x - (nx * w) / 2, z - (nz * w) / 2]);
    });
    return poly(L.concat(R.reverse()));
  };
  s += `<path d="${band(course, 34)}" fill="#aebcc0" opacity=".85"/><path d="${band(course, 8)}" fill="#d0d6d3" opacity=".4"/>`;
  // the lane and the estate: a lawn, an avenue of trees, the white rotunda
  s += `<path d="${band(bezPts([900, 400], [700, 1000], [260, 1500], [120, 2150], 30), 10)}" fill="#cdc6b4" opacity=".6"/>`;
  const [ex, ez] = [0, 2300];
  let grove = '';
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2;
    const d = 140 + rnd() * 170;
    const [px, py] = cam.at(ex + Math.cos(a) * d * 1.2, ez + Math.sin(a) * d);
    grove += `<ellipse cx="${r1(px)}" cy="${r1(py)}" rx="${r1(cam.scale(ez) * (50 + rnd() * 40))}" ry="${r1(cam.scale(ez) * (34 + rnd() * 24))}"/>`;
  }
  s += soft(
    { box: [0, cam.horizon, W, H - cam.horizon], blur: 2, disp: 8, freq: 0.08, seed: 9 },
    grove,
    `fill="${mix('#6d866a', hazeColor, hazeAt(ez) + 0.12)}" opacity=".8"`,
  );
  const [rx0, ry0] = cam.at(ex, ez);
  s += `<ellipse cx="${r1(rx0)}" cy="${r1(ry0)}" rx="${r1(cam.scale(ez) * 70)}" ry="${r1(cam.scale(ez) * 48)}" fill="${mix('#b3bf98', hazeColor, hazeAt(ez))}"/>`;
  s += `<ellipse cx="${r1(rx0)}" cy="${r1(ry0)}" rx="${r1(cam.scale(ez) * 17)}" ry="${r1(cam.scale(ez) * 13)}" fill="#e9e3d6"/>`;
  return s;
};

/** descending through the clouds: cumulus all round and below, parting on the green land far beneath */
const descent = () => {
  const cam = aerial({ h: 3000, tilt: 0.585, f: 1000, cy: 900 });
  const hz = cam.horizon;
  const hazeColor = '#b9c5cd';
  let s = skyFill([
    [0, '#6f8fb3'],
    [r3(hz / H - 0.06), '#a3b7c9'],
    [r3(hz / H), '#cdd0cf'],
    [r3(hz / H + 0.004), '#c3cbcf'],
    [1, '#c3cbcf'],
  ]);
  const lb = blurFilter(1.8);
  s +=
    lb.defs +
    `<g filter="url(#${lb.id})">${landscape(cam, { zMin: 600, zMax: 14000, hazeColor, hazeK: 7000 })}</g>`;
  // the air: a veil thickening towards the horizon, sunlight from the upper right
  s += `<defs>${ugrad(
    'dv',
    [
      [0, '#cdd0cf', 0.9],
      [0.1, '#c3cad0', 0.5],
      [0.35, '#bcc6ce', 0.22],
      [1, '#bcc6ce', 0.12],
    ],
    [0, hz, 0, H],
  )}</defs><rect y="${r1(hz - 2)}" width="${W}" height="${r1(H - hz + 2)}" fill="url(#dv)"/>`;
  s += glow({ x: 880, y: hz - 60, rx: 900, ry: 420, color: '#ead9bb', a: 0.4 });
  // cumulus floating over the land, and their shadows
  const lit = (t) => ({
    top: mix('#e4d8c5', '#e2d6c3', t),
    mid: mix('#bcc2cb', '#b3bac6', t),
    bot: mix('#98a4b6', '#8794aa', t),
  });
  const dir = [0.65, 0, 0.35, 1];
  const floats = [
    [-1800, 7200, 900],
    [1600, 5200, 800],
    [-500, 11000, 1100],
    [2600, 9000, 900],
    [-2600, 4200, 700],
  ];
  let shadows = '';
  let heaps = '';
  floats.forEach(([x, z, w], i) => {
    const alt = 1300;
    const [px, py] = cam.at(x, z, alt);
    const k = cam.scale(z, alt);
    const [sx, sy] = cam.at(x - 500, z + 700);
    const ks = cam.scale(z + 700);
    shadows += `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="${r1(w * 0.55 * ks)}" ry="${r1(w * 0.26 * ks)}"/>`;
    const haze = 1 - Math.exp(-z / 16000);
    const pal = (t) => {
      const c = lit(t);
      return {
        top: mix(c.top, hazeColor, haze),
        mid: mix(c.mid, hazeColor, haze),
        bot: mix(c.bot, hazeColor, haze),
      };
    };
    heaps += cumulus({
      cx: px,
      base: py,
      width: w * k,
      height: w * k * 0.5,
      n: 22,
      size: w * k * 0.16,
      pal,
      seed: 401 + i,
      bands: 3,
      dir,
    });
  });
  s += soft(
    { box: [0, hz, W, H - hz], blur: 10, disp: 30, freq: 0.02, seed: 4 },
    shadows,
    'fill="#3f5452" opacity=".16"',
  );
  s += heaps;
  // the cloud we come down through: walls to either side, big billows below us, mist above
  s += cumulus({
    cx: -40,
    base: 1500,
    width: 560,
    height: 820,
    n: 46,
    size: 150,
    pal: lit,
    seed: 153,
    bands: 5,
    dir,
    skew: 0.08,
  });
  s += cumulus({
    cx: 1120,
    base: 1600,
    width: 560,
    height: 760,
    n: 46,
    size: 150,
    pal: lit,
    seed: 155,
    bands: 5,
    dir,
    skew: -0.08,
  });
  s += cumulus({
    cx: 540,
    base: 2250,
    width: 1700,
    height: 640,
    n: 60,
    size: 200,
    pal: lit,
    seed: 157,
    bands: 5,
    dir,
    flatBase: 0,
  });
  // above: the cloud's underside hanging over the far land, dissolving into mist
  const under = (t) => ({
    top: mix('#c2c7cd', '#bfc5cc', t),
    mid: mix('#b1b9c4', '#abb4c1', t),
    bot: mix('#d2cdc4', '#cfcac2', t),
  });
  s += `<defs>${lgrad('dmist', [
    [0, '#bcc2c8', 1],
    [0.2, '#c2c7cb', 0.85],
    [0.32, '#c6cacc', 0.45],
    [0.42, '#c6cacc', 0],
  ])}</defs><rect width="${W}" height="${H}" fill="url(#dmist)"/>`;
  s += cumulus({
    cx: 540,
    base: 80,
    width: 1700,
    height: 520,
    n: 60,
    size: 150,
    pal: under,
    seed: 159,
    bands: 4,
    dir: [0.5, 0, 0.5, 1],
    down: true,
    flatBase: 0,
    blur: 0.16,
    disp: 0.55,
  });
  s += mist({ y: 560, h: 110, x0: -300, x1: 1400, color: '#d6d6d3', a: 0.5, seed: 191, n: 6 });
  s += mist({ y: 1560, h: 120, x0: 600, x1: 1400, color: '#d6d5d1', a: 0.35, seed: 193, n: 3 });
  s += mist({ y: 820, h: 60, x0: -200, x1: 380, color: '#d8d7d3', a: 0.35, seed: 195, n: 3 });
  s += vignette(0.3);
  return [svgLayer(s)];
};

/**
 * Foliage: a crown's silhouette (lobes = ellipses), its edge broken into clumps and leaves by displacement
 * at two scales, shaded as a whole (lit side → shade side) and textured by lit fractal noise at the scale
 * of the leaf clusters, like foliage in soft focus.
 */
const foliage = ({
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
const crown = (rnd, x, y, w, h, n = 9) => {
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
const flame = (rnd, x, top, base, w) => {
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
const tree = ({
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

/** a white rotunda (a dome on eight columns over three round steps), seen a little from above, sun from the left */
const rotunda = ({ cx = 540, fy = 1330, R = 150, k = 0.26, colH = 250 }) => {
  const band = (rx, y0, y1) =>
    `M${r1(cx - rx)} ${y0}A${rx} ${r1(rx * k)} 0 0 0 ${r1(cx + rx)} ${y0}L${r1(cx + rx)} ${y1}A${rx} ${r1(rx * k)} 0 0 1 ${r1(cx - rx)} ${y1}Z`;
  const disc = (rx, y) => `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${r1(rx * k)}"`;
  const side = nid('rs');
  const colG = nid('rc');
  const colB = nid('rb');
  const domeG = nid('rd');
  const floorSh = nid('rf');
  const defs = `<defs>${ugrad(
    side,
    [
      [0, '#d9d3c8'],
      [0.22, '#efe8dc'],
      [0.55, '#d6d0c6'],
      [0.85, '#aeb1b8'],
      [1, '#9ea4ae'],
    ],
    [cx - R - 60, 0, cx + R + 60, 0],
  )}
${lgrad(
  colG,
  [
    [0, '#cfcdca'],
    [0.28, '#f0e9dd'],
    [0.58, '#d9d3c9'],
    [0.86, '#a9adb6'],
    [1, '#98a0ab'],
  ],
  [0, 0, 1, 0],
)}
${lgrad(
  colB,
  [
    [0, '#b7b8bb'],
    [0.4, '#c9c6c0'],
    [1, '#98a0ab'],
  ],
  [0, 0, 1, 0],
)}
<radialGradient id="${domeG}" cx="0.3" cy="0.28" r="0.85">${stopsOf([
    [0, '#f2ebdf'],
    [0.35, '#e2dbcf'],
    [0.7, '#bdbdc0'],
    [1, '#9aa1ad'],
  ])}</radialGradient>
<radialGradient id="${floorSh}" cx="0.56" cy="0.42" r="0.6">${stopsOf([
    [0, '#8e95a1', 0.55],
    [0.75, '#8e95a1', 0.35],
    [1, '#8e95a1', 0],
  ])}</radialGradient></defs>`;
  let out = defs;
  // the steps
  [
    [R + 58, fy + 30],
    [R + 44, fy + 15],
    [R + 30, fy],
  ].forEach(([rx, y]) => {
    out += `<path d="${band(rx, y, y + 15)}" fill="url(#${side})"/>${disc(rx, y)} fill="#e6dfd3"/>`;
  });
  out += `${disc(R + 30, fy)} fill="url(#${floorSh})"/>`;
  const col = (th, back) => {
    const x = cx + R * Math.sin(th);
    const yb = fy + R * Math.cos(th) * k;
    const w = 21 * (1 + 0.08 * Math.cos(th));
    const g = back ? colB : colG;
    return `<rect x="${r1(x - w * 0.78)}" y="${r1(yb - 10)}" width="${r1(w * 1.56)}" height="10" fill="url(#${g})"/>
<rect x="${r1(x - w / 2)}" y="${r1(yb - colH + 14)}" width="${r1(w)}" height="${r1(colH - 24)}" fill="url(#${g})"/>
<rect x="${r1(x - w * 0.75)}" y="${r1(yb - colH)}" width="${r1(w * 1.5)}" height="15" fill="url(#${g})"/>`;
  };
  const angles = Array.from({ length: 8 }, (_, i) => ((i + 0.5) * Math.PI) / 4);
  out += `<g opacity=".92">${angles
    .filter((t) => Math.cos(t) < 0)
    .map((t) => col(t, true))
    .join('')}</g>`;
  out += angles
    .filter((t) => Math.cos(t) >= 0)
    .sort((a, b) => Math.cos(a) - Math.cos(b))
    .map((t) => col(t, false))
    .join('');
  // entablature, cornice, the dome with its ribs, the lantern
  const yE = fy - colH;
  out += `<path d="${band(R + 16, yE - 34, yE)}" fill="url(#${side})"/><path d="M${cx - R - 16} ${yE - 17}A${R + 16} ${r1((R + 16) * k)} 0 0 0 ${cx + R + 16} ${yE - 17}" fill="none" stroke="#9aa1ab" stroke-width="2" opacity=".35"/>`;
  out += `<path d="${band(R + 24, yE - 46, yE - 34)}" fill="url(#${side})"/>${disc(R + 24, yE - 46)} fill="#e9e2d6"/>`;
  const yD = yE - 46;
  const rx = R + 4;
  const hd = R * 0.95;
  out += `<path d="M${cx - rx} ${yD}A${rx} ${r1(hd)} 0 0 1 ${cx + rx} ${yD}A${rx} ${r1(rx * k)} 0 0 1 ${cx - rx} ${yD}Z" fill="url(#${domeG})"/>`;
  let ribs = '';
  for (let i = 1; i < 8; i++) {
    const ph = -Math.PI / 2 + (Math.PI * i) / 8;
    ribs += pts(
      Array.from({ length: 21 }, (_, j) => {
        const la = (j / 20) * (Math.PI / 2) * 0.93;
        return [
          cx + rx * Math.cos(la) * Math.sin(ph),
          yD + rx * k * Math.cos(la) * Math.cos(ph) - hd * Math.sin(la),
        ];
      }),
    );
  }
  out += `<path d="${ribs}" fill="none" stroke="#8f97a3" stroke-width="2.2" opacity=".3"/><path d="${ribs}" fill="none" stroke="#fbf5ea" stroke-width="1.2" opacity=".35" transform="translate(-1.5 0)"/>`;
  const yT = yD - hd + 6;
  out += `<path d="${band(22, yT - 26, yT)}" fill="url(#${side})"/>${disc(22, yT - 26)} fill="#e7e0d4"/>`;
  out += `<path d="M${cx - 24} ${yT - 26}A24 20 0 0 1 ${cx + 24} ${yT - 26}Z" fill="url(#${domeG})"/>`;
  out += `<path d="M${cx} ${yT - 62}V${yT - 44}" stroke="${C.gold}" stroke-width="3"/><circle cx="${cx}" cy="${yT - 48}" r="5.5" fill="${C.champagne}"/>`;
  return out;
};

/** a lawn in perspective: a gradient, mower stripes towards the vanishing point, a gravel path */
const lawn = ({ hz, vx = 540, path = true }) => {
  let s = `<defs>${lgrad('lwn', [
    [0, '#a9b59f'],
    [0.12, '#9fb094'],
    [0.4, '#8ea283'],
    [1, '#7a9070'],
  ])}</defs><rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#lwn)"/>`;
  let stripes = '';
  for (let i = -14; i < 14; i++) {
    if (i % 2) continue;
    stripes += `M${vx} ${hz}L${vx + i * 160} ${H}L${vx + (i + 1) * 160} ${H}Z`;
  }
  s += `<defs>${lgrad('lws', [
    [0, '#f2f0e0', 0],
    [0.4, '#f2f0e0', 0.045],
    [1, '#f2f0e0', 0.06],
  ])}<filter id="lwsb"><feGaussianBlur stdDeviation="6"/></filter></defs><path d="${stripes}" fill="url(#lws)" filter="url(#lwsb)"/>`;
  s += `<filter id="lwt" x="0" y="${hz}" width="${W}" height="${H - hz}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="3" seed="5"/><feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.33  0 0 0 0 0.24  0.8 0 0 0 -0.25"/></filter><rect y="${hz}" width="${W}" height="${H - hz}" filter="url(#lwt)" opacity=".4"/>`;
  if (path) {
    s += `<defs>${lgrad('pth', [
      [0, '#c3bcab'],
      [1, '#b9ae99'],
    ])}<filter id="pthb" x="0" y="${hz}" width="${W}" height="${H - hz}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.3  1.2 0 0 0 -0.45" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gg"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gg"/></feMerge><feGaussianBlur stdDeviation="1.6"/></filter></defs><path d="M${vx - 30} ${hz + 610}L${vx + 30} ${hz + 610}L${vx + 150} ${H}L${vx - 150} ${H}Z" fill="url(#pth)" filter="url(#pthb)"/>`;
  }
  return s;
};

/** the venue emerging: a garden estate, a white rotunda among soft trees, lawn and gravel, morning haze */
const venue = () => {
  const rnd = prng(6007);
  const hz = 760;
  let s = skyFill([
    [0, '#5f80aa'],
    [0.16, '#7d9abb'],
    [0.3, '#a5b8c9'],
    [0.39, '#c8cbc7'],
    [0.4, '#c6c9c5'],
    [1, '#c6c9c5'],
  ]);
  s += glow({ x: 170, y: 330, rx: 900, ry: 760, color: '#ecd8b4', a: 0.42 });
  s += glow({ x: 170, y: 330, rx: 260, ry: 240, color: '#f1e1c2', a: 0.45 });
  s += wisps({
    color: '#e3e2de',
    a: 0.34,
    seed: 27,
    items: [
      [700, 200, 360, 16, -3],
      [300, 110, 280, 12, 2],
      [880, 430, 320, 14, 3],
      [520, 560, 420, 12, -1],
      [140, 600, 300, 10, 2],
    ],
  });
  const leafy = { lit: '#b6c092', front: '#bec797', mid: '#7b9270', midFront: '#859a76', shade: '#4d6557' };
  const dark = { lit: '#94a67f', mid: '#627b61', shade: '#435a4f' };
  const hazeColor = '#c4cbc8';
  // far woods along the horizon, blue with distance
  for (let x = -40, i = 0; x < W + 60; x += 50 + rnd() * 40, i += 1)
    s += tree({
      cx: x,
      cy: hz - 4 - rnd() * 16,
      w: 80 + rnd() * 60,
      h: 56 + rnd() * 30,
      n: 16,
      pal: leafy,
      haze: 0.66,
      hazeColor,
      seed: 500 + i,
      bands: 2,
      leaf: 0.09,
    });
  s += lawn({ hz: hz + 20 });
  s += mist({ y: hz + 34, h: 30, x0: -100, x1: 1180, color: '#d4d6d1', a: 0.6, seed: 213, n: 10 });
  // a wood behind the rotunda, cypresses flanking it
  for (let x = 110, i = 0; x < 990; x += 70 + rnd() * 40, i += 1)
    s += tree({
      cx: x,
      cy: 1010 - rnd() * 70,
      w: 170 + rnd() * 80,
      h: 160 + rnd() * 60,
      n: 40,
      pal: leafy,
      haze: 0.34,
      hazeColor,
      seed: 540 + i,
      leaf: 0.07,
    });
  s += mist({ y: 1115, h: 34, x0: 80, x1: 1000, color: '#cfd3cf', a: 0.45, seed: 215, n: 7 });
  const cyp = (x, top, base, w, sd, hz2) =>
    foliage({
      lobes: flame(rnd, x, top, base, w),
      pal: {
        lit: mix(dark.lit, hazeColor, hz2),
        mid: mix(dark.mid, hazeColor, hz2),
        shade: mix(dark.shade, hazeColor, hz2),
      },
      seed: sd,
      grain: 0.07,
      edge: 9,
      clump: 12,
      tex: 0.55,
      relief: 6,
      light: [0, 0, 1, 0.35],
    });
  s +=
    cyp(236, 890, 1245, 64, 581, 0.3) +
    cyp(844, 900, 1245, 64, 583, 0.3) +
    cyp(330, 810, 1255, 76, 585, 0.2) +
    cyp(752, 822, 1255, 76, 587, 0.2);
  s += `<defs>${ugrad(
    'haze6',
    [
      [0, '#cfd3d0', 0.2],
      [1, '#cfd3d0', 0],
    ],
    [0, hz, 0, 1300],
  )}</defs><rect width="${W}" height="${H}" fill="url(#haze6)"/>`;
  // long morning shadows across the lawn, then the rotunda, softened by the air
  const shade = `<ellipse cx="660" cy="1374" rx="260" ry="50"/><path d="M0 1540L360 1505L450 1600L0 1680Z"/><path d="M1080 1480L940 1490L810 1550L1080 1580Z"/>`;
  s += soft({ box: [0, 1200, W, 600], blur: 18, disp: 30, freq: 0.02 }, shade, 'fill="#4c6152" opacity=".3"');
  const sb = blurFilter(0.8);
  s += sb.defs + `<g filter="url(#${sb.id})">${rotunda({ cx: 540, fy: 1330 })}</g>`;
  s += `<defs>${ugrad(
    'air6',
    [
      [0, '#d2d5d2', 0.14],
      [1, '#d2d5d2', 0.05],
    ],
    [0, 800, 0, 1400],
  )}</defs><rect x="300" y="780" width="480" height="640" fill="url(#air6)"/>`;
  // trees framing the view
  s += tree({ cx: 40, cy: 1170, w: 480, h: 620, n: 120, pal: leafy, seed: 591, leaf: 0.045, bands: 4 });
  s += tree({
    cx: 1050,
    cy: 1190,
    w: 450,
    h: 580,
    n: 110,
    pal: leafy,
    seed: 593,
    leaf: 0.045,
    bands: 4,
    dir: [0.2, 0, 0.8, 1],
  });
  // low hedges along the path, white roses in them, and clipped balls
  const hedge = (x0, x1, y0, y1, sd) => {
    const lobes = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const k = 0.35 + 0.65 * t;
      lobes.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 10 * k, 30 * k, 20 * k]);
    }
    return foliage({
      lobes,
      pal: dark,
      seed: sd,
      grain: 0.09,
      edge: 5,
      clump: 6,
      tex: 0.5,
      relief: 5,
      light: [0.3, 0, 0.7, 1],
    });
  };
  s += hedge(488, 380, 1400, 1940, 610) + hedge(592, 700, 1400, 1940, 640);
  let roses = '';
  const rr = prng(677);
  for (let i = 0; i < 70; i++) {
    const t = rr();
    const side = rr() < 0.5 ? -1 : 1;
    const x = 540 + side * (52 + t * 116) + (rr() - 0.5) * 30 * (0.4 + t);
    const y = 1400 + t * 540 - (6 + rr() * 16) * (0.4 + t);
    roses += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1((2.5 + rr() * 3) * (0.4 + t))}" fill="${rr() < 0.3 ? '#eadbd0' : '#efe9de'}" opacity=".9"/>`;
  }
  const rb = blurFilter(0.9);
  s += rb.defs + `<g filter="url(#${rb.id})">${roses}</g>`;
  const ball = (x, y, r, sd) =>
    tree({
      cx: x,
      cy: y,
      w: r * 2,
      h: r * 1.8,
      n: 12,
      pal: dark,
      seed: sd,
      leaf: 0.1,
      bands: 2,
      clump: 2.8,
      fray: 0.1,
    });
  s += ball(470, 1380, 18, 601) + ball(610, 1380, 18, 602);
  // out of focus at our feet: leaves and blossom at the corners
  const fg = blurFilter(9);
  s +=
    fg.defs +
    `<g filter="url(#${fg.id})">${tree({ cx: -30, cy: 1900, w: 360, h: 220, n: 40, pal: leafy, seed: 621, leaf: 0.05 })}${tree({ cx: 1110, cy: 1880, w: 320, h: 240, n: 40, pal: leafy, seed: 623, leaf: 0.05 })}<g fill="#efe8dc" opacity=".85"><circle cx="60" cy="1820" r="22"/><circle cx="130" cy="1870" r="18"/><circle cx="1010" cy="1800" r="20"/><circle cx="1050" cy="1870" r="24"/></g></g>`;
  // morning light slanting through the haze
  s += rays({
    x: 120,
    y: 260,
    n: 12,
    len: 1700,
    a0: 30,
    a1: 62,
    w: [1.5, 4],
    color: '#f1e2c4',
    a: 0.16,
    seed: 17,
    blur: 16,
  });
  s += mist({ y: 1880, h: 90, x0: -200, x1: 1280, color: '#d1d3cf', a: 0.25, seed: 257, n: 6 });
  s += vignette(0.34);
  return [svgLayer(s)];
};

/** a petal seen from above: an arc at radius R, its inner edge bowed towards the heart by th */
const crescentPts = (R, a0, span, th, n = 14) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = a0 + (span * k) / n;
    const rr = R - th * Math.sin((Math.PI * k) / n);
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });
const arcOf = (R, a0, span, n = 14) => crescentPts(R, a0, span, 0, n);

/** a garden rose from above: a spiral of cupped petals (body, lit rim, shadow line) round a darker heart */
const rose = (rnd, x, y, r, t, rot, squash, gradId) => {
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
const eucalyptus = (rnd, x, y, ang, len, bend, tones) => {
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

/** the ceremony: a white arch dressed in cream and white flowers and sheer drapes, on a lawn, the garden
 * behind it in soft bokeh */
const garden = () => {
  const rnd = prng(7001);
  let s = skyFill([
    [0, '#7390b5'],
    [0.18, '#98aec6'],
    [0.32, '#bfc6c8'],
    [0.42, '#cdc9bf'],
    [1, '#c9ccc3'],
  ]);
  s += glow({ x: 860, y: 360, rx: 780, ry: 660, color: '#f0dcb8', a: 0.5 });
  // the garden behind, far out of focus: trees with light between them, the lawn, flowers down the aisle
  const leafy = { lit: '#b9c294', front: '#c1c89a', mid: '#80966f', midFront: '#8a9e76', shade: '#566e5c' };
  let back = '';
  const heights = [820, 700, 860, 640, 780, 900, 700, 820];
  heights.forEach((y, i) => {
    back += tree({
      cx: -40 + i * 165 + rnd() * 50,
      cy: y + 120,
      w: 320 + rnd() * 120,
      h: 420 + rnd() * 160,
      n: 40,
      pal: leafy,
      seed: 700 + i,
      leaf: 0.05,
    });
  });
  back += `<defs>${lgrad('glw', [
    [0, '#9fb191'],
    [0.25, '#90a585'],
    [1, '#779172'],
  ])}</defs><rect y="1190" width="${W}" height="${H - 1190}" fill="url(#glw)"/>`;
  const aisle = (x, y, r, sd) =>
    tree({
      cx: x,
      cy: y,
      w: r * 2.2,
      h: r * 1.6,
      n: 20,
      pal: { lit: '#f1ebe0', mid: '#d9d2c6', shade: '#aeb0a9' },
      seed: sd,
      leaf: 0.08,
      clump: 2,
      bands: 2,
    });
  back +=
    aisle(120, 1330, 60, 731) +
    aisle(960, 1330, 60, 733) +
    aisle(30, 1420, 80, 735) +
    aisle(1050, 1420, 80, 737);
  const bgBlur = blurFilter(13);
  s += bgBlur.defs + `<g filter="url(#${bgBlur.id})">${back}</g>`;
  s += `<defs>${ugrad(
    'gair',
    [
      [0, '#d8d6cc', 0.1],
      [0.5, '#d8d6cc', 0.18],
      [1, '#d8d6cc', 0],
    ],
    [0, 650, 0, 1500],
  )}</defs><rect width="${W}" height="${H}" fill="url(#gair)"/>`;
  // bokeh: discs of sun through the leaves, bright-rimmed
  const bk = nid('bk');
  s += `<defs><radialGradient id="${bk}">${stopsOf([
    [0, '#f6e8cb', 0.4],
    [0.8, '#f6e8cb', 0.6],
    [0.93, '#f8ecd2', 0.85],
    [1, '#f8ecd2', 0],
  ])}</radialGradient></defs>`;
  let discs = '';
  for (let i = 0; i < 44; i++) {
    const r = 10 + rnd() ** 2 * 46;
    const x = rnd() * W;
    const y = 520 + rnd() * 760;
    if (Math.abs(x - 540) < 190 && y > 880) continue;
    discs += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" opacity="${r3(0.14 + rnd() * 0.3)}"/>`;
  }
  const bb = blurFilter(1.6);
  s += bb.defs + `<g fill="url(#${bk})" filter="url(#${bb.id})" style="mix-blend-mode:screen">${discs}</g>`;
  // contact shadows on the lawn
  s += soft(
    { box: [0, 1500, W, 300], blur: 14, disp: 20, freq: 0.03 },
    `<ellipse cx="250" cy="1652" rx="130" ry="16"/><ellipse cx="850" cy="1652" rx="160" ry="18"/>`,
    'fill="#4a5f4e" opacity=".45"',
  );
  // the arch: two posts and a round head in white-painted wood, lit from behind on the right
  const [cx, spring, ground, half] = [540, 830, 1650, 280];
  const post = nid('ap');
  const drape = nid('dp');
  let arch = `<defs>${lgrad(
    post,
    [
      [0, '#b3b3b4'],
      [0.22, '#d6d0c5'],
      [0.6, '#e9e2d5'],
      [0.86, '#f1e9db'],
      [1, '#c7c3bc'],
    ],
    [0, 0, 1, 0],
  )}${lgrad(
    drape,
    [
      [0, '#f4efe6', 0.18],
      [0.5, '#f1ebe1', 0.45],
      [1, '#ece6dc', 0.3],
    ],
    [0, 0, 1, 0],
  )}</defs>`;
  const fold = (x0, dir) => {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const x = x0 + dir * i * 14;
      d += `<path d="M${cx + dir * 40} ${spring - half + 20}C${x - dir * 40} ${spring - half + 140} ${x} 720 ${x + dir * 4} 1150C${x + dir * 30} 1300 ${x + dir * 60 + dir * i * 12} 1500 ${x + dir * 90 + dir * i * 22} ${ground + 20}" fill="none" stroke="#f3eee5" stroke-width="${10 + i * 3}" opacity="${r3(0.16 + (i % 2) * 0.12)}"/>`;
    }
    return d;
  };
  arch += `<g>${fold(cx - half - 10, -1)}${fold(cx + half + 10, 1)}</g>`;
  const frame = (ro, ri) =>
    `M${cx - ro} ${ground}V${spring}A${ro} ${ro} 0 0 1 ${cx + ro} ${spring}V${ground}H${cx + ri}V${spring}A${ri} ${ri} 0 0 0 ${cx - ri} ${spring}V${ground}Z`;
  arch += `<path d="${frame(half + 24, half - 24)}" fill="url(#${post})"/>`;
  arch += `<path d="${frame(half + 8, half - 8)}" fill="none" stroke="#9aa0aa" stroke-width="2" opacity=".35"/>`;
  arch += `<path d="M${cx + half + 24} ${ground}V${spring}A${half + 24} ${half + 24} 0 0 0 ${cx + 60} ${spring - half - 18}" fill="none" stroke="#f7e6c6" stroke-width="3" opacity=".75"/>`;
  arch += `<path d="M${cx - 230} 650C${cx - 120} 770 ${cx + 120} 770 ${cx + 230} 650C${cx + 130} 730 ${cx - 130} 730 ${cx - 230} 650Z" fill="url(#${drape})"/>`;
  const ab = blurFilter(1.1);
  s += ab.defs + `<g filter="url(#${ab.id})">${arch}</g>`;
  // the flowers: a lush cluster over the head's left shoulder, one at the foot of the right post
  const tones = [
    { base: '#e9dfcf', light: '#f7f2e9', deep: '#bfae98', heart: '#9d8670' },
    { base: '#e7d2c6', light: '#f6e8e0', deep: '#c09e91', heart: '#9c7b71' },
    { base: '#e4d4b6', light: '#f3e8d2', deep: '#bca783', heart: '#9b8461' },
    { base: '#eeeae3', light: '#fbf9f5', deep: '#c7bfb3', heart: '#a39584' },
    { base: '#ebe2d6', light: '#f8f3ec', deep: '#c4b4a3', heart: '#a08a78' },
  ];
  const tg = tones.map((t) => {
    const id = nid('rg');
    return {
      id,
      def: `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stopsOf([
        [0, t.heart],
        [0.4, t.deep],
        [0.85, t.base],
        [1, t.base],
      ])}</radialGradient>`,
    };
  });
  const blooms = [];
  const stems = [];
  const cluster = (path, spread, count, [rMin, rMax], out) => {
    let tries = 0;
    let placed = 0;
    while (placed < count && tries < count * 40) {
      tries += 1;
      const [px, py] = path[Math.floor(rnd() * path.length)];
      const r = rMin + rnd() * (rMax - rMin);
      const [x, y] = [px + (rnd() - 0.5) * spread, py + (rnd() - 0.5) * spread * 0.8];
      if (blooms.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.7)) continue;
      blooms.push({
        x,
        y,
        r,
        t: Math.floor(rnd() * tones.length),
        rot: rnd() * 360,
        sq: 0.72 + rnd() * 0.26,
      });
      placed += 1;
    }
    // greenery reaching out of the cluster along `out` (angles in degrees)
    for (let i = 0; i < count * 0.9; i++) {
      const [px, py] = path[Math.floor(rnd() * path.length)];
      const a = ((out[0] + rnd() * (out[1] - out[0])) * Math.PI) / 180;
      stems.push([
        px + (rnd() - 0.5) * spread * 0.5,
        py + (rnd() - 0.5) * spread * 0.4,
        a,
        spread * (0.6 + rnd() * 0.7),
        (rnd() - 0.5) * 40,
      ]);
    }
  };
  const onArch = (a0, a1) => arcPts(cx, spring, half, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180, 30);
  cluster(onArch(200, 250), 110, 5, [50, 62], [120, 330]);
  cluster(onArch(186, 268), 150, 34, [18, 44], [120, 330]);
  cluster(onArch(268, 296), 80, 8, [14, 26], [-60, 30]);
  cluster(
    onArch(170, 188).concat(
      bezPts([cx - half, 880], [cx - half - 10, 960], [cx - half + 10, 1030], [cx - half - 6, 1110], 10),
    ),
    80,
    10,
    [14, 26],
    [60, 140],
  );
  cluster(
    bezPts([cx + half - 40, 1610], [cx + half, 1600], [cx + half + 30, 1590], [cx + half + 70, 1610], 6),
    70,
    3,
    [46, 56],
    [180, 360],
  );
  cluster(
    bezPts([cx + half - 100, 1636], [cx + half, 1606], [cx + half + 50, 1566], [cx + half + 130, 1640], 12),
    120,
    22,
    [18, 40],
    [180, 360],
  );
  cluster(
    bezPts([cx + half, 1560], [cx + half + 8, 1480], [cx + half - 6, 1420], [cx + half + 4, 1330], 8),
    60,
    7,
    [12, 22],
    [-120, -60],
  );
  cluster(
    bezPts(
      [cx - half - 110, 1644],
      [cx - half - 40, 1616],
      [cx - half + 20, 1624],
      [cx - half + 80, 1648],
      8,
    ),
    80,
    12,
    [16, 32],
    [180, 360],
  );
  const sage = ['#9aab98', '#8fa08e', '#a6b4a2', '#869885'];
  const greenery = stems.map(([x, y, a, len, bend]) => eucalyptus(rnd, x, y, a, len, bend, sage)).join('');
  let ruscus = '';
  for (let i = 0; i < 60; i++) {
    const b = blooms[Math.floor(rnd() * blooms.length)];
    const [x, y] = [b.x + (rnd() - 0.5) * b.r * 3, b.y + (rnd() - 0.5) * b.r * 2.4];
    const len = 26 + rnd() * 34;
    ruscus += `<path d="M${r1(x)} ${r1(y)}q${r1(len * 0.5)} ${r1(-len * 0.26)} ${r1(len)} 0q${r1(-len * 0.5)} ${r1(len * 0.26)} ${r1(-len)} 0Z" transform="rotate(${r1(rnd() * 360)} ${r1(x)} ${r1(y)})" fill="${rnd() < 0.5 ? '#6b8270' : '#7a8f78'}"/>`;
  }
  const bloomSvg = blooms
    .sort((a, b) => a.r - b.r)
    .map((b) => rose(rnd, b.x, b.y, b.r, tones[b.t], b.rot, b.sq, tg[b.t].id))
    .join('');
  let buds = '';
  let dots = '';
  for (let i = 0; i < 40; i++) {
    const b = blooms[Math.floor(rnd() * blooms.length)];
    const [x, y] = [b.x + (rnd() - 0.5) * 3.2 * b.r, b.y + (rnd() - 0.5) * 2.6 * b.r];
    buds += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(6 + rnd() * 4)}" ry="${r1(8 + rnd() * 5)}" transform="rotate(${r1(rnd() * 360)} ${r1(x)} ${r1(y)})" fill="${rnd() < 0.5 ? '#e9dccb' : '#e6d3c8'}"/>`;
  }
  for (let i = 0; i < 160; i++) {
    const b = blooms[Math.floor(rnd() * blooms.length)];
    dots += `<circle cx="${r1(b.x + (rnd() - 0.5) * 3.4 * b.r)}" cy="${r1(b.y + (rnd() - 0.5) * 2.8 * b.r)}" r="${r1(1.8 + rnd() * 2.2)}"/>`;
  }
  // a soft shadow the arrangement throws on the arch, a dark bed of leaves, then the arrangement itself
  s += soft(
    { box: [0, 400, W, 1400], blur: 10, disp: 20, freq: 0.03 },
    blooms.map((b) => `<circle cx="${r1(b.x + 8)}" cy="${r1(b.y + 12)}" r="${r1(b.r)}"/>`).join(''),
    'fill="#4e5e5a" opacity=".25"',
  );
  s += soft(
    { box: [0, 400, W, 1400], blur: 3, disp: 26, freq: 0.05, seed: 3 },
    blooms.map((b) => `<circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r * 1.08)}"/>`).join(''),
    'fill="#56695b"',
  );
  const fb = blurFilter(1.1);
  const lightOn = nid('lo');
  s += `<defs>${ugrad(
    lightOn,
    [
      [0, '#fff4e0', 0.22],
      [0.5, '#fff4e0', 0],
      [0.5, '#3f4b52', 0],
      [1, '#3f4b52', 0.3],
    ],
    [760, 420, 260, 1000],
  )}</defs>`;
  s +=
    fb.defs +
    `<defs>${tg.map((g) => g.def).join('')}</defs><g filter="url(#${fb.id})">${greenery}${ruscus}${bloomSvg}${buds}<g fill="#f5f0e6" opacity=".8">${dots}</g></g>`;
  s += `<g style="mix-blend-mode:soft-light">${soft({ box: [0, 400, W, 1400], blur: 2, disp: 10, freq: 0.05, seed: 5 }, blooms.map((b) => `<circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r * 1.1)}"/>`).join(''), `fill="url(#${lightOn})"`)}</g>`;
  // the light from behind, glancing off the flowers and the arch
  s += glow({ x: 820, y: 440, rx: 540, ry: 440, color: '#f3e0bd', a: 0.22, blend: 'screen' });
  // petals along the aisle, and blossom out of focus at our feet
  const pb = blurFilter(3.5);
  let petals = '';
  for (let i = 0; i < 150; i++) {
    const t = rnd();
    const y = 1660 + t * 290;
    const spread = 70 + t * 260;
    const r = 3 + t * 10;
    petals += `<ellipse cx="${r1(cx + (rnd() - 0.5) * spread * 2)}" cy="${r1(y)}" rx="${r1(r)}" ry="${r1(r * 0.55)}" fill="${rnd() < 0.3 ? '#e6d2c8' : '#ebe5da'}" opacity="${r3(0.55 + rnd() * 0.35)}"/>`;
  }
  s += pb.defs + `<g filter="url(#${pb.id})">${petals}</g>`;
  const fg = blurFilter(10);
  let near =
    tree({ cx: -20, cy: 1880, w: 300, h: 200, n: 30, pal: leafy, seed: 741, leaf: 0.05 }) +
    tree({ cx: 1100, cy: 1900, w: 280, h: 200, n: 30, pal: leafy, seed: 743, leaf: 0.05 });
  near += `<g opacity=".9">${rose(rnd, 60, 1800, 46, tones[0], 30, 0.9, tg[0].id)}${rose(rnd, 150, 1880, 38, tones[1], 80, 0.85, tg[1].id)}${rose(rnd, 1020, 1830, 44, tones[3], 10, 0.9, tg[3].id)}</g>`;
  s += fg.defs + `<g filter="url(#${fg.id})">${near}</g>`;
  s += vignette(0.38);
  return [svgLayer(s)];
};

/** the evening: the sky over the venue in cream, peach and lilac, the first stars, a warm glow low down */
const dusk = () => {
  const rnd = prng(8009);
  let s = skyFill([
    [0, '#39456b'],
    [0.14, '#4f5a82'],
    [0.3, '#7a7aa0'],
    [0.44, '#a896ae'],
    [0.56, '#c9a8aa'],
    [0.66, '#dcb9a4'],
    [0.74, '#e5c9aa'],
    [0.8, '#e2cdb0'],
    [1, '#b9a9a6'],
  ]);
  s += glow({ x: 600, y: 1470, rx: 1000, ry: 520, color: '#efcf9f', a: 0.55 });
  s += glow({ x: 600, y: 1500, rx: 380, ry: 180, color: '#f3dcb4', a: 0.5 });
  // the first stars
  const star = nid('sr');
  s += `<defs><radialGradient id="${star}">${stopsOf([
    [0, '#fbf3e2', 1],
    [0.25, '#f6ead3', 0.5],
    [1, '#f6ead3', 0],
  ])}</radialGradient></defs>`;
  let stars = '';
  for (let i = 0; i < 90; i++) {
    const y = rnd() ** 1.6 * 620;
    const a = (1 - y / 700) * (0.25 + rnd() * 0.6);
    stars += `<circle cx="${r1(rnd() * W)}" cy="${r1(y)}" r="${r1(1 + rnd() * 1.4)}" fill="#f6eedf" opacity="${r3(a)}"/>`;
  }
  for (let i = 0; i < 7; i++)
    stars += `<circle cx="${r1(80 + rnd() * 920)}" cy="${r1(40 + rnd() * 420)}" r="${r1(7 + rnd() * 5)}" fill="url(#${star})" opacity="${r3(0.45 + rnd() * 0.35)}"/>`;
  s += stars;
  // clouds lit from below by the set sun: warm undersides, lilac tops
  const under = (t) => ({
    top: mix('#e9c3a3', '#efcfad', t),
    mid: mix('#b69aa9', '#c4a4a6', t),
    bot: mix('#86809f', '#958aa2', t),
  });
  const flip = [0.3, 1, 0.5, 0];
  s += wisps({
    color: '#e6bfa6',
    a: 0.45,
    seed: 29,
    items: [
      [300, 560, 380, 16, -4],
      [820, 480, 340, 14, 3],
      [560, 700, 460, 18, -2],
    ],
  });
  s += cumulus({
    cx: 230,
    base: 930,
    width: 620,
    height: 170,
    n: 34,
    size: 60,
    pal: under,
    seed: 301,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 860,
    base: 860,
    width: 560,
    height: 150,
    n: 30,
    size: 56,
    pal: under,
    seed: 303,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 560,
    base: 1150,
    width: 1300,
    height: 190,
    n: 54,
    size: 70,
    pal: under,
    seed: 305,
    bands: 3,
    dir: flip,
    flatBase: 0.5,
  });
  s += cumulus({
    cx: 380,
    base: 1330,
    width: 900,
    height: 110,
    n: 30,
    size: 50,
    pal: under,
    seed: 307,
    bands: 2,
    dir: flip,
    flatBase: 0.5,
  });
  // the venue below, in silhouette against the glow: the wood, the cypresses, the rotunda's dome
  const sil = { lit: '#5d5a78', mid: '#4d4c6a', shade: '#3e3f5b' };
  let wood = [];
  for (let x = -60; x < W + 80; x += 60 + rnd() * 50)
    wood = wood.concat(crown(rnd, x, 1640 - rnd() * 90, 180 + rnd() * 90, 150 + rnd() * 70, 5));
  wood = wood.concat([[W / 2, 1800, 900, 180]]);
  s += foliage({
    lobes: wood,
    pal: sil,
    seed: 31,
    grain: 0.05,
    edge: 10,
    clump: 24,
    tex: 0.25,
    relief: 4,
    light: [0.5, 0, 0.5, 1],
  });
  const cyp = (x, top, base, w, sd) =>
    foliage({
      lobes: flame(rnd, x, top, base, w),
      pal: sil,
      seed: sd,
      grain: 0.07,
      edge: 7,
      clump: 8,
      tex: 0.2,
      light: [0.5, 0, 0.5, 1],
    });
  s +=
    cyp(410, 1380, 1720, 58, 33) +
    cyp(700, 1390, 1720, 58, 35) +
    cyp(160, 1440, 1720, 50, 37) +
    cyp(930, 1450, 1720, 50, 39);
  // the rotunda's dome and lantern above the trees, warm light within
  s += `<path d="M452 1560A88 84 0 0 1 628 1560Z" fill="#4c4b68"/><rect x="530" y="1462" width="20" height="18" fill="#4c4b68"/><path d="M526 1464A14 12 0 0 1 554 1464Z" fill="#4c4b68"/><path d="M540 1440V1452" stroke="#6b6680" stroke-width="3"/>`;
  s += `<rect x="444" y="1560" width="192" height="12" fill="#4a4966"/>`;
  s += glow({ x: 540, y: 1620, rx: 110, ry: 70, color: '#f2c98e', a: 0.55 });
  // lanterns in the trees
  const lights = nid('lt');
  s += `<defs><radialGradient id="${lights}">${stopsOf([
    [0, '#fbe3b4', 0.95],
    [0.3, '#f5cf92', 0.55],
    [1, '#f5cf92', 0],
  ])}</radialGradient></defs>`;
  let dotsL = '';
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const x = 120 + t * 840;
    const y = 1620 + Math.sin(t * Math.PI) * 36 + (i % 2) * 4;
    dotsL += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(9 + (i % 3) * 2)}" fill="url(#${lights})"/>`;
  }
  s += dotsL;
  s += vignette(0.32);
  return [svgLayer(s)];
};

const SCENES = {
  'scene-gate': { paint: gateClosed, seed: 11, post: { gamma: 1.2, bloom: 0.4 } },
  'scene-threshold': { paint: gateOpen, seed: 12, post: { gamma: 1.2, bloom: 0.45 } },
  'scene-ascent': { paint: ascent, seed: 13, post: { gamma: 1.15, bloom: 0.4 } },
  'scene-above': { paint: above, seed: 14, post: { gamma: 1.2, bloom: 0.35 } },
  'scene-descent': { paint: descent, seed: 15, post: { gamma: 1.3, bloom: 0.4 } },
  'scene-venue': { paint: venue, seed: 16, post: { gamma: 1.12, bloom: 0.4 } },
  'scene-garden': { paint: garden, seed: 17, post: { gamma: 1.25, bloom: 0.42 } },
  'scene-dusk': { paint: dusk, seed: 18, post: { gamma: 1.05, bloom: 0.45 } },
};

// ---------------------------------------------------------------------------------------------------
// finishing: a soft halation (the light blooms into its surroundings), a highlight shoulder (nothing
// brighter than ~0.85 luma, for the white text), film grain; then WebP

const finish = async (
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

const page = (layers) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${C.sky}}</style></head><body>${layers.join('')}</body></html>`;

const names = process.argv.slice(2).map((n) => (n.startsWith('scene-') ? n : `scene-${n}`));
const unknown = names.filter((n) => !SCENES[n]);
if (unknown.length)
  throw new Error(`unknown scene(s): ${unknown.join(', ')} — one of ${Object.keys(SCENES).join(', ')}`);
const todo = names.length ? names : Object.keys(SCENES);

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
tab.setDefaultTimeout(300_000);
mkdirSync(DIR, { recursive: true });
const list = JSON.parse(readFileSync(LIST, 'utf8'));
const listed = list.templates[ID] ?? {};
for (const name of todo) {
  uid = 0;
  const { paint, seed, post } = SCENES[name];
  await tab.setContent(page(paint()), { waitUntil: 'load' });
  const png = await tab.screenshot({ type: 'png' });
  const { webp, mean, peak } = await finish(png, { seed, ...post });
  const file = `${name}.webp`;
  writeFileSync(`${DIR}/${file}`, webp);
  listed[file] = { hash: createHash('md5').update(webp).digest('hex').slice(0, 10), bytes: webp.length };
  console.log(
    `${DIR}/${file}  ${Math.round(webp.length / 1024)} KB  luma mean ${mean.toFixed(2)} max ${peak.toFixed(2)}`,
  );
}
// the entries in the scenes' order
list.templates[ID] = Object.fromEntries(
  Object.keys(SCENES)
    .map((n) => `${n}.webp`)
    .filter((f) => listed[f])
    .map((f) => [f, listed[f]]),
);
writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`);
await browser.close();
