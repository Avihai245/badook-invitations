import 'server-only';
import { GALLERY } from '../config';
import { galleryDb, type GalleryDb } from './db';
import { galleryStorage, type Bucket, type GalleryStorage } from './storage';

/**
 * Housekeeping, as the privacy policy promises: files of deleted items are removed from storage
 * (the database queues them — gallery_trash — whoever deleted the item, the gallery, the invitation
 * or the account), uploads that never finished go after two days, deleted items' rows after a month.
 * Runs after the deletes that need it, on the host's gallery traffic at most every ten minutes per
 * server, and when a scheduler calls POST /api/cron/gallery.
 */

type Deps = {
  db: Pick<GalleryDb, 'trashClaim' | 'trashDone' | 'maintenance'>;
  storage: Pick<GalleryStorage, 'remove'>;
};
const DEFAULT: Deps = { db: galleryDb, storage: galleryStorage };

/** Removes queued files for up to `budgetMs`. Returns how many went. */
export async function sweepTrash(
  budgetMs: number = GALLERY.housekeeping.sweepBudgetMs,
  deps: Deps = DEFAULT,
): Promise<number> {
  const until = Date.now() + budgetMs;
  let removed = 0;
  while (Date.now() < until) {
    const batch = await deps.db.trashClaim(300);
    if (!batch.length) break;
    const byBucket = new Map<Bucket, string[]>();
    for (const f of batch) {
      const list = byBucket.get(f.bucket as Bucket) ?? [];
      list.push(f.path);
      byBucket.set(f.bucket as Bucket, list);
    }
    for (const [bucket, paths] of byBucket) await deps.storage.remove(bucket, paths);
    await deps.db.trashDone(batch.map((f) => f.id));
    removed += batch.length;
    if (batch.length < 300) break;
  }
  return removed;
}

/** The whole round: expire what the policy says, then remove the files. */
export async function galleryHousekeeping(deps: Deps = DEFAULT) {
  const h = GALLERY.housekeeping;
  const expired = await deps.db.maintenance(h.abandonedHours, h.tombstoneDays);
  const files = await sweepTrash(h.sweepBudgetMs * 2, deps);
  return { ...expired, files };
}

let last = 0;
let running: Promise<void> | null = null;

/** On the server's own traffic: at most every ten minutes, never throws, bounded in time. */
export function maybeHousekeeping(now = Date.now()): Promise<void> {
  if (running || now - last < GALLERY.housekeeping.sweepEveryMs) return running ?? Promise.resolve();
  last = now;
  running = galleryHousekeeping()
    .then(() => undefined)
    .catch((err) => console.error('[gallery] housekeeping failed', err))
    .finally(() => {
      running = null;
    });
  return running;
}

/** Right after a delete: remove those files now (a short budget; what's left goes next round). */
export async function sweepNow(): Promise<void> {
  try {
    await sweepTrash(2_500);
  } catch (err) {
    console.error('[gallery] sweep failed', err);
  }
}
