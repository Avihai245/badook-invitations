/**
 * A photo the host uploads, made ready for guests' phones in the browser before it is sent: upright
 * (its EXIF orientation applied), at most MAX_EDGE px on its long edge, and re-encoded — WebP where the
 * browser can write it, else JPEG; a picture with transparency (a PNG overlay, an illustration) keeps
 * it (WebP, or the PNG as it was). The original is kept when the result isn't smaller and needed no
 * resizing. Its pixel size comes back with it, saved in the document (Media.width / height), so the page
 * reserves its box before it loads. The image optimizer then serves it to each screen in AVIF / WebP at
 * the width shown (renderer/images.ts).
 */

/** The long edge a stored photo keeps: twice a large phone's width, enough for any screen it fills. */
export const MAX_EDGE = 2560;
const QUALITY = 0.85;

export interface PreparedImage {
  file: Blob;
  width: number;
  height: number;
}

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Whether any pixel of the image isn't fully opaque (sampled — a 64px copy is enough to tell). */
function hasAlpha(bitmap: ImageBitmap): boolean {
  const c = document.createElement('canvas');
  c.width = Math.min(64, bitmap.width);
  c.height = Math.min(64, bitmap.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return true;
  return false;
}

/**
 * The prepared photo, or null when this browser can't decode it (it is then sent as it is — the
 * optimizer still resizes it for guests).
 */
export async function prepareImage(file: Blob): Promise<PreparedImage | null> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const resized = scale < 1;
    const alpha = file.type !== 'image/jpeg' && hasAlpha(bitmap);
    // WebP (with its alpha); a browser that can't write it hands back a PNG — then JPEG for a photo,
    // and for a picture with transparency a PNG only when it had to be made smaller
    let out = await encode(canvas, 'image/webp', QUALITY);
    if (out?.type !== 'image/webp')
      out = !alpha ? await encode(canvas, 'image/jpeg', QUALITY) : resized ? out : null;
    canvas.width = canvas.height = 0; // release the pixels (old phones have little memory)
    if (!out || (!resized && out.size >= file.size))
      return { file, width: bitmap.width, height: bitmap.height };
    return { file: out, width, height };
  } finally {
    bitmap.close();
  }
}
