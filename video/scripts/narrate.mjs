// Narration for the tour: one MP3 per segment of src/tour/narration.ts, from Azure AI Speech's
// text-to-speech REST API (the same call as the app's src/features/voice/server/speech.ts), then
// src/tour/durations.json with each segment's measured length. The composition times its scenes,
// subtitles and <Audio> from that file.
//
//   INVITES_TTS_AZURE_KEY=… INVITES_TTS_AZURE_REGION=westeurope node scripts/narrate.mjs
//
// env: INVITES_TTS_AZURE_KEY, INVITES_TTS_AZURE_REGION or INVITES_TTS_AZURE_ENDPOINT (another base
// address), TOUR_VOICE (default he-IL-HilaNeural; e.g. he-IL-AvriNeural), TOUR_RATE (default -4%).
// flags: --force (re-synthesize every segment), --estimate (no audio: write the text-length estimates),
// --files (no service: use the recorded MP3s already in public/narration/<id>.mp3 — see NARRATION.he.md).
// Without a key it says so and exits 0, so `npm run video:tour` still renders a captions-only video.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DURATIONS_FILE, NARRATION_DIR, loadTour, mp3Seconds } from './tour-lib.mjs';

const args = new Set(process.argv.slice(2));
const key = process.env.INVITES_TTS_AZURE_KEY ?? '';
const region = process.env.INVITES_TTS_AZURE_REGION ?? '';
const endpoint = (process.env.INVITES_TTS_AZURE_ENDPOINT ?? '').replace(/\/+$/, '');
const voice = process.env.TOUR_VOICE || 'he-IL-HilaNeural';
const rate = process.env.TOUR_RATE || '-4%';
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

const tour = await loadTour();
const { NARRATION, estimateSeconds } = tour;

const estimates = () =>
  Object.fromEntries(NARRATION.map((s) => [s.id, { seconds: estimateSeconds(s.text), audio: false }]));
const writeDurations = (d) => fs.writeFileSync(DURATIONS_FILE, `${JSON.stringify(d, null, 2)}\n`);

if (args.has('--estimate')) {
  writeDurations(estimates());
  console.log(
    `narrate: wrote text-length estimates (no audio) to ${path.relative(process.cwd(), DURATIONS_FILE)}`,
  );
  process.exit(0);
}

if (args.has('--files')) {
  // a voice-over recorded (or made elsewhere) as one MP3 per scene: measure each and time the scenes by
  // it; a scene without its file keeps the text-length estimate and stays silent
  const next = estimates();
  let found = 0;
  for (const { id } of NARRATION) {
    const file = path.join(NARRATION_DIR, `${id}.mp3`);
    if (!fs.existsSync(file)) {
      console.log(`  ${id.padEnd(9)} —  no ${path.relative(process.cwd(), file)} (silent, estimated)`);
      continue;
    }
    const seconds = Math.round(mp3Seconds(fs.readFileSync(file)) * 100) / 100;
    if (!seconds) {
      console.error(`narrate: ${path.relative(process.cwd(), file)}: not an MP3 it can read (export as MP3)`);
      process.exit(1);
    }
    next[id] = { seconds, audio: true, voice: 'recorded' };
    found++;
    console.log(`  ${id.padEnd(9)} ${seconds.toFixed(2)}s  (recorded)`);
  }
  writeDurations(next);
  console.log(`narrate: ${found} of ${NARRATION.length} scenes have a recording. Wrote ${path.relative(process.cwd(), DURATIONS_FILE)}.`);
  process.exit(0);
}

if (!key || (!region && !endpoint)) {
  console.log(
    'narrate: skipped, no voice-over. Set INVITES_TTS_AZURE_KEY and INVITES_TTS_AZURE_REGION (or ' +
      'INVITES_TTS_AZURE_ENDPOINT) to make one; the tour renders with subtitles only and the timing in ' +
      'src/tour/durations.json.',
  );
  process.exit(0);
}

const xml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const lang = voice.split('-').slice(0, 2).join('-');
const ssml = (text) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
  `<voice name="${xml(voice)}"><prosody rate="${xml(rate)}">${xml(text)}</prosody></voice></speak>`;
const hashOf = (text) => createHash('sha256').update(`${voice}\n${rate}\n${text}`).digest('hex').slice(0, 16);

const base = endpoint || `https://${region}.tts.speech.microsoft.com`;
async function synthesize(text) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${base}/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
          'User-Agent': 'badook-video',
        },
        body: ssml(text),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw new Error(
        `request failed (${err?.cause?.code ?? err?.name ?? 'network'}); is ${new URL(base).host} reachable?`,
      );
    }
    if (res.ok) {
      const audio = Buffer.from(await res.arrayBuffer());
      if (audio.length) return audio;
    } else {
      await res.body?.cancel().catch(() => undefined);
    }
    const retry = !res.ok ? res.status === 429 || res.status >= 500 : true;
    if (!retry || attempt >= 4) {
      const hint =
        res.status === 401 || res.status === 403
          ? ' (check the key and the region)'
          : res.status === 400
            ? ` (check the voice "${voice}" and the rate "${rate}")`
            : '';
      throw new Error(`speech ${res.ok ? 'returned empty audio' : res.status}${hint}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(DURATIONS_FILE, 'utf8'));
} catch {
  previous = {};
}

fs.mkdirSync(NARRATION_DIR, { recursive: true });
const next = {};
let made = 0;
for (const { id, text } of NARRATION) {
  const file = path.join(NARRATION_DIR, `${id}.mp3`);
  const hash = hashOf(text);
  const old = previous[id];
  if (!args.has('--force') && old?.audio && old.hash === hash && fs.existsSync(file)) {
    next[id] = old;
    console.log(`  ${id.padEnd(9)} ${old.seconds.toFixed(2)}s  (unchanged)`);
    continue;
  }
  const audio = await synthesize(text).catch((err) => {
    console.error(`narrate: "${id}" failed: ${err.message}`);
    process.exit(1);
  });
  fs.writeFileSync(file, audio);
  const seconds = Math.round(mp3Seconds(audio) * 100) / 100;
  if (!seconds) {
    console.error(`narrate: "${id}": could not read the MP3's length`);
    process.exit(1);
  }
  next[id] = { seconds, audio: true, voice, hash };
  made++;
  console.log(`  ${id.padEnd(9)} ${seconds.toFixed(2)}s  ${voice} ${rate}`);
}

for (const f of fs.readdirSync(NARRATION_DIR)) {
  if (f.endsWith('.mp3') && !next[f.slice(0, -4)])
    console.log(`narrate: note: ${f} is not in the narration (unused)`);
}
writeDurations(next);
const total = Object.values(next).reduce((s, d) => s + d.seconds, 0);
console.log(
  `narrate: ${made} new, ${NARRATION.length - made} unchanged; ${total.toFixed(1)}s of voice. ` +
    `Wrote ${path.relative(process.cwd(), DURATIONS_FILE)}.`,
);
