import 'server-only';
import { adminSupportDb } from '@/features/support/tickets/server/db';
import type { ActivityItem } from '../../activity';
import { can } from '../../permissions';
import type { Staff } from '../gate';

/**
 * The support tickets' lines of the activity feed — a ticket opened, the team answered — newest first,
 * with the subject and the customer's first name only; for roles with support.view (else none). A
 * failure leaves the feed without them.
 */
export async function supportActivity(staff: Staff, limit: number): Promise<ActivityItem[]> {
  if (!can(staff.role, 'support.view')) return [];
  try {
    return await adminSupportDb.activity(staff.userId, limit);
  } catch (err) {
    console.error('[admin] support activity', err);
    return [];
  }
}
