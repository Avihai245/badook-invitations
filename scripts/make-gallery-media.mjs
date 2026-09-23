// Generates the gallery test photos (tests/fixtures/media/gallery-<n>.jpg): soft gradients with a big
// number, so a carousel or a lightbox position is visible in screenshots. Drawn in headless Chromium.
// Usage: node scripts/make-gallery-media.mjs   (files are committed; re-run only to change them)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'tests/fixtures/media';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const files = await page.evaluate(async () => {
  const palettes = [
    ['#F8DCC4', '#9A5C6B'],
    ['#E6EEF0', '#2F6470'],
    ['#F6EBD3', '#7A5E2E'],
    ['#EDE7F6', '#5B4B8A'],
    ['#E8F3E8', '#3F6B47'],
  ];
  const out = {};
  for (const [i, [a, b]] of palettes.entries()) {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 1000;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 800, 1000);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, 1000);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.beginPath();
    g.arc(560, 300, 220, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.font = 'bold 260px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(i + 1), 400, 560);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const byte of buf) s += String.fromCharCode(byte);
    out[`gallery-${i + 1}.jpg`] = btoa(s);
  }
  return out;
});
for (const [name, b64] of Object.entries(files)) writeFileSync(`${OUT}/${name}`, Buffer.from(b64, 'base64'));
await browser.close();
console.log(Object.keys(files).join(', '));
