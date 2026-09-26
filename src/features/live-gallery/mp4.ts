/**
 * When a video (MP4 / MOV) was recorded, from its movie header (moov → mvhd creation_time: seconds
 * since 1904 in UTC). Reads only box headers and the moov box — never the video itself — through
 * `read(start, end)`, so a phone doesn't load a 200 MB file into memory. null when there is none.
 */

const EPOCH_1904 = 2_082_844_800; // seconds from 1904-01-01 to 1970-01-01
const MAX_MOOV = 16 * 1024 * 1024;

type Read = (start: number, end: number) => Promise<Uint8Array>;

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);

export async function mp4CreationTime(read: Read, size: number, now = Date.now()): Promise<string | null> {
  let p = 0;
  for (let guard = 0; guard < 64 && p + 8 <= size; guard++) {
    const head = await read(p, Math.min(size, p + 16));
    if (head.length < 8) return null;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let boxSize = view.getUint32(0);
    const type = fourcc(head, 4);
    let header = 8;
    if (boxSize === 1) {
      if (head.length < 16) return null;
      boxSize = view.getUint32(8) * 2 ** 32 + view.getUint32(12);
      header = 16;
    } else if (boxSize === 0) {
      boxSize = size - p;
    }
    if (boxSize < header) return null;
    if (type === 'moov') {
      if (boxSize > MAX_MOOV) return null;
      const moov = await read(p + header, Math.min(size, p + boxSize));
      return mvhdCreation(moov, now);
    }
    p += boxSize;
  }
  return null;
}

/** creation_time of the mvhd box inside a moov box's payload. */
export function mvhdCreation(moov: Uint8Array, now = Date.now()): string | null {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  let p = 0;
  while (p + 8 <= moov.length) {
    const size = view.getUint32(p);
    const type = fourcc(moov, p + 4);
    if (size < 8) return null;
    if (type === 'mvhd') {
      const version = moov[p + 8];
      let seconds: number;
      if (version === 1) {
        if (p + 20 > moov.length) return null;
        seconds = view.getUint32(p + 12) * 2 ** 32 + view.getUint32(p + 16);
      } else {
        if (p + 16 > moov.length) return null;
        seconds = view.getUint32(p + 12);
      }
      if (!seconds) return null;
      const ms = (seconds - EPOCH_1904) * 1000;
      // cameras without a clock write 1904 or 1970; nothing from the future either
      if (ms < Date.UTC(2000, 0, 1) || ms > now + 86_400_000) return null;
      return new Date(ms).toISOString();
    }
    p += size;
  }
  return null;
}
