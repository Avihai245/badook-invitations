import 'server-only';
import type { ActivityItem } from '../../activity';
import type { Staff } from '../gate';

/** The support tickets' lines of the activity feed (opened, answered) — for roles with support.view. */
export async function supportActivity(staff: Staff, limit: number): Promise<ActivityItem[]> {
  void staff;
  void limit;
  return [];
}
