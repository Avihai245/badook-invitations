import 'server-only';
import { featureInput, featuresFor } from '@/features/flags/server';
import { broadcastRefresh, realtimeInfo } from '@/lib/live/broadcast';
import { reviewDb } from './db';
import type { ReviewGuestDeps } from './guest-api';
import type { ReviewHostDeps } from './host-api';
import { notifyHost } from './notify';
import { newReviewLink, randomId, reviewToken } from './tokens';

/** The real dependencies of the draft review's APIs (tests pass their own). */

const broadcast = (channel: string, kind: string) => broadcastRefresh(channel, kind, fetch, 'review');

export function reviewHostDeps(): ReviewHostDeps {
  return {
    db: reviewDb,
    featureInput,
    broadcast,
    realtime: realtimeInfo,
    newLink: newReviewLink,
    tokenAgain: reviewToken,
    randomId: () => randomId(),
    now: () => Date.now(),
  };
}

/** `later`: runs a job after the answer is sent (the route's `after`). */
export function reviewGuestDeps(later: ReviewGuestDeps['later'] = (job) => void job()): ReviewGuestDeps {
  return { db: reviewDb, features: featuresFor, broadcast, realtime: realtimeInfo, later, notifyHost };
}
