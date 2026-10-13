import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearTiffGps, readJpegInfo, withoutGps } from '@/features/live-gallery/exif';
import { blankXmpGps, stripLocation } from '@/features/live-gallery/media-location';
import {
  GPS_FROM,
  ISO6709,
  MARKER,
  TAKEN,
  TIFF_LENGTH,
  XMP_GONE,
  XMP_KEEPS,
  XMP_PACKET,
  ascii,
  bytesOf,
  contains,
  diffs,
  heic,
  inRanges,
  jpeg,
  jpegTiffAt,
  mp4,
  png,
  pngChunks,
  text,
  tiff,
  tiffWithoutGps,
  u32,
  webp,
} from './media-location-fixtures';

const blob = (bytes: Uint8Array, type = '') => new Blob([bytes as Uint8Array<ArrayBuffer>], { type });

/** No latitude/longitude number of the fixture's GPS block anywhere in these bytes (either byte order). */
const hasMarker = (bytes: Uint8Array) => contains(bytes, u32(MARKER)) || contains(bytes, u32(MARKER, true));

afterEach(() => vi.restoreAllMocks());

describe('clearTiffGps — the shared TIFF/Exif location clearing', () => {
  it.each([true, false])(
    'zeroes the GPS directory and its values, nothing else (little endian: %s)',
    (little) => {
      const before = tiff(little);
      const after = before.slice();
      expect(clearTiffGps(after, 0, after.length)).toBe(true);
      // every difference is inside the GPS block; the orientation and the time taken are intact
      expect(diffs(before, after).every((i) => i >= GPS_FROM && i < TIFF_LENGTH)).toBe(true);
      expect(text(after.subarray(68, 87))).toBe(TAKEN);
      expect(new DataView(after.buffer).getUint16(GPS_FROM, little)).toBe(0);
      expect(after.subarray(GPS_FROM).every((b) => b === 0)).toBe(true);
      // doing it again finds nothing to change
      expect(clearTiffGps(after, 0, after.length)).toBe(false);
    },
  );

  it('does the same as withoutGps for a JPEG segment', () => {
    const file = jpeg();
    const info = readJpegInfo(file)!;
    const exif = info.exif!;
    const segment = file.slice(exif.app1Start, exif.app1End);
    const viaOld = withoutGps(segment, exif)!;
    const viaNew = segment.slice();
    expect(clearTiffGps(viaNew, 10, viaNew.length)).toBe(true);
    expect([...viaNew]).toEqual([...viaOld]);
  });

  it('leaves alone what is not a TIFF, has no GPS, or runs off the end', () => {
    const none = tiffWithoutGps();
    expect(clearTiffGps(none, 0, none.length)).toBe(false);
    const junk = Uint8Array.from({ length: 64 }, (_, i) => i);
    expect(clearTiffGps(junk, 0, junk.length)).toBe(false);
    const cut = tiff().slice(0, GPS_FROM + 10); // GPS directory cut off mid-way: no throw
    expect(() => clearTiffGps(cut, 0, cut.length)).not.toThrow();
    expect(clearTiffGps(tiff(), 0, 4)).toBe(false);
  });
});

describe('blankXmpGps', () => {
  it('blanks exif:GPS* attributes and elements with spaces, same length, the rest intact', () => {
    const bytes = new TextEncoder().encode(XMP_PACKET);
    const before = bytes.slice();
    expect(blankXmpGps(bytes)).toBe(true);
    expect(bytes.length).toBe(before.length);
    const out = text(bytes);
    for (const gone of XMP_GONE) expect(out).not.toContain(gone);
    for (const kept of XMP_KEEPS) expect(out).toContain(kept);
    expect(out).toContain('café ☕');
    expect(blankXmpGps(bytes)).toBe(false);
  });

  it('does nothing to a packet without a location', () => {
    const bytes = new TextEncoder().encode(
      '<x:xmpmeta><exif:ExposureTime>1/60</exif:ExposureTime></x:xmpmeta>',
    );
    expect(blankXmpGps(bytes)).toBe(false);
  });
});

describe('stripLocation — JPEG', () => {
  it('zeroes the GPS block and the XMP location; orientation, time, size, picture bytes and length stay', async () => {
    const file = jpeg();
    const result = await stripLocation(blob(file, 'image/jpeg'), 'image/jpeg');
    expect(result.changed).toBe(true);
    expect(result.kinds.sort()).toEqual(['exif-gps', 'xmp-gps']);
    const out = await bytesOf(result.blob);
    expect(out.length).toBe(file.length);
    expect(result.blob.type).toBe('image/jpeg');
    expect(hasMarker(out)).toBe(false);
    const info = readJpegInfo(out)!;
    expect(info).toMatchObject({
      width: 4032,
      height: 3008,
      orientation: 6,
      dateTime: '2027-06-17T21:04:33',
    });
    expect(new DataView(out.buffer).getUint16(info.exif!.gpsIfd!, true)).toBe(0);
    const outText = text(out);
    for (const gone of XMP_GONE) expect(outText).not.toContain(gone);
    for (const kept of XMP_KEEPS) expect(outText).toContain(kept);
    // the scan (the "picture") is byte-identical: only the Exif GPS block and the XMP differ
    const tail = file.length - 16;
    expect(diffs(file.subarray(tail), out.subarray(tail))).toEqual([]);
    expect(diffs(file, out).every((i) => i > 20 && i < tail)).toBe(true);
  });

  it('gives exactly what the old JPEG-only path gave when there is no XMP', async () => {
    const file = jpeg({ xmp: false });
    const info = readJpegInfo(file)!;
    const exif = info.exif!;
    const old = withoutGps(file.slice(exif.app1Start, exif.app1End), exif)!;
    const expected = Uint8Array.from([...file.slice(0, exif.app1Start), ...old, ...file.slice(exif.app1End)]);
    const out = await bytesOf((await stripLocation(blob(file), 'image/jpeg')).blob);
    expect([...out]).toEqual([...expected]);
  });

  it('finds an Exif block beyond the first 512 KB', async () => {
    const file = jpeg({ padKb: 640 });
    expect(readJpegInfo(file.subarray(0, 512 * 1024))!.exif).toBeNull(); // the old path would not see it
    const result = await stripLocation(blob(file), 'image/jpeg');
    expect(result.changed).toBe(true);
    const out = await bytesOf(result.blob);
    expect(hasMarker(out)).toBe(false);
    expect(diffs(file, out).every((i) => i >= jpegTiffAt(640))).toBe(true);
  });

  it('big-endian Exif too, and a JPEG with no location comes back as the same object', async () => {
    const be = await stripLocation(blob(jpeg({ little: false, xmp: false })), 'image/jpeg');
    expect(be.changed).toBe(true);
    expect(hasMarker(await bytesOf(be.blob))).toBe(false);

    const clean = blob(jpeg({ gps: false, xmp: false }));
    const same = await stripLocation(clean, 'image/jpeg');
    expect(same).toEqual({ blob: clean, changed: false, kinds: [] });
    expect(same.blob).toBe(clean);
  });
});

describe('stripLocation — HEIC / HEIF / AVIF', () => {
  it.each([
    ['heic', 'image/heic'],
    ['mif1', 'image/heif'],
    ['avif', 'image/avif'],
  ])('zeroes the GPS IFD inside the Exif item in place (%s)', async (brand, type) => {
    const { file, tiffAt } = heic(brand);
    const result = await stripLocation(blob(file, type), type);
    expect(result.changed).toBe(true);
    expect(result.kinds.sort()).toEqual(['exif-gps', 'xmp-gps']);
    const out = await bytesOf(result.blob);
    expect(out.length).toBe(file.length);
    expect(hasMarker(out)).toBe(false);
    // inside the Exif item only the GPS block changed; its prefix, orientation and time are intact
    const gps: [number, number][] = [[tiffAt + GPS_FROM, tiffAt + TIFF_LENGTH]];
    const xmpAt = file.length - new TextEncoder().encode(XMP_PACKET).length;
    const changed = diffs(file, out);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((i) => inRanges(i, gps) || i >= xmpAt)).toBe(true);
    expect(text(out.subarray(tiffAt + 68, tiffAt + 87))).toBe(TAKEN);
    expect(out.subarray(tiffAt, tiffAt + GPS_FROM)).toEqual(file.subarray(tiffAt, tiffAt + GPS_FROM));
    const outText = text(out.subarray(xmpAt));
    for (const gone of XMP_GONE) expect(outText).not.toContain(gone);
    for (const kept of XMP_KEEPS) expect(outText).toContain(kept);
    // the meta box and the "image" are untouched
    expect(out.subarray(0, tiffAt - 10)).toEqual(file.subarray(0, tiffAt - 10));
  });

  it('a HEIC that has been cleaned already is returned as it was', async () => {
    const once = await stripLocation(blob(heic().file, 'image/heic'), 'image/heic');
    const file = blob(await bytesOf(once.blob), 'image/heic');
    const again = await stripLocation(file, 'image/heic');
    expect(again.changed).toBe(false);
    expect(again.blob).toBe(file);
  });
});

describe('stripLocation — MP4 / MOV / 3GP', () => {
  it.each([
    ['isom (ISO meta box)', false, 'video/mp4'],
    ['QuickTime (plain meta box)', true, 'video/quicktime'],
    ['3gp', false, 'video/3gpp'],
  ])('neutralises ©xyz, loci and the QuickTime location key in place — %s', async (_name, qt, type) => {
    const fx = mp4({ qt });
    const result = await stripLocation(blob(fx.file, type), type);
    expect(result.changed).toBe(true);
    expect(result.kinds.sort()).toEqual(['quicktime-location', 'udta-location']);
    const out = await bytesOf(result.blob);
    expect(out.length).toBe(fx.file.length);
    // nothing changed outside the four regions
    expect(diffs(fx.file, out).every((i) => inRanges(i, fx.changing))).toBe(true);
    const outText = text(out);
    expect(outText).not.toContain(ISO6709);
    expect(outText).not.toContain('+32.0853');
    expect(outText).not.toContain('Tel Aviv');
    expect(outText).not.toContain('quicktime.location');
    // the other tags and the media are as they were
    expect(outText).toContain('keep me');
    expect(outText).toContain('com.apple.quicktime.make');
    expect(outText).toContain('com.apple.quicktime.model');
    expect(outText).toContain('Apple');
    expect(outText).toContain('iPhone 15');
    // the boxes are still well formed: ©xyz and loci are now 'free' boxes of the same size
    expect(outText).toContain('free');
    expect(out.subarray(fx.moovEnd)).toEqual(fx.file.subarray(fx.moovEnd));
  });

  it('keeps the box structure walkable (sizes unchanged, the moov still ends where it did)', async () => {
    const fx = mp4();
    const out = await bytesOf((await stripLocation(blob(fx.file), 'video/mp4')).blob);
    let p = 0;
    const sizes: number[] = [];
    while (p + 8 <= out.length) {
      const size = new DataView(out.buffer).getUint32(p);
      sizes.push(size);
      p += size;
    }
    expect(p).toBe(out.length);
    expect(new DataView(fx.file.buffer).getUint32(fx.moovAt)).toBe(fx.moovEnd - fx.moovAt);
    expect(sizes).toHaveLength(3);
  });

  it('a video with no location comes back as the same object', async () => {
    const fx = mp4();
    // remove the places: retype the three boxes/keys by stripping once, then strip again
    const once = await stripLocation(blob(fx.file), 'video/mp4');
    const file = blob(await bytesOf(once.blob));
    const again = await stripLocation(file, 'video/mp4');
    expect(again.changed).toBe(false);
    expect(again.blob).toBe(file);
  });

  it('handles a big mdat before the moov through slices — it never reads the media', async () => {
    const fx = mp4({ moovFirst: false, mdatBytes: 48 * 1024 * 1024 });
    const file = blob(fx.file, 'video/mp4');
    const reads: number[] = [];
    const original = Blob.prototype.arrayBuffer;
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(function (this: Blob) {
      reads.push(this.size);
      return original.call(this);
    });
    const result = await stripLocation(file, 'video/mp4');
    expect(result.changed).toBe(true);
    expect(result.blob.size).toBe(file.size);
    // only box headers and the movie header box were read: a few hundred bytes, not 48 MB
    expect(reads.reduce((a, b) => a + b, 0)).toBeLessThan(fx.moovEnd - fx.moovAt + 4096);
    expect(Math.max(...reads)).toBeLessThanOrEqual(fx.moovEnd - fx.moovAt);
    vi.restoreAllMocks();
    // the bulk is the original's bytes, shifted nowhere
    const out = await bytesOf(result.blob);
    expect(diffs(fx.file, out).every((i) => inRanges(i, fx.changing))).toBe(true);
    expect(contains(out.subarray(fx.moovAt), ascii(ISO6709))).toBe(false);
  });

  it('a 64-bit mdat that claims gigabytes (the file is a stub) is walked by header, not read', async () => {
    const fx = mp4({ moovFirst: true });
    const moov = fx.file.subarray(fx.moovAt, fx.moovEnd);
    const ftyp = fx.file.subarray(0, fx.moovAt);
    // a 'largesize' mdat of 5 GB after the moov: the file is cut short, as a lying header would be
    const huge = Uint8Array.from([
      ...u32(1),
      ...ascii('mdat'),
      0,
      0,
      0,
      1,
      0x2a,
      0x05,
      0xf2,
      0x00,
      1,
      2,
      3,
      4,
    ]);
    const stub = new Uint8Array([...ftyp, ...moov, ...huge]);
    const result = await stripLocation(blob(stub), 'video/mp4');
    expect(result.changed).toBe(true);
    expect(result.blob.size).toBe(stub.length);
    expect(hasMarker(await bytesOf(result.blob))).toBe(false);
    expect(text(await bytesOf(result.blob))).not.toContain(ISO6709);
  });

  it('a moov over 16 MB, or one that lies about its size, is left as it is', async () => {
    const fx = mp4();
    const lying = fx.file.slice();
    new DataView(lying.buffer).setUint32(fx.moovAt, fx.moovEnd - fx.moovAt + 10_000); // runs past the end
    const a = blob(lying, 'video/mp4');
    expect(await stripLocation(a, 'video/mp4')).toEqual({ blob: a, changed: false, kinds: [] });

    const huge = fx.file.slice();
    const dv = new DataView(huge.buffer);
    dv.setUint32(fx.moovAt, 0); // size 0 = to the end of file…
    const big = new Blob([huge as Uint8Array<ArrayBuffer>, new Uint8Array(17 * 1024 * 1024)]); // …which is 17 MB
    const result = await stripLocation(big, 'video/mp4');
    expect(result.changed).toBe(false);
    expect(result.blob).toBe(big);
  });
});

describe('stripLocation — PNG', () => {
  it('zeroes the eXIf GPS block and the XMP location and keeps every chunk CRC valid', async () => {
    const { file, exifDataAt } = png();
    expect(pngChunks(file).every((c) => c.crcOk)).toBe(true);
    const result = await stripLocation(blob(file, 'image/png'), 'image/png');
    expect(result.changed).toBe(true);
    expect(result.kinds.sort()).toEqual(['exif-gps', 'xmp-gps']);
    const out = await bytesOf(result.blob);
    expect(out.length).toBe(file.length);
    expect(hasMarker(out)).toBe(false);
    expect(pngChunks(out).map((c) => [c.type, c.crcOk])).toEqual([
      ['IHDR', true],
      ['eXIf', true],
      ['iTXt', true],
      ['tEXt', true],
      ['IDAT', true],
      ['IEND', true],
    ]);
    const outText = text(out);
    for (const gone of XMP_GONE) expect(outText).not.toContain(gone);
    for (const kept of XMP_KEEPS) expect(outText).toContain(kept);
    expect(outText).toContain('keep me');
    // the time taken in the Exif chunk is still there; IHDR / IDAT / IEND are byte-identical
    expect(text(out.subarray(exifDataAt + 68, exifDataAt + 87))).toBe(TAKEN);
    const chunks = pngChunks(file);
    for (const type of ['IHDR', 'tEXt', 'IDAT', 'IEND']) {
      const c = chunks.find((x) => x.type === type)!;
      expect(out.subarray(c.at, c.at + 12 + c.length)).toEqual(file.subarray(c.at, c.at + 12 + c.length));
    }
  });
});

describe('stripLocation — WebP', () => {
  it('zeroes the EXIF chunk GPS block and the XMP location, padding and the picture chunk intact', async () => {
    const { file, exifDataAt } = webp();
    const result = await stripLocation(blob(file, 'image/webp'), 'image/webp');
    expect(result.changed).toBe(true);
    expect(result.kinds.sort()).toEqual(['exif-gps', 'xmp-gps']);
    const out = await bytesOf(result.blob);
    expect(out.length).toBe(file.length);
    expect(hasMarker(out)).toBe(false);
    const outText = text(out);
    for (const gone of XMP_GONE) expect(outText).not.toContain(gone);
    for (const kept of XMP_KEEPS) expect(outText).toContain(kept);
    expect(text(out.subarray(exifDataAt + 68, exifDataAt + 87))).toBe(TAKEN);
    // the last chunk (VP8L, 33 bytes + 8 header + pad) is the same bytes
    expect(out.subarray(file.length - 42)).toEqual(file.subarray(file.length - 42));
  });
});

describe('stripLocation — formats it leaves alone, and files it must not break', () => {
  it('GIF and WebM come back as the same object (documented: not handled)', async () => {
    const gif = blob(Uint8Array.from([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b]), 'image/gif');
    const webm = blob(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]), 'video/webm');
    expect((await stripLocation(gif, 'image/gif')).blob).toBe(gif);
    expect((await stripLocation(webm, 'video/webm')).blob).toBe(webm);
    expect((await stripLocation(gif, 'application/octet-stream')).changed).toBe(false);
  });

  it.each([
    'image/jpeg',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/3gpp',
  ])('empty, junk and truncated %s input returns unchanged without throwing', async (type) => {
    const inputs = [
      new Uint8Array(0),
      Uint8Array.from({ length: 300 }, (_, i) => (i * 31 + 7) & 0xff),
      new Uint8Array(300).fill(0xff),
      new Uint8Array(300),
    ];
    const real: Record<string, Uint8Array> = {
      'image/jpeg': jpeg(),
      'image/heic': heic().file,
      'image/heif': heic('mif1').file,
      'image/avif': heic('avif').file,
      'image/png': png().file,
      'image/webp': webp().file,
      'video/mp4': mp4().file,
      'video/quicktime': mp4({ qt: true }).file,
      'video/3gpp': mp4().file,
    };
    const file = real[type]!;
    // every prefix of a real file, in coarse steps
    for (let n = 0; n < file.length; n += 17) inputs.push(file.slice(0, n));
    for (const bytes of inputs) {
      const input = blob(bytes, type);
      const result = await stripLocation(input, type);
      expect(result.blob.size).toBe(bytes.length);
      if (!result.changed) expect(result.blob).toBe(input);
    }
  });

  it('a damaged size field in the middle of a real file returns unchanged', async () => {
    for (const [file, type] of [
      [heic().file, 'image/heic'],
      [mp4().file, 'video/mp4'],
      [png().file, 'image/png'],
      [webp().file, 'image/webp'],
    ] as const) {
      const broken = file.slice();
      for (let i = 0; i < 40; i += 4) broken.set([0xff, 0xff, 0xff, 0xf0], i + 20); // sizes everywhere
      const input = blob(broken, type);
      const result = await stripLocation(input, type);
      // either it found and cleaned something that was still readable, or left everything: never a throw, never a new length
      expect(result.blob.size).toBe(broken.length);
    }
  });

  it('a blob whose reads fail gives the file back', async () => {
    const input = blob(jpeg(), 'image/jpeg');
    vi.spyOn(input, 'slice').mockImplementation(() => {
      throw new Error('disk gone');
    });
    const result = await stripLocation(input, 'image/jpeg');
    expect(result).toEqual({ blob: input, changed: false, kinds: [] });
  });

  it('does not misread an unrelated file as the type it was declared to be', async () => {
    const png1 = blob(png().file);
    const asJpeg = await stripLocation(png1, 'image/jpeg');
    expect(asJpeg.changed).toBe(false);
    const asMp4 = await stripLocation(png1, 'video/mp4');
    expect(asMp4.changed).toBe(false);
  });
});
