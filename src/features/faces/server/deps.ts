import 'server-only';
import { featureInput, featuresFor } from '@/features/flags/server';
import { guestDeps } from '@/features/live-gallery/server/deps';
import { galleryStorage } from '@/features/live-gallery/server/storage';
import { FACES } from '../config';
import type { FaceGuestDeps, FaceHostDeps } from './api';
import { facesDb } from './db';

/** The real dependencies of face search's API (tests pass their own). */

export function faceGuestDeps(): FaceGuestDeps {
  return { gallery: guestDeps(), db: facesDb };
}

export function faceHostDeps(): FaceHostDeps {
  return { db: facesDb, storage: galleryStorage, featureInput, now: () => Date.now() };
}

/**
 * The daily run's promise about face data (the privacy policy's words): erased 30 days after the
 * event, and at once for every event that no longer has the feature — the host switched it off (that
 * already erased it), the plan changed, or this deployment turned face search off altogether.
 */
export async function facesHousekeeping() {
  const expired = await facesDb.maintenance(FACES.retentionDays);
  const events = await facesDb.events();
  const off: string[] = [];
  for (const id of events) {
    const features = await featuresFor(id).catch(() => null);
    // an event whose features can't be read keeps its data until the next run (never erased by a hiccup)
    if (features && !features.has('face_albums')) off.push(id);
  }
  const withoutFeature = off.length ? await facesDb.eraseEvents(off) : 0;
  return { expired: expired.events, withoutFeature };
}
