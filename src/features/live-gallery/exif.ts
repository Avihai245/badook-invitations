/**
 * What a JPEG's header says, read without decoding the photo: its pixel size (SOF), the EXIF
 * orientation, when it was taken (DateTimeOriginal + its time-zone offset) and where the location
 * block (GPS IFD) sits — so the original can be sent without the guest's location. Plain byte work
 * over the first bytes of the file; testable in Node.
 */

export interface ExifLocation {
  /** the APP1 segment, marker included: [start, end) in the file */
  app1Start: number;
  app1End: number;
  /** where the TIFF header starts (EXIF offsets count from here) */
  tiffStart: number;
  little: boolean;
  /** the GPS IFD (absolute offset), when there is one */
  gpsIfd: number | null;
}

export interface JpegInfo {
  width: number | null;
  height: number | null;
  /** 1..8 (1 = as stored) */
  orientation: number;
  /** 'YYYY-MM-DDTHH:mm:ss' in the camera's local time */
  dateTime: string | null;
  /** '+03:00' when the camera recorded its offset */
  offset: string | null;
  exif: ExifLocation | null;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

export const isJpeg = (bytes: Uint8Array): boolean =>
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** Reads a JPEG's header (the first few hundred KB are enough). null when it isn't a JPEG. */
export function readJpegInfo(bytes: Uint8Array): JpegInfo | null {
  if (!isJpeg(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info: JpegInfo = {
    width: null,
    height: null,
    orientation: 1,
    dateTime: null,
    offset: null,
    exif: null,
  };
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) break;
    const marker = bytes[p + 1]!;
    if (marker === 0xff) {
      p++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image / start of scan
    const length = view.getUint16(p + 2);
    if (length < 2) break;
    const start = p + 4;
    const end = p + 2 + length;
    if (SOF.has(marker) && start + 5 <= bytes.length) {
      info.height = view.getUint16(start + 1);
      info.width = view.getUint16(start + 3);
    }
    if (marker === 0xe1 && !info.exif && end <= bytes.length && hasExifHeader(bytes, start)) {
      readExif(bytes, view, p, end, start + 6, info);
    }
    p = end;
  }
  return info;
}

function hasExifHeader(bytes: Uint8Array, at: number): boolean {
  // "Exif\0\0"
  return (
    bytes[at] === 0x45 &&
    bytes[at + 1] === 0x78 &&
    bytes[at + 2] === 0x69 &&
    bytes[at + 3] === 0x66 &&
    bytes[at + 4] === 0 &&
    bytes[at + 5] === 0
  );
}

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** absolute offset of the value (inline or out of line) */
  at: number;
}

function readExif(
  bytes: Uint8Array,
  view: DataView,
  app1Start: number,
  app1End: number,
  tiff: number,
  info: JpegInfo,
): void {
  if (tiff + 8 > app1End) return;
  const little = bytes[tiff] === 0x49; // "II"
  if (!little && bytes[tiff] !== 0x4d) return; // "MM"
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(tiff + 2) !== 42) return;
  const location: ExifLocation = { app1Start, app1End, tiffStart: tiff, little, gpsIfd: null };
  info.exif = location;

  const entries = (ifd: number): Entry[] => {
    const at = tiff + ifd;
    if (ifd <= 0 || at + 2 > app1End) return [];
    const n = u16(at);
    const out: Entry[] = [];
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      if (e + 12 > app1End) break;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = (TYPE_SIZE[type] ?? 0) * count;
      out.push({ tag: u16(e), type, count, at: size > 4 ? tiff + u32(e + 8) : e + 8 });
    }
    return out;
  };
  const ascii = (e: Entry): string | null => {
    if (e.type !== 2 || e.at + e.count > app1End) return null;
    let s = '';
    for (let i = 0; i < e.count; i++) {
      const c = bytes[e.at + i]!;
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  const ifd0 = entries(u32(tiff + 4));
  let exifIfd = 0;
  for (const e of ifd0) {
    if (e.tag === 0x0112 && e.type === 3) {
      const o = u16(e.at);
      if (o >= 1 && o <= 8) info.orientation = o;
    } else if (e.tag === 0x8769) exifIfd = u32(e.at);
    else if (e.tag === 0x8825) {
      const gps = u32(e.at);
      if (gps > 0 && tiff + gps + 2 <= app1End) location.gpsIfd = tiff + gps;
    }
  }
  let original: string | null = null;
  let digitized: string | null = null;
  for (const e of entries(exifIfd)) {
    if (e.tag === 0x9003) original = ascii(e);
    else if (e.tag === 0x9004) digitized = ascii(e);
    else if (e.tag === 0x9011) {
      const o = ascii(e);
      if (o && /^[+-]\d{2}:\d{2}$/.test(o)) info.offset = o;
    }
  }
  info.dateTime = exifDateTime(original) ?? exifDateTime(digitized);
}

/** "2027:06:17 21:04:33" → "2027-06-17T21:04:33" (null for blanks and nonsense). */
export function exifDateTime(raw: string | null): string | null {
  const m = raw && /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (Number(y) < 1990 || Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/**
 * When the photo was taken, as an ISO instant: the camera's offset when it recorded one, otherwise
 * `fallbackOffsetMinutes` (the phone's own time zone — guests shoot where they are). null without a
 * date.
 */
export function takenAtIso(
  info: Pick<JpegInfo, 'dateTime' | 'offset'>,
  fallbackOffsetMinutes: number,
): string | null {
  if (!info.dateTime) return null;
  let offset = info.offset;
  if (!offset) {
    const sign = fallbackOffsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(fallbackOffsetMinutes);
    offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }
  const date = new Date(`${info.dateTime}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The APP1 segment with its location block emptied: every GPS value zeroed, then the GPS IFD made an
 * empty directory (count 0, no next). Offsets elsewhere don't move — the file keeps its size and
 * everything else in it. null when there is no GPS block. `segment` is the APP1 segment as it is in
 * the file ([app1Start, app1End)).
 */
export function withoutGps(segment: Uint8Array, exif: ExifLocation): Uint8Array | null {
  if (exif.gpsIfd === null) return null;
  const out = segment.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const base = exif.app1Start;
  const local = (abs: number) => abs - base;
  const u16 = (abs: number) => view.getUint16(local(abs), exif.little);
  const u32 = (abs: number) => view.getUint32(local(abs), exif.little);
  const zero = (absStart: number, length: number) => {
    const from = Math.max(0, local(absStart));
    const to = Math.min(out.length, local(absStart) + length);
    if (to > from) out.fill(0, from, to);
  };
  const ifd = exif.gpsIfd;
  if (local(ifd) + 2 > out.length) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (local(e) + 12 > out.length) break;
    const size = (TYPE_SIZE[u16(e + 2)] ?? 0) * u32(e + 4);
    // values longer than 4 bytes live elsewhere in the segment: clear them too
    if (size > 4) zero(exif.tiffStart + u32(e + 8), size);
  }
  // the entries and the next-directory pointer, then an empty directory
  zero(ifd + 2, n * 12 + 4);
  zero(ifd, 2);
  return out;
}

/** Orientations 5..8 turn the photo a quarter: its width and height swap. */
export const swapsSides = (orientation: number): boolean => orientation >= 5 && orientation <= 8;

/**
 * The canvas transform that draws a photo stored with `orientation` upright, given the drawn size
 * (w × h of the upright photo): [a, b, c, d, e, f] for setTransform.
 */
export function orientationTransform(
  orientation: number,
  w: number,
  h: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, w, 0];
    case 3:
      return [-1, 0, 0, -1, w, h];
    case 4:
      return [1, 0, 0, -1, 0, h];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, w, 0];
    case 7:
      return [0, -1, -1, 0, w, h];
    case 8:
      return [0, -1, 1, 0, 0, h];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}
