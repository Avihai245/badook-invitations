// Helpers shared by the "nature" group's scroll-scene pictures (forest-lights, enchanted-garden,
// lullaby-sky, sunset-shore): night skies, glowing lights (string lights, lanterns, candles in jars),
// tree trunks with bark, bokeh, textures and simple perspective — all on top of the painting kit.
import { H, W, glow, mix, nid, prng, pts, r1, r3, stopsOf, ugrad } from './kit.mjs';

// ---------------------------------------------------------------------------------------------------
// gradients and plain layers

export const radial = (id, stops, attrs = '') =>
  `<radialGradient id="${id}" ${attrs}>${stopsOf(stops)}</radialGradient>`;

/** a rect filled by a vertical gradient laid out in page coordinates from y0 to y1 */
export const vband = (stops, y0, y1, { x = 0, w = W, top = 0, h = H } = {}) => {
  const id = nid('vb');
  return `<defs>${ugrad(id, stops, [0, y0, 0, y1])}</defs><rect x="${r1(x)}" y="${r1(top)}" width="${r1(w)}" height="${r1(h)}" fill="url(#${id})"/>`;
};

/** a veil of air: a colour whose opacity follows `stops` ([y, alpha]) down the frame */
export const veil = (color, stops) => {
  const id = nid('ve');
  const y0 = stops[0][0];
  const y1 = stops[stops.length - 1][0];
  const s = stops.map(([y, a]) => [r3((y - y0) / (y1 - y0 || 1)), color, a]);
  return `<defs>${ugrad(id, s, [0, y0, 0, y1])}</defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
};

/** a blurred group */
export const blurred = (s, inner, attrs = '') => {
  if (!s) return `<g ${attrs}>${inner}</g>`;
  const id = nid('bl');
  return `<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${s}"/></filter></defs><g filter="url(#${id})" ${attrs}>${inner}</g>`;
};

/** mottling over a region (moss, sand, leaf litter): fractal noise tinted dark and light */
export const mottle = ({
  clip,
  freq = [0.02, 0.05],
  seed = 3,
  dark,
  light,
  a = 0.35,
  box = [0, 0, W, H],
  oct = 4,
}) => {
  const f = nid('mt');
  const c = nid('mc');
  const [x0, y0, w, h] = box;
  const [dr, dg, db] = dark;
  const [lr, lg, lb] = light;
  return `<defs><clipPath id="${c}"><path d="${clip}"/></clipPath>
<filter id="${f}" x="${x0}" y="${y0}" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq[0]} ${freq[1]}" numOctaves="${oct}" seed="${seed}" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${dr}  0 0 0 0 ${dg}  0 0 0 0 ${db}  -2.2 0 0 0 1.05" result="d"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${lr}  0 0 0 0 ${lg}  0 0 0 0 ${lb}  2.2 0 0 0 -1.15" result="l"/>
<feMerge><feMergeNode in="d"/><feMergeNode in="l"/></feMerge></filter></defs>
<g clip-path="url(#${c})"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" filter="url(#${f})" opacity="${a}"/></g>`;
};

/** colour as [r,g,b] in 0..1 (for colour matrices) */
export const unit = (hex) => [1, 3, 5].map((k) => r3(parseInt(hex.slice(k, k + 2), 16) / 255));

// ---------------------------------------------------------------------------------------------------
// perspective: a camera `h` metres up, the horizon at `hz`, focal length f (pixels)

export const eye = ({ hz, h = 1.6, f = 1000, cx = W / 2 }) => ({
  hz,
  f,
  h,
  /** a point x across, y up, z ahead (metres) to the screen */
  at: (x, y, z) => [cx + (f * x) / z, hz + (f * (h - y)) / z],
  k: (z) => f / z,
});

// ---------------------------------------------------------------------------------------------------
// night skies

/** a field of stars: small dots, a few with a soft glow; fade(x, y) thins them out (0 … 1) */
export const stars = ({
  seed,
  n,
  x0 = 0,
  x1 = W,
  y0 = 0,
  y1 = H / 2,
  r = [0.7, 1.9],
  color = '#f7f1e3',
  a = [0.25, 0.85],
  fade = () => 1,
  bright = 0,
  bright_r = [6, 11],
  pow = 1.25,
}) => {
  const rnd = prng(seed * 911 + 7);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() ** pow * (y1 - y0);
    const k = fade(x, y);
    const rr = r[0] + rnd() ** 2 * (r[1] - r[0]);
    const o = (a[0] + rnd() * (a[1] - a[0])) * k;
    if (o < 0.03) continue;
    out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" fill="${color}" opacity="${r3(o)}"/>`;
  }
  if (bright) {
    const id = nid('st');
    out += `<defs>${radial(id, [
      [0, '#fffaf0', 1],
      [0.18, color, 0.7],
      [0.5, color, 0.16],
      [1, color, 0],
    ])}</defs>`;
    for (let i = 0; i < bright; i++) {
      const x = x0 + 40 + rnd() * (x1 - x0 - 80);
      const y = y0 + 20 + rnd() ** pow * (y1 - y0 - 40);
      const k = fade(x, y);
      if (k < 0.2) continue;
      const rr = bright_r[0] + rnd() * (bright_r[1] - bright_r[0]);
      out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" fill="url(#${id})" opacity="${r3((0.55 + rnd() * 0.4) * k)}"/>`;
    }
  }
  return out;
};

// ---------------------------------------------------------------------------------------------------
// lights

/** the gradient of a glowing bulb (a hot core in a warm halo) */
export const bulbGrad = (color, core = '#fff6df') => {
  const id = nid('bu');
  return {
    id,
    defs: `<defs>${radial(id, [
      [0, core, 1],
      [0.13, core, 0.95],
      [0.24, color, 0.7],
      [0.5, color, 0.2],
      [1, color, 0],
    ])}</defs>`,
  };
};

/** bulbs: [{x, y, r, a}] drawn with a bulbGrad (screen-blended) */
export const bulbs = (list, g, blend = 'screen') =>
  `${g.defs}<g style="mix-blend-mode:${blend}">${list
    .map(
      (b) =>
        `<circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r)}" fill="url(#${g.id})"${b.a !== undefined ? ` opacity="${r3(b.a)}"` : ''}/>`,
    )
    .join('')}</g>`;

/** a four-pointed glint over the brightest lights */
export const glints = (list, color = '#fff4dc') => {
  const id = nid('gt');
  let out = `<defs><linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0">${stopsOf([
    [0, color, 0],
    [0.5, color, 0.9],
    [1, color, 0],
  ])}</linearGradient><linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">${stopsOf([
    [0, color, 0],
    [0.5, color, 0.9],
    [1, color, 0],
  ])}</linearGradient></defs>`;
  for (const { x, y, r, a = 0.8 } of list) {
    out += `<g opacity="${r3(a)}" style="mix-blend-mode:screen"><rect x="${r1(x - r)}" y="${r1(y - r * 0.035)}" width="${r1(2 * r)}" height="${r1(Math.max(0.8, r * 0.07))}" fill="url(#${id}h)"/><rect x="${r1(x - r * 0.035)}" y="${r1(y - r * 0.7)}" width="${r1(Math.max(0.8, r * 0.07))}" height="${r1(1.4 * r)}" fill="url(#${id}v)"/></g>`;
  }
  return out;
};

/** points along a sagging wire from p0 to p1 (a parabola, `sag` pixels deep at the middle) */
export const sagPts = (p0, p1, sag, n = 30) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + 4 * sag * t * (1 - t)];
  });

/** evenly spaced points along a polyline, every `gap` pixels */
export const along = (list, gap, offset = 0) => {
  const out = [];
  let carry = gap - offset;
  for (let i = 1; i < list.length; i++) {
    const [a, b] = [list[i - 1], list[i]];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    while (s <= d) {
      const t = s / d;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      s += gap;
    }
    carry = s - d;
  }
  return out;
};

/** a string of lights between two points on the screen: a thin wire, bulbs every `gap` pixels */
export const lightString = ({ p0, p1, sag, gap, r, g, rnd, wire = '#1d2a26', wireA = 0.55, wireW = 1.4 }) => {
  const line = sagPts(p0, p1, sag, 40);
  const list = along(line, gap, rnd() * gap).map(([x, y]) => ({
    x,
    y: y + r * 0.3,
    r: r * (0.8 + rnd() * 0.45),
    a: 0.7 + rnd() * 0.3,
  }));
  return {
    svg: `<path d="${pts(line)}" fill="none" stroke="${wire}" stroke-width="${wireW}" opacity="${wireA}"/>${bulbs(list, g)}`,
    list,
  };
};

/** a candle flame (a teardrop, hot at its heart) with its glow */
export const flame = (x, y, s, { glowA = 0.6, color = '#f3b45a', halo = 9 } = {}) => {
  const id = nid('fl');
  const h = s * 2.6;
  return `<defs>${radial(
    id,
    [
      [0, '#fffbea', 1],
      [0.45, '#ffe3a0', 0.95],
      [0.8, color, 0.8],
      [1, color, 0],
    ],
    'cx="0.5" cy="0.68" r="0.6"',
  )}</defs>${glow({ x, y: y - h * 0.35, rx: s * halo, color, a: glowA, blend: 'screen' })}<path d="M${r1(x)} ${r1(y - h)}C${r1(x + s * 0.2)} ${r1(y - h * 0.6)} ${r1(x + s * 0.62)} ${r1(y - h * 0.28)} ${r1(x + s * 0.5)} ${r1(y - h * 0.12)}C${r1(x + s * 0.4)} ${r1(y + s * 0.1)} ${r1(x - s * 0.4)} ${r1(y + s * 0.1)} ${r1(x - s * 0.5)} ${r1(y - h * 0.12)}C${r1(x - s * 0.62)} ${r1(y - h * 0.28)} ${r1(x - s * 0.2)} ${r1(y - h * 0.6)} ${r1(x)} ${r1(y - h)}Z" fill="url(#${id})"/>`;
};

/**
 * A lantern standing on the ground (or hanging, with `hang` the length of its chain): a metal frame, warm
 * glass, a candle inside; it lights the air round it and the ground under it. (x, y) = the middle of its
 * foot, h = its height in pixels.
 */
export const lantern = ({
  x,
  y,
  h,
  metal = '#2c2622',
  glass = ['#fff0c4', '#f3c371', '#c98a45'],
  light = '#f2b765',
  glowA = 0.55,
  ground = true,
  hang = 0,
  rnd = () => 0.5,
}) => {
  const w = h * 0.46;
  const g = nid('lg');
  const top = y - h;
  const bodyTop = y - h * 0.8;
  const bodyBot = y - h * 0.1;
  let out = `<defs>${radial(
    g,
    [
      [0, glass[0]],
      [0.55, glass[1]],
      [1, glass[2]],
    ],
    'cx="0.5" cy="0.62" r="0.7"',
  )}</defs>`;
  if (ground)
    out += glow({
      x,
      y: y + h * 0.02,
      rx: h * 1.5,
      ry: h * 0.34,
      color: light,
      a: glowA * 0.8,
      blend: 'screen',
    });
  out += glow({
    x,
    y: (bodyTop + bodyBot) / 2,
    rx: h * 1.25,
    ry: h * 1.15,
    color: light,
    a: glowA * 0.55,
    blend: 'screen',
  });
  if (hang)
    out += `<path d="M${r1(x)} ${r1(top - hang)}V${r1(top)}" stroke="${metal}" stroke-width="${r1(Math.max(1, h * 0.025))}" opacity=".8"/>`;
  // glass, candle, flame
  out += `<rect x="${r1(x - w / 2)}" y="${r1(bodyTop)}" width="${r1(w)}" height="${r1(bodyBot - bodyTop)}" fill="url(#${g})"/>`;
  const cw = w * 0.34;
  const cTop = bodyBot - (bodyBot - bodyTop) * 0.42;
  out += `<rect x="${r1(x - cw / 2)}" y="${r1(cTop)}" width="${r1(cw)}" height="${r1(bodyBot - cTop)}" fill="#f7e7c6" opacity=".9"/>`;
  out += flame(x, cTop - h * 0.02, Math.max(1.2, h * 0.045), { glowA: 0.5, color: light, halo: 5 });
  // frame: corner posts, a middle bar, base, cap, roof and ring
  const bw = Math.max(1, h * 0.035);
  out += `<g fill="${metal}">`;
  out += `<rect x="${r1(x - w / 2 - bw / 2)}" y="${r1(bodyTop)}" width="${r1(bw)}" height="${r1(bodyBot - bodyTop)}"/>`;
  out += `<rect x="${r1(x + w / 2 - bw / 2)}" y="${r1(bodyTop)}" width="${r1(bw)}" height="${r1(bodyBot - bodyTop)}"/>`;
  out += `<rect x="${r1(x - bw * 0.3)}" y="${r1(bodyTop)}" width="${r1(bw * 0.6)}" height="${r1(bodyBot - bodyTop)}" opacity=".55"/>`;
  out += `<rect x="${r1(x - w * 0.58)}" y="${r1(bodyBot)}" width="${r1(w * 1.16)}" height="${r1(h * 0.1)}" rx="${r1(h * 0.015)}"/>`;
  out += `<rect x="${r1(x - w * 0.6)}" y="${r1(bodyTop - h * 0.05)}" width="${r1(w * 1.2)}" height="${r1(h * 0.05)}"/>`;
  out += `<path d="M${r1(x - w * 0.55)} ${r1(bodyTop - h * 0.05)}L${r1(x)} ${r1(top + h * 0.06)}L${r1(x + w * 0.55)} ${r1(bodyTop - h * 0.05)}Z"/>`;
  out += `</g><circle cx="${r1(x)}" cy="${r1(top + h * 0.03)}" r="${r1(h * 0.035)}" fill="none" stroke="${metal}" stroke-width="${r1(Math.max(0.8, h * 0.018))}"/>`;
  // the glass catches the light on its edges
  out += `<rect x="${r1(x - w / 2 + bw)}" y="${r1(bodyTop + 2)}" width="${r1(Math.max(0.8, w * 0.06))}" height="${r1((bodyBot - bodyTop) * 0.8)}" fill="#fff4d6" opacity="${r3(0.25 + rnd() * 0.2)}"/>`;
  return out;
};

/** a candle in a glass jar: warm glass, a rim, the flame low inside; (x, y) = the middle of its foot */
export const jar = ({ x, y, h, light = '#f2b765', glowA = 0.5, tint = '#e9c58a' }) => {
  const w = h * 0.72;
  const g = nid('jg');
  let out = `<defs>${radial(
    g,
    [
      [0, '#fff3d2', 0.95],
      [0.5, '#f6cf87', 0.75],
      [1, tint, 0.45],
    ],
    'cx="0.5" cy="0.7" r="0.75"',
  )}</defs>`;
  out += glow({ x, y, rx: h * 1.6, ry: h * 0.4, color: light, a: glowA * 0.75, blend: 'screen' });
  out += glow({ x, y: y - h * 0.5, rx: h * 1.3, color: light, a: glowA * 0.45, blend: 'screen' });
  out += `<rect x="${r1(x - w / 2)}" y="${r1(y - h)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(w * 0.18)}" fill="url(#${g})"/>`;
  out += `<ellipse cx="${r1(x)}" cy="${r1(y - h)}" rx="${r1(w / 2)}" ry="${r1(w * 0.12)}" fill="none" stroke="#fbe6bd" stroke-width="${r1(Math.max(0.7, h * 0.03))}" opacity=".7"/>`;
  out += `<rect x="${r1(x - w * 0.42)}" y="${r1(y - h * 0.85)}" width="${r1(Math.max(0.7, w * 0.08))}" height="${r1(h * 0.7)}" fill="#fff6e2" opacity=".45"/>`;
  out += flame(x, y - h * 0.34, Math.max(1, h * 0.08), { glowA: 0.45, color: light, halo: 4 });
  return out;
};

// ---------------------------------------------------------------------------------------------------
// trees

/** a bark texture: vertical streaks of fractal noise laid over the group's own colours */
export const barkFilter = (seed = 7, freq = [0.07, 0.006]) => {
  const id = nid('bk');
  return {
    id,
    defs: `<defs><filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq[0]} ${freq[1]}" numOctaves="4" seed="${seed}" result="n"/>
<feColorMatrix in="n" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="g"/>
<feComposite in="SourceGraphic" in2="g" operator="arithmetic" k1="1.05" k2="0.32" result="t"/>
<feComposite in="t" in2="SourceAlpha" operator="in"/></filter></defs>`,
  };
};

/**
 * A trunk: a tapering column with a flared foot, shaded across (shade → body → lit rim on the side the
 * light comes from); `side` 1 = light from the right, -1 = from the left.
 */
export const trunk = ({
  x,
  top,
  foot,
  w,
  taper = 0.72,
  flare = 0.5,
  lean = 0,
  pal,
  side = 1,
  rnd,
  wobble = 0.08,
}) => {
  const g = nid('tk');
  const n = 26;
  const ph = rnd() * 6;
  const L = [];
  const R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 top … 1 foot
    const y = top + (foot - top) * t;
    let hw = (w / 2) * (taper + (1 - taper) * t);
    hw *= 1 + flare * Math.exp(-(1 - t) * 14);
    const cx = x + lean * (foot - y) + Math.sin(ph + t * 5) * w * wobble;
    L.push([cx - hw, y]);
    R.push([cx + hw, y]);
  }
  const x0 = x - w * 0.6;
  const x1 = x + w * 0.6;
  const stops =
    side > 0
      ? [
          [0, pal.shade],
          [0.35, pal.shade],
          [0.62, pal.body],
          [0.86, pal.lit],
          [1, pal.rim ?? pal.lit],
        ]
      : [
          [0, pal.rim ?? pal.lit],
          [0.14, pal.lit],
          [0.38, pal.body],
          [0.65, pal.shade],
          [1, pal.shade],
        ];
  return `<defs>${ugrad(g, stops, [x0, 0, x1, 0])}</defs><path d="${pts(L.concat(R.reverse()))}Z" fill="url(#${g})"/>`;
};

// ---------------------------------------------------------------------------------------------------
// light in the air

/** bokeh: out-of-focus discs of light, bright at the rim, screen-blended */
export const bokeh = ({
  seed,
  n,
  x0 = 0,
  x1 = W,
  y0,
  y1,
  r = [10, 40],
  color = '#f6e3bd',
  a = [0.12, 0.4],
  avoid = () => false,
  blur = 1.4,
}) => {
  const rnd = prng(seed * 577 + 1);
  const id = nid('bo');
  let discs = '';
  for (let i = 0; i < n; i++) {
    const rr = r[0] + rnd() ** 2 * (r[1] - r[0]);
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const o = a[0] + rnd() * (a[1] - a[0]);
    if (avoid(x, y)) continue;
    discs += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" opacity="${r3(o)}"/>`;
  }
  const f = nid('bb');
  return `<defs>${radial(id, [
    [0, color, 0.45],
    [0.78, color, 0.6],
    [0.93, color, 0.9],
    [1, color, 0],
  ])}<filter id="${f}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g fill="url(#${id})" filter="url(#${f})" style="mix-blend-mode:screen">${discs}</g>`;
};

/** a mix of two hex colours as hex (for places that need #rrggbb) */
export const mixHex = (a, b, t) => {
  const m = mix(a, b, t).match(/\d+/g).map(Number);
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
