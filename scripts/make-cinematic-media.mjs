// Generates the cinematic demo's media (tests/fixtures/media/cine-*): five painted "photographs" —
// a sunset over hills, a couple's silhouette at golden hour, a field of evening bokeh, a lit venue at
// night, a table of candles — and a 4s looping video of drifting light with its still. Drawn in
// headless Chromium (canvas + MediaRecorder), no ffmpeg needed; used by the kitchen sink's `cinematic`
// document, the end-to-end tests and the performance gate (`/dev/media/<file>`).
// Usage: node scripts/make-cinematic-media.mjs   (files are committed; re-run only to change them)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'tests/fixtures/media';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const files = await page.evaluate(async () => {
  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  // a seeded PRNG: the same pictures every run
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const canvasOf = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
  };
  const sky = (g, w, h, stops) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([at, color]) => grad.addColorStop(at, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  };
  const glow = (g, x, y, r, color) => {
    // fade to the same color at alpha 0 (to transparent black would darken the edge into a halo)
    const clear = color.startsWith('rgba')
      ? color.replace(/,[^,]*\)$/, ',0)')
      : color.replace('rgb(', 'rgba(').replace(')', ',0)');
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.45, color.startsWith('rgba') ? color.replace(/,([^,]*)\)$/, (_, a) => `,${a * 0.45})`) : color);
    grad.addColorStop(1, clear);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over';
  };
  const hills = (g, w, h, base, amp, color, phase) => {
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8)
      g.lineTo(x, base + Math.sin(x / (w / 3) + phase) * amp + Math.sin(x / (w / 11) + phase * 2) * amp * 0.25);
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  const grain = (g, w, h, amount) => {
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * amount;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  };
  const jpeg = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  const out = {};

  // 1 — sunset over the hills (landscape, the quote's full-bleed background)
  {
    const [c, g] = canvasOf(1800, 1200);
    sky(g, 1800, 1200, [
      [0, '#2B2340'],
      [0.35, '#7A3F5E'],
      [0.58, '#E0795A'],
      [0.72, '#F6B06B'],
      [1, '#F9D59A'],
    ]);
    glow(g, 1180, 760, 520, 'rgba(255,214,150,.85)');
    glow(g, 1180, 760, 140, 'rgba(255,246,220,1)');
    hills(g, 1800, 1200, 820, 60, '#6B3548', 0.4);
    hills(g, 1800, 1200, 930, 44, '#4A2536', 1.9);
    hills(g, 1800, 1200, 1040, 30, '#2E1624', 3.1);
    grain(g, 1800, 1200, 10);
    out['cine-sunset.jpg'] = await toB64(await jpeg(c));
  }
  // 2 — a couple's silhouette at golden hour (portrait, the split layouts)
  {
    const [c, g] = canvasOf(1200, 1500);
    sky(g, 1200, 1500, [
      [0, '#F3C889'],
      [0.5, '#E9936A'],
      [1, '#8E4E58'],
    ]);
    glow(g, 640, 560, 520, 'rgba(255,236,190,.9)');
    hills(g, 1200, 1500, 1180, 30, '#5C3040', 0.8);
    g.fillStyle = '#2A1420';
    // two figures, leaning in
    const person = (x, y, s, lean) => {
      g.save();
      g.translate(x, y);
      g.rotate(lean);
      g.beginPath();
      g.ellipse(0, -330 * s, 54 * s, 64 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-70 * s, -250 * s);
      g.quadraticCurveTo(-120 * s, 60 * s, -150 * s, 330 * s);
      g.lineTo(150 * s, 330 * s);
      g.quadraticCurveTo(120 * s, 60 * s, 70 * s, -250 * s);
      g.closePath();
      g.fill();
      g.restore();
    };
    person(520, 1180, 1.05, 0.08);
    person(700, 1190, 1.12, -0.08);
    grain(g, 1200, 1500, 9);
    out['cine-couple.jpg'] = await toB64(await jpeg(c));
  }
  // 3 — evening bokeh (the parents' split)
  {
    const [c, g] = canvasOf(1200, 1500);
    sky(g, 1200, 1500, [
      [0, '#1D2436'],
      [1, '#3B2A3C'],
    ]);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 1200;
      const y = rnd() * 1500;
      const r = 30 + rnd() * 110;
      const warm = rnd() > 0.3;
      glow(g, x, y, r, warm ? `rgba(255,${190 + rnd() * 50},${120 + rnd() * 60},${0.25 + rnd() * 0.35})` : `rgba(180,200,255,${0.2 + rnd() * 0.25})`);
    }
    grain(g, 1200, 1500, 8);
    out['cine-bokeh.jpg'] = await toB64(await jpeg(c));
  }
  // 4 — a lit venue at night (the parallax "where")
  {
    const [c, g] = canvasOf(1800, 1300);
    sky(g, 1800, 1300, [
      [0, '#0E1424'],
      [0.6, '#27304A'],
      [1, '#3E3A4A'],
    ]);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
      g.fillRect(rnd() * 1800, rnd() * 640, 2, 2);
    }
    // the hall: a long low building with arched windows
    g.fillStyle = '#1A1C28';
    g.fillRect(260, 700, 1280, 420);
    g.beginPath();
    g.moveTo(220, 710);
    g.lineTo(900, 520);
    g.lineTo(1580, 710);
    g.closePath();
    g.fill();
    for (let i = 0; i < 9; i++) {
      const x = 340 + i * 138;
      glow(g, x + 34, 880, 120, 'rgba(255,200,120,.35)');
      g.fillStyle = '#F7C77E';
      g.beginPath();
      g.moveTo(x, 1000);
      g.lineTo(x, 860);
      g.arc(x + 34, 860, 34, Math.PI, 0);
      g.lineTo(x + 68, 1000);
      g.closePath();
      g.fill();
    }
    // string lights
    for (let i = 0; i < 40; i++) glow(g, 120 + i * 40, 640 + Math.sin(i / 3) * 18, 18, 'rgba(255,220,150,.9)');
    hills(g, 1800, 1300, 1150, 14, '#0C0F18', 0.2);
    grain(g, 1800, 1300, 8);
    out['cine-venue.jpg'] = await toB64(await jpeg(c));
  }
  // 5 — candles on a long table (the footer)
  {
    const [c, g] = canvasOf(1800, 1200);
    sky(g, 1800, 1200, [
      [0, '#1B1216'],
      [1, '#3A2324'],
    ]);
    g.fillStyle = '#E9DCCB';
    g.beginPath();
    g.moveTo(0, 1200);
    g.lineTo(700, 640);
    g.lineTo(1100, 640);
    g.lineTo(1800, 1200);
    g.closePath();
    g.fill();
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const x = 700 + t * 400 + (i % 2 ? -1 : 1) * (60 + t * 300);
      const y = 660 + t * 480;
      const s = 0.4 + t * 1.2;
      glow(g, x, y - 90 * s, 160 * s, 'rgba(255,190,110,.5)');
      g.fillStyle = '#F4EBDD';
      g.fillRect(x - 10 * s, y - 80 * s, 20 * s, 80 * s);
      g.fillStyle = '#FFE2A0';
      g.beginPath();
      g.ellipse(x, y - 96 * s, 7 * s, 16 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, 1800, 1200, 10);
    out['cine-candles.jpg'] = await toB64(await jpeg(c));
  }

  // the loop: drifting warm lights (4s, 720×1280), and its first frame as the still
  {
    const W = 720;
    const H = 1280;
    const [c, g] = canvasOf(W, H);
    const lights = Array.from({ length: 26 }, () => ({
      x: rnd() * W,
      y: rnd() * H,
      r: 40 + rnd() * 120,
      dx: (rnd() - 0.5) * 60,
      dy: -20 - rnd() * 50,
      a: 0.2 + rnd() * 0.4,
    }));
    const draw = (t) => {
      sky(g, W, H, [
        [0, '#241A2E'],
        [1, '#4A2A36'],
      ]);
      for (const l of lights) {
        // a loop: every light returns to where it started after 4s
        const k = Math.sin(t * Math.PI * 2);
        glow(g, l.x + l.dx * k, l.y + l.dy * Math.sin(t * Math.PI * 2 + l.r), l.r, `rgba(255,205,140,${l.a})`);
      }
    };
    draw(0);
    out['cine-loop-poster.jpg'] = await toB64(await jpeg(c));
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 900_000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 4000;
        draw(Math.min(1, t));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    rec.stop();
    await done;
    out['cine-loop.webm'] = await toB64(new Blob(chunks, { type: 'video/webm' }));
  }
  return out;
});
for (const [name, b64] of Object.entries(files)) writeFileSync(`${OUT}/${name}`, Buffer.from(b64, 'base64'));
await browser.close();
console.log(
  Object.entries(files)
    .map(([n, b]) => `${n} ${Math.round((b.length * 0.75) / 1024)}KB`)
    .join('\n'),
);
