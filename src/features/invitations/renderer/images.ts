import { IMAGE_DEVICE_SIZES, IMAGE_OPTIMIZER_PATH, IMAGE_QUALITIES, IMAGE_SIZES } from './image-config';

/**
 * Invitation images through Next.js image optimization (AVIF / WebP, a srcset of widths): the
 * Supabase Storage buckets (uploads, template media) and local paths. next.config.ts builds the
 * optimizer's `remotePatterns` from the Supabase address known at build time and hands the same list
 * to the code as INVITES_IMAGE_SOURCES — so the server, the browser and the optimizer always agree on
 * what it may fetch. Anything else (another host, optimization switched off with
 * INVITES_IMAGE_OPTIMIZATION=off) is a plain <img src>, and an optimized image that fails to load
 * falls back to its original address (IMAGE_FALLBACK, inlined in the page's <head>).
 *
 * The addresses are the ones next/image's default loader writes (`/_next/image?url=…&w=…&q=…`, the
 * widths chosen from `sizes` the same way), from the same widths and qualities as next.config.ts
 * (./image-config.ts) — without next/image itself, which would add ~10 KB to every guest's page.
 */

interface Source {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
}

function sources(): Source[] | null {
  const raw = process.env.INVITES_IMAGE_SOURCES;
  if (raw === 'off') return null;
  try {
    const list = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(list) ? (list as Source[]) : [];
  } catch {
    return [];
  }
}

const matches = (pattern: string, path: string) =>
  pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern;

/** Whether the optimizer may serve `url` (a local path, or a configured Storage bucket). */
export function optimizable(url: string): boolean {
  const list = sources();
  if (!list) return false;
  if (url.startsWith('/')) return !url.startsWith('//') && !url.startsWith('/_next/image');
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return list.some(
    (s) =>
      u.protocol === `${s.protocol}:` &&
      u.hostname === s.hostname &&
      (s.port || '') === u.port &&
      matches(s.pathname, u.pathname),
  );
}

export interface ImageSet {
  src: string;
  srcSet?: string;
  sizes?: string;
  /** the original address when `src` is optimized (the error fallback swaps to it) */
  fallback?: string;
}

/** Photos: a little below the default 75 (they are behind text or framed; AVIF holds up well). */
export const PHOTO_QUALITY = 70;

const ALL_SIZES = [...IMAGE_DEVICE_SIZES, ...IMAGE_SIZES].sort((a, b) => a - b);

/** The widths a srcset offers for `sizes` (next/image's rule: from the smallest share of the viewport). */
function widthsFor(sizes: string): number[] {
  const shares = [...sizes.matchAll(/(^|\s)(1?\d?\d)vw/g)].map((m) => Number.parseInt(m[2]!, 10));
  if (!shares.length) return ALL_SIZES;
  const smallest = Math.min(...shares) / 100;
  return ALL_SIZES.filter((w) => w >= IMAGE_DEVICE_SIZES[0]! * smallest);
}

/** The configured quality nearest to the one asked for (the optimizer refuses any other). */
const qualityOf = (q: number) =>
  IMAGE_QUALITIES.reduce((best, cur) => (Math.abs(cur - q) < Math.abs(best - q) ? cur : best));

const optimized = (url: string, width: number, quality: number) =>
  `${IMAGE_OPTIMIZER_PATH}?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;

/**
 * An image's src / srcset / sizes: optimized widths when the optimizer may serve it, else the file as
 * it is. `sizes` says how wide it shows (e.g. '100vw' for a full-bleed background).
 */
export function imageSet(url: string, sizes: string, quality = PHOTO_QUALITY): ImageSet {
  if (!optimizable(url)) return { src: url };
  const q = qualityOf(quality);
  const widths = widthsFor(sizes);
  return {
    src: optimized(url, widths.at(-1)!, q),
    srcSet: widths.map((w) => `${optimized(url, w, q)} ${w}w`).join(', '),
    sizes,
    fallback: url,
  };
}

/**
 * One optimized width of an image — the smallest configured width ≥ `width` (a video's `poster`
 * can't take a srcset).
 */
export function imageAt(url: string, width: number, quality = PHOTO_QUALITY): string {
  if (!optimizable(url)) return url;
  const widths = widthsFor('100vw');
  return optimized(url, widths.find((w) => w >= width) ?? widths.at(-1)!, qualityOf(quality));
}

/**
 * Inlined at the top of the invitation's <head>: an optimized image that fails (the optimizer is
 * unavailable, the file is odd) is swapped for its original address once — error events don't
 * bubble, so one capturing listener sees every <img> of the page, even before React hydrates.
 */
export const IMAGE_FALLBACK =
  "document.addEventListener('error',function(e){var t=e.target;" +
  "if(!t||t.tagName!=='IMG'||!t.dataset||!t.dataset.fallback)return;" +
  "var f=t.dataset.fallback;delete t.dataset.fallback;t.removeAttribute('srcset');t.src=f},true);";
