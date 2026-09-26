import 'server-only';
import { VERSIONS } from '@/features/invitations/lib/versions';
import { serviceDb } from '@/lib/supabase/server';
import { REVIEW } from '../config';
import { reviewDb } from './db';
import { sendReviewDigests } from './notify';

/**
 * The studio's part of the daily run, as the privacy policy promises: the draft's saves past their
 * keeping time go (publishes stay), the review comments go 90 days after the event (removed ones after
 * a month), and hosts who asked for it get the day's summary of new comments.
 */
export async function studioHousekeeping() {
  const { data: saves, error } = await serviceDb().rpc('invitation_saves_purge', {
    p_keep_days: VERSIONS.keepSavesDays,
    p_max_saves: VERSIONS.maxSaves,
  });
  if (error) console.error('invitation_saves_purge failed', error.message);
  const review = await reviewDb.maintenance(REVIEW.keepDaysAfterEvent);
  const digests = await sendReviewDigests();
  return { saves: (saves as number | null) ?? null, review, digests };
}
