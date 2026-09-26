import { GALLERY } from './config';

/**
 * The browser's checks on a photo's thumbnail, as plain math over pixels (so they are testable
 * without a browser): luminance, sharpness (variance of the Laplacian), a perceptual hash (dHash) and
 * the gentle levels/contrast lift of the display version.
 */

/** RGBA pixels → luminance 0..255 (Rec. 601). */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4)
    out[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  return out;
}

/** Mean luminance, 0 (black) .. 1 (white). */
export function meanLuminance(gray: Float32Array): number {
  if (!gray.length) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i]!;
  return sum / gray.length / 255;
}

/** Variance of the 4-neighbour Laplacian over a rectangle (inner pixels only). */
export function laplacianVariance(
  gray: Float32Array,
  width: number,
  height: number,
  x0 = 0,
  y0 = 0,
  x1 = width,
  y1 = height,
): number {
  let n = 0;
  let sum = 0;
  let sq = 0;
  for (let y = Math.max(1, y0); y < Math.min(height - 1, y1); y++) {
    for (let x = Math.max(1, x0); x < Math.min(width - 1, x1); x++) {
      const i = y * width + x;
      const l = gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]! - 4 * gray[i]!;
      sum += l;
      sq += l * l;
      n++;
    }
  }
  if (n < 2) return 0;
  const mean = sum / n;
  return sq / n - mean * mean;
}

/**
 * Sharpness: the variance of the Laplacian in each cell of a grid, second best. A photo with anything
 * in focus scores high even where the rest is sky or a wall; a shaken or out-of-focus shot scores low
 * everywhere; and one noisy corner can't carry the whole photo.
 */
export function sharpness(gray: Float32Array, width: number, height: number, grid = 4): number {
  const scores: number[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x0 = Math.floor((gx * width) / grid);
      const x1 = Math.floor(((gx + 1) * width) / grid);
      const y0 = Math.floor((gy * height) / grid);
      const y1 = Math.floor(((gy + 1) * height) / grid);
      scores.push(laplacianVariance(gray, width, height, x0 - 1, y0 - 1, x1 + 1, y1 + 1));
    }
  }
  scores.sort((a, b) => b - a);
  return scores[Math.min(1, scores.length - 1)] ?? 0;
}

/** Area-average downscale of a luminance image to w × h. */
export function downscale(
  gray: Float32Array,
  width: number,
  height: number,
  w: number,
  h: number,
): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy0 = (y * height) / h;
    const sy1 = ((y + 1) * height) / h;
    for (let x = 0; x < w; x++) {
      const sx0 = (x * width) / w;
      const sx1 = ((x + 1) * width) / w;
      let sum = 0;
      let area = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        if (wy <= 0 || sy >= height) continue;
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          if (wx <= 0 || sx >= width) continue;
          sum += gray[sy * width + sx]! * wx * wy;
          area += wx * wy;
        }
      }
      out[y * w + x] = area ? sum / area : 0;
    }
  }
  return out;
}

/**
 * dHash: the photo shrunk to 9×8, each pixel compared with its right-hand neighbour — 64 bits as 16
 * hex digits. The same photo re-saved, resized or slightly re-coloured keeps (almost) the same bits.
 */
export function dHash(gray: Float32Array, width: number, height: number): string {
  const small = downscale(gray, width, height, 9, 8);
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      byte = (byte << 1) | (small[y * 9 + x]! < small[y * 9 + x + 1]! ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Bits that differ between two 64-bit hashes (hex); 64 when either isn't one. */
export function hamming(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return 64;
  let bits = 0;
  for (let i = 0; i < 16; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) {
      bits += x & 1;
      x >>>= 1;
    }
  }
  return bits;
}

export type EnhanceOptions = typeof GALLERY.enhance;

/**
 * The display version's gentle lift, as a 256-entry lookup table applied to R, G and B alike (hue
 * stays): the levels stretched so the darkest and brightest half-percent reach black and white —
 * at most `maxGain` more contrast, blended with the original at `strength` — and a dark photo's
 * midtones raised a little. null when the photo needs nothing.
 */
export function levelsLut(gray: Float32Array, o: EnhanceOptions = GALLERY.enhance): Uint8Array | null {
  if (!gray.length) return null;
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i]!)))]!++;
  const at = (q: number) => {
    const target = q * gray.length;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!;
      if (acc >= target) return v;
    }
    return 255;
  };
  const low = at(o.lowPercentile);
  const high = at(o.highPercentile);
  const mean = meanLuminance(gray);
  const stretch = high - low < o.fullRange && high > low;
  const gamma = mean < o.darkMean ? Math.max(o.minGamma, 1 - (o.darkMean - mean) * 0.6) : 1;
  if (!stretch && gamma === 1) return null;
  const gain = stretch ? Math.min(o.maxGain, 255 / (high - low)) : 1;
  // a capped stretch doesn't fill 0..255: the room left is shared like the photo's own margins
  // (a photo with no highlights brightens, one with no shadows darkens, a foggy one does both)
  const span = (high - low) * gain;
  const margins = low + (255 - high);
  const newLow = stretch && margins > 0 ? ((255 - span) * low) / margins : 0;
  const lut = new Uint8Array(256);
  let changed = false;
  for (let v = 0; v < 256; v++) {
    let s = stretch ? (v - low) * gain + newLow : v;
    s = Math.max(0, Math.min(255, s));
    if (gamma !== 1) s = 255 * Math.pow(s / 255, gamma);
    const out = Math.round(v + o.strength * (s - v));
    lut[v] = Math.max(0, Math.min(255, out));
    if (lut[v] !== v) changed = true;
  }
  return changed ? lut : null;
}

/** Applies a lookup table to RGBA pixels in place (alpha untouched). */
export function applyLut(rgba: { length: number; [i: number]: number }, lut: Uint8Array): void {
  for (let p = 0; p < rgba.length; p += 4) {
    rgba[p] = lut[rgba[p]!]!;
    rgba[p + 1] = lut[rgba[p + 1]!]!;
    rgba[p + 2] = lut[rgba[p + 2]!]!;
  }
}

/** The size to draw at so the long edge is at most `maxEdge` (never enlarged). */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
