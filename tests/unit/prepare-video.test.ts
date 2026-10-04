import { describe, expect, it } from 'vitest';
import { mp4Tracks, tracksOfMoov } from '@/features/invitations/editor/fields/mp4-tracks';
import {
  LONG_EDGE,
  MAX_SECONDS,
  SHORT_EDGE,
  bitrateFor,
  fitSize,
  planTranscode,
} from '@/features/invitations/editor/fields/prepare-video';

describe('fitSize — the size a stored video keeps', () => {
  it('leaves what already fits as it is', () => {
    expect(fitSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it('brings 1080p and 4K down to 720p, in either orientation', () => {
    expect(fitSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(fitSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(fitSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(fitSize(2160, 3840)).toEqual({ width: 720, height: 1280 });
  });

  it('never enlarges, and keeps both sides even (H.264 needs it)', () => {
    expect(fitSize(321, 241)).toEqual({ width: 322, height: 242 });
    for (const [w, h] of [
      [1921, 1081],
      [1500, 1000],
      [1000, 1500],
      [1440, 1080],
      [2, 2],
    ] as const) {
      const out = fitSize(w, h);
      expect(out.width % 2).toBe(0);
      expect(out.height % 2).toBe(0);
      expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(LONG_EDGE);
      expect(Math.min(out.width, out.height)).toBeLessThanOrEqual(SHORT_EDGE);
    }
  });

  it('keeps the proportions of a square and of an odd ratio', () => {
    expect(fitSize(2000, 2000)).toEqual({ width: 720, height: 720 });
    const wide = fitSize(3000, 1000);
    expect(wide.width).toBe(1280);
    expect(Math.abs(wide.width / wide.height - 3)).toBeLessThan(0.02);
  });
});

describe('bitrateFor', () => {
  it('is about 1.5 Mb/s at 720p, 30 fps', () => {
    const rate = bitrateFor(1280, 720, 30);
    expect(rate).toBeGreaterThan(1_400_000);
    expect(rate).toBeLessThan(1_800_000);
  });

  it('stays between 0.6 and 2.5 Mb/s', () => {
    expect(bitrateFor(160, 90, 30)).toBe(600_000);
    expect(bitrateFor(3840, 2160, 60)).toBe(2_500_000);
  });
});

describe('planTranscode — what to do with a video', () => {
  const MB = 1024 * 1024;

  it('re-encodes a heavy 1080p phone clip at 720p', () => {
    const plan = planTranscode({ width: 1920, height: 1080, seconds: 12 }, 40 * MB);
    expect(plan).toMatchObject({ width: 1280, height: 720, fps: 30 });
    expect(plan!.bitrate).toBe(bitrateFor(1280, 720, 30));
  });

  it('re-encodes a portrait clip at 720×1280', () => {
    expect(planTranscode({ width: 1080, height: 1920, seconds: 8 }, 30 * MB)).toMatchObject({
      width: 720,
      height: 1280,
    });
  });

  it('re-encodes a clip too big for its size even when the picture is small', () => {
    expect(planTranscode({ width: 1280, height: 720, seconds: 10 }, 30 * MB)).not.toBeNull();
  });

  it('leaves a clip that is as light as the result would be', () => {
    // 720p at ~1.6 Mb/s for 10 s ≈ 2 MB: nothing to gain
    expect(planTranscode({ width: 1280, height: 720, seconds: 10 }, 2 * MB)).toBeNull();
    expect(planTranscode({ width: 640, height: 360, seconds: 20 }, 1 * MB)).toBeNull();
  });

  it('re-encodes a big picture even when its file is light (it is resized)', () => {
    expect(planTranscode({ width: 3840, height: 2160, seconds: 10 }, 2 * MB)).toMatchObject({
      width: 1280,
      height: 720,
    });
  });

  it('leaves what it can’t judge or can’t wait for', () => {
    expect(planTranscode({ width: 0, height: 0, seconds: 10 }, 40 * MB)).toBeNull();
    expect(planTranscode({ width: 1920, height: 1080, seconds: 0 }, 40 * MB)).toBeNull();
    expect(planTranscode({ width: 1920, height: 1080, seconds: Number.NaN }, 40 * MB)).toBeNull();
    expect(planTranscode({ width: 1920, height: 1080, seconds: MAX_SECONDS + 1 }, 400 * MB)).toBeNull();
  });
});

// ── mp4 tracks ──────────────────────────────────────────────────────────────────────────────────────

const ascii = (text: string) => Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
const zeros = (n: number) => new Uint8Array(n);
const u32 = (n: number) => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const box = (type: string, ...payload: Uint8Array[]) => {
  const body = join(...payload);
  return join(u32(8 + body.length), ascii(type), body);
};
/** A box with a 64-bit size field (size = 1, the real size after the type). */
const bigBox = (type: string, ...payload: Uint8Array[]) => {
  const body = join(...payload);
  return join(u32(1), ascii(type), u32(0), u32(16 + body.length), body);
};
const trak = (handler: string) =>
  box(
    'trak',
    box('tkhd', zeros(84)),
    box('mdia', box('mdhd', zeros(24)), box('hdlr', u32(0), u32(0), ascii(handler), zeros(12))),
  );
const moov = (...handlers: string[]) => box('moov', box('mvhd', zeros(100)), ...handlers.map(trak));
const ftyp = box('ftyp', ascii('isom'), u32(512), ascii('isomiso2'));
const reader = (file: Uint8Array) => async (start: number, end: number) => file.slice(start, end);

describe('mp4Tracks — what a file holds, from its movie box', () => {
  it('finds one picture and one sound track (moov after the media, as a phone writes it)', async () => {
    const file = join(ftyp, box('mdat', zeros(5000)), moov('vide', 'soun'));
    expect(await mp4Tracks(reader(file), file.length)).toEqual({ video: 1, audio: 1 });
  });

  it('finds them with the movie box first (faststart)', async () => {
    const file = join(ftyp, moov('vide', 'soun'), box('mdat', zeros(5000)));
    expect(await mp4Tracks(reader(file), file.length)).toEqual({ video: 1, audio: 1 });
  });

  it('reads a video with no sound', async () => {
    const file = join(ftyp, moov('vide'), box('mdat', zeros(100)));
    expect(await mp4Tracks(reader(file), file.length)).toEqual({ video: 1, audio: 0 });
  });

  it('counts several sound tracks (the editor leaves such a file alone)', async () => {
    const file = join(ftyp, moov('vide', 'soun', 'soun'), box('mdat', zeros(100)));
    expect(await mp4Tracks(reader(file), file.length)).toEqual({ video: 1, audio: 2 });
  });

  it('skips other tracks (text, hint) and a media box with a 64-bit size', async () => {
    const file = join(ftyp, bigBox('mdat', zeros(3000)), moov('vide', 'text', 'soun', 'hint'));
    expect(await mp4Tracks(reader(file), file.length)).toEqual({ video: 1, audio: 1 });
  });

  it('answers null for a file with no movie box, or one cut short', async () => {
    const none = join(ftyp, box('mdat', zeros(100)));
    expect(await mp4Tracks(reader(none), none.length)).toBeNull();
    const cut = join(ftyp, moov('vide', 'soun')).slice(0, -20);
    expect(await mp4Tracks(reader(cut), cut.length)).toBeNull();
    expect(await mp4Tracks(reader(zeros(4)), 4)).toBeNull();
    expect(await mp4Tracks(reader(new Uint8Array()), 0)).toBeNull();
  });

  it('answers null for a movie box that is absurdly large, without reading it', async () => {
    const huge = join(u32(0x7fffffff), ascii('moov'));
    expect(await mp4Tracks(reader(huge), huge.length)).toBeNull();
  });

  it('answers null for random bytes', async () => {
    const noise = Uint8Array.from({ length: 4096 }, (_, i) => (i * 131 + 7) & 255);
    expect(await mp4Tracks(reader(noise), noise.length)).toBeNull();
  });
});

describe('tracksOfMoov', () => {
  it('counts the handlers of the tracks in a movie box', () => {
    const payload = moov('vide', 'soun').slice(8);
    expect(tracksOfMoov(payload)).toEqual({ video: 1, audio: 1 });
  });

  it('answers null when there is no track', () => {
    expect(tracksOfMoov(box('mvhd', zeros(100)))).toBeNull();
    expect(tracksOfMoov(new Uint8Array())).toBeNull();
  });
});
