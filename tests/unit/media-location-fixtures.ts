/**
 * Synthetic files for the location tests, assembled by hand: just enough of each format to be valid
 * to the parsers, with a place in them (a GPS block, an XMP location, an ISO 6709 string) and things
 * that must survive (orientation, the time taken, other tags, the "picture" bytes).
 */
import { crc32 } from '@/features/live-gallery/zip';

export const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
export const u16 = (n: number, little = false): number[] =>
  little ? [n & 0xff, (n >> 8) & 0xff] : [(n >> 8) & 0xff, n & 0xff];
export const u32 = (n: number, little = false): number[] =>
  little
    ? [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
    : [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
export const cat = (...parts: (number[] | Uint8Array)[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

// ─── TIFF / Exif ────────────────────────────────────────────────────────────────────────────────

/** Where things sit in `tiff()`: the GPS directory and its values are bytes [GPS_FROM, TIFF_LENGTH). */
export const GPS_FROM = 88;
export const TIFF_LENGTH = 178;
export const TAKEN = '2027:06:17 21:04:33';
/** 4488/100 (the seconds of the latitude) — a number that must not survive anywhere in a clean file */
export const MARKER = 4488;

/** IFD0 (orientation 6, Exif IFD, GPS IFD) → Exif IFD (DateTimeOriginal) → GPS IFD (N, 32°4′44.88″, E, 34°46′51.31″). */
export function tiff(little = true): Uint8Array {
  const s = (n: number) => u16(n, little);
  const l = (n: number) => u32(n, little);
  const entry = (tag: number, type: number, count: number, value: number[]) => [
    ...s(tag),
    ...s(type),
    ...l(count),
    ...[...value, 0, 0, 0, 0].slice(0, 4),
  ];
  const rationals = (list: [number, number][]) => list.flatMap(([n, d]) => [...l(n), ...l(d)]);
  const out = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...s(42),
    ...l(8),
    // IFD0 at 8
    ...s(3),
    ...entry(0x0112, 3, 1, s(6)),
    ...entry(0x8769, 4, 1, l(50)),
    ...entry(0x8825, 4, 1, l(GPS_FROM)),
    ...l(0),
    // Exif IFD at 50
    ...s(1),
    ...entry(0x9003, 2, 20, l(68)),
    ...l(0),
    // DateTimeOriginal at 68
    ...ascii(TAKEN),
    0,
    // GPS IFD at 88
    ...s(3),
    ...entry(0x0001, 2, 2, [0x4e, 0]),
    ...entry(0x0002, 5, 3, l(130)),
    ...entry(0x0004, 5, 3, l(154)),
    ...l(0),
    // latitude at 130, longitude at 154
    ...rationals([
      [32, 1],
      [4, 1],
      [MARKER, 100],
    ]),
    ...rationals([
      [34, 1],
      [46, 1],
      [5131, 100],
    ]),
  ];
  if (out.length !== TIFF_LENGTH) throw new Error(`tiff fixture is ${out.length} bytes`);
  return Uint8Array.from(out);
}

/** An Exif block with no GPS at all (IFD0 → Exif IFD only) — the GPS pointer set to 0. */
export function tiffWithoutGps(): Uint8Array {
  const t = tiff();
  const copy = t.slice(0, GPS_FROM);
  // the pointer entry's value: IFD0 entry 3 (tag 0x8825) value at 8 + 2 + 2*12 + 8
  copy.fill(0, 8 + 2 + 24 + 8, 8 + 2 + 24 + 12);
  return copy;
}

export const XMP_PACKET =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="32,4.748N" ' +
  'exif:DateTimeOriginal="2027-06-17T21:04:33" exif:GPSLongitude=\'34,46.855E\'>' +
  '<exif:GPSAltitude>12/1</exif:GPSAltitude><exif:GPSMapDatum/><exif:ExposureTime>1/60</exif:ExposureTime>' +
  '<dc:description>café ☕</dc:description></rdf:Description></rdf:RDF></x:xmpmeta>';
export const xmpBytes = (): number[] => [...new TextEncoder().encode(XMP_PACKET)];

/** What the XMP survivors look like in a clean file. */
export const XMP_KEEPS = [
  'exif:DateTimeOriginal="2027-06-17T21:04:33"',
  '<exif:ExposureTime>1/60</exif:ExposureTime>',
];
export const XMP_GONE = [
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'GPSMapDatum',
  '32,4.748N',
  '34,46.855E',
];

// ─── JPEG ───────────────────────────────────────────────────────────────────────────────────────

/** SOI, APP0, [APP2 padding], APP1 Exif, APP1 XMP, SOF, SOS + a few "pixels", EOI. */
export function jpeg(
  opts: { little?: boolean; padKb?: number; xmp?: boolean; gps?: boolean } = {},
): Uint8Array {
  const { little = true, padKb = 0, xmp = true, gps = true } = opts;
  const segment = (marker: number, body: number[]) => [0xff, marker, ...u16(body.length + 2), ...body];
  const exif = segment(0xe1, [...ascii('Exif'), 0, 0, ...(gps ? tiff(little) : tiffWithoutGps())]);
  const padding: number[] = [];
  for (let i = 0; i < padKb; i += 32) padding.push(...segment(0xe2, new Array<number>(32 * 1024).fill(0x55)));
  return cat(
    [0xff, 0xd8],
    segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    padding,
    exif,
    xmp ? segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...xmpBytes()]) : [],
    segment(0xc0, [8, 0x0b, 0xc0, 0x0f, 0xc0, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
    [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0x78, 0xff, 0xd9],
  );
}

/** Offset of the TIFF block inside `jpeg()` (after SOI, APP0 (18), padding, APP1 header + "Exif\0\0"). */
export const jpegTiffAt = (padKb = 0): number => 2 + 18 + (padKb / 32) * (4 + 32 * 1024) + 4 + 6;

// ─── ISO base media ─────────────────────────────────────────────────────────────────────────────

export function box(type: string, ...payload: (number[] | Uint8Array)[]): Uint8Array {
  const body = cat(...payload);
  return cat(u32(8 + body.length), ascii(type), body);
}
export const fullBox = (type: string, version: number, ...payload: (number[] | Uint8Array)[]) =>
  box(type, [version, 0, 0, 0], ...payload);

export const ISO6709 = '+32.0853+034.7818/';

/** HEIC: ftyp, meta (hdlr, iinf: hvc1 + Exif + XMP, iloc) , mdat (the "image", the Exif item, the XMP item). */
export function heic(brand = 'heic'): { file: Uint8Array; tiffAt: number } {
  const imageBytes = new Array<number>(64).fill(0xab);
  const exifItem = cat(u32(6), ascii('Exif'), [0, 0], tiff(false));
  const xmpItem = cat(xmpBytes());
  const build = (offsets: number[]) => {
    const infe = (id: number, type: string, extra: number[] = []) =>
      fullBox('infe', 2, u16(id), u16(0), ascii(type), extra);
    const iinf = fullBox(
      'iinf',
      0,
      u16(3),
      infe(1, 'hvc1', [...ascii('Image'), 0]),
      infe(2, 'Exif', [...ascii('Exif'), 0]),
      infe(3, 'mime', [...ascii('XMP'), 0, ...ascii('application/rdf+xml'), 0]),
    );
    const item = (id: number, offset: number, length: number) => [
      ...u16(id),
      ...u16(0), // construction method 0
      ...u16(0), // data reference
      ...u16(1), // one extent
      ...u32(offset),
      ...u32(length),
    ];
    // version 1: offset size 4, length size 4, base offset size 0, index size 0
    const iloc = fullBox(
      'iloc',
      1,
      [0x44, 0x00],
      u16(3),
      item(1, offsets[0]!, imageBytes.length),
      item(2, offsets[1]!, exifItem.length),
      item(3, offsets[2]!, xmpItem.length),
    );
    const hdlr = fullBox('hdlr', 0, u32(0), ascii('pict'), new Array<number>(12).fill(0), [0]);
    return fullBox('meta', 0, hdlr, iinf, iloc);
  };
  const ftyp = box('ftyp', ascii(brand), u32(0), ascii(brand), ascii('mif1'));
  const metaSize = build([0, 0, 0]).length;
  const dataAt = ftyp.length + metaSize + 8; // inside mdat
  const offsets = [dataAt, dataAt + imageBytes.length, dataAt + imageBytes.length + exifItem.length];
  const file = cat(ftyp, build(offsets), box('mdat', imageBytes, exifItem, xmpItem));
  return { file, tiffAt: offsets[1]! + 4 + 6 };
}

/** The location boxes / keys the MP4 fixture carries, and the offsets of what must change. */
export interface Mp4Fixture {
  file: Uint8Array;
  /** [from, to) of each region that is allowed to differ */
  changing: [number, number][];
  moovAt: number;
  moovEnd: number;
}

/**
 * ftyp, [mdat], moov (mvhd, trak, udta (©xyz, loci, cprt), meta (hdlr, keys, ilst)) , [mdat].
 * `mdatBytes` of picture data go before or after the movie header.
 */
export function mp4(opts: { moovFirst?: boolean; mdatBytes?: number; qt?: boolean } = {}): Mp4Fixture {
  const { moovFirst = true, mdatBytes = 32, qt = false } = opts;
  const xyz = box('©xyz', u16(ISO6709.length), u16(0x15c7), ascii(ISO6709));
  const loci = fullBox(
    'loci',
    0,
    u16(0),
    ascii('Tel Aviv'),
    [0],
    [0],
    u32(0x00400000),
    u32(0x00200000),
    [0],
    ascii('home'),
    [0],
    [0],
  );
  const cprt = fullBox('cprt', 0, u16(0x15c7), ascii('keep me'));
  const udta = box('udta', xyz, loci, cprt);

  const keyEntry = (key: string) => cat(u32(8 + key.length), ascii('mdta'), ascii(key));
  const keys = fullBox(
    'keys',
    0,
    u32(3),
    keyEntry('com.apple.quicktime.make'),
    keyEntry('com.apple.quicktime.location.ISO6709'),
    keyEntry('com.apple.quicktime.model'),
  );
  const dataBox = (text: string) => box('data', u32(1), u32(0), ascii(text));
  const ilst = box(
    'ilst',
    box('\u0000\u0000\u0000\u0001', dataBox('Apple')),
    box('\u0000\u0000\u0000\u0002', dataBox('+32.0853+034.7818+012.000/')),
    box('\u0000\u0000\u0000\u0003', dataBox('iPhone 15')),
  );
  const hdlr = fullBox('hdlr', 0, u32(0), ascii('mdta'), new Array<number>(12).fill(0), [0]);
  // QuickTime's own 'meta' is a plain box (no version and flags); ISO's is a full box
  const meta = qt ? box('meta', hdlr, keys, ilst) : fullBox('meta', 0, hdlr, keys, ilst);

  const mvhd = fullBox(
    'mvhd',
    0,
    u32(3_700_000_000),
    u32(3_700_000_000),
    u32(1000),
    u32(2000),
    new Array<number>(80).fill(0),
  );
  const trak = box(
    'trak',
    box('tkhd', new Array<number>(84).fill(1)),
    box('mdia', box('mdhd', new Array<number>(24).fill(2))),
  );
  const moov = box('moov', mvhd, trak, udta, meta);
  const ftyp = box('ftyp', ascii(qt ? 'qt  ' : 'isom'), u32(0), ascii(qt ? 'qt  ' : 'isom'));
  // the "video": not zeros, so a shifted or damaged copy would show
  const media = Uint8Array.from({ length: mdatBytes }, (_, i) => (i * 7 + 3) & 0xff);
  const mdat = cat(u32(8 + mdatBytes), ascii('mdat'), media);
  const file = moovFirst ? cat(ftyp, moov, mdat) : cat(ftyp, mdat, moov);
  const moovAt = moovFirst ? ftyp.length : ftyp.length + mdat.length;

  const find = (needle: number[], from: number) => {
    for (let i = from; i < file.length - needle.length; i++)
      if (needle.every((b, j) => file[i + j] === b)) return i;
    throw new Error('fixture: not found');
  };
  const regions: [number, number][] = [];
  const xyzAt = find([...ascii('©xyz')], moovAt) - 4;
  regions.push([xyzAt + 4, xyzAt + xyz.length]);
  const lociAt = find(ascii('loci'), moovAt) - 4;
  regions.push([lociAt + 4, lociAt + loci.length]);
  const keyAt = find(ascii('com.apple.quicktime.location.ISO6709'), moovAt);
  regions.push([keyAt, keyAt + 'com.apple.quicktime.location.ISO6709'.length]);
  const valAt = find(ascii('+32.0853+034.7818+012.000/'), moovAt);
  regions.push([valAt, valAt + '+32.0853+034.7818+012.000/'.length]);
  return { file, changing: regions, moovAt, moovEnd: moovAt + moov.length };
}

// ─── PNG / WebP ─────────────────────────────────────────────────────────────────────────────────

export function pngChunk(type: string, data: number[] | Uint8Array): Uint8Array {
  const t = Uint8Array.from(ascii(type));
  const d = Uint8Array.from(data);
  return cat(u32(d.length), t, d, u32(crc32(d, crc32(t))));
}

export function png(): { file: Uint8Array; exifDataAt: number } {
  const sig = [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = pngChunk('IHDR', [...u32(2), ...u32(2), 8, 2, 0, 0, 0]);
  const exif = pngChunk('eXIf', tiff(false));
  const itxt = pngChunk('iTXt', [...ascii('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...xmpBytes()]);
  const text = pngChunk('tEXt', [...ascii('Comment'), 0, ...ascii('keep me')]);
  const idat = pngChunk(
    'IDAT',
    Array.from({ length: 40 }, (_, i) => (i * 5 + 1) & 0xff),
  );
  const iend = pngChunk('IEND', []);
  const file = cat(sig, ihdr, exif, itxt, text, idat, iend);
  return { file, exifDataAt: sig.length + ihdr.length + 8 };
}

/** The chunks of a PNG with their stored and recomputed CRCs. */
export function pngChunks(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const out: { type: string; at: number; length: number; crcOk: boolean }[] = [];
  let p = 8;
  while (p + 12 <= file.length) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(...file.subarray(p + 4, p + 8));
    const crc = crc32(file.subarray(p + 8, p + 8 + length), crc32(file.subarray(p + 4, p + 8)));
    out.push({ type, at: p, length, crcOk: crc === view.getUint32(p + 8 + length) });
    p += 12 + length;
  }
  return out;
}

export function webp(): { file: Uint8Array; exifDataAt: number } {
  const chunk = (type: string, data: number[] | Uint8Array) => {
    const d = Array.from(data);
    return cat(ascii(type), u32(d.length, true), d, d.length & 1 ? [0] : []);
  };
  const vp8x = chunk('VP8X', [0x2c, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
  const exif = chunk('EXIF', tiff(true));
  // an odd length, so the chunk is followed by a pad byte
  const packet = xmpBytes();
  if (packet.length % 2 === 0) packet.push(0x20);
  const xmp = chunk('XMP ', packet);
  const image = chunk(
    'VP8L',
    Array.from({ length: 33 }, (_, i) => (i * 3 + 1) & 0xff),
  );
  const body = cat(ascii('WEBP'), vp8x, exif, xmp, image);
  const file = cat(ascii('RIFF'), u32(body.length, true), body);
  return { file, exifDataAt: 12 + vp8x.length + 8 };
}

// ─── comparing ──────────────────────────────────────────────────────────────────────────────────

export const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

/** Offsets where two equal-length byte strings differ. */
export function diffs(a: Uint8Array, b: Uint8Array): number[] {
  if (a.length !== b.length) throw new Error(`length ${a.length} vs ${b.length}`);
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

export const inRanges = (at: number, ranges: [number, number][]) =>
  ranges.some(([from, to]) => at >= from && at < to);

/** Does `haystack` hold `needle` anywhere? */
export function contains(haystack: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

export const text = (b: Uint8Array) => new TextDecoder().decode(b);
