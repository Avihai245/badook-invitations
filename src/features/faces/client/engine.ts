import type * as FaceApi from '@vladmandic/face-api';
import { FACES, modelBase } from '../config';
import { normalizeFaces, type Face } from '../model';

/**
 * The face engine, in the browser only: the open-source face detector and face descriptor models of
 * @vladmandic/face-api (MIT), served from this app's own origin (public/face-models/<version>/, copied
 * from node_modules at build time) and fetched only when someone uses face search — then kept by the
 * browser (their address is versioned and cached for a year). Nothing about a face leaves the device
 * from here: callers decide what is sent.
 *
 * Test hook: an end-to-end test may set `window.__badookFaceEngine` (before the page loads) to stand in
 * for the models — the real ones are exercised in tests/unit/face-model.test.ts.
 */

export type FaceSource = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | ImageBitmap;

export interface FaceEngine {
  /** every face in the image, as it would be sent (boxes as fractions, descriptors) */
  detect(image: FaceSource): Promise<Face[]>;
}

declare global {
  interface Window {
    __badookFaceEngine?: FaceEngine;
  }
}

const sizeOf = (image: FaceSource): { width: number; height: number } =>
  'videoWidth' in image
    ? { width: image.videoWidth, height: image.videoHeight }
    : 'naturalWidth' in image
      ? { width: image.naturalWidth, height: image.naturalHeight }
      : { width: image.width, height: image.height };

let engine: Promise<FaceEngine> | null = null;

/** The engine, loaded once per page (the model's download is the only slow part). */
export function loadFaceEngine(): Promise<FaceEngine> {
  if (typeof window !== 'undefined' && window.__badookFaceEngine)
    return Promise.resolve(window.__badookFaceEngine);
  engine ??= (async (): Promise<FaceEngine> => {
    const base = modelBase();
    // a native import of the library's own browser build (TensorFlow.js inside), from this origin
    const api = (await import(/* webpackIgnore: true */ `${base}${FACES.model.library}`)) as typeof FaceApi;
    // the fastest backend this browser has (WebGL, else the CPU)
    await (api.tf as unknown as { ready(): Promise<void> }).ready();
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(base),
      api.nets.faceLandmark68Net.loadFromUri(base),
      api.nets.faceRecognitionNet.loadFromUri(base),
    ]);
    const options = new api.SsdMobilenetv1Options({
      minConfidence: FACES.detect.minConfidence,
      maxResults: FACES.detect.maxFaces,
    });
    return {
      async detect(image) {
        const { width, height } = sizeOf(image);
        const found = await api
          .detectAllFaces(image as Parameters<typeof api.detectAllFaces>[0], options)
          .withFaceLandmarks()
          .withFaceDescriptors();
        return normalizeFaces(
          found.map((f) => ({
            x: f.detection.box.x,
            y: f.detection.box.y,
            width: f.detection.box.width,
            height: f.detection.box.height,
            score: f.detection.score,
            descriptor: f.descriptor,
          })),
          width,
          height,
        );
      },
    };
  })().catch((err: unknown) => {
    engine = null; // offline, or the device can't run it: the next attempt tries again
    throw err;
  });
  return engine;
}

/**
 * A picture drawn at the size faces are looked for at (its long edge FACES.detect.longEdge, never
 * enlarged), upright as the browser shows it. From a file or blob (a selfie, a photo on this phone) or
 * an address (a gallery photo's signed URL).
 */
export async function pictureForFaces(source: Blob | string): Promise<HTMLCanvasElement> {
  const blob = typeof source === 'string' ? await (await fetch(source, { mode: 'cors' })).blob() : source;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = Math.min(1, FACES.detect.longEdge / Math.max(1, long));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The largest face of a picture (a selfie), or null when none was found. */
export async function largestFace(engine: FaceEngine, picture: FaceSource): Promise<Face | null> {
  const faces = await engine.detect(picture);
  return faces.reduce<Face | null>(
    (best, f) => (!best || f.box[2] * f.box[3] > best.box[2] * best.box[3] ? f : best),
    null,
  );
}

/**
 * Whether this device should look for faces in its own uploads now: not on a data saver or a slow
 * connection, and not on a device with very little memory (the host's browser does it later instead).
 */
export function deviceCanIndex(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && /(^|-)2g$|^3g$/.test(nav.connection.effectiveType)) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false;
  return true;
}
