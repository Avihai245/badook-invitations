// Records the live invitation on a phone as an MP4 (CDP screencast frames → ffmpeg, real timing).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [,, url, out, plan = 'open'] = process.argv;
const DIR = `${process.env.SP}/rec-${Date.now()}`; fs.mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const p = await c.newPage();
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const cdp = await c.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  const file = `${DIR}/${String(frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
  frames.push({ file, t: f.metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
const t0 = Date.now();
const until = async (ms) => { const w = ms - (Date.now() - t0); if (w > 0) await p.waitForTimeout(w); };
const scroll = async (px, ms) => { const steps = Math.round(ms / 16); for (let i = 0; i < steps; i++) { const e = 0.5 - Math.cos(Math.PI * (i + 1) / steps) / 2, e0 = 0.5 - Math.cos(Math.PI * i / steps) / 2; await p.mouse.wheel(0, px * (e - e0)); await p.waitForTimeout(16); } };
if (plan === 'open') {
  await until(1500); await p.mouse.click(195, 420);
  await until(6500); await scroll(860, 2200);
  await until(10500); await scroll(1100, 2600);
  await until(15000);
} else if (plan === 'hero') {
  await until(1200); await p.mouse.click(195, 420); await until(9000);
}
await cdp.send('Page.stopScreencast');
await b.close();
// concat with each frame's real duration
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const d = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 0.5;
  lines.push(`file '${frames[i].file}'`, `duration ${d.toFixed(4)}`);
}
lines.push(`file '${frames.at(-1).file}'`);
fs.writeFileSync(`${DIR}/list.txt`, lines.join('\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${DIR}/list.txt`, '-vf', 'fps=30,scale=780:1688:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', out]);
console.log('frames', frames.length, 'span', (frames.at(-1).t - frames[0].t).toFixed(2), 's →', out);
