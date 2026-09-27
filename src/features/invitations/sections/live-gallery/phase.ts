import { isLocale } from '../../lib/locales';

/**
 * Where the invitation's gallery section stands (pure; the page decides it in the guest's browser, since
 * the cached page is the same for everyone): before the event it invites guests to the gallery,
 * around the event it asks for their photos, and from the morning after it leads to the album.
 */
export type GalleryPhase = 'before' | 'during' | 'after';

const HOUR = 3_600_000;
export const GALLERY_PHASES = {
  /** "upload your photos" from this long before the event starts */
  duringFrom: 3 * HOUR,
  /** "see the album" from this long after it ends */
  albumAfter: 6 * HOUR,
} as const;

/** The phase at `now` of an event from `start` to `end` (ms epoch). */
export function galleryPhase(now: number, start: number, end: number): GalleryPhase {
  if (now < start - GALLERY_PHASES.duringFrom) return 'before';
  if (now < Math.max(end, start) + GALLERY_PHASES.albumAfter) return 'during';
  return 'after';
}

const GUEST_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The gallery's address for this guest: the upload page's link, keeping the guest's personal link
 * (`g`) when they came through it — their uploads then carry their name for the hosts — and the
 * language they read the invitation in (`lang`), so the gallery opens in it.
 */
export function galleryHref(
  url: string,
  guestToken: string | null | undefined,
  language?: string | null,
): string {
  const token = guestToken && GUEST_TOKEN.test(guestToken) ? guestToken : null;
  const lang = isLocale(language) ? language : null;
  if (!token && !lang) return url;
  const [path, query = ''] = url.split('?');
  const q = new URLSearchParams(query);
  if (token) q.set('g', token);
  if (lang) q.set('lang', lang);
  return `${path}?${q.toString()}`;
}
