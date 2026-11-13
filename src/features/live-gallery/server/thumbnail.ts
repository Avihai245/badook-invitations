import { GALLERY } from '../config';

/**
 * A gallery item's thumbnail from its display version, the way the browser makes it (config.ts: the long
 * edge and the quality), upright, in the thumbnail's own format.
 */
export async function makeThumbnail(display: Uint8Array, format: 'webp' | 'jpeg'): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const edge = GALLERY.image.thumbMaxEdge;
  const quality = Math.round(GALLERY.image.thumbQuality * 100);
  const resized = sharp(display, { failOn: 'none' })
    .rotate()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
  const out =
    format === 'webp'
      ? resized.webp({ quality })
      : resized.flatten({ background: '#ffffff' }).jpeg({ quality });
  return new Uint8Array(await out.toBuffer());
}
