// Writes the tour's Hebrew captions (WebVTT) from the same schedule the composition renders, so the
// web player's captions match the burned-in subtitles to the frame. Prints the scene timing too.
// Usage: node scripts/vtt.mjs [out.vtt]   (default ../public/video/badook-tour.he.vtt)
import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, loadTour } from './tour-lib.mjs';

const out = path.resolve(process.argv[2] ?? path.join(OUT_DIR, 'badook-tour.he.vtt'));
const { buildSchedule, toVtt } = await loadTour();
const schedule = buildSchedule();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, toVtt(schedule));

const s = (frames) => (frames / schedule.fps).toFixed(2).padStart(6);
for (const seg of schedule.segments) {
  console.log(
    `  ${seg.id.padEnd(9)} at ${s(seg.start)}s  ${s(seg.dur)}s  voice ${seg.seconds.toFixed(2)}s ` +
      `${seg.audio ? 'audio' : seg.estimated ? 'estimate' : 'no audio'}`,
  );
}
console.log(
  `vtt: ${schedule.cues.length} cues, ${s(schedule.total).trim()}s (${schedule.total} frames) → ` +
    path.relative(process.cwd(), out),
);
