// Helpers shared by the "action" group's scroll-scene pictures (buzzer-beater, golden-goal, moonshot,
// spotlight-stage), on top of the painting kit (./kit.mjs): a pinhole camera over a floor (courts, pitches,
// stalls), lens bokeh, starfields, spotlight beams, textured haze and small drawing conveniences.
import { W, H, prng, gaussOf, r1, r3, nid, mix, stopsOf, ugrad, pts } from './kit.mjs';

/**
 * A pinhole camera over a floor: world points (x across, z ahead, y up, in metres) to the screen, from `h`
 * metres up, at (px, pz), turned by `yaw` radians (positive = to the right) and looking down by `tilt`
 * radians (negative = up). The horizon sits at cy − f·tan(tilt).
 */
export const camera = ({ h, tilt = 0, f = 900, cx = W / 2, cy = H / 2, px = 0, pz = 0, yaw = 0 }) => {
  const [st, ct, sy, cyw] = [Math.sin(tilt), Math.cos(tilt), Math.sin(yaw), Math.cos(yaw)];
  const local = (x, z, y = 0) => {
    const [dx, dy, dz] = [x - px, y - h, z - pz];
    const right = dx * cyw - dz * sy;
    const fwd = dx * sy + dz * cyw;
    return { right, depth: fwd * ct - dy * st, up: dy * ct + fwd * st };
  };
  return {
    f,
    local,
    depth: (x, z, y = 0) => local(x, z, y).depth,
    at: (x, z, y = 0) => {
      const p = local(x, z, y);
      return [cx + (f * p.right) / p.depth, cy - (f * p.up) / p.depth];
    },
    scale: (x, z, y = 0) => f / local(x, z, y).depth,
    horizon: cy - f * Math.tan(tilt),
  };
};

/** a path through world points ([x, z] or [x, z, y]), dropping the parts behind the camera (depth < near) */
export const worldPath = (cam, list, { close = false, near = 0.2 } = {}) => {
  const runs = [];
  let run = [];
  for (const [x, z, y = 0] of list) {
    if (cam.depth(x, z, y) > near) run.push(cam.at(x, z, y));
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs
    .filter((r) => r.length > 1)
    .map((r) => pts(r) + (close && runs.length === 1 ? 'Z' : ''))
    .join('');
};

/** a circle (or an arc from a0 to a1) on the floor, as world points */
export const floorArc = (x, z, r, a0 = 0, a1 = Math.PI * 2, n = 96, y = 0) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [x + r * Math.cos(a), z + r * Math.sin(a), y];
  });

/** a straight segment on the floor, finely sampled (so perspective clipping works) */
export const floorLine = (a, b, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => a.map((v, k) => v + ((b[k] ?? 0) - v) * (i / n)));

/**
 * Lens bokeh: soft discs with a faint brighter rim, grouped by color (one gradient per color). items:
 * [{ x, y, r, color, a }]. `rim` sets how much the rim stands out (0 = plain soft disc).
 */
export const bokeh = (items, { rim = 0.25, blend = 'screen', blur = 0 } = {}) => {
  const byColor = new Map();
  for (const it of items) {
    if (!byColor.has(it.color)) byColor.set(it.color, []);
    byColor.get(it.color).push(it);
  }
  let defs = '';
  let body = '';
  for (const [color, list] of byColor) {
    const id = nid('bk');
    defs += `<radialGradient id="${id}">${stopsOf([
      [0, color, r3(0.62 - rim * 0.3)],
      [0.72, color, r3(0.72 - rim * 0.1)],
      [0.9, color, r3(0.8 + rim * 0.2)],
      [0.97, color, 0.35],
      [1, color, 0],
    ])}</radialGradient>`;
    body += list
      .map(
        (b) =>
          `<circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r)}" fill="url(#${id})" opacity="${r3(b.a ?? 1)}"/>`,
      )
      .join('');
  }
  let filt = '';
  let fa = '';
  if (blur) {
    const f = nid('bkb');
    filt = `<filter id="${f}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur}"/></filter>`;
    fa = ` filter="url(#${f})"`;
  }
  return `<defs>${defs}${filt}</defs><g style="mix-blend-mode:${blend}"${fa}>${body}</g>`;
};

/** random bokeh in a box: n discs, radius r0…r1, colors picked by weight [[color, w], …] */
export const bokehField = ({
  n,
  box: [x0, y0, w, h],
  r = [8, 30],
  colors,
  a = [0.3, 0.8],
  seed = 1,
  weight = () => 1,
}) => {
  const rnd = prng(seed * 7121 + 17);
  const total = colors.reduce((s, [, k]) => s + k, 0);
  const pick = () => {
    let u = rnd() * total;
    for (const [c, k] of colors) if ((u -= k) <= 0) return c;
    return colors[0][0];
  };
  const out = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const k = weight(x, y);
    if (rnd() > k) continue;
    out.push({
      x,
      y,
      r: r[0] + (r[1] - r[0]) * rnd() ** 1.6,
      color: pick(),
      a: a[0] + (a[1] - a[0]) * rnd(),
    });
  }
  return out;
};

/**
 * Stars: points of light with a soft halo; the brightest get a glow and, optionally, four fine diffraction
 * spikes. `weight(x, y)` in [0, 1] thins them out where the picture must stay calm.
 */
export const stars = ({
  n,
  box: [x0, y0, w, h] = [0, 0, W, H],
  seed = 1,
  colors = ['#ffffff', '#dfe8ff', '#fff1dc', '#cfe0ff'],
  size = [0.6, 1.9],
  a = [0.35, 1],
  bright = 0.04,
  spikes = true,
  weight = () => 1,
}) => {
  const rnd = prng(seed * 5813 + 29);
  const halo = nid('sh');
  let dots = '';
  let glows = '';
  let sp = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const k = weight(x, y);
    const u = rnd();
    const c = colors[Math.floor(rnd() * colors.length)];
    if (u > k) continue;
    const s = size[0] + (size[1] - size[0]) * rnd() ** 2.2;
    const al = a[0] + (a[1] - a[0]) * rnd();
    dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(s)}" fill="${c}" opacity="${r3(al * Math.min(1, k * 1.4))}"/>`;
    if (rnd() < bright * k) {
      const R = 7 + rnd() * 12;
      glows += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(R)}" fill="url(#${halo})" opacity="${r3(0.5 + rnd() * 0.5)}"/>`;
      if (spikes && rnd() < 0.7) {
        const L = R * (2.2 + rnd() * 2.2);
        sp += `<path d="M${r1(x - L)} ${r1(y)}H${r1(x + L)}M${r1(x)} ${r1(y - L)}V${r1(y + L)}" stroke="${c}" stroke-width="1" opacity="${r3(0.25 + rnd() * 0.3)}"/>`;
      }
    }
  }
  const spk = nid('spb');
  return `<defs><radialGradient id="${halo}">${stopsOf([
    [0, '#ffffff', 0.95],
    [0.18, '#eaf1ff', 0.55],
    [0.5, '#c9d8ff', 0.12],
    [1, '#c9d8ff', 0],
  ])}</radialGradient><filter id="${spk}"><feGaussianBlur stdDeviation="0.7"/></filter></defs>${dots}<g style="mix-blend-mode:screen">${glows}</g><g filter="url(#${spk})" style="mix-blend-mode:screen">${sp}</g>`;
};

/**
 * A spotlight's beam through haze: a cone from (x, y) along `ang` (degrees, 0 = right, 90 = down), `spread`
 * degrees wide, `len` long, `w0` wide at its source, fading along its length; drawn soft (blur) with a
 * brighter core.
 */
export const beam = ({
  x,
  y,
  ang,
  spread = 10,
  len = 1600,
  w0 = 10,
  color,
  a = 0.35,
  blur = 16,
  blend = 'screen',
  core = 0.55,
  fade = [1, 0.55, 0.22, 0],
}) => {
  const th = (ang * Math.PI) / 180;
  const [dx, dy] = [Math.cos(th), Math.sin(th)];
  const [nx, ny] = [-dy, dx];
  const cone = (k) => {
    const half = Math.tan(((spread * k) / 2) * (Math.PI / 180)) * len + w0 / 2;
    return [
      [x + (nx * w0) / 2, y + (ny * w0) / 2],
      [x + dx * len + nx * half, y + dy * len + ny * half],
      [x + dx * len - nx * half, y + dy * len - ny * half],
      [x - (nx * w0) / 2, y - (ny * w0) / 2],
    ];
  };
  const g = nid('bm');
  const f = nid('bmf');
  const f2 = nid('bmf');
  const stops = fade.map((v, i) => [r3(i / (fade.length - 1)), color, r3(a * v)]);
  return `<defs>${ugrad(g, stops, [x, y, x + dx * len, y + dy * len])}<filter id="${f}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter><filter id="${f2}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r1(blur * 0.45)}"/></filter></defs><g style="mix-blend-mode:${blend}"><path d="${pts(cone(1))}Z" fill="url(#${g})" filter="url(#${f})"/>${core ? `<path d="${pts(cone(0.45))}Z" fill="url(#${g})" opacity="${core}" filter="url(#${f2})"/>` : ''}</g>`;
};

/**
 * Textured haze: fractal noise turned into a colored veil (alpha from the noise), over a box. `k` and `b`
 * shape the alpha (alpha = noise·k + b), then scaled by `a`.
 */
export const hazeTex = ({
  box: [x0, y0, w, h] = [0, 0, W, H],
  color,
  a = 0.5,
  freq = [0.004, 0.006],
  oct = 4,
  seed = 1,
  k = 1.6,
  b = -0.45,
  mask,
  blend = 'normal',
}) => {
  const f = nid('hz');
  const [cr, cg, cb] = color.startsWith('#')
    ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    : color.match(/\d+/g).map((v) => Number(v) / 255);
  const m = mask ? ` mask="url(#${mask})"` : '';
  return `<defs><filter id="${f}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${r3(freq[0])} ${r3(freq[1])}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix values="0 0 0 0 ${r3(cr)}  0 0 0 0 ${r3(cg)}  0 0 0 0 ${r3(cb)}  ${r3(k)} 0 0 0 ${r3(b)}"/></filter></defs><rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" filter="url(#${f})" opacity="${r3(a)}"${m} style="mix-blend-mode:${blend}"/>`;
};

/** a vertical mask: white where the stops say (offset, opacity), over the whole frame or a y range */
export const vmask = (stops, [ya, yb] = [0, H]) => {
  const id = nid('vm');
  const g = nid('vmg');
  return {
    id,
    defs: `<defs>${ugrad(
      g,
      stops.map(([o, v]) => [o, '#fff', v]),
      [0, ya, 0, yb],
    )}<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${g})"/></mask></defs>`,
  };
};

/** a radial mask: white inside the ellipse fading out (stops are [offset, opacity] from the centre) */
export const rmask = ({ x, y, rx, ry = rx, stops }) => {
  const id = nid('rm');
  const g = nid('rmg');
  return {
    id,
    defs: `<defs><radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${r1(x)}" cy="${r1(y)}" r="${r1(rx)}" gradientTransform="translate(${r1(x)} ${r1(y)}) scale(1 ${r3(ry / rx)}) translate(${r1(-x)} ${r1(-y)})">${stopsOf(
      stops.map(([o, v]) => [o, '#fff', v]),
    )}</radialGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${g})"/></mask></defs>`,
  };
};

/** a group blurred by s (page-sized filter region) */
export const blurred = (s, inner, attrs = '') => {
  const f = nid('bl');
  return `<defs><filter id="${f}" x="-200" y="-200" width="${W + 400}" height="${H + 400}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${s}"/></filter></defs><g filter="url(#${f})" ${attrs}>${inner}</g>`;
};

/** a full-frame rect in a color (with opacity and blend) */
export const wash = (color, a = 1, blend = 'normal', box = [0, 0, W, H]) =>
  `<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${color}" opacity="${r3(a)}" style="mix-blend-mode:${blend}"/>`;

/** a vertical gradient over a box (page coordinates) */
export const vgrad = (stops, [x, y, w, h] = [0, 0, W, H], attrs = '') => {
  const id = nid('vg');
  return `<defs>${ugrad(id, stops, [0, y, 0, y + h])}</defs><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="url(#${id})" ${attrs}/>`;
};

/** a radial gradient ellipse with explicit stops ([offset, color, opacity]) */
export const rgrad = ({ x, y, rx, ry = rx, stops, blend = 'normal', attrs = '' }) => {
  const id = nid('rg');
  return `<defs><radialGradient id="${id}">${stopsOf(stops)}</radialGradient></defs><ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="url(#${id})" style="mix-blend-mode:${blend}" ${attrs}/>`;
};

export { gaussOf, mix };
