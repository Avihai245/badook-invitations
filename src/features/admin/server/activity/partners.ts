import 'server-only';
import type { ActivityItem } from '../../activity';
import type { Staff } from '../gate';

/** Badook Events' lines of the activity feed (an account opened or updated through the partner API). */
export async function partnerActivity(staff: Staff, limit: number): Promise<ActivityItem[]> {
  void staff;
  void limit;
  return [];
}
