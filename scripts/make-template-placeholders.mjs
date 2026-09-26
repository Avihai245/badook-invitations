// Placeholder photographs for a photographic design, until the owner's real photos are in the
// template-media bucket: soft gradients, light and film grain in the design's palette, at the aspect
// ratios and sizes of the real ones. Drawn in headless Chromium (canvas → WebP), written to
// public/templates/<id>/<file> (shipped with the app — MASTER_PROMPT §1.1: public/templates keeps only
// placeholders) and listed with a content hash in src/features/invitations/templates/placeholder-media.json,
// which the renderer reads (renderer/assets.ts): a file the bucket has always wins over its placeholder.
//
// The list of pictures is the design's own: the `photo-*` entries of its manifest's `assets`. Each gets
// a look from STYLES below (its key), else a quiet default.
//
// Usage: node scripts/make-template-placeholders.mjs [template id …]   (default: lumiere)
// The files are committed; re-run only to change them. Swapping in the real photos: upload them to the
// bucket (docs/template-media.md) under the same names — or edit the manifest's `assets` — then
// `npm run media:sync` and deploy (the seed re-publishes the demos).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['lumiere'];
const LIST = 'src/features/invitations/templates/placeholder-media.json';

/**
 * How each picture looks: its size, and a scene for the painter below — light (where the sun or the
 * window is), the sky's gradient, a horizon, bokeh, candles, a line of string lights.
 */
const STYLES = {
  // warm dusk behind the couple: dark enough at the top and the bottom for white names
  'photo-hero': {
    size: [1080, 1920],
    sky: ['#2E211A', '#4F3727', '#8A6244', '#5A3F2E', '#1E150F'],
    stops: [0, 0.3, 0.5, 0.74, 1],
    sun: { x: 0.68, y: 0.42, r: 0.42, color: 'rgba(255,212,160,.42)' },
    bokeh: { count: 22, color: [255, 222, 176], top: 0.12, bottom: 0.62, size: [0.014, 0.05] },
    vignette: 0.62,
    grain: 6,
  },
  // the sea at dusk, the sun low on it
  'photo-quote': {
    size: [1200, 1600],
    sky: ['#1E1A2B', '#3C2E45', '#7A5260', '#B98270', '#E0AE86'],
    stops: [0, 0.3, 0.52, 0.64, 0.72],
    sun: { x: 0.4, y: 0.7, r: 0.36, color: 'rgba(255,206,160,.5)' },
    horizon: { y: 0.72, color: 'rgba(34,26,38,.78)', reflect: true },
    bokeh: { count: 8, color: [255, 206, 170], top: 0.06, bottom: 0.46, size: [0.008, 0.022] },
    vignette: 0.6,
    grain: 6,
  },
  // an interior in window light: mid tones, never blown out
  'photo-story': {
    size: [1200, 1500],
    sky: ['#CDBDA9', '#B09780', '#86705E', '#4E3E33'],
    stops: [0, 0.4, 0.72, 1],
    window: { x: 0.14, y: 0.1, w: 0.38, h: 0.54, alpha: 0.4 },
    sun: { x: 0.3, y: 0.34, r: 0.4, color: 'rgba(255,240,214,.4)' },
    rays: true,
    vignette: 0.5,
    grain: 6,
  },
  // a garden at night under a string of lights
  'photo-venue': {
    size: [1200, 1600],
    sky: ['#0E1512', '#17231C', '#243427', '#1A221C'],
    stops: [0, 0.4, 0.7, 1],
    lights: { y: 0.3, sag: 0.12, count: 16, color: [255, 214, 150] },
    bokeh: { count: 18, color: [255, 206, 140], top: 0.45, bottom: 0.9, size: [0.016, 0.05] },
    trees: '#0B100D',
    vignette: 0.55,
    grain: 7,
  },
  // candles on a table, glowing in the dark
  'photo-rsvp': {
    size: [1200, 1600],
    sky: ['#140E0B', '#2A1D16', '#3C2A1F', '#1A120E'],
    stops: [0, 0.45, 0.72, 1],
    candles: { count: 6, y: 0.7, color: [255, 196, 120] },
    bokeh: { count: 14, color: [255, 200, 140], top: 0.12, bottom: 0.55, size: [0.016, 0.055] },
    vignette: 0.6,
    grain: 7,
  },
};
const DEFAULT_STYLE = {
  size: [1200, 1600],
  sky: ['#2A211C', '#8A6A45', '#E8D9C4'],
  stops: [0, 0.6, 1],
  vignette: 0.5,
  grain: 7,
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const list = JSON.parse(readFileSync(LIST, 'utf8'));

for (const id of ids) {
  const manifest = JSON.parse(readFileSync(`invitation-templates-pack/${id}/manifest.json`, 'utf8'));
  const photos = Object.entries(manifest.assets)
    .filter(([key]) => key.startsWith('photo-'))
    .map(([key, path]) => ({ key, file: path.split('/').pop(), style: STYLES[key] ?? DEFAULT_STYLE }));
  const files = await page.evaluate(async (photos) => {
    const toB64 = async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const out = {};
    for (const [n, { key, file, style: st }] of photos.entries()) {
      // a seeded generator per picture: the same pictures on every run
      let seed = 97 + n * 7919;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const [w, h] = st.size;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      // the sky: a vertical gradient
      const sky = g.createLinearGradient(0, 0, 0, h);
      st.sky.forEach((color, i) => sky.addColorStop(st.stops[i], color));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      const glow = (x, y, r, color) => {
        const clear = color.replace(/,[^,]*\)$/, ',0)');
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(
          0.5,
          color.replace(/,([^,]*)\)$/, (_, a) => `,${a * 0.35})`),
        );
        grad.addColorStop(1, clear);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.globalCompositeOperation = 'source-over';
      };
      if (st.window) {
        // window light: a soft bright pane and its light falling across the room
        const { x, y, w: ww, h: wh, alpha } = st.window;
        g.fillStyle = `rgba(255,248,234,${alpha})`;
        g.filter = 'blur(40px)';
        g.fillRect(x * w, y * h, ww * w, wh * h);
        g.filter = 'none';
        g.strokeStyle = 'rgba(110,88,70,.3)';
        g.lineWidth = w * 0.014;
        g.filter = 'blur(10px)';
        g.beginPath();
        g.moveTo((x + ww / 2) * w, y * h);
        g.lineTo((x + ww / 2) * w, (y + wh) * h);
        g.moveTo(x * w, (y + wh / 2) * h);
        g.lineTo((x + ww) * w, (y + wh / 2) * h);
        g.stroke();
        g.filter = 'none';
      }
      if (st.sun) glow(st.sun.x * w, st.sun.y * h, st.sun.r * Math.max(w, h), st.sun.color);
      if (st.rays) {
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const grad = g.createLinearGradient(0.2 * w, 0.2 * h, 0.9 * w, 0.95 * h);
          grad.addColorStop(0, 'rgba(255,240,215,.07)');
          grad.addColorStop(1, 'rgba(255,240,215,0)');
          g.fillStyle = grad;
          g.beginPath();
          const a = 0.16 + i * 0.07;
          g.moveTo(a * w, 0.14 * h);
          g.lineTo((a + 0.05) * w, 0.14 * h);
          g.lineTo((a + 0.55) * w, h);
          g.lineTo((a + 0.4) * w, h);
          g.closePath();
          g.filter = 'blur(18px)';
          g.fill();
          g.filter = 'none';
        }
        g.globalCompositeOperation = 'source-over';
      }
      if (st.horizon) {
        const y0 = st.horizon.y * h;
        const land = g.createLinearGradient(0, y0 - h * 0.02, 0, h);
        land.addColorStop(0, 'rgba(0,0,0,0)');
        land.addColorStop(0.08, st.horizon.color);
        land.addColorStop(1, st.horizon.color.replace(/,[^,]*\)$/, ',.95)'));
        g.fillStyle = land;
        g.filter = 'blur(22px)';
        // drawn past the edges, so the blur leaves no light frame
        const bleed = w * 0.1;
        g.beginPath();
        g.moveTo(-bleed, h + bleed);
        for (let x = -bleed; x <= w + bleed; x += 12)
          g.lineTo(x, y0 + Math.sin(x / (w / 2.6) + n) * h * 0.012 + Math.sin(x / (w / 9)) * h * 0.004);
        g.lineTo(w + bleed, h + bleed);
        g.closePath();
        g.fill();
        g.filter = 'none';
        if (st.horizon.reflect) {
          // the sun's path on the water: a long soft glow below it
          g.save();
          g.translate(st.sun.x * w, y0 + h * 0.1);
          g.scale(0.32, 1);
          glow(0, 0, h * 0.14, 'rgba(255,204,160,.34)');
          g.restore();
        }
      }
      if (st.trees) {
        // soft tree shapes against the evening sky
        g.fillStyle = st.trees;
        g.filter = 'blur(14px)';
        for (let i = 0; i < 7; i++) {
          const x = rnd() * w;
          const r = (0.12 + rnd() * 0.18) * w;
          g.beginPath();
          g.arc(x, h * (0.08 + rnd() * 0.2), r, 0, Math.PI * 2);
          g.fill();
        }
        g.filter = 'none';
      }
      if (st.lights) {
        // a string of lights hanging across the garden
        const { y, sag, count, color } = st.lights;
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = t * w;
          const yy = y * h + Math.sin(t * Math.PI) * sag * h;
          glow(x, yy, w * 0.05, `rgba(${color.join(',')},.75)`);
          glow(x, yy, w * 0.012, 'rgba(255,248,230,1)');
        }
      }
      if (st.candles) {
        const { count, y, color } = st.candles;
        for (let i = 0; i < count; i++) {
          const x = (0.12 + (i / (count - 1)) * 0.76 + (rnd() - 0.5) * 0.05) * w;
          const yy = (y + (rnd() - 0.5) * 0.08) * h;
          // the candle's body, warm in its own light
          g.fillStyle = 'rgba(236,222,200,.55)';
          g.filter = 'blur(4px)';
          g.fillRect(x - w * 0.018, yy + h * 0.012, w * 0.036, h * (0.08 + rnd() * 0.08));
          g.filter = 'none';
          glow(x, yy, w * 0.2, `rgba(${color.join(',')},.55)`);
          glow(x, yy, w * 0.03, 'rgba(255,240,205,1)');
        }
      }
      if (st.bokeh) {
        const { count, color, top, bottom, size } = st.bokeh;
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < count; i++) {
          const x = rnd() * w;
          const y = (top + rnd() * (bottom - top)) * h;
          const r = (size[0] + rnd() * (size[1] - size[0])) * Math.max(w, h);
          const a = 0.06 + rnd() * 0.12;
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, `rgba(${color.join(',')},${a * 0.8})`);
          grad.addColorStop(0.72, `rgba(${color.join(',')},${a})`);
          grad.addColorStop(0.9, `rgba(${color.join(',')},${a * 0.45})`);
          grad.addColorStop(1, `rgba(${color.join(',')},0)`);
          g.fillStyle = grad;
          g.filter = 'blur(2px)';
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.filter = 'none';
        }
        g.globalCompositeOperation = 'source-over';
      }
      // a vignette, like a lens
      const v = g.createRadialGradient(
        w / 2,
        h * 0.45,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75,
      );
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(12,8,6,${st.vignette})`);
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      // film grain
      const img = g.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (rnd() + rnd() - 1) * st.grain * 1.6;
        d[i] += noise;
        d[i + 1] += noise;
        d[i + 2] += noise;
      }
      g.putImageData(img, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
      out[file] = { key, b64: await toB64(blob) };
    }
    return out;
  }, photos);

  const dir = `public/templates/${id}`;
  mkdirSync(dir, { recursive: true });
  list.templates[id] = {};
  for (const [file, { b64 }] of Object.entries(files)) {
    const bytes = Buffer.from(b64, 'base64');
    writeFileSync(`${dir}/${file}`, bytes);
    list.templates[id][file] = {
      hash: createHash('md5').update(bytes).digest('hex').slice(0, 10),
      bytes: bytes.length,
    };
    console.log(`${dir}/${file}  ${Math.round(bytes.length / 1024)} KB`);
  }
}
writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`);
await browser.close();
