import { FILM } from './config';
import type { Box } from './select';

/**
 * The slow movement over each photo, as plain geometry (tested in tests/unit/film.test.ts): the frame
 * — a rectangle of the film's shape in the photo's pixels — pushes in toward the focal point (the
 * faces, when face search found them; otherwise the middle, or a third of the way down a photo taller
 * than the frame, where people's faces usually are), or pulls out, or pans across, varying
 * from shot to shot. It never leaves a face out: when the faces fit the frame, every moment of the
 * movement keeps them all inside it; when they don't (a wide group in a vertical film), the frame
 * grows past the photo's edges to hold them, and the painter fills what's beyond the photo with a
 * soft, blurred copy of it.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Motion {
  from: Rect;
  to: Rect;
}

/** The largest rectangle of `aspect` (width / height) inside a w × h picture, centred. */
export function coverRect(w: number, h: number, aspect: number): Rect {
  if (w / h > aspect) {
    const cw = h * aspect;
    return { x: (w - cw) / 2, y: 0, w: cw, h };
  }
  const ch = w / aspect;
  return { x: 0, y: (h - ch) / 2, w, h: ch };
}

/** The faces together, with room around them, in pixels (null: none). */
export function faceBounds(faces: readonly Box[] | null, w: number, h: number): Rect | null {
  if (!faces?.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y, bw, bh] of faces) {
    const m = FILM.motion.faceMargin;
    // room around each face, more above (hair) and below (the chin, the shoulders)
    x0 = Math.min(x0, (x - bw * m) * w);
    x1 = Math.max(x1, (x + bw * (1 + m)) * w);
    y0 = Math.min(y0, (y - bh * m * 1.5) * h);
    y1 = Math.max(y1, (y + bh * (1 + m * 1.5)) * h);
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(w, x1);
  y1 = Math.min(h, y1);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

/**
 * A frame of `size` (its width; the height follows the aspect) centred as near `cx, cy` as it can be,
 * inside the picture when it fits, and always around `keep` when given.
 */
function place(
  width: number,
  aspect: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  keep: Rect | null,
): Rect {
  const height = width / aspect;
  let x = cx - width / 2;
  let y = cy - height / 2;
  // inside the picture (when it can be)
  x = width <= w ? clamp(x, 0, w - width) : (w - width) / 2;
  y = height <= h ? clamp(y, 0, h - height) : (h - height) / 2;
  if (keep) {
    // around the faces, before anything else
    x = clamp(x, keep.x + keep.w - width, keep.x);
    y = clamp(y, keep.y + keep.h - height, keep.y);
  }
  return { x, y, w: width, h: height };
}

/**
 * The movement over one photo (w × h pixels) in a film of `aspect`, the `index`-th photo shot: its
 * start and end frames.
 */
export function planMotion({
  width: w,
  height: h,
  aspect,
  faces,
  index,
}: {
  width: number;
  height: number;
  aspect: number;
  faces: readonly Box[] | null;
  index: number;
}): Motion {
  const cover = coverRect(w, h, aspect);
  const keep = faceBounds(faces, w, h);
  const push = FILM.motion.push;
  // the frame at least big enough for the faces (in the film's shape)
  const need = keep ? Math.max(keep.w, keep.h * aspect) : 0;
  const cx = keep ? keep.x + keep.w / 2 : w / 2;
  const cy = keep ? keep.y + keep.h / 2 : cover.h < h ? h / 3 : h / 2;

  if (need > cover.w) {
    // the faces are wider (or taller) than the photo's frame can be: a frame past the photo's edges
    // that holds them all, closing in only a little
    const wide = need * 1.04;
    return {
      from: place(wide, aspect, cx, cy, w, h, keep),
      to: place(Math.max(need, wide / (1 + push / 3)), aspect, cx, cy, w, h, keep),
    };
  }

  const tight = Math.max(cover.w / (1 + push), need);
  if (keep) {
    // from the whole photo toward the faces (every third one the other way: out from them)
    const wideFrame = place(cover.w, aspect, w / 2, h / 2, w, h, keep);
    const tightFrame = place(tight, aspect, cx, cy, w, h, keep);
    return index % 3 === 2 ? { from: tightFrame, to: wideFrame } : { from: wideFrame, to: tightFrame };
  }
  const kind = index % 4;
  if (kind === 0 || kind === 2) {
    // push in to the middle, or pull out from it
    const wideFrame = place(cover.w, aspect, cx, cy, w, h, null);
    const tightFrame = place(tight, aspect, cx, cy, w, h, null);
    return kind === 2 ? { from: tightFrame, to: wideFrame } : { from: wideFrame, to: tightFrame };
  }
  // a pan across (the photo has room one way or the other), at a gentle zoom
  const size = Math.max(tight, cover.w / (1 + push / 2));
  const height = size / aspect;
  const roomX = w - size;
  const roomY = h - height;
  const reverse = kind === 3;
  if (roomX >= roomY) {
    const y = (h - height) / 2;
    const a = { x: roomX * 0.15, y, w: size, h: height };
    const b = { x: roomX * 0.85, y, w: size, h: height };
    return reverse ? { from: b, to: a } : { from: a, to: b };
  }
  // down a tall photo: over its upper part (the faces, usually), not down to the feet
  const x = (w - size) / 2;
  const a = { x, y: roomY * 0.05, w: size, h: height };
  const b = { x, y: roomY * 0.3, w: size, h: height };
  return reverse ? { from: b, to: a } : { from: a, to: b };
}

/** Smooth start and finish (the movement never jerks at a cut). */
export const ease = (p: number) => {
  const t = Math.min(1, Math.max(0, p));
  return t * t * (3 - 2 * t) * 0.6 + t * 0.4;
};

/** The frame at `p` (0..1) of the shot. */
export function rectAt(m: Motion, p: number): Rect {
  const e = ease(p);
  return {
    x: m.from.x + (m.to.x - m.from.x) * e,
    y: m.from.y + (m.to.y - m.from.y) * e,
    w: m.from.w + (m.to.w - m.from.w) * e,
    h: m.from.h + (m.to.h - m.from.h) * e,
  };
}

/** Whether a frame holds a rectangle (a small tolerance for rounding). */
export function contains(frame: Rect, r: Rect, tolerance = 0.5): boolean {
  return (
    r.x >= frame.x - tolerance &&
    r.y >= frame.y - tolerance &&
    r.x + r.w <= frame.x + frame.w + tolerance &&
    r.y + r.h <= frame.y + frame.h + tolerance
  );
}
