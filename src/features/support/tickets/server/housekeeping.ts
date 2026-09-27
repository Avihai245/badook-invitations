import 'server-only';
import { ticketsDb } from './db';

/**
 * The daily run's part for support tickets (what the privacy policy promises): answered tickets the
 * customer didn't come back to in 14 days close by themselves; closed tickets and their messages are
 * erased two years after closing, and tickets the team deleted (spam) 30 days after.
 */
export function supportHousekeeping(): Promise<{ autoClosed: number; erased: number; deleted: number }> {
  return ticketsDb.maintenance();
}
