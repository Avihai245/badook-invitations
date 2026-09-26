/**
 * Browsers record WebM without a duration (they write it as they go), so a player can't show the
 * length or seek until it has read the whole file. This writes the duration into the file's Info
 * element — a few bytes, the rest untouched (tested in tests/unit/film.test.ts).
 */

const ID = {
  segment: 0x18538067,
  info: 0x1549a966,
  duration: 0x4489,
  timecodeScale: 0x2ad7b1,
} as const;

interface Element {
  id: number;
  /** where the element starts, where its size field starts, where its data starts */
  start: number;
  sizeAt: number;
  sizeLength: number;
  dataAt: number;
  /** null: unknown size (a live recording's segment) */
  size: number | null;
}

function readVint(
  bytes: Uint8Array,
  at: number,
  keepMarker: boolean,
): { value: number; length: number } | null {
  const first = bytes[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || at + length > bytes.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[at + i]!;
    if (bytes[at + i] !== 0xff) allOnes = false;
  }
  return { value: !keepMarker && allOnes ? -1 : value, length };
}

function readElement(bytes: Uint8Array, at: number): Element | null {
  const id = readVint(bytes, at, true);
  if (!id) return null;
  const size = readVint(bytes, at + id.length, false);
  if (!size) return null;
  return {
    id: id.value,
    start: at,
    sizeAt: at + id.length,
    sizeLength: size.length,
    dataAt: at + id.length + size.length,
    size: size.value < 0 ? null : size.value,
  };
}

/** A size written in exactly `length` bytes (null: it doesn't fit). */
function sizeBytes(value: number, length: number): Uint8Array | null {
  if (value >= 2 ** (7 * length) - 1) return null;
  const out = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0]! |= 0x80 >> (length - 1);
  return out;
}

function children(bytes: Uint8Array, from: number, to: number): Element[] {
  const out: Element[] = [];
  let at = from;
  while (at < to) {
    const el = readElement(bytes, at);
    if (!el) break;
    out.push(el);
    if (el.size === null) break;
    at = el.dataAt + el.size;
  }
  return out;
}

/** The file with its duration (ms) written in; the file as it was when it isn't a WebM this can read. */
export function withWebmDuration(
  input: Uint8Array<ArrayBuffer>,
  durationMs: number,
): Uint8Array<ArrayBuffer> {
  const top = children(input, 0, input.length);
  const segment = top.find((e) => e.id === ID.segment);
  if (!segment) return input;
  const segmentEnd = segment.size === null ? input.length : segment.dataAt + segment.size;
  const info = children(input, segment.dataAt, segmentEnd).find((e) => e.id === ID.info);
  if (!info || info.size === null) return input;
  const fields = children(input, info.dataAt, info.dataAt + info.size);
  const scaleEl = fields.find((e) => e.id === ID.timecodeScale);
  let scale = 1_000_000;
  if (scaleEl?.size) {
    scale = 0;
    for (let i = 0; i < scaleEl.size; i++) scale = scale * 256 + input[scaleEl.dataAt + i]!;
    scale ||= 1_000_000;
  }
  const value = (durationMs * 1_000_000) / scale;

  const existing = fields.find((e) => e.id === ID.duration);
  if (existing && (existing.size === 8 || existing.size === 4)) {
    const out = input.slice();
    const view = new DataView(out.buffer, out.byteOffset + existing.dataAt, existing.size);
    if (existing.size === 8) view.setFloat64(0, value);
    else view.setFloat32(0, value);
    return out;
  }

  // a new Duration element (float64) at the end of Info, whose size grows by it
  const element = new Uint8Array(11);
  element.set([0x44, 0x89, 0x88]);
  new DataView(element.buffer).setFloat64(3, value);
  const newSize = sizeBytes(info.size + element.length, info.sizeLength);
  if (!newSize) return input;
  const insertAt = info.dataAt + info.size;
  const out = new Uint8Array(input.length + element.length);
  out.set(input.subarray(0, insertAt), 0);
  out.set(element, insertAt);
  out.set(input.subarray(insertAt), insertAt + element.length);
  out.set(newSize, info.sizeAt);
  if (segment.size !== null) {
    const grown = sizeBytes(segment.size + element.length, segment.sizeLength);
    if (!grown) return input;
    out.set(grown, segment.sizeAt);
  }
  return out;
}

/** The duration written in a WebM (ms), or null (for tests and checks). */
export function webmDuration(input: Uint8Array): number | null {
  const segment = children(input, 0, input.length).find((e) => e.id === ID.segment);
  if (!segment) return null;
  const end = segment.size === null ? input.length : segment.dataAt + segment.size;
  const info = children(input, segment.dataAt, end).find((e) => e.id === ID.info);
  if (!info || info.size === null) return null;
  const fields = children(input, info.dataAt, info.dataAt + info.size);
  const d = fields.find((e) => e.id === ID.duration);
  if (!d || (d.size !== 8 && d.size !== 4)) return null;
  const view = new DataView(input.buffer, input.byteOffset + d.dataAt, d.size);
  const raw = d.size === 8 ? view.getFloat64(0) : view.getFloat32(0);
  const scaleEl = fields.find((e) => e.id === ID.timecodeScale);
  let scale = 1_000_000;
  if (scaleEl?.size) {
    scale = 0;
    for (let i = 0; i < scaleEl.size; i++) scale = scale * 256 + input[scaleEl.dataAt + i]!;
  }
  return (raw * scale) / 1_000_000;
}
