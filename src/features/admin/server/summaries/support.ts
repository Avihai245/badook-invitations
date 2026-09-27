import 'server-only';
import { adminSupportDb } from '@/features/support/tickets/server/db';
import { can } from '../../permissions';
import type { Staff } from '../gate';

/** The support tickets on the console's overview and beside "Support" in its menu. */
export interface SupportSummary {
  /** waiting for the team's answer */
  open: number;
  /** answered, waiting for the customer */
  waiting: number;
  /** the oldest one waiting for the team (ISO), null: none */
  oldestOpenAt: string | null;
}

/** null: the role may not see tickets (support.view), or they couldn't be read. */
export async function supportSummary(staff: Staff): Promise<SupportSummary | null> {
  if (!can(staff.role, 'support.view')) return null;
  try {
    const s = await adminSupportDb.summary(staff.userId);
    return { open: s.open, waiting: s.waiting, oldestOpenAt: s.oldestOpenAt };
  } catch (err) {
    console.error('[admin] support summary', err);
    return null;
  }
}
