// Generates the synthetic cover/music media used by the P3 end-to-end tests (tests/fixtures/media):
// a 9:16 poster, an opening video whose first 0.5s equal the poster, a blank seal PNG and a short
// audio track — drawn and recorded in headless Chromium (canvas + MediaRecorder), no ffmpeg needed.
// Usage: node scripts/make-test-media.mjs   (files are committed; re-run only to change them)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'tests/fixtures/media';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const files = await page.evaluate(async () => {
  const W = 390;
  const H = 844;
  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const b of buf) s += String.fromCharCode(b);
    return btoa(s);
  };
  const scene = (ctx, t) => {
    // t: 0..1 opening progress (0 = closed, identical to the poster)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F3EDE4');
    g.addColorStop(1, '#DCD1C3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const ew = 320;
    const eh = 220;
    const x = (W - ew) / 2;
    const y = H / 2 - eh / 2;
    // card rising out of the envelope
    ctx.fillStyle = '#E8A08E';
    ctx.fillRect(x + 20, y + 16 - t * 180, ew - 40, eh - 30);
    ctx.fillStyle = '#F6F1E8';
    ctx.fillRect(x, y + eh * 0.35, ew, eh * 0.65);
    // flap: folds from pointing down (closed) to pointing up (open)
    ctx.fillStyle = '#EDE5D8';
    ctx.beginPath();
    ctx.moveTo(x, y + eh * 0.35);
    ctx.lineTo(x + ew, y + eh * 0.35);
    ctx.lineTo(x + ew / 2, y + eh * 0.35 + (1 - 2 * t) * eh * 0.5);
    ctx.closePath();
    ctx.fill();
    // fade to the hero at the end
    if (t > 0.75) {
      ctx.fillStyle = `rgba(94,47,64,${(t - 0.75) * 4})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  scene(ctx, 0);
  const poster = await new Promise((r) => canvas.toBlob(r, 'image/png'));

  // opening video: 0.5s hold on the poster, then 1.9s of opening
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 600_000 });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const frame = () => {
      const ms = performance.now() - t0;
      scene(ctx, Math.max(0, Math.min(1, (ms - 500) / 1900)));
      if (ms < 2500) requestAnimationFrame(frame);
      else resolve();
    };
    frame();
  });
  rec.stop();
  await stopped;
  const video = new Blob(chunks, { type: 'video/webm' });

  // blank wax seal: light warm gray with shading, transparent around it
  const sc = document.createElement('canvas');
  sc.width = 240;
  sc.height = 240;
  const s = sc.getContext('2d');
  const rg = s.createRadialGradient(95, 85, 10, 120, 120, 115);
  rg.addColorStop(0, '#FFFFFF');
  rg.addColorStop(0.6, '#D9D4CE');
  rg.addColorStop(1, '#9E968D');
  s.fillStyle = rg;
  s.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = 110 + Math.sin(i * 2.7) * 5 + Math.cos(i * 1.3) * 4;
    s[i ? 'lineTo' : 'moveTo'](120 + r * Math.cos(a), 120 + r * Math.sin(a));
  }
  s.closePath();
  s.fill();
  s.strokeStyle = 'rgba(0,0,0,.18)';
  s.lineWidth = 3;
  s.beginPath();
  s.arc(120, 120, 78, 0, Math.PI * 2);
  s.stroke();
  const seal = await new Promise((r) => sc.toBlob(r, 'image/png'));

  // music: 4s of a soft two-note chime
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const gain = ac.createGain();
  gain.gain.value = 0.2;
  gain.connect(dest);
  for (const [f, at] of [
    [523.25, 0],
    [659.25, 1],
    [783.99, 2],
  ]) {
    const o = ac.createOscillator();
    o.frequency.value = f;
    o.connect(gain);
    o.start(ac.currentTime + at);
    o.stop(ac.currentTime + at + 1.8);
  }
  const arec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
  const achunks = [];
  arec.ondataavailable = (e) => achunks.push(e.data);
  const astopped = new Promise((r) => (arec.onstop = r));
  arec.start();
  await new Promise((r) => setTimeout(r, 4000));
  arec.stop();
  await astopped;
  const music = new Blob(achunks, { type: 'audio/webm' });

  return {
    'cover-poster.png': await toB64(poster),
    'cover-open.webm': await toB64(video),
    'seal-blank.png': await toB64(seal),
    'music.webm': await toB64(music),
  };
});
for (const [name, b64] of Object.entries(files)) {
  writeFileSync(`${OUT}/${name}`, Buffer.from(b64, 'base64'));
  console.log(name, Buffer.from(b64, 'base64').length, 'bytes');
}
await browser.close();
