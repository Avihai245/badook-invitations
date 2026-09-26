import { z } from 'zod';
import { FACES } from './config';

/**
 * Face search as plain data and math (isomorphic, tested in tests/unit/faces.test.ts): a face as the
 * browsers send it — where it is in the photo (fractions of its width and height), the detector's
 * confidence and its descriptor (128 numbers) — never a crop, never a name; the distance that says two
 * faces are the same person; and the window face search is open in (until the data's erasure, 30 days
 * after the event).
 */

/** x, y, width, height as fractions of the photo (as shown, upright). */
export type Box = [number, number, number, number];

export interface Face {
  box: Box;
  score: number;
  descriptor: number[];
}

export const DESCRIPTOR_LENGTH = 128;

export const DescriptorSchema = z.array(z.number().finite().min(-2).max(2)).length(DESCRIPTOR_LENGTH);

const fraction = z.number().finite().min(0).max(1);
export const FaceSchema = z.strictObject({
  box: z
    .tuple([fraction, fraction, fraction, fraction])
    .refine(([x, y, w, h]) => w > 0 && h > 0 && x + w <= 1.001 && y + h <= 1.001),
  score: fraction,
  descriptor: DescriptorSchema,
});
export const FacesSchema = z.array(FaceSchema).max(FACES.detect.maxFaces);

/** Euclidean distance of two descriptors (0: the same face; the same person is usually under 0.5). */
export function faceDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** What a detector found, in the photo's pixels (x, y, width, height). */
export interface RawFace {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  descriptor: ArrayLike<number>;
}

/**
 * A detector's faces as they are sent: boxes as fractions of the photo, clamped inside it; faces too
 * small to match reliably or unsure left out; the largest first, at most FACES.detect.maxFaces; numbers
 * rounded (a descriptor needs no more than 5 decimals).
 */
export function normalizeFaces(raw: readonly RawFace[], imageWidth: number, imageHeight: number): Face[] {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return [];
  const minSide = Math.min(imageWidth, imageHeight) * FACES.detect.minFaceShare;
  return raw
    .filter((f) => f.score >= FACES.detect.minConfidence && Math.min(f.width, f.height) >= minSide)
    .filter((f) => f.descriptor.length === DESCRIPTOR_LENGTH)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, FACES.detect.maxFaces)
    .map((f) => {
      const x = Math.min(1, Math.max(0, f.x / imageWidth));
      const y = Math.min(1, Math.max(0, f.y / imageHeight));
      const w = Math.min(1 - x, Math.max(0, f.width / imageWidth));
      const h = Math.min(1 - y, Math.max(0, f.height / imageHeight));
      return {
        box: [round(x, 4), round(y, 4), round(w, 4), round(h, 4)] as Box,
        score: round(Math.min(1, Math.max(0, f.score)), 3),
        descriptor: Array.from(f.descriptor, (v) => round(Math.min(2, Math.max(-2, v)), 5)),
      };
    })
    .filter((f) => f.box[2] > 0 && f.box[3] > 0 && f.descriptor.every(Number.isFinite));
}

/**
 * The photos a descriptor finds among faces (the database does the same in gallery_face_search):
 * every photo with a face within `threshold`, with its closest distance, closest first.
 */
export function matchPhotos(
  descriptor: readonly number[],
  faces: readonly { itemId: string; descriptor: readonly number[] | null }[],
  threshold: number = FACES.match.search,
): { itemId: string; distance: number }[] {
  const best = new Map<string, number>();
  for (const f of faces) {
    if (!f.descriptor) continue;
    const d = faceDistance(descriptor, f.descriptor);
    if (d <= threshold && d < (best.get(f.itemId) ?? Infinity)) best.set(f.itemId, d);
  }
  return [...best.entries()]
    .map(([itemId, distance]) => ({ itemId, distance }))
    .sort((a, b) => a.distance - b.distance);
}

/** 'YYYY-MM-DD' + n days. */
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Face search is open until its data is erased: through the 30th day after the event's date (the daily
 * run erases it the day after). `until`: that last day ('YYYY-MM-DD'); without a date, open.
 */
export function faceWindow(eventDate: string | null, now: number): { open: boolean; until: string | null } {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { open: true, until: null };
  const until = addDays(eventDate, FACES.retentionDays);
  const today = new Date(now).toISOString().slice(0, 10);
  return { open: today <= until, until };
}
