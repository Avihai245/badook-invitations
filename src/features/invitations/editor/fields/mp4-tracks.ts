/**
 * Which kinds of tracks an MP4 / MOV file has — read from its movie box (moov → trak → mdia → hdlr:
 * `vide`, `soun`) without touching the media itself: the video's own sound decides how the editor may
 * re-encode it (prepare-video.ts). Only box headers and the moov box are read. `null` when the file
 * isn't a plain MP4 (no moov, or a malformed one): the caller then leaves the file as it is.
 */

const MAX_MOOV = 32 * 1024 * 1024;

export interface Mp4Tracks {
  video: number;
  audio: number;
}

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);

/** The boxes of `bytes[start, end)`: type, and where the payload starts and ends. */
function* boxes(bytes: Uint8Array, start: number, end: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = start;
  while (p + 8 <= end) {
    let size = view.getUint32(p);
    const type = fourcc(bytes, p + 4);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) return;
      size = view.getUint32(p + 8) * 2 ** 32 + view.getUint32(p + 12);
      header = 16;
    } else if (size === 0) size = end - p;
    if (size < header || p + size > end) return;
    yield { type, from: p + header, to: p + size };
    p += size;
  }
}

/** The tracks inside a moov box's payload. */
export function tracksOfMoov(moov: Uint8Array): Mp4Tracks | null {
  const found: Mp4Tracks = { video: 0, audio: 0 };
  let any = false;
  for (const trak of boxes(moov, 0, moov.length)) {
    if (trak.type !== 'trak') continue;
    for (const mdia of boxes(moov, trak.from, trak.to)) {
      if (mdia.type !== 'mdia') continue;
      for (const hdlr of boxes(moov, mdia.from, mdia.to)) {
        if (hdlr.type !== 'hdlr' || hdlr.to - hdlr.from < 12) continue;
        // version + flags (4), pre_defined (4), handler_type (4)
        const handler = fourcc(moov, hdlr.from + 8);
        if (handler === 'vide') found.video++;
        else if (handler === 'soun') found.audio++;
        any = true;
      }
    }
  }
  return any ? found : null;
}

/** The tracks of an MP4 file, read through `read(start, end)` (a `Blob.slice(…).arrayBuffer()`). */
export async function mp4Tracks(
  read: (start: number, end: number) => Promise<Uint8Array>,
  size: number,
): Promise<Mp4Tracks | null> {
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
    } else if (boxSize === 0) boxSize = size - p;
    if (boxSize < header) return null;
    if (type === 'moov') {
      // too large to be a movie box, or running past the end of the file (cut short): not read
      if (boxSize > MAX_MOOV || p + boxSize > size) return null;
      return tracksOfMoov(await read(p + header, p + boxSize));
    }
    p += boxSize;
  }
  return null;
}
