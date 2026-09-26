import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { GALLERY, ORIGINAL_TYPES, isOriginalType, kindOfType } from '@/features/live-gallery/config';
import {
  exifDateTime,
  orientationTransform,
  readJpegInfo,
  swapsSides,
  takenAtIso,
  withoutGps,
} from '@/features/live-gallery/exif';
import {
  applyLut,
  dHash,
  downscale,
  fitWithin,
  hamming,
  laplacianVariance,
  levelsLut,
  meanLuminance,
  sharpness,
  toGray,
} from '@/features/live-gallery/image-metrics';
import { decide, type ModerationInput } from '@/features/live-gallery/moderation';
import { mp4CreationTime, mvhdCreation } from '@/features/live-gallery/mp4';
import {
  backoff,
  failed,
  nextAction,
  previewParts,
  progress,
  retryNow,
  settled,
  succeeded,
  type QueueItem,
} from '@/features/live-gallery/queue';
import { advance, arrive, depart, EMPTY_SHOW } from '@/features/live-gallery/slideshow';
import { galleryState } from '@/features/live-gallery/state';
import { crc32, zipStream, type ZipSource } from '@/features/live-gallery/zip';

// ─── moderation: the thresholds in GALLERY.moderation decide ────────────────────────────────────

const T = GALLERY.moderation;
const base: ModerationInput = {
  mode: 'instant',
  kind: 'image',
  preview: true,
  metrics: { sharpness: 120, brightness: 0.45 },
  nearest: 30,
  ai: null,
};

describe('moderation', () => {
  it('a good photo in instant mode goes to the feed; every check is recorded', () => {
    const d = decide(base);
    expect(d).toMatchObject({ status: 'published', reason: 'ok' });
    expect(d.checks.map((c) => [c.check, c.result])).toEqual([
      ['blur', 'pass'],
      ['dark', 'pass'],
      ['duplicate', 'pass'],
      ['mode', 'published'],
    ]);
  });

  it('approval mode holds everything for the host', () => {
    expect(decide({ ...base, mode: 'approval' })).toMatchObject({ status: 'pending', reason: 'approval' });
  });

  it('blur and darkness hold a photo, right at the thresholds', () => {
    expect(decide({ ...base, metrics: { sharpness: T.blurHold - 0.01, brightness: 0.4 } })).toMatchObject({
      status: 'pending',
      reason: 'blurry',
    });
    expect(decide({ ...base, metrics: { sharpness: T.blurHold, brightness: 0.4 } }).status).toBe('published');
    expect(decide({ ...base, metrics: { sharpness: 200, brightness: T.darkHold - 0.001 } })).toMatchObject({
      status: 'pending',
      reason: 'dark',
    });
    expect(decide({ ...base, metrics: { sharpness: 200, brightness: T.darkHold } }).status).toBe('published');
  });

  it('a duplicate stays out (its hash distance at or under the threshold)', () => {
    expect(decide({ ...base, nearest: T.duplicateDistance })).toMatchObject({
      status: 'rejected',
      reason: 'duplicate',
    });
    expect(decide({ ...base, nearest: T.duplicateDistance + 1 }).status).toBe('published');
  });

  it('the automatic check: rejected over nsfwReject, held over nsfwHold, held for low quality', () => {
    const ai = (nsfw: number, quality = 0.8) => ({
      ...base,
      ai: { status: 'ok' as const, nsfw, quality, reason: 'x' },
    });
    expect(decide(ai(T.nsfwReject))).toMatchObject({ status: 'rejected', reason: 'unsafe' });
    expect(decide(ai(T.nsfwReject - 0.01))).toMatchObject({ status: 'pending', reason: 'nsfw' });
    expect(decide(ai(T.nsfwHold))).toMatchObject({ status: 'pending', reason: 'nsfw' });
    expect(decide(ai(T.nsfwHold - 0.01)).status).toBe('published');
    expect(decide(ai(0.01, T.qualityHold - 0.01))).toMatchObject({ status: 'pending', reason: 'quality' });
    const checks = decide(ai(0.5)).checks;
    expect(checks.find((c) => c.check === 'ai')).toMatchObject({
      result: 'flag',
      score: 0.5,
      decidedBy: 'ai',
    });
  });

  it('a refused, failed or skipped check waits for the host (the configured policy)', () => {
    expect(decide({ ...base, ai: { status: 'refused' } })).toMatchObject({
      status: 'pending',
      reason: 'nsfw',
    });
    expect(decide({ ...base, ai: { status: 'error', error: 'timeout' } })).toMatchObject({
      status: 'pending',
      reason: 'unchecked',
    });
    expect(decide({ ...base, ai: { status: 'skipped', why: 'daily_limit' } })).toMatchObject({
      reason: 'unchecked',
    });
    expect(
      decide({ ...base, ai: { status: 'error', error: 'x' } }, { ...T, aiUnavailable: 'publish' }).status,
    ).toBe('published');
  });

  it('videos skip the still-frame checks; a photo nobody can show waits', () => {
    expect(
      decide({ ...base, kind: 'video', metrics: { sharpness: 1, brightness: 0 }, nearest: 0 }).status,
    ).toBe('published');
    expect(decide({ ...base, preview: false, metrics: null, nearest: null })).toMatchObject({
      status: 'pending',
      reason: 'no_preview',
    });
  });
});

// ─── the browser's checks ───────────────────────────────────────────────────────────────────────

/** A w×h RGBA image from a luminance function. */
function image(w: number, h: number, f: (x: number, y: number) => number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, f(x, y)));
      rgba.set([v, v, v, 255], (y * w + x) * 4);
    }
  return rgba;
}
const checker = (x: number, y: number) => ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? 230 : 25);

function boxBlur(gray: Float32Array, w: number, h: number, r: number) {
  const out = new Float32Array(gray.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += gray[yy * w + xx]!;
          n++;
        }
      out[y * w + x] = s / n;
    }
  return out;
}

describe('image metrics', () => {
  const w = 120;
  const h = 90;
  const sharp = toGray(image(w, h, checker), w, h);

  it('luminance: black 0, white 1, a checkerboard in between', () => {
    expect(
      meanLuminance(
        toGray(
          image(4, 4, () => 0),
          4,
          4,
        ),
      ),
    ).toBe(0);
    expect(
      meanLuminance(
        toGray(
          image(4, 4, () => 255),
          4,
          4,
        ),
      ),
    ).toBeCloseTo(1, 5);
    expect(meanLuminance(sharp)).toBeGreaterThan(0.4);
    expect(meanLuminance(sharp)).toBeLessThan(0.6);
  });

  it('sharpness: a sharp photo scores far above a blurred copy of it, and above the threshold', () => {
    const blurred = boxBlur(sharp, w, h, 4);
    expect(sharpness(sharp, w, h)).toBeGreaterThan(sharpness(blurred, w, h) * 10);
    expect(sharpness(sharp, w, h)).toBeGreaterThan(T.blurHold);
    expect(sharpness(blurred, w, h)).toBeLessThan(sharpness(sharp, w, h));
    // a flat frame has no edges at all
    expect(
      laplacianVariance(
        toGray(
          image(20, 20, () => 128),
          20,
          20,
        ),
        20,
        20,
      ),
    ).toBe(0);
  });

  it('sharpness looks at the best part: a sharp subject on a plain background still counts', () => {
    const subject = toGray(
      image(w, h, (x, y) => (x > 40 && x < 80 && y > 30 && y < 60 ? checker(x, y) : 128)),
      w,
      h,
    );
    expect(sharpness(subject, w, h)).toBeGreaterThan(T.blurHold);
  });

  it('dHash: the same picture resized or re-toned keeps its bits; a different one doesn’t', () => {
    const photo = (x: number, y: number) => 40 + ((x * 3 + y * 5) % 180) + (x > 60 ? 30 : 0);
    const a = dHash(toGray(image(w, h, photo), w, h), w, h);
    const smaller = dHash(
      toGray(
        image(60, 45, (x, y) => photo(x * 2, y * 2)),
        60,
        45,
      ),
      60,
      45,
    );
    const brighter = dHash(
      toGray(
        image(w, h, (x, y) => photo(x, y) * 1.1 + 5),
        w,
        h,
      ),
      w,
      h,
    );
    const other = dHash(
      toGray(
        image(w, h, (x, y) => 255 - photo(x, y)),
        w,
        h,
      ),
      w,
      h,
    );
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hamming(a, brighter)).toBeLessThanOrEqual(T.duplicateDistance);
    expect(hamming(a, smaller)).toBeLessThanOrEqual(12);
    expect(hamming(a, other)).toBeGreaterThan(T.duplicateDistance);
  });

  it('hamming distance between hashes', () => {
    expect(hamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(hamming('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hamming('0f0f0f0f0f0f0f0f', '0f0f0f0f0f0f0f0c')).toBe(2);
    expect(hamming('nope', '0000000000000000')).toBe(64);
  });

  it('downscale keeps the average', () => {
    const g = toGray(
      image(8, 8, (x) => (x < 4 ? 0 : 200)),
      8,
      8,
    );
    const small = downscale(g, 8, 8, 2, 1);
    expect(small[0]).toBeCloseTo(0);
    expect(small[1]).toBeCloseTo(200);
  });

  it('the lift: a flat, foggy photo gets more range, gently; a full-range one is left alone', () => {
    const foggy = toGray(
      image(40, 40, (x) => 90 + x * 2),
      40,
      40,
    ); // 90..168
    const lut = levelsLut(foggy)!;
    expect(lut).not.toBeNull();
    expect(lut[90]!).toBeLessThan(90);
    expect(lut[168]!).toBeGreaterThan(168);
    // gentle: never more contrast than maxGain, blended at `strength`
    const slope = (lut[168]! - lut[90]!) / (168 - 90);
    expect(slope).toBeLessThanOrEqual(GALLERY.enhance.maxGain);
    expect(slope).toBeGreaterThan(1);
    // monotonic
    for (let v = 1; v < 256; v++) expect(lut[v]!).toBeGreaterThanOrEqual(lut[v - 1]!);
    const full = toGray(
      image(64, 4, (x) => x * 4),
      64,
      4,
    ); // 0..252
    expect(levelsLut(full)).toBeNull();
    // a dark photo's midtones rise
    const dark = toGray(
      image(40, 40, (x) => x),
      40,
      40,
    );
    const d = levelsLut(dark)!;
    expect(d[20]!).toBeGreaterThan(20);
    const px = new Uint8ClampedArray([90, 100, 110, 7]);
    applyLut(px, lut);
    expect(px[3]).toBe(7);
    expect(px[0]).toBe(lut[90]);
  });

  it('compression sizes: long edge 2560 for display, 480 for thumbnails, never enlarged', () => {
    expect(GALLERY.image.displayMaxEdge).toBe(2560);
    expect(GALLERY.image.displayQuality).toBe(0.85);
    expect(GALLERY.image.thumbMaxEdge).toBe(480);
    expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 });
    expect(fitWithin(3024, 4032, 2560)).toEqual({ width: 1920, height: 2560 });
    expect(fitWithin(2560, 1920, 480)).toEqual({ width: 480, height: 360 });
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 10, 480)).toEqual({ width: 480, height: 1 });
  });
});

// ─── EXIF ───────────────────────────────────────────────────────────────────────────────────────

/** A JPEG header with an EXIF block (orientation, time taken, offset, a GPS block) and a frame size. */
function jpeg({
  little = true,
  orientation = 6,
  taken = '2027:06:17 21:04:33',
  offset = '+03:00' as string | null,
  gps = true,
  width = 4032,
  height = 3024,
}: Partial<{
  little: boolean;
  orientation: number;
  taken: string;
  offset: string | null;
  gps: boolean;
  width: number;
  height: number;
}> = {}) {
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const entry = (tag: number, type: number, count: number, value: number[]) => [
    ...u16(tag),
    ...u16(type),
    ...u32(count),
    ...[...value, 0, 0, 0, 0].slice(0, 4),
  ];
  const ifd0Count = gps ? 3 : 2;
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + ifd0Count * 12 + 4;
  const exifCount = offset ? 2 : 1;
  const exifData = exifIfd + 2 + exifCount * 12 + 4;
  const takenAt = exifData;
  const offsetAt = takenAt + 20;
  const gpsIfd = offsetAt + (offset ? 8 : 0);
  const gpsData = gpsIfd + 2 + 2 * 12 + 4;
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0));
  tiff.push(...u16(ifd0Count));
  tiff.push(...entry(0x0112, 3, 1, u16(orientation)));
  tiff.push(...entry(0x8769, 4, 1, u32(exifIfd)));
  if (gps) tiff.push(...entry(0x8825, 4, 1, u32(gpsIfd)));
  tiff.push(...u32(0));
  tiff.push(...u16(exifCount));
  tiff.push(...entry(0x9003, 2, 20, u32(takenAt)));
  if (offset) tiff.push(...entry(0x9011, 2, 7, u32(offsetAt)));
  tiff.push(...u32(0));
  tiff.push(...[...taken].map((ch) => ch.charCodeAt(0)), 0);
  if (offset) tiff.push(...[...offset].map((ch) => ch.charCodeAt(0)), 0);
  if (gps) {
    tiff.push(...u16(2));
    tiff.push(...entry(0x0001, 2, 2, [0x4e, 0])); // "N"
    tiff.push(...entry(0x0002, 5, 3, u32(gpsData))); // latitude: 3 rationals
    tiff.push(...u32(0));
    for (const [n, d] of [
      [32, 1],
      [4, 1],
      [4488, 100],
    ])
      tiff.push(...u32(n!), ...u32(d!));
  }
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app1 = [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff, ...exif];
  const sof = [
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

describe('EXIF', () => {
  it('reads the size, the orientation, when it was taken and where the location block is — both byte orders', () => {
    for (const little of [true, false]) {
      const info = readJpegInfo(jpeg({ little }))!;
      expect(info).toMatchObject({
        width: 4032,
        height: 3024,
        orientation: 6,
        dateTime: '2027-06-17T21:04:33',
        offset: '+03:00',
      });
      expect(info.exif?.gpsIfd).toBeGreaterThan(0);
      expect(info.exif?.little).toBe(little);
    }
    expect(readJpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegInfo(jpeg({ gps: false }))!.exif?.gpsIfd).toBeNull();
  });

  it('the time taken becomes an instant: the camera’s offset, or the phone’s zone', () => {
    expect(takenAtIso({ dateTime: '2027-06-17T21:04:33', offset: '+03:00' }, 0)).toBe(
      '2027-06-17T18:04:33.000Z',
    );
    expect(takenAtIso({ dateTime: '2027-06-17T21:04:33', offset: null }, 180)).toBe(
      '2027-06-17T18:04:33.000Z',
    );
    expect(takenAtIso({ dateTime: '2027-06-17T21:04:33', offset: null }, -300)).toBe(
      '2027-06-18T02:04:33.000Z',
    );
    expect(takenAtIso({ dateTime: null, offset: null }, 0)).toBeNull();
    expect(exifDateTime('0000:00:00 00:00:00')).toBeNull();
    expect(exifDateTime('    ')).toBeNull();
  });

  it('the original goes without its location: GPS values zeroed, the block emptied, nothing else moved', () => {
    const file = jpeg();
    const info = readJpegInfo(file)!;
    const exif = info.exif!;
    const segment = file.slice(exif.app1Start, exif.app1End);
    const clean = withoutGps(segment, exif)!;
    expect(clean.length).toBe(segment.length);
    const rebuilt = new Uint8Array([...file.slice(0, exif.app1Start), ...clean, ...file.slice(exif.app1End)]);
    const again = readJpegInfo(rebuilt)!;
    // everything else is intact
    expect(again).toMatchObject({
      width: 4032,
      height: 3024,
      orientation: 6,
      dateTime: '2027-06-17T21:04:33',
    });
    // the GPS directory is empty and its values are gone (4488/100 no longer anywhere)
    const view = new DataView(rebuilt.buffer);
    expect(view.getUint16(again.exif!.gpsIfd!, true)).toBe(0);
    const hasLatitude = [...rebuilt].some(
      (_, i) => i + 4 <= rebuilt.length && view.getUint32(i, true) === 4488,
    );
    expect(hasLatitude).toBe(false);
    expect(withoutGps(segment, { ...exif, gpsIfd: null })).toBeNull();
  });

  it('orientation: which sides swap, and the canvas transform for each', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(swapsSides)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    // a point at the stored image's origin lands in the right corner of the upright canvas (w=300, h=400)
    const land = (o: number) => {
      const [a, b, c, d, e, f] = orientationTransform(o, 300, 400);
      return [a * 0 + c * 0 + e, b * 0 + d * 0 + f];
    };
    expect(land(1)).toEqual([0, 0]);
    expect(land(3)).toEqual([300, 400]);
    expect(land(6)).toEqual([300, 0]);
    expect(land(8)).toEqual([0, 400]);
  });
});

// ─── MP4 ────────────────────────────────────────────────────────────────────────────────────────

function box(type: string, payload: number[]) {
  const size = 8 + payload.length;
  return [
    size >>> 24,
    (size >> 16) & 0xff,
    (size >> 8) & 0xff,
    size & 0xff,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...payload,
  ];
}
const be32 = (v: number) => [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];

describe('MP4 creation time', () => {
  const when = Date.UTC(2027, 5, 17, 18, 4, 33) / 1000 + 2_082_844_800;
  const file = new Uint8Array([
    ...box(
      'ftyp',
      [...'isom'].map((c) => c.charCodeAt(0)),
    ),
    ...box('mdat', new Array(64).fill(7)),
    ...box('moov', box('mvhd', [0, 0, 0, 0, ...be32(when), ...be32(when), ...be32(600), ...be32(3000)])),
  ]);

  it('reads moov/mvhd even when the movie box comes after the media', async () => {
    const read = async (s: number, e: number) => file.slice(s, e);
    expect(await mp4CreationTime(read, file.length, Date.UTC(2030, 0, 1))).toBe('2027-06-17T18:04:33.000Z');
  });

  it('no clock (1904), or a future date: nothing', () => {
    expect(mvhdCreation(new Uint8Array(box('mvhd', [0, 0, 0, 0, ...be32(0)])))).toBeNull();
    const future = Date.UTC(2040, 0, 1) / 1000 + 2_082_844_800;
    expect(
      mvhdCreation(new Uint8Array(box('mvhd', [0, 0, 0, 0, ...be32(future)])), Date.UTC(2030, 0, 1)),
    ).toBeNull();
  });
});

// ─── ZIP ────────────────────────────────────────────────────────────────────────────────────────

const streamOf = (bytes: Uint8Array, pieces = 3) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const step = Math.ceil(bytes.length / pieces) || 1;
      for (let i = 0; i < bytes.length; i += step) c.enqueue(bytes.slice(i, i + step));
      c.close();
    },
  });

async function collect(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

describe('zip', () => {
  const files = [
    {
      name: '2027-06-17_21-04-33_דנה_ab12cd34.jpg',
      bytes: new Uint8Array(5000).map((_, i) => (i * 7) % 256),
    },
    { name: 'video.mp4', bytes: new Uint8Array(12345).map((_, i) => (i * 13) % 251) },
    { name: 'empty.txt', bytes: new Uint8Array(0) },
  ];
  const sources = (): ZipSource[] =>
    files.map((f) => ({
      name: f.name,
      date: new Date(2027, 5, 17, 21, 4, 33),
      open: async () => streamOf(f.bytes),
    }));

  it('CRC-32 matches the standard value and continues over chunks', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xcbf43926);
    expect(crc32(data.slice(4), crc32(data.slice(0, 4)))).toBe(0xcbf43926);
  });

  it('a stream a standard unzip reads back exactly (UTF-8 names, data descriptors)', async () => {
    const seen: string[] = [];
    let copied = 0;
    const zip = await collect(
      zipStream(sources(), { onFile: (n) => seen.push(n), onBytes: (b) => (copied = b) }),
    );
    const out = unzipSync(zip);
    expect(Object.keys(out)).toEqual(files.map((f) => f.name));
    for (const f of files) expect(out[f.name]).toEqual(f.bytes);
    expect(seen).toEqual(files.map((f) => f.name));
    expect(copied).toBe(5000 + 12345);
  });

  it('with ZIP64 records too', async () => {
    const zip = await collect(zipStream(sources(), { zip64: true }));
    const out = unzipSync(zip);
    for (const f of files) expect(out[f.name]).toEqual(f.bytes);
    // the ZIP64 end record and locator are there
    const text = Array.from(zip.slice(-98, -22));
    expect(text.join(',')).toContain([0x50, 0x4b, 0x06, 0x06].join(','));
  });
});

// ─── the upload queue ───────────────────────────────────────────────────────────────────────────

function q(overrides: Partial<QueueItem> & { localId: string }): QueueItem {
  return {
    kind: 'image',
    createdAt: 1,
    remoteId: null,
    stage: 'queued',
    parts: {
      thumb: { type: 'image/jpeg', size: 40_000, done: false },
      display: { type: 'image/jpeg', size: 900_000, done: false },
      original: { type: 'image/jpeg', size: 4_000_000, done: false },
    },
    meta: { width: 4000, height: 3000, durationMs: null, takenAt: null },
    metrics: null,
    result: null,
    attempts: 0,
    nextAt: 0,
    error: null,
    sent: 0,
    ...overrides,
  };
}
const done = (item: QueueItem, ...names: ('thumb' | 'display' | 'original')[]) => ({
  ...item,
  parts: Object.fromEntries(
    Object.entries(item.parts).map(([k, p]) => [k, { ...p, done: names.includes(k as never) }]),
  ),
});

describe('upload queue', () => {
  it('reserves new items together (at most 10 a request)', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      q({ localId: `i${String(i).padStart(2, '0')}`, createdAt: i }),
    );
    const a = nextAction(items, 100);
    expect(a).toEqual({ type: 'reserve', ids: items.slice(0, 10).map((i) => i.localId) });
  });

  it('previews of every item go before any original; then "complete"; then originals', () => {
    const a = q({ localId: 'a', createdAt: 1, stage: 'reserved', remoteId: 'A' });
    const b = q({ localId: 'b', createdAt: 2, stage: 'reserved', remoteId: 'B' });
    expect(nextAction([a, b], 10)).toEqual({ type: 'upload', id: 'a', part: 'thumb' });
    expect(nextAction([done(a, 'thumb'), b], 10)).toEqual({ type: 'upload', id: 'a', part: 'display' });
    expect(nextAction([done(a, 'thumb', 'display'), b], 10)).toEqual({
      type: 'upload',
      id: 'b',
      part: 'thumb',
    });
    const previews = [done(a, 'thumb', 'display'), done(b, 'thumb', 'display')];
    expect(nextAction(previews, 10)).toEqual({ type: 'complete', id: 'a', originalDone: false });
    const visible = previews.map((i) => ({ ...i, stage: 'visible' as const }));
    expect(nextAction(visible, 10)).toEqual({ type: 'upload', id: 'a', part: 'original' });
    expect(nextAction([done(visible[0]!, 'thumb', 'display', 'original'), visible[1]!], 10)).toEqual({
      type: 'upload',
      id: 'b',
      part: 'original',
    });
  });

  it('a video (and a photo without a preview) sends its original before "complete"', () => {
    const video = q({ localId: 'v', stage: 'reserved', kind: 'video' });
    expect(previewParts(video)).toEqual(['thumb', 'display', 'original']);
    expect(nextAction([done(video, 'thumb', 'display')], 1)).toEqual({
      type: 'upload',
      id: 'v',
      part: 'original',
    });
    expect(nextAction([done(video, 'thumb', 'display', 'original')], 1)).toEqual({
      type: 'complete',
      id: 'v',
      originalDone: true,
    });
    const heic = q({
      localId: 'h',
      stage: 'reserved',
      parts: { original: { type: 'image/heic', size: 3, done: false } },
    });
    expect(previewParts(heic)).toEqual(['original']);
  });

  it('a failed step waits (growing pauses), the others go on; the network back: now', () => {
    const a = failed(q({ localId: 'a', stage: 'reserved' }), 'network', 1_000, () => 0.5);
    expect(a.attempts).toBe(1);
    expect(a.nextAt).toBe(1_000 + GALLERY.queue.backoffMs[0]!);
    const b = q({ localId: 'b', createdAt: 2, stage: 'reserved' });
    expect(nextAction([a, b], 1_500)).toEqual({ type: 'upload', id: 'b', part: 'thumb' });
    expect(nextAction([a], 1_500)).toEqual({ type: 'wait', until: a.nextAt });
    expect(nextAction(retryNow([a]), 1_500)).toEqual({ type: 'upload', id: 'a', part: 'thumb' });
    expect(succeeded(a)).toMatchObject({ attempts: 0, error: null, nextAt: 0 });
    const steps = [1, 2, 3, 4, 5, 6, 9].map((n) => backoff(n, () => 0.5));
    expect(steps).toEqual([...GALLERY.queue.backoffMs, GALLERY.queue.backoffMs.at(-1)]);
    // the jitter stays within ±25%
    expect(backoff(3, () => 0)).toBe(Math.round(8_000 * 0.75));
    expect(backoff(3, () => 1)).toBe(Math.round(8_000 * 1.25));
  });

  it('a paused gallery stops new reservations, not uploads already under way', () => {
    const fresh = q({ localId: 'n' });
    const going = q({ localId: 'g', stage: 'reserved', createdAt: 2 });
    expect(nextAction([fresh, going], 5, { blocked: true })).toEqual({
      type: 'upload',
      id: 'g',
      part: 'thumb',
    });
    expect(nextAction([fresh], 5, { blocked: true })).toEqual({ type: 'idle' });
  });

  it('progress: "3 of 7" counts whole items, bytes for the bar; skipped ones don’t count', () => {
    const items = [
      q({ localId: 'a', stage: 'done' }),
      q({ localId: 'b', stage: 'visible', sent: 940_000 }),
      q({ localId: 'c', stage: 'queued' }),
      q({ localId: 'd', stage: 'failed', error: 'too_large' }),
      q({ localId: 'e', stage: 'skipped' }),
    ];
    expect(progress(items)).toMatchObject({ done: 1, total: 4, visible: 2, failed: 1 });
    expect(progress(items).bytesSent).toBe(4_940_000 + 940_000);
    expect(settled(items)).toBe(false);
    expect(settled([items[0]!, items[3]!, items[4]!])).toBe(true);
  });
});

// ─── the venue screen's slideshow ───────────────────────────────────────────────────────────────

describe('slideshow', () => {
  it('goes round the gallery, newest first', () => {
    let s = EMPTY_SHOW;
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const step = advance(s, ['c', 'b', 'a']);
      s = step.state;
      seen.push(step.id);
    }
    expect(seen).toEqual(['c', 'b', 'a', 'c']);
    expect(advance(EMPTY_SHOW, []).id).toBeNull();
  });

  it('arrivals jump the line in the order they were taken, then the rotation carries on where it was', () => {
    let s = advance(EMPTY_SHOW, ['c', 'b', 'a']).state; // showing c
    s = advance(s, ['c', 'b', 'a']).state; // showing b (cursor 1)
    s = arrive(s, ['e', 'd']); // two new ones, newest first
    const ids = ['e', 'd', 'c', 'b', 'a'];
    const one = advance(s, ids);
    expect(one).toMatchObject({ id: 'd', fresh: true });
    const two = advance(one.state, ids);
    expect(two).toMatchObject({ id: 'e', fresh: true });
    // back to the rotation: after b comes a
    expect(advance(two.state, ids)).toMatchObject({ id: 'a', fresh: false });
  });

  it('a removed item leaves at once, even the one on screen', () => {
    const s = advance(EMPTY_SHOW, ['c', 'b', 'a']).state; // c
    const gone = depart(s, ['c', 'b', 'a'], ['c']);
    expect(gone.skip).toBe(true);
    expect(depart(s, ['c', 'b', 'a'], ['a']).skip).toBe(false);
    const withFresh = depart(arrive(s, ['x']), ['x', 'c', 'b', 'a'], ['x']);
    expect(withFresh.state.fresh).toEqual([]);
  });
});

// ─── config and state ───────────────────────────────────────────────────────────────────────────

describe('config and state', () => {
  it('knows the phones’ formats', () => {
    expect(kindOfType('image/heic')).toBe('image');
    expect(kindOfType('video/quicktime')).toBe('video');
    expect(kindOfType('application/pdf')).toBeNull();
    expect(isOriginalType('toString')).toBe(false);
    expect(Object.values(ORIGINAL_TYPES).every((t) => /^[a-z0-9]+$/.test(t.ext))).toBe(true);
    expect(GALLERY.limits.resumableChunk).toBe(6 * 1024 * 1024);
  });

  it('the state: off, not open yet, over, paused, open', () => {
    const g = {
      enabled: true,
      paused: false,
      opensAt: '2027-06-17T16:00:00Z',
      closesAt: '2027-06-18T02:00:00Z',
    };
    const at = (iso: string) => Date.parse(iso);
    expect(galleryState(g, 'published', at('2027-06-17T15:00:00Z'))).toBe('scheduled');
    expect(galleryState(g, 'published', at('2027-06-17T20:00:00Z'))).toBe('open');
    expect(galleryState({ ...g, paused: true }, 'published', at('2027-06-17T20:00:00Z'))).toBe('paused');
    expect(galleryState(g, 'published', at('2027-06-18T02:00:00Z'))).toBe('ended');
    expect(galleryState({ ...g, enabled: false }, 'published', at('2027-06-17T20:00:00Z'))).toBe('off');
    expect(galleryState(g, 'archived', at('2027-06-17T20:00:00Z'))).toBe('off');
    expect(galleryState({ ...g, opensAt: null, closesAt: null }, 'draft', 0)).toBe('open');
  });
});
