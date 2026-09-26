import { GALLERY, ORIGINAL_TYPES, type MediaKind } from '../config';
import {
  readJpegInfo,
  swapsSides,
  takenAtIso,
  orientationTransform,
  withoutGps,
  type JpegInfo,
} from '../exif';
import { dHash, fitWithin, levelsLut, applyLut, meanLuminance, sharpness, toGray } from '../image-metrics';
import { mp4CreationTime } from '../mp4';

/**
 * Prepares a photo or video in the guest's browser before it is queued: the file's real type (from
 * its first bytes, not its name), the size and length limits, and for a photo a display version
 * (long edge ≤ 2560 px, JPEG 0.85, upright per its EXIF orientation, a gentle levels/contrast lift)
 * and a thumbnail (≤ 480 px) with the checks run on it (sharpness, darkness, perceptual hash); the
 * original is kept as it is, minus its location (JPEG). For a video: a still (display + thumbnail)
 * and when it was recorded — no transcoding. One file at a time, canvases released after use (old
 * phones have little memory).
 */

export interface Prepared {
  kind: MediaKind;
  original: Blob;
  originalType: string;
  display: Blob | null;
  thumb: Blob | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  takenAt: string | null;
  metrics: { sharpness: number; brightness: number; phash: string; enhanced: boolean } | null;
}

export type PrepareError = 'unsupported' | 'too_large' | 'too_long';

const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** The type from the file's first bytes; the browser's word or the name when the bytes don't say. */
export function sniffType(head: Uint8Array, declared: string, name: string): string | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && ascii(head, 1, 4) === 'PNG') return 'image/png';
  if (ascii(head, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12);
    if (/^(heic|heix|heim|heis|hevc|hevx)$/.test(brand)) return 'image/heic';
    if (/^(mif1|msf1)$/.test(brand)) return 'image/heif';
    if (/^avi[fs]$/.test(brand)) return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    if (/^3g/.test(brand)) return 'video/3gpp';
    return 'video/mp4';
  }
  const t = declared.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ORIGINAL_TYPES, t)) return t;
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext ? (EXT_TYPES[ext] ?? null) : null;
}

const readBytes = async (blob: Blob, start: number, end: number) =>
  new Uint8Array(await blob.slice(start, end).arrayBuffer());

// ─── canvases ───────────────────────────────────────────────────────────────────────────────────

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Frees a canvas's memory at once (iOS counts canvas memory per page). */
function release(...list: (HTMLCanvasElement | null)[]) {
  for (const c of list) {
    if (!c) continue;
    c.width = 0;
    c.height = 0;
  }
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** A smaller copy, halving step by step first (a single big jump looks jagged). */
function scaled(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let cur = src;
  while (cur.width / 2 >= w * 1.5 && cur.height / 2 >= h * 1.5) {
    const half = canvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    context(half).drawImage(cur, 0, 0, half.width, half.height);
    if (cur !== src) release(cur);
    cur = half;
  }
  const out = canvas(w, h);
  context(out).drawImage(cur, 0, 0, w, h);
  if (cur !== src) release(cur);
  return out;
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      c.toBlob((b) => resolve(b && b.type === 'image/jpeg' ? b : null), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
}

/** The thumbnail's checks: sharpness, mean luminance, dHash — and the lift the display version gets. */
function measure(thumb: HTMLCanvasElement) {
  const ctx = context(thumb);
  const { data } = ctx.getImageData(0, 0, thumb.width, thumb.height);
  const gray = toGray(data, thumb.width, thumb.height);
  return {
    sharpness: Math.round(sharpness(gray, thumb.width, thumb.height) * 100) / 100,
    brightness: Math.round(meanLuminance(gray) * 10_000) / 10_000,
    phash: dHash(gray, thumb.width, thumb.height),
    lut: levelsLut(gray),
  };
}

function lift(c: HTMLCanvasElement, lut: Uint8Array) {
  const ctx = context(c);
  const image = ctx.getImageData(0, 0, c.width, c.height);
  applyLut(image.data, lut);
  ctx.putImageData(image, 0, 0);
}

// ─── photos ─────────────────────────────────────────────────────────────────────────────────────

/** A 2×1 JPEG marked "rotate a quarter": browsers that honour EXIF orientation show it 1×2. */
const ORIENTATION_PROBE =
  'data:image/jpeg;base64,/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCYAIoH/9k=';

let orientationProbe: Promise<boolean> | null = null;
/** Does this browser turn photos upright by itself (every one since 2020 does)? */
export function browserAppliesOrientation(): Promise<boolean> {
  orientationProbe ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth === 1 && img.naturalHeight === 2);
    img.onerror = () => resolve(true);
    img.src = ORIENTATION_PROBE;
  });
  return orientationProbe;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

async function preparePhoto(file: File, type: string): Promise<Prepared> {
  let info: JpegInfo | null = null;
  let original: Blob = file;
  if (type === 'image/jpeg') {
    info = readJpegInfo(await readBytes(file, 0, 512 * 1024));
    // the original goes without the guest's location (the file's size and everything else stay)
    const exif = info?.exif;
    if (exif && exif.gpsIfd !== null) {
      const segment = await readBytes(file, exif.app1Start, exif.app1End);
      const clean = withoutGps(segment, exif);
      if (clean)
        original = new Blob(
          [file.slice(0, exif.app1Start), clean as Uint8Array<ArrayBuffer>, file.slice(exif.app1End)],
          {
            type,
          },
        );
    }
  }
  const takenAt = info ? takenAtIso(info, -new Date().getTimezoneOffset()) : null;
  const base: Prepared = {
    kind: 'image',
    original,
    originalType: type,
    display: null,
    thumb: null,
    width: info?.width ?? null,
    height: info?.height ?? null,
    durationMs: null,
    takenAt,
    metrics: null,
  };

  const url = URL.createObjectURL(file);
  let full: HTMLCanvasElement | null = null;
  let thumb: HTMLCanvasElement | null = null;
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      // a format this browser can't open (HEIC outside Safari): the original alone
      return base;
    }
    const orientation = info?.orientation ?? 1;
    // turn it ourselves only when the browser didn't
    const manual = orientation > 1 && !(await browserAppliesOrientation());
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const [w, h] = manual && swapsSides(orientation) ? [nh, nw] : [nw, nh];
    const target = fitWithin(w, h, GALLERY.image.displayMaxEdge);
    full = canvas(target.width, target.height);
    const ctx = context(full);
    if (manual) {
      ctx.setTransform(...orientationTransform(orientation, target.width, target.height));
      const [dw, dh] = swapsSides(orientation)
        ? [target.height, target.width]
        : [target.width, target.height];
      ctx.drawImage(img, 0, 0, dw, dh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(img, 0, 0, target.width, target.height);
    }
    img.src = '';
    const t = fitWithin(target.width, target.height, GALLERY.image.thumbMaxEdge);
    thumb = scaled(full, t.width, t.height);
    const m = measure(thumb);
    const thumbBlob = await toBlob(thumb, GALLERY.image.thumbQuality);
    // the lift goes on the display version only
    if (m.lut) lift(full, m.lut);
    const displayBlob = await toBlob(full, GALLERY.image.displayQuality);
    if (!thumbBlob || !displayBlob) return base;
    return {
      ...base,
      display: displayBlob,
      thumb: thumbBlob,
      width: w,
      height: h,
      metrics: { sharpness: m.sharpness, brightness: m.brightness, phash: m.phash, enhanced: !!m.lut },
    };
  } finally {
    release(full, thumb);
    URL.revokeObjectURL(url);
  }
}

// ─── videos ─────────────────────────────────────────────────────────────────────────────────────

function once(target: EventTarget, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, ms);
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error('media error'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, ok);
      target.removeEventListener('error', bad);
    };
    target.addEventListener(event, ok);
    target.addEventListener('error', bad);
  });
}

async function prepareVideo(file: File, type: string): Promise<Prepared | PrepareError> {
  const base: Prepared = {
    kind: 'video',
    original: file,
    originalType: type,
    display: null,
    thumb: null,
    width: null,
    height: null,
    durationMs: null,
    takenAt: null,
    metrics: null,
  };
  if (type === 'video/mp4' || type === 'video/quicktime' || type === 'video/3gpp') {
    base.takenAt = await mp4CreationTime((s, e) => readBytes(file, s, e), file.size).catch(() => null);
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  let poster: HTMLCanvasElement | null = null;
  let thumb: HTMLCanvasElement | null = null;
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    try {
      await once(video, 'loadedmetadata', 10_000);
    } catch {
      // a codec this browser can't play: the video goes as it is
      return base;
    }
    const seconds = Number.isFinite(video.duration) ? video.duration : 0;
    base.durationMs = Math.round(seconds * 1000);
    if (base.durationMs > GALLERY.limits.videoMs) return 'too_long';
    base.width = video.videoWidth || null;
    base.height = video.videoHeight || null;
    if (!video.videoWidth || !video.videoHeight) return base;
    try {
      video.currentTime = Math.min(GALLERY.video.posterAtSeconds, seconds / 2);
      await once(video, 'seeked', 6_000);
    } catch {
      return base;
    }
    const size = fitWithin(video.videoWidth, video.videoHeight, GALLERY.video.posterMaxEdge);
    poster = canvas(size.width, size.height);
    context(poster).drawImage(video, 0, 0, size.width, size.height);
    const t = fitWithin(size.width, size.height, GALLERY.image.thumbMaxEdge);
    thumb = scaled(poster, t.width, t.height);
    const [display, small] = await Promise.all([
      toBlob(poster, GALLERY.video.posterQuality),
      toBlob(thumb, GALLERY.image.thumbQuality),
    ]);
    if (!display || !small) return base;
    // a still says little about a video: no checks on it (and no hash — it would match photos)
    return { ...base, display, thumb: small };
  } finally {
    release(poster, thumb);
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** A picked file → what the queue sends, or why it can't go. */
export async function prepare(file: File): Promise<Prepared | PrepareError> {
  const head = await readBytes(file, 0, 64);
  const type = sniffType(head, file.type, file.name);
  const kind =
    type && Object.prototype.hasOwnProperty.call(ORIGINAL_TYPES, type) ? ORIGINAL_TYPES[type]!.kind : null;
  if (!type || !kind) return 'unsupported';
  if (file.size > (kind === 'video' ? GALLERY.limits.videoBytes : GALLERY.limits.imageBytes))
    return 'too_large';
  return kind === 'video' ? prepareVideo(file, type) : preparePhoto(file, type);
}
