import { LIMITS } from '../model';

/**
 * A floor plan file, ready to upload — in the browser: an image is kept as it is (or scaled down when
 * it is huge: old phones run out of memory drawing a 12-megapixel photo), a PDF's first page is drawn
 * to an image with pdf.js (loaded only when a PDF is picked). The server never renders PDFs.
 */

/** The longest side of a plan image, in pixels: sharp when zoomed in, light enough for a phone. */
export const MAX_PLAN_SIDE = 3000;
/** A PDF can be bigger than the image it becomes. */
const MAX_PDF_BYTES = 40 * 1024 * 1024;

export type PlanImageType = 'image/png' | 'image/jpeg' | 'image/webp';
export interface PlanImage {
  blob: Blob;
  type: PlanImageType;
  width: number;
  height: number;
}

export class PlanFileError extends Error {
  constructor(readonly code: 'too_large' | 'bad_type' | 'pdf' | 'failed') {
    super(code);
  }
}

const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];
export const PLAN_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,.pdf';

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** A drawing as the smallest good file: PNG for line drawings, JPEG when that is too big (or a photo). */
async function encode(canvas: HTMLCanvasElement, photo: boolean): Promise<PlanImage> {
  const size = { width: canvas.width, height: canvas.height };
  if (!photo) {
    const png = await canvasBlob(canvas, 'image/png');
    if (png && png.size <= LIMITS.planBytes) return { blob: png, type: 'image/png', ...size };
  }
  const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.9);
  if (!jpeg || jpeg.size > LIMITS.planBytes) throw new PlanFileError('too_large');
  return { blob: jpeg, type: 'image/jpeg', ...size };
}

/** A canvas at most MAX_PLAN_SIDE on its long side, on white (a transparent plan reads on the map). */
function whiteCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PlanFileError('failed');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

async function decodeImage(
  file: Blob,
): Promise<{ width: number; height: number; source: CanvasImageSource; close(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
    } catch {
      // older Safari: through an <img> below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new PlanFileError('bad_type');
  }
}

/** The first page of a PDF, drawn at up to MAX_PLAN_SIDE pixels on its long side. */
export async function renderPdf(data: ArrayBuffer): Promise<HTMLCanvasElement> {
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  } catch {
    throw new PlanFileError('pdf');
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise.catch(() => {
      throw new PlanFileError('pdf');
    });
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(8, MAX_PLAN_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const { canvas } = whiteCanvas(viewport.width, viewport.height);
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    return canvas;
  } catch (err) {
    throw err instanceof PlanFileError ? err : new PlanFileError('pdf');
  } finally {
    void task.destroy();
  }
}

/** A picked file → the image to upload (see the top of this file). */
export async function preparePlanFile(file: File): Promise<PlanImage> {
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) throw new PlanFileError('too_large');
    return encode(await renderPdf(await file.arrayBuffer()), false);
  }
  if (!IMAGE_TYPES.includes(file.type)) throw new PlanFileError('bad_type');
  const image = await decodeImage(file);
  try {
    const long = Math.max(image.width, image.height);
    if (long <= MAX_PLAN_SIDE && file.size <= LIMITS.planBytes)
      return { blob: file, type: file.type as PlanImageType, width: image.width, height: image.height };
    const k = Math.min(1, MAX_PLAN_SIDE / long);
    const { canvas, ctx } = whiteCanvas(image.width * k, image.height * k);
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return encode(canvas, file.type === 'image/jpeg');
  } finally {
    image.close();
  }
}

/** A plan already stored as a PDF (the venue's) → an image to store for this event. */
export async function renderStoredPdf(url: string): Promise<PlanImage> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) throw new PlanFileError('failed');
  return encode(await renderPdf(await res.arrayBuffer()), false);
}

/** PUT to the signed upload URL with progress events (fetch has none). */
export function uploadTo(
  url: string,
  blob: Blob,
  type: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new PlanFileError(xhr.status === 413 ? 'too_large' : xhr.status === 415 ? 'bad_type' : 'failed'),
          );
    xhr.onerror = () => reject(new PlanFileError('failed'));
    xhr.send(blob);
  });
}
