/**
 * A venue's floor plan as the partner sends it — pure checks, unit-tested in
 * tests/unit/partner-venues.test.ts:
 *   · what the bytes really are (never the declared type): PNG, JPEG, WebP or PDF, and an image's size
 *     in pixels as a browser shows it (a JPEG's EXIF rotation included);
 *   · whether an address may be fetched from (the server fetches a plan's URL: never an address inside
 *     our network — loopback, private, link-local, cloud metadata — however the URL spells it).
 */

export type PlanFileType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
export const PLAN_EXT: Record<PlanFileType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface SniffedPlan {
  type: PlanFileType;
  /** pixels (null for a PDF: a browser renders it) */
  width: number | null;
  height: number | null;
}

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number) =>
  (b[i] ?? 0) * 0x1000000 + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** A JPEG's EXIF orientation (1–8; 5–8 are turned a quarter, so width and height swap). */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  if (ascii(b, start, 6) !== 'Exif\0\0') return 1;
  const tiff = start + 6;
  const little = ascii(b, tiff, 2) === 'II';
  const r16 = (i: number) => (little ? u16le(b, i) : u16be(b, i));
  const r32 = (i: number) => (little ? u16le(b, i) + u16le(b, i + 2) * 0x10000 : u32be(b, i));
  const ifd = tiff + r32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = r16(ifd);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > end) break;
    if (r16(entry) === 0x0112) return r16(entry + 8);
  }
  return 1;
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  let orientation = 1;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    if (marker === 0xe1) orientation = exifOrientation(b, i + 4, Math.min(b.length, i + 2 + length));
    // start of frame (baseline, progressive…): not DHT (C4), JPG (C8) or DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16be(b, i + 5);
      const width = u16be(b, i + 7);
      if (!width || !height) return null;
      return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
    }
    i += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8 ') {
    // the frame's start code, then 14-bit width and height
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** What a file really is (PNG, JPEG, WebP or PDF) and an image's size — null for anything else. */
export function sniffPlan(bytes: Uint8Array): SniffedPlan | null {
  const b = bytes;
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    const width = u32be(b, 16);
    const height = u32be(b, 20);
    return width && height ? { type: 'image/png', width, height } : null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const size = jpegSize(b);
    return size ? { type: 'image/jpeg', ...size } : null;
  }
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const size = webpSize(b);
    return size ? { type: 'image/webp', ...size } : null;
  }
  // a PDF's header is within its first kilobyte
  if (ascii(b, 0, Math.min(b.length, 1024)).includes('%PDF-'))
    return { type: 'application/pdf', width: null, height: null };
  return null;
}

// ─── addresses ───────────────────────────────────────────────────────────────────────────────────

function v4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const n = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return n.every((x) => x >= 0 && x <= 255) ? n : null;
}

/** An IPv6 address as 8 numbers (an embedded dotted IPv4 tail included), or null. */
function v6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const four = v4(dotted[1]!);
    if (!four) return null;
    s =
      s.slice(0, dotted.index) +
      `${((four[0]! << 8) | four[1]!).toString(16)}:${((four[2]! << 8) | four[3]!).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const n = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return n.length === 8 && n.every((x) => x >= 0) ? n : null;
}

const inV4 = (a: number[], base: number[], bits: number) => {
  for (let i = 0; i < 4 && bits > 0; i++, bits -= 8) {
    const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
    if ((a[i]! & mask) !== (base[i]! & mask)) return false;
  }
  return true;
};

/** IPv4 ranges never fetched from: this host, private networks, shared/carrier NAT, loopback,
 * link-local (cloud metadata 169.254.169.254), documentation and benchmark ranges, multicast, reserved. */
const V4_BLOCKED: [number[], number][] = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

const v4Public = (a: number[]) => !V4_BLOCKED.some(([base, bits]) => inV4(a, base, bits));

/**
 * May the server connect to this address? Only public unicast ones: IPv4 outside the ranges above;
 * IPv6 global unicast (2000::/3) outside documentation, Teredo / protocol assignments and 6to4, with
 * IPv4 inside IPv6 (mapped ::ffff:…, NAT64 64:ff9b::…) judged by the IPv4 address.
 */
export function isPublicAddress(ip: string): boolean {
  const four = v4(ip);
  if (four) return v4Public(four);
  const h = v6(ip);
  if (!h) return false;
  const embedded = [h[6]! >> 8, h[6]! & 0xff, h[7]! >> 8, h[7]! & 0xff];
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d)
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) {
    if (h[5] === 0 && h[6] === 0 && h[7]! <= 1) return false; // :: and ::1
    return v4Public(embedded);
  }
  // NAT64 (64:ff9b::/96)
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return v4Public(embedded);
  // only global unicast
  if ((h[0]! & 0xe000) !== 0x2000) return false;
  // 2001::/23 (IETF protocol assignments, Teredo 2001::/32), 2001:db8::/32 (documentation), 2002::/16 (6to4)
  if (h[0] === 0x2001 && (h[1]! < 0x200 || h[1] === 0xdb8)) return false;
  if (h[0] === 0x2002) return false;
  // 3fff::/20 (documentation, RFC 9637)
  if (h[0] === 0x3fff && h[1]! < 0x1000) return false;
  return true;
}
