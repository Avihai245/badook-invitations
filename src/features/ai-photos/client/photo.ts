'use client';

/**
 * A photo prepared on the device for the AI photos (feature ai_photos): turned upright as it was taken,
 * no larger than `longSide`, re-encoded as JPEG (no location or camera data leaves the phone), smaller
 * and smaller until it fits `maxBytes` — as base64 for the request, with a preview address and its size.
 */

export interface ShrunkPhoto {
  base64: string;
  /** a `blob:` address of the copy (release it with URL.revokeObjectURL) */
  url: string;
  width: number;
  height: number;
}

type Drawable = CanvasImageSource & { width: number; height: number };

async function decode(file: Blob): Promise<{ image: Drawable; close(): void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bitmap, close: () => bitmap.close() };
  } catch {
    // a format createImageBitmap doesn't take here (HEIC in some browsers): an <img> may
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try {
      await img.decode();
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    return { image: img as Drawable, close: () => URL.revokeObjectURL(url) };
  }
}

function draw(image: Drawable, longSide: number): HTMLCanvasElement {
  const w0 = (image as HTMLImageElement).naturalWidth || image.width;
  const h0 = (image as HTMLImageElement).naturalHeight || image.height;
  const scale = Math.min(1, longSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2d canvas');
  g.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality),
  );

export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Throws when the browser can't read the file as a picture. */
export async function shrinkPhoto(
  file: Blob,
  { longSide, quality, maxBytes }: { longSide: number; quality: number; maxBytes: number },
): Promise<ShrunkPhoto> {
  const decoded = await decode(file);
  try {
    let side = longSide;
    for (let round = 0; round < 4; round++) {
      const canvas = draw(decoded.image, side);
      for (const q of [quality, 0.75, 0.62]) {
        const blob = await jpeg(canvas, q);
        if (blob.size <= maxBytes)
          return {
            base64: await base64Of(blob),
            url: URL.createObjectURL(blob),
            width: canvas.width,
            height: canvas.height,
          };
      }
      side = Math.round(side * 0.75);
    }
    throw new Error('too large');
  } finally {
    decoded.close();
  }
}
