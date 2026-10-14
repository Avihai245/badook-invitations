import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepare, type Prepared } from '@/features/live-gallery/client/process';
import {
  MARKER,
  heic,
  jpeg,
  mp4,
  png,
  u32,
  webp,
  XMP_GONE,
  bytesOf,
  contains,
  text,
} from './media-location-fixtures';

/**
 * prepare() end to end (the guest's browser pipeline) with a stand-in DOM: what the queue would send
 * as the original has no location for every type, and the display copy and thumbnail are whatever a
 * canvas hands back from toBlob — pixels re-encoded, so they carry no EXIF/XMP/location by construction.
 */

const hasMarker = (b: Uint8Array) => contains(b, u32(MARKER)) || contains(b, u32(MARKER, true));

const asFile = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type });

// a JPEG with no metadata at all, as a canvas encoder writes it
const CANVAS_JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]);

let toBlobCalls: { type: string | undefined; quality: number | undefined }[] = [];
let toBlobResults: Blob[] = [];

function fakeCanvas() {
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    drawImage: () => {},
    setTransform: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(120),
    }),
  };
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob(cb: (b: Blob | null) => void, type?: string, quality?: number) {
      toBlobCalls.push({ type, quality });
      const b = new Blob([CANVAS_JPEG as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
      toBlobResults.push(b);
      cb(b);
    },
  };
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  naturalWidth = 0;
  naturalHeight = 0;
  set src(value: string) {
    if (!value) return;
    // the orientation probe is a data: URL (the browser turns it upright: 1×2); a photo is 400×300
    if (value.startsWith('data:')) [this.naturalWidth, this.naturalHeight] = [1, 2];
    else [this.naturalWidth, this.naturalHeight] = [400, 300];
    queueMicrotask(() => this.onload?.());
  }
}

/** A <video> that cannot play (the "codec this browser can't play" path): the original goes as it is. */
function fakeVideo() {
  const target = new EventTarget();
  Object.defineProperty(target, 'src', {
    set: () => queueMicrotask(() => target.dispatchEvent(new Event('error'))),
  });
  return Object.assign(target, {
    muted: false,
    playsInline: false,
    preload: '',
    duration: NaN,
    videoWidth: 0,
    videoHeight: 0,
    currentTime: 0,
    removeAttribute: () => {},
    load: () => {},
  });
}

beforeEach(() => {
  toBlobCalls = [];
  toBlobResults = [];
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas() : fakeVideo()),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (r: Prepared | string): Prepared => {
  expect(typeof r).toBe('object');
  return r as Prepared;
};

describe('prepare() — the original that gets sent has no location', () => {
  it('JPEG: GPS and XMP location gone, the size unchanged, the picture decodes to the same bytes', async () => {
    const bytes = jpeg();
    const p = ok(await prepare(asFile(bytes, 'IMG_1.jpg', 'image/jpeg')));
    const out = await bytesOf(p.original);
    expect(p.originalType).toBe('image/jpeg');
    expect(out.length).toBe(bytes.length);
    expect(hasMarker(out)).toBe(false);
    for (const gone of XMP_GONE) expect(text(out)).not.toContain(gone);
    // when it was taken and the size are still read from the file
    expect(p).toMatchObject({ takenAt: '2027-06-17T21:04:33.000Z', width: 400, height: 300 });
  });

  it('JPEG with the Exif beyond 512 KB: still clean (the old path left this one)', async () => {
    const bytes = jpeg({ padKb: 640 });
    const p = ok(await prepare(asFile(bytes, 'IMG_2.jpg', 'image/jpeg')));
    expect(hasMarker(await bytesOf(p.original))).toBe(false);
  });

  it.each([
    ['HEIC', heic().file, 'IMG_3.HEIC', 'image/heic'],
    ['HEIF', heic('mif1').file, 'IMG_3.heif', 'image/heif'],
    ['AVIF', heic('avif').file, 'IMG_3.avif', 'image/avif'],
    ['PNG', png().file, 'shot.png', 'image/png'],
    ['WebP', webp().file, 'shot.webp', 'image/webp'],
  ])(
    '%s: the Exif GPS block and the XMP location are zeroed, the length is the same',
    async (_n, bytes, name, type) => {
      const p = ok(await prepare(asFile(bytes, name, type)));
      const out = await bytesOf(p.original);
      expect(p.kind).toBe('image');
      expect(p.originalType).toBe(type);
      expect(out.length).toBe(bytes.length);
      expect(hasMarker(bytes)).toBe(true); // the fixture does carry a place
      expect(hasMarker(out)).toBe(false);
      for (const gone of XMP_GONE) expect(text(out)).not.toContain(gone);
    },
  );

  it.each([
    ['MP4', mp4().file, 'clip.mp4', 'video/mp4'],
    ['MOV', mp4({ qt: true }).file, 'clip.mov', 'video/quicktime'],
    ['3GP', mp4().file, 'clip.3gp', 'video/3gpp'],
  ])(
    '%s: ©xyz, loci and the QuickTime location key are neutralised, the length is the same',
    async (_n, bytes, name, type) => {
      const p = ok(await prepare(asFile(bytes, name, type)));
      const out = await bytesOf(p.original);
      expect(p.kind).toBe('video');
      expect(out.length).toBe(bytes.length);
      expect(text(bytes)).toContain('+32.0853');
      expect(text(out)).not.toContain('+32.0853');
      expect(text(out)).not.toContain('quicktime.location');
      expect(text(out)).not.toContain('Tel Aviv');
    },
  );

  it('a GIF is sent as picked (no location in the format that we know of)', async () => {
    const gif = Uint8Array.from(
      [...'GIF89a'].map((c) => c.charCodeAt(0)).concat([1, 0, 1, 0, 0, 0, 0, 0x3b]),
    );
    const file = asFile(gif, 'a.gif', 'image/gif');
    const p = ok(await prepare(file));
    expect(p.original).toBe(file);
  });

  it('a file that cannot be parsed is sent as picked, never an error', async () => {
    const junk = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3]);
    const file = asFile(junk, 'broken.jpg', 'image/jpeg');
    const p = ok(await prepare(file));
    expect(p.original).toBe(file);
  });
});

describe('prepare() — the display copy and the thumbnail carry no metadata', () => {
  it('both come from canvas.toBlob as JPEG (pixels re-encoded), untouched afterwards', async () => {
    const p = ok(await prepare(asFile(jpeg(), 'IMG_4.jpg', 'image/jpeg')));
    expect(p.display).not.toBeNull();
    expect(p.thumb).not.toBeNull();
    // exactly two canvas encodes, both as JPEG with a quality — no other way into display / thumb
    expect(toBlobCalls).toHaveLength(2);
    expect(toBlobCalls.every((c) => c.type === 'image/jpeg' && typeof c.quality === 'number')).toBe(true);
    expect(toBlobResults).toContain(p.display);
    expect(toBlobResults).toContain(p.thumb);
    // and nothing in them is the original's: no Exif/XMP segment, no GPS
    for (const derived of [p.display!, p.thumb!]) {
      const bytes = await bytesOf(derived);
      expect(hasMarker(bytes)).toBe(false);
      expect(
        contains(
          bytes,
          [...'Exif'].map((c) => c.charCodeAt(0)),
        ),
      ).toBe(false);
      expect(
        contains(
          bytes,
          [...'xap'].map((c) => c.charCodeAt(0)),
        ),
      ).toBe(false);
    }
  });
});
