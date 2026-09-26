import { getImageProps } from 'next/image';

/**
 * Invitation images through Next.js image optimization (AVIF / WebP, a srcset of widths): the
 * Supabase Storage buckets (uploads, template media) and local paths. next.config.ts builds the
 * optimizer's `remotePatterns` from the Supabase address known at build time and hands the same list
 * to the code as INVITES_IMAGE_SOURCES — so the server, the browser and the optimizer always agree on
 * what it may fetch. Anything else (another host, optimization switched off with
 * INVITES_IMAGE_OPTIMIZATION=off) is a plain <img src>, and an optimized image that fails to load
 * falls back to its original address (IMAGE_FALLBACK, inlined in the page's <head>).
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

/**
 * An image's src / srcset / sizes: optimized widths when the optimizer may serve it, else the file as
 * it is. `sizes` says how wide it shows (e.g. '100vw' for a full-bleed background).
 */
export function imageSet(url: string, sizes: string, quality = PHOTO_QUALITY): ImageSet {
  if (!optimizable(url)) return { src: url };
  const { props } = getImageProps({ src: url, alt: '', fill: true, sizes, quality });
  return {
    src: props.src,
    srcSet: props.srcSet,
    sizes: props.sizes ?? sizes,
    fallback: url,
  };
}

/**
 * One optimized width of an image — the smallest configured width ≥ `width` (a video's `poster`
 * can't take a srcset).
 */
export function imageAt(url: string, width: number, quality = PHOTO_QUALITY): string {
  const set = imageSet(url, '100vw', quality);
  if (!set.srcSet) return set.src;
  const candidates = set.srcSet
    .split(', ')
    .map((entry) => {
      const [href, w] = entry.trim().split(/\s+/);
      return { href: href!, w: Number.parseInt(w ?? '', 10) };
    })
    .filter((c) => c.href && Number.isFinite(c.w))
    .sort((a, b) => a.w - b.w);
  return (candidates.find((c) => c.w >= width) ?? candidates.at(-1))?.href ?? set.src;
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
