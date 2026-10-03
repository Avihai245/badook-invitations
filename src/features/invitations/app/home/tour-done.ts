'use server';

import { sessionDb } from '@/lib/supabase/session';
import { TOUR_DONE_META } from './tour-meta';

/**
 * The tour was finished or skipped: remembered on the account, so it doesn't open again on another
 * device or browser (the browser also keeps it, for the moment before this lands). Best effort.
 */
export async function markTourDone(): Promise<void> {
  try {
    const db = await sessionDb();
    await db.auth.updateUser({ data: { [TOUR_DONE_META]: true } });
  } catch {
    /* the browser's copy still holds */
  }
}
