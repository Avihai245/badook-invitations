import 'server-only';
import { after } from 'next/server';
import sharp from 'sharp';
import { featureInput } from '@/features/flags/server';
import { guestDeps } from '@/features/live-gallery/server/deps';
import { broadcastRefresh } from '@/features/live-gallery/server/realtime';
import { BUCKETS, galleryStorage } from '@/features/live-gallery/server/storage';
import { sweepNow } from '@/features/live-gallery/server/sweep';
import { serverEnv } from '@/lib/env';
import { AI_PHOTOS } from '../config';
import { aiPhotoDb } from './db';
import type { AiGuestDeps } from './guest-api';
import type { AiHostDeps } from './host-api';
import { checkImage, startImage, type OpenAiImageConfig } from './openai';
import { processAiPhotos, type WorkerDeps } from './worker';

/** The real dependencies of the AI photos (tests pass their own). */

export function imageConfig(): OpenAiImageConfig {
  const env = serverEnv();
  return {
    apiKey: env.OPENAI_API_KEY,
    apiBase: env.INVITES_AI_API_BASE_OPENAI,
    model: env.INVITES_AI_IMAGE_MODEL,
    quality: env.INVITES_AI_IMAGE_QUALITY,
    transport: env.INVITES_AI_IMAGE_TRANSPORT,
    mainline: env.INVITES_AI_IMAGE_MAINLINE_MODEL,
    timeoutMs: AI_PHOTOS.worker.requestTimeoutMs,
  };
}

/** A JPEG no larger than `edge` on its long side, turned upright, without metadata (null: not a photo). */
async function jpeg(bytes: Uint8Array, edge: number, quality: number): Promise<Uint8Array | null> {
  try {
    const out = await sharp(bytes, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

const aiFiles = {
  download: (path: string) => galleryStorage.download(BUCKETS.aiPhotos, path),
  upload: (path: string, bytes: Uint8Array, type: string) =>
    galleryStorage.upload(BUCKETS.aiPhotos, path, bytes, type),
};

export function aiWorkerDeps(): WorkerDeps {
  const R = AI_PHOTOS.result;
  return {
    db: aiPhotoDb,
    download: aiFiles.download,
    upload: aiFiles.upload,
    start: (req) => startImage(req, imageConfig()),
    check: (id) => checkImage(id, imageConfig()),
    async finish(image) {
      const { data, info } = await sharp(image)
        .rotate()
        .resize({ width: R.maxEdge, height: R.maxEdge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: R.quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      const thumb = await sharp(data)
        .resize({ width: R.thumbEdge, height: R.thumbEdge, fit: 'inside' })
        .jpeg({ quality: R.thumbQuality, mozjpeg: true })
        .toBuffer();
      return {
        result: new Uint8Array(data),
        thumb: new Uint8Array(thumb),
        width: info.width,
        height: info.height,
      };
    },
    async measure(bytes) {
      try {
        const m = await sharp(bytes).metadata();
        if (!m.width || !m.height) return null;
        // EXIF orientations 5–8 turn the picture a quarter
        return (m.orientation ?? 1) >= 5
          ? { width: m.height, height: m.width }
          : { width: m.width, height: m.height };
      } catch {
        return null;
      }
    },
  };
}

/** Starts this event's queued photos after the answer (the request never waits for the model). */
export function kickAiPhotos(invitationId: string | null): void {
  try {
    after(() => processAiPhotos(invitationId, aiWorkerDeps()).then(() => undefined));
  } catch {
    // outside a request (a script, a test): run it now, without waiting
    void processAiPhotos(invitationId, aiWorkerDeps());
  }
}

export function aiHostDeps(): AiHostDeps {
  return {
    db: aiPhotoDb,
    featureInput,
    sign: (paths) =>
      paths.length
        ? galleryStorage.signRead(BUCKETS.aiPhotos, paths, AI_PHOTOS.urls.signedTtlSeconds)
        : Promise.resolve(new Map()),
    upload: aiFiles.upload,
    remove: (paths) => galleryStorage.remove(BUCKETS.aiPhotos, paths),
    portrait: (bytes) => jpeg(bytes, AI_PHOTOS.people.maxEdge, 90),
    sweep: sweepNow,
  };
}

export function aiGuestDeps(): AiGuestDeps {
  return {
    gallery: guestDeps(),
    db: aiPhotoDb,
    signRead: (bucket, paths, ttl) => galleryStorage.signRead(bucket, paths, ttl),
    download: (bucket, path) => galleryStorage.download(bucket, path),
    upload: (bucket, path, bytes, type) => galleryStorage.upload(bucket, path, bytes, type),
    remove: (bucket, paths) => galleryStorage.remove(bucket, paths),
    normalize: (bytes) => jpeg(bytes, AI_PHOTOS.source.maxEdge, 88),
    thumbnail: async (bytes) => (await jpeg(bytes, 480, 80)) ?? bytes,
    kick: kickAiPhotos,
    advance: async (invitationId) => {
      // checks only (no new starts): a guest's poll stays short
      await processAiPhotos(invitationId, aiWorkerDeps(), { starts: 0 });
    },
    broadcast: broadcastRefresh,
    dailyLimit: serverEnv().INVITES_AI_IMAGE_DAILY_LIMIT,
  };
}

/** The daily run's part: what the privacy policy promises (30 days after the event). */
export async function aiPhotosHousekeeping() {
  const erased = await aiPhotoDb.maintenance(AI_PHOTOS.keepDays);
  await sweepNow();
  return erased;
}
