import 'server-only';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import { isLocale } from '@/features/invitations/lib/locales';
import { AI_PHOTOS } from '../config';
import { buildPrompt, nameIn, sizeFor, type ImageSize } from '../model';
import type { AiPhotoDb, ClaimedPhoto, PhotoRow } from './db';
import type { ImageInput, ImageOutcome, ImageRequest } from './openai';

/**
 * The AI photos' worker (feature ai_photos): photos are queued by the guests' requests and made here —
 * right after the request answered (`after`), on the app's own clock (features/jobs) and when a
 * scheduler calls POST /api/cron/ai-photos. Each round first checks the photos working in OpenAI's
 * background, then starts the queued ones: their files from storage (the guest's photo, each person's
 * reference photo), the request built for the image model (model.ts), the answer stored as a JPEG and
 * its thumbnail. The database hands each photo to one worker (ai_photo_claim, ai_photo_checks); a worker
 * that died leaves it to the next (a few tries); a refusal by the content rules is 'blocked' and, like
 * a failure, doesn't count against the guest. Plain functions over injected dependencies
 * (tests/unit/ai-photos-worker.test.ts).
 */

export interface WorkerDeps {
  db: Pick<AiPhotoDb, 'claim' | 'started' | 'checks' | 'done' | 'fail' | 'retry'>;
  /** a file of the ai-photos bucket (null: gone) */
  download(path: string): Promise<Uint8Array | null>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  start(req: ImageRequest): Promise<ImageOutcome>;
  check(externalId: string): Promise<ImageOutcome>;
  /** the model's image as the stored photo (JPEG, ≤ AI_PHOTOS.result.maxEdge) and its thumbnail */
  finish(
    image: Uint8Array,
  ): Promise<{ result: Uint8Array; thumb: Uint8Array; width: number; height: number }>;
  /** a photo's size, for the request's shape */
  measure(bytes: Uint8Array): Promise<{ width: number; height: number } | null>;
}

export interface WorkResult {
  started: number;
  done: number;
  failed: number;
  pending: number;
}

const W = AI_PHOTOS.worker;

/** Where a photo's files live in the ai-photos bucket. */
export const photoPath = (invitationId: string, photoId: string, file: 'source' | 'result' | 'thumb') =>
  `${invitationId}/photos/${photoId}/${file}.jpg`;

/** What happens to a photo once OpenAI answered (or didn't). */
async function settle(
  photo: Pick<PhotoRow, 'id'> & { invitationId: string },
  outcome: ImageOutcome,
  deps: WorkerDeps,
  out: WorkResult,
  fresh: boolean,
): Promise<void> {
  if (outcome.status === 'done') {
    try {
      const made = await deps.finish(outcome.image);
      const result = photoPath(photo.invitationId, photo.id, 'result');
      const thumb = photoPath(photo.invitationId, photo.id, 'thumb');
      await deps.upload(result, made.result, 'image/jpeg');
      await deps.upload(thumb, made.thumb, 'image/jpeg');
      await deps.db.done(photo.id, result, thumb, made.width, made.height);
      out.done++;
    } catch (err) {
      console.error('[ai photos] storing the result failed', photo.id, err);
      if (await deps.db.retry(photo.id, 'store failed', W.maxAttempts)) out.pending++;
      else out.failed++;
    }
    return;
  }
  if (outcome.status === 'pending') {
    if (fresh) await deps.db.started(photo.id, outcome.externalId);
    out.pending++;
    return;
  }
  if (outcome.status === 'blocked') {
    await deps.db.fail(photo.id, 'blocked', outcome.error);
    out.failed++;
    return;
  }
  if (outcome.retryable && (await deps.db.retry(photo.id, outcome.error, W.maxAttempts))) out.pending++;
  else {
    if (!outcome.retryable) await deps.db.fail(photo.id, 'failed', outcome.error);
    out.failed++;
  }
}

/** The request for a claimed photo: its files and words (null: nothing to make it from). */
export async function requestFor(
  job: ClaimedPhoto,
  deps: Pick<WorkerDeps, 'download' | 'measure'>,
): Promise<ImageRequest | null> {
  const parsed = safeMigrateDocument(job.document);
  if (!parsed.success) return null;
  const doc = parsed.data;
  const locale = isLocale(job.locale) ? job.locale : doc.defaultLocale;
  const images: ImageInput[] = [];
  let size: ImageSize = sizeFor(null, null);
  if (job.sourcePath) {
    const source = await deps.download(job.sourcePath);
    if (!source) return null;
    images.push({ bytes: source, type: 'image/jpeg', name: 'photo.jpg' });
    const dims = await deps.measure(source);
    size = sizeFor(dims?.width ?? null, dims?.height ?? null);
  }
  const people: {
    name: string;
    role: ClaimedPhoto['persons'][number]['role'];
    description: string | null;
  }[] = [];
  for (const p of job.persons) {
    if (!p.photoPath) continue;
    const bytes = await deps.download(p.photoPath);
    if (!bytes) continue;
    images.push({ bytes, type: 'image/jpeg', name: `person-${people.length + 1}.jpg` });
    people.push({ name: nameIn(p.name, locale), role: p.role, description: p.description });
  }
  if (!people.length) return null;
  return {
    prompt: buildPrompt({
      request: job.prompt,
      locale,
      eventType: doc.eventType,
      people,
      withSource: !!job.sourcePath,
    }),
    images,
    size,
  };
}

/**
 * One round (one invitation's photos, or any when null): checks what works in the background, then
 * starts up to `starts` queued photos (two at a time). Never throws.
 */
export async function processAiPhotos(
  invitationId: string | null,
  deps: WorkerDeps,
  { starts = 2 }: { starts?: number } = {},
): Promise<WorkResult> {
  const out: WorkResult = { started: 0, done: 0, failed: 0, pending: 0 };
  try {
    const due = await deps.db.checks(invitationId, 20, W.checkEverySeconds, W.giveUpSeconds);
    await Promise.all(
      due.map(async (p) => {
        if (!p.externalId) return;
        await settle(p, await deps.check(p.externalId), deps, out, false);
      }),
    );
    if (starts <= 0) return out;
    const jobs = await deps.db.claim(invitationId, starts, W.staleSeconds, W.maxAttempts);
    for (let i = 0; i < jobs.length; i += 2) {
      await Promise.all(
        jobs.slice(i, i + 2).map(async (job) => {
          out.started++;
          try {
            const req = await requestFor(job, deps);
            if (!req) {
              await deps.db.fail(job.id, 'failed', 'nothing to make it from');
              out.failed++;
              return;
            }
            await settle(job, await deps.start(req), deps, out, true);
          } catch (err) {
            console.error('[ai photos] a photo failed', job.id, err);
            if (await deps.db.retry(job.id, 'worker error', W.maxAttempts).catch(() => false)) out.pending++;
            else out.failed++;
          }
        }),
      );
    }
  } catch (err) {
    console.error('[ai photos] the round failed', err);
  }
  return out;
}
