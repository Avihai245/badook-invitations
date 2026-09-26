'use client';

import type { AssetRef, InvitationDocument } from '@/features/invitations/contracts/types';
import {
  extractSwatches,
  focalPointOf,
  pixelsOf,
  scrimForPhoto,
} from '@/features/invitations/lib/photo-palette';
import { ART_DIRECTION } from '../config';
import type { PhotoInfo } from '../model';

/**
 * The host's photos for "design it for me", prepared on the device: a small JPEG for the AI (at most
 * ART_DIRECTION.aiLongSide, re-encoded — no location or camera data travels), what the photo-palette
 * reads from it (colors, the focal point, the scrim text needs), and for a photo from the device the
 * copy that is uploaded if a design uses it (at most ART_DIRECTION.uploadLongSide). Nothing is sent
 * or kept until the host asks for designs.
 */

export interface PreparedPhoto {
  key: string;
  /** an invitation's picture (its asset reference), or a file from the device */
  origin: { kind: 'ref'; ref: AssetRef } | { kind: 'file'; name: string };
  /** where the previews show it (the picture's address, or a `blob:` of the device's copy) */
  url: string;
  /** base64 of the small JPEG for the AI */
  jpeg: string;
  info: PhotoInfo;
  /** a device photo's upload copy (JPEG) */
  upload: Blob | null;
}

type Drawable = CanvasImageSource & { width: number; height: number };

function canvasOf(image: Drawable, longSide: number): HTMLCanvasElement {
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

const jpegOf = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality),
  );

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The AI's copy: smaller and smaller until it fits. */
async function aiJpeg(image: Drawable): Promise<string> {
  const canvas = canvasOf(image, ART_DIRECTION.aiLongSide);
  for (const q of [ART_DIRECTION.aiQuality, 0.62, 0.48]) {
    const blob = await jpegOf(canvas, q);
    if (blob.size <= ART_DIRECTION.aiMaxBytes) return base64Of(blob);
  }
  return base64Of(await jpegOf(canvasOf(image, Math.round(ART_DIRECTION.aiLongSide * 0.7)), 0.5));
}

function read(image: Drawable): PhotoInfo {
  const { rgba, width, height } = pixelsOf(image, 96);
  return {
    swatches: extractSwatches(rgba).slice(0, 8),
    focal: focalPointOf(rgba, width),
    scrim: Math.round(scrimForPhoto(rgba, width) * 100) / 100,
    width: (image as HTMLImageElement).naturalWidth || image.width || width,
    height: (image as HTMLImageElement).naturalHeight || image.height || height,
  };
}

let counter = 0;

/** A photo from the device (its orientation as taken). Throws when the browser can't read it. */
export async function prepareFile(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const upload = await jpegOf(canvasOf(bitmap, ART_DIRECTION.uploadLongSide), ART_DIRECTION.uploadQuality);
    return {
      key: `file-${++counter}`,
      origin: { kind: 'file', name: file.name },
      url: URL.createObjectURL(upload),
      jpeg: await aiJpeg(bitmap),
      info: read(bitmap),
      upload,
    };
  } finally {
    bitmap.close();
  }
}

/** One of the invitation's pictures (its address must allow reading it: the storage buckets do). */
export async function prepareRef(ref: AssetRef, url: string): Promise<PreparedPhoto> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return {
    key: `ref-${ref}`,
    origin: { kind: 'ref', ref },
    url,
    jpeg: await aiJpeg(img),
    info: read(img),
    upload: null,
  };
}

/** Lets go of a device photo's preview address. */
export function releasePhoto(photo: PreparedPhoto) {
  if (photo.origin.kind === 'file') URL.revokeObjectURL(photo.url);
}

/**
 * The invitation's own photos (what the host uploaded): the opening's picture or video still, the
 * sections' pictures, the gallery — each once, in the order guests meet them. The design's own
 * pictures aren't the host's (a new design brings its own).
 */
export function invitationPhotos(doc: InvitationDocument): AssetRef[] {
  const out: AssetRef[] = [];
  const add = (ref: AssetRef | null | undefined) => {
    if (ref && !ref.startsWith('template:') && !out.includes(ref)) out.push(ref);
  };
  for (const s of doc.sections) {
    if (s.type === 'hero') {
      const m = s.data.media;
      if (m?.kind === 'image') add(m.src);
      else if (m?.kind === 'video') add(m.poster);
    }
    if (s.media?.kind === 'image') add(s.media.src);
    else if (s.media?.kind === 'video') add(s.media.poster);
    if (s.type === 'gallery') for (const item of s.data.images) add(item.src);
  }
  return out;
}
