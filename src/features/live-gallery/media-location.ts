import { clearTiffGps } from './exif';
import { crc32 } from './zip';

/**
 * Takes the guest's location out of an original before it leaves the browser — photos (JPEG, HEIC /
 * HEIF / AVIF, PNG, WebP) and videos (MP4 / MOV / 3GP). Everything is done IN PLACE: a location is
 * overwritten with zeros (or spaces, in XMP text) at the same offsets, so the file keeps its length,
 * every other byte, and the picture or movie itself. Only box / chunk / segment headers and the small
 * metadata blocks are read, through `Blob.slice`; the result is a new Blob made of the untouched
 * slices of the original and the few patched pieces, so a 200 MB video is never held in memory.
 *
 * It is a best effort and never throws: a file it can't read, a format it doesn't handle, or any
 * surprise gives the file back as it was (`changed: false`) — an upload must never fail because of it.
 *
 * Known limits (what is NOT neutralised): GIF and WebM go through unchanged; compressed XMP; IPTC /
 * Photoshop place names (city, country); maker notes; Exif inside an embedded preview or a
 * multi-picture (MPF) secondary image; HEIC items stored in 'idat'; location in a video's timed
 * metadata track ('mebx', dashcam 'gps ' atoms); a moov box over 16 MB; PNG "Raw profile type exif"
 * text chunks. It also depends on this code running — a client that skips it uploads what it likes.
 */

export interface StrippedMedia {
  blob: Blob;
  changed: boolean;
  /** what was found and overwritten: 'exif-gps', 'xmp-gps', 'udta-location', 'quicktime-location' */
  kinds: string[];
}

type Read = (start: number, end: number) => Promise<Uint8Array>;

/** Something in the file doesn't add up: leave it alone. */
class Malformed extends Error {}
const bad = (): never => {
  throw new Malformed();
};

const MAX_MOOV = 16 * 1024 * 1024;
const MAX_META = 16 * 1024 * 1024;
const MAX_ITEM = 2 * 1024 * 1024;
const MAX_BOXES = 512;
const MAX_CHUNKS = 20_000;

// ─── patches ────────────────────────────────────────────────────────────────────────────────────

interface Patch {
  at: number;
  bytes: Uint8Array;
}

class Patches {
  list: Patch[] = [];
  kinds = new Set<string>();

  /** `next` goes where `prev` is now (same length); nothing happens when they're already equal. */
  put(at: number, next: Uint8Array, prev: Uint8Array, kind: string) {
    if (next.length !== prev.length) bad();
    let same = true;
    for (let i = 0; i < next.length && same; i++) same = next[i] === prev[i];
    if (same) return;
    this.list.push({ at, bytes: next });
    this.kinds.add(kind);
  }

  /** The file with the patches in: untouched slices around them. null when they overlap or overrun. */
  apply(file: Blob, type: string): Blob | null {
    const sorted = [...this.list].sort((a, b) => a.at - b.at);
    const parts: BlobPart[] = [];
    let cursor = 0;
    for (const patch of sorted) {
      if (patch.at < cursor || patch.at + patch.bytes.length > file.size) return null;
      parts.push(file.slice(cursor, patch.at), patch.bytes as Uint8Array<ArrayBuffer>);
      cursor = patch.at + patch.bytes.length;
    }
    parts.push(file.slice(cursor));
    return new Blob(parts, { type });
  }
}

const u32be = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u32le = (b: Uint8Array, at: number) =>
  ((b[at + 3]! << 24) | (b[at + 2]! << 16) | (b[at + 1]! << 8) | b[at]!) >>> 0;
const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);
const fourccBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const startsWith = (b: Uint8Array, at: number, s: string) => {
  if (at + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};
const be32 = (n: number) => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** A NUL-terminated Latin-1 string at `at` (bounded by `end`); null without a terminator. */
function cstr(b: Uint8Array, at: number, end: number): { text: string; next: number } | null {
  let s = '';
  for (let i = at; i < end; i++) {
    if (b[i] === 0) return { text: s, next: i + 1 };
    s += String.fromCharCode(b[i]!);
  }
  return null;
}

// ─── XMP ────────────────────────────────────────────────────────────────────────────────────────

const XMP_GPS: RegExp[] = [
  // <exif:GPSLatitude>…</exif:GPSLatitude>  and  <exif:GPSLatitude …/>
  /<exif:(GPS\w*)\b[^>]*?(?:\/>|>[\s\S]*?<\/exif:\1\s*>)/g,
  // exif:GPSLatitude="…" as an attribute of rdf:Description
  /\sexif:GPS\w*\s*=\s*(?:"[^"]*"|'[^']*')/g,
];

/**
 * Overwrites the exif:GPS* properties of an XMP packet at bytes[from, to) with spaces, IN PLACE (the
 * packet keeps its length; spaces are legal XML between attributes and elements). Works on a 1:1
 * byte-to-character view, so multi-byte text elsewhere is untouched. true when something changed.
 */
export function blankXmpGps(bytes: Uint8Array, from = 0, to = bytes.length): boolean {
  to = Math.min(to, bytes.length);
  if (from >= to) return false;
  let text = '';
  for (let i = from; i < to; i++) text += String.fromCharCode(bytes[i]!);
  if (!text.includes('GPS')) return false;
  let changed = false;
  for (const pattern of XMP_GPS) {
    for (const m of text.matchAll(pattern)) {
      const start = from + m.index;
      for (let i = start; i < start + m[0].length; i++) {
        if (bytes[i] !== 0x20) {
          bytes[i] = 0x20;
          changed = true;
        }
      }
    }
    // later patterns must not see what the earlier one blanked as something else
    text = '';
    for (let i = from; i < to; i++) text += String.fromCharCode(bytes[i]!);
  }
  return changed;
}

/** A bare Exif block (TIFF, optionally behind "Exif\0\0"): returns the copy with GPS cleared, or null. */
function cleanExif(data: Uint8Array, tiffAt: number): Uint8Array | null {
  const copy = data.slice();
  return clearTiffGps(copy, tiffAt, copy.length) ? copy : null;
}

// ─── JPEG ───────────────────────────────────────────────────────────────────────────────────────

const XMP_JPEG = 'http://ns.adobe.com/xap/1.0/\0';
const XMP_JPEG_EXT = 'http://ns.adobe.com/xmp/extension/\0';

async function stripJpeg(size: number, read: Read, patches: Patches) {
  const head = await read(0, 3);
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return;
  let p = 2;
  // the segments before the scan: as many as there are, wherever the Exif sits
  for (let guard = 0; guard < MAX_BOXES && p + 4 <= size; guard++) {
    const h = await read(p, p + 4);
    if (h.length < 4 || h[0] !== 0xff) break;
    const marker = h[1]!;
    if (marker === 0xff) {
      p++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image / start of scan
    const length = (h[2]! << 8) | h[3]!;
    const end = p + 2 + length;
    if (length < 2 || end > size) break;
    if (marker === 0xe1 && length >= 8) {
      const segment = await read(p, end);
      if (startsWith(segment, 4, 'Exif\0\0')) {
        const clean = cleanExif(segment, 10);
        if (clean) patches.put(p, clean, segment, 'exif-gps');
      } else if (startsWith(segment, 4, XMP_JPEG) || startsWith(segment, 4, XMP_JPEG_EXT)) {
        const copy = segment.slice();
        if (blankXmpGps(copy, 4)) patches.put(p, copy, segment, 'xmp-gps');
      }
    }
    p = end;
  }
}

// ─── ISO base media boxes (HEIC / HEIF / AVIF / MP4 / MOV / 3GP) ────────────────────────────────

interface Box {
  type: string;
  /** offset of the box header in the buffer */
  start: number;
  /** header length (8, or 16 with a 64-bit size) */
  hdr: number;
  /** offset just past the box */
  end: number;
}

/** The boxes in b[from, to). Throws when one runs outside; a short tail (a QuickTime terminator) ends it. */
function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    let size = u32be(b, p);
    let hdr = 8;
    if (size === 1) {
      if (p + 16 > to) bad();
      const hi = u32be(b, p + 8);
      if (hi > 0x1fffff) bad();
      size = hi * 2 ** 32 + u32be(b, p + 12);
      hdr = 16;
    } else if (size === 0) {
      size = to - p;
    }
    if (size < hdr || p + size > to) bad();
    out.push({ type: fourcc(b, p + 4), start: p, hdr, end: p + size });
    p += size;
  }
  return out;
}

/** The top-level box of this type (header + `maxSize`-bounded extent), found by reading headers only. */
async function findTopBox(
  read: Read,
  fileSize: number,
  wanted: string,
  maxSize: number,
): Promise<{ start: number; hdr: number; end: number } | null> {
  let p = 0;
  for (let guard = 0; guard < MAX_BOXES && p + 8 <= fileSize; guard++) {
    const h = await read(p, Math.min(fileSize, p + 16));
    if (h.length < 8) return null;
    let size = u32be(h, 0);
    let hdr = 8;
    if (size === 1) {
      if (h.length < 16) return null;
      const hi = u32be(h, 8);
      if (hi > 0x1fffff) return null;
      size = hi * 2 ** 32 + u32be(h, 12);
      hdr = 16;
    } else if (size === 0) {
      size = fileSize - p;
    }
    if (size < hdr || p + size > fileSize) return null; // truncated, or a lie about its size
    if (fourcc(h, 4) === wanted) return size > maxSize ? null : { start: p, hdr, end: p + size };
    p += size;
  }
  return null;
}

// ─── HEIC / HEIF / AVIF ─────────────────────────────────────────────────────────────────────────

interface ItemInfo {
  type: string;
  contentType: string;
}
interface ItemExtent {
  /** 0 = offset into the file; 1 = into 'idat'; 2 = into another item */
  method: number;
  base: number;
  extents: { offset: number; length: number }[];
}

function readInfe(b: Uint8Array, box: Box): { id: number; info: ItemInfo } | null {
  const p = box.start + box.hdr;
  const version = b[p]!;
  if (version < 2) return null; // no item_type before version 2
  const id = version === 2 ? (b[p + 4]! << 8) | b[p + 5]! : u32be(b, p + 4);
  const at = p + 4 + (version === 2 ? 2 : 4) + 2; // item_ID, item_protection_index
  if (at + 4 > box.end) return null;
  const type = fourcc(b, at);
  let contentType = '';
  if (type === 'mime') {
    const name = cstr(b, at + 4, box.end);
    contentType = (name && cstr(b, name.next, box.end)?.text) || '';
  }
  return { id, info: { type, contentType } };
}

function readIloc(b: Uint8Array, box: Box): Map<number, ItemExtent> {
  const out = new Map<number, ItemExtent>();
  let p = box.start + box.hdr;
  const end = box.end;
  const need = (n: number) => {
    if (p + n > end) bad();
  };
  const num = (n: number): number => {
    need(n);
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + b[p + i]!;
    p += n;
    if (!Number.isSafeInteger(v)) bad();
    return v;
  };
  const version = num(1);
  num(3); // flags
  if (version > 2) bad();
  const sizes = num(2);
  const offsetSize = sizes >> 12;
  const lengthSize = (sizes >> 8) & 0xf;
  const baseSize = (sizes >> 4) & 0xf;
  const indexSize = version === 0 ? 0 : sizes & 0xf;
  for (const n of [offsetSize, lengthSize, baseSize, indexSize]) if (n !== 0 && n !== 4 && n !== 8) bad();
  const count = version < 2 ? num(2) : num(4);
  for (let i = 0; i < count; i++) {
    const id = version < 2 ? num(2) : num(4);
    const method = version === 0 ? 0 : num(2) & 0xf;
    num(2); // data_reference_index
    const base = num(baseSize);
    const extentCount = num(2);
    const extents: ItemExtent['extents'] = [];
    for (let j = 0; j < extentCount; j++) {
      num(indexSize);
      extents.push({ offset: num(offsetSize), length: num(lengthSize) });
    }
    out.set(id, { method, base, extents });
  }
  return out;
}

async function stripHeif(fileSize: number, read: Read, patches: Patches) {
  const meta = await findTopBox(read, fileSize, 'meta', MAX_META);
  if (!meta) return;
  const b = await read(meta.start + meta.hdr, meta.end);
  // 'meta' is a full box here: 4 bytes of version and flags, then its children
  const kids = boxes(b, 4, b.length);
  const iinf = kids.find((k) => k.type === 'iinf');
  const ilocBox = kids.find((k) => k.type === 'iloc');
  if (!iinf || !ilocBox) return;

  const items = new Map<number, ItemInfo>();
  const iinfVersion = b[iinf.start + iinf.hdr]!;
  for (const infe of boxes(b, iinf.start + iinf.hdr + (iinfVersion === 0 ? 6 : 8), iinf.end)) {
    if (infe.type !== 'infe') continue;
    const item = readInfe(b, infe);
    if (item) items.set(item.id, item.info);
  }
  const locations = readIloc(b, ilocBox);

  for (const [id, info] of items) {
    const isExif = info.type === 'Exif';
    const isXmp = info.type === 'mime' && /^application\/(rdf\+xml|xml)\b/i.test(info.contentType);
    if (!isExif && !isXmp) continue;
    const where = locations.get(id);
    // one extent in the file itself; anything else is left (and listed among the limits)
    if (!where || where.method !== 0 || where.extents.length !== 1) continue;
    const extent = where.extents[0]!;
    const at = where.base + extent.offset;
    if (extent.length === 0 || extent.length > MAX_ITEM || at + extent.length > fileSize) continue;
    const data = await read(at, at + extent.length);
    if (isExif) {
      // ExifDataBlock: a 4-byte exif_tiff_header_offset (counted past itself), then the Exif data
      if (data.length < 12) continue;
      const clean = cleanExif(data, 4 + u32be(data, 0));
      if (clean) patches.put(at, clean, data, 'exif-gps');
    } else {
      const copy = data.slice();
      if (blankXmpGps(copy)) patches.put(at, copy, data, 'xmp-gps');
    }
  }
}

// ─── MP4 / MOV / 3GP ────────────────────────────────────────────────────────────────────────────

/** QuickTime metadata keys that carry a place: com.apple.quicktime.location.ISO6709, …name, …accuracy… */
const LOCATION_KEY = /location|gps|iso6709/i;
const UDTA_LOCATION = new Set(['©xyz', 'loci']);
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'udta']);

/** Retype a box as 'free' and zero what it held (same size): players skip it. */
function retypeFree(b: Uint8Array, base: number, box: Box, patches: Patches, kind: string) {
  patches.put(base + box.start + 4, fourccBytes('free'), b.subarray(box.start + 4, box.start + 8), kind);
  zeroRange(b, base, box.start + box.hdr, box.end, patches, kind);
}

function zeroRange(b: Uint8Array, base: number, from: number, to: number, patches: Patches, kind: string) {
  if (to > from) patches.put(base + from, new Uint8Array(to - from), b.subarray(from, to), kind);
}

/** A 'meta' box inside moov / trak / udta: QuickTime's keys + ilst pair, or iTunes-style ilst items. */
function stripMeta(b: Uint8Array, base: number, meta: Box, patches: Patches) {
  const ps = meta.start + meta.hdr;
  // QuickTime writes 'meta' as a plain box (hdlr right away); ISO writes a full box (4 bytes first)
  const plain = ps + 8 <= meta.end && fourcc(b, ps + 4) === 'hdlr';
  const kids = boxes(b, plain ? ps : ps + 4, meta.end);

  const located = new Set<number>();
  const keys = kids.find((k) => k.type === 'keys');
  if (keys) {
    const kp = keys.start + keys.hdr;
    if (kp + 8 > keys.end) bad();
    const count = u32be(b, kp + 4);
    let p = kp + 8;
    for (let i = 1; i <= count; i++) {
      if (p + 8 > keys.end) bad();
      const size = u32be(b, p);
      if (size < 8 || p + size > keys.end) bad();
      let key = '';
      for (let j = p + 8; j < p + size; j++) key += String.fromCharCode(b[j]!);
      if (LOCATION_KEY.test(key)) {
        located.add(i);
        // the key no longer says "location" (and keeps its length)
        patches.put(
          base + p + 8,
          new Uint8Array(size - 8).fill(0x5f),
          b.subarray(p + 8, p + size),
          'quicktime-location',
        );
      }
      p += size;
    }
  }
  for (const ilst of kids.filter((k) => k.type === 'ilst')) {
    for (const item of boxes(b, ilst.start + ilst.hdr, ilst.end)) {
      const isLocation = item.type === '©xyz' || located.has(u32be(b, item.start + 4));
      if (!isLocation) continue;
      for (const data of boxes(b, item.start + item.hdr, item.end)) {
        // 'data': type indicator + locale (8 bytes), then the value
        if (data.type === 'data')
          zeroRange(b, base, data.start + data.hdr + 8, data.end, patches, 'quicktime-location');
      }
    }
  }
}

function walkMoov(b: Uint8Array, base: number, from: number, to: number, depth: number, patches: Patches) {
  for (const box of boxes(b, from, to)) {
    if (UDTA_LOCATION.has(box.type)) retypeFree(b, base, box, patches, 'udta-location');
    else if (box.type === 'XMP_') {
      const copy = b.slice(box.start + box.hdr, box.end);
      if (blankXmpGps(copy))
        patches.put(base + box.start + box.hdr, copy, b.subarray(box.start + box.hdr, box.end), 'xmp-gps');
    } else if (box.type === 'meta') stripMeta(b, base, box, patches);
    else if (CONTAINERS.has(box.type) && depth < 8)
      walkMoov(b, base, box.start + box.hdr, box.end, depth + 1, patches);
  }
}

async function stripMp4(fileSize: number, read: Read, patches: Patches) {
  const moov = await findTopBox(read, fileSize, 'moov', MAX_MOOV); // a huge or lying moov: as it is
  if (!moov) return;
  const start = moov.start + moov.hdr;
  const b = await read(start, moov.end);
  walkMoov(b, start, 0, b.length, 0, patches);
}

// ─── PNG ────────────────────────────────────────────────────────────────────────────────────────

async function stripPng(fileSize: number, read: Read, patches: Patches) {
  const sig = await read(0, 8);
  if (sig[0] !== 0x89 || !startsWith(sig, 1, 'PNG\r\n\x1a\n')) return;
  let p = 8;
  for (let guard = 0; guard < MAX_CHUNKS && p + 12 <= fileSize; guard++) {
    const h = await read(p, p + 8);
    const length = u32be(h, 0);
    const type = fourcc(h, 4);
    const dataAt = p + 8;
    if (length > 0x7fffffff || dataAt + length + 4 > fileSize) bad();
    if (type === 'IEND') return;
    if ((type === 'eXIf' || type === 'iTXt') && length > 0 && length <= MAX_ITEM) {
      const data = await read(dataAt, dataAt + length);
      let clean: Uint8Array | null = null;
      let kind = 'exif-gps';
      if (type === 'eXIf') {
        clean = cleanExif(data, startsWith(data, 0, 'Exif\0\0') ? 6 : 0);
      } else {
        // iTXt: keyword\0 flag method language\0 translated\0 text — the XMP packet, when uncompressed
        const key = cstr(data, 0, data.length);
        if (key?.text === 'XML:com.adobe.xmp' && data[key.next] === 0) {
          const lang = cstr(data, key.next + 2, data.length);
          const translated = lang && cstr(data, lang.next, data.length);
          if (translated) {
            const copy = data.slice();
            if (blankXmpGps(copy, translated.next)) clean = copy;
            kind = 'xmp-gps';
          }
        }
      }
      if (clean) {
        // the chunk's CRC covers its type and data
        const oldCrc = await read(dataAt + length, dataAt + length + 4);
        patches.put(dataAt, clean, data, kind);
        patches.put(dataAt + length, be32(crc32(clean, crc32(fourccBytes(type)))), oldCrc, kind);
      }
    }
    p = dataAt + length + 4;
  }
}

// ─── WebP ───────────────────────────────────────────────────────────────────────────────────────

async function stripWebp(fileSize: number, read: Read, patches: Patches) {
  const head = await read(0, 12);
  if (!startsWith(head, 0, 'RIFF') || !startsWith(head, 8, 'WEBP')) return;
  let p = 12;
  for (let guard = 0; guard < MAX_CHUNKS && p + 8 <= fileSize; guard++) {
    const h = await read(p, p + 8);
    const type = fourcc(h, 0);
    const length = u32le(h, 4);
    const dataAt = p + 8;
    if (dataAt + length > fileSize) bad();
    if ((type === 'EXIF' || type === 'XMP ') && length > 0 && length <= MAX_ITEM) {
      const data = await read(dataAt, dataAt + length);
      if (type === 'EXIF') {
        const clean = cleanExif(data, startsWith(data, 0, 'Exif\0\0') ? 6 : 0);
        if (clean) patches.put(dataAt, clean, data, 'exif-gps');
      } else {
        const copy = data.slice();
        if (blankXmpGps(copy)) patches.put(dataAt, copy, data, 'xmp-gps');
      }
    }
    p = dataAt + length + (length & 1); // chunks are padded to an even size
  }
}

// ─── entry point ────────────────────────────────────────────────────────────────────────────────

/**
 * The original without its location. `type` is the file's real type (sniffed from its bytes). The
 * returned blob is `file` itself when nothing was found or anything went wrong.
 */
export async function stripLocation(file: Blob, type: string): Promise<StrippedMedia> {
  const unchanged: StrippedMedia = { blob: file, changed: false, kinds: [] };
  try {
    const size = file.size;
    const read: Read = async (start, end) =>
      new Uint8Array(await file.slice(start, Math.min(end, size)).arrayBuffer());
    const patches = new Patches();
    switch (type.toLowerCase()) {
      case 'image/jpeg':
        await stripJpeg(size, read, patches);
        break;
      case 'image/heic':
      case 'image/heif':
      case 'image/avif':
        await stripHeif(size, read, patches);
        break;
      case 'video/mp4':
      case 'video/quicktime':
      case 'video/3gpp':
        await stripMp4(size, read, patches);
        break;
      case 'image/png':
        await stripPng(size, read, patches);
        break;
      case 'image/webp':
        await stripWebp(size, read, patches);
        break;
      default:
        // GIF has no standard place for a location; WebM (Matroska tags) is not handled
        return unchanged;
    }
    if (patches.list.length === 0) return unchanged;
    const blob = patches.apply(file, type);
    if (!blob || blob.size !== size) return unchanged;
    return { blob, changed: true, kinds: [...patches.kinds] };
  } catch {
    return unchanged;
  }
}
