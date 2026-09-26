/**
 * The image optimizer's widths and qualities — one list for next.config.ts (`images`) and for the
 * renderer (renderer/images.ts), which writes the optimizer's addresses itself: the invitation's
 * browser bundle (the live language switch renders sections in the page) stays without next/image.
 */

/** Phones to wide screens (a full-bleed photo); no 3840 — a 2048px photo is plenty behind text. */
export const IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048];
/** Smaller pictures (a split layout's half on a narrow screen, thumbnails). */
export const IMAGE_SIZES = [96, 256, 384];
/** Photos at 70 (they sit behind text or in a frame; AVIF holds up well), the rest at the default 75. */
export const IMAGE_QUALITIES = [70, 75];
/** Where the optimizer answers (Next's default path; the app has no basePath). */
export const IMAGE_OPTIMIZER_PATH = '/_next/image';
