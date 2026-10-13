import 'server-only';
import { legalStatus } from '@/features/legal/status';
import { legalDb } from '@/features/legal-requests/server/db';
import { can } from '../permissions';
import type { AdminNavBadges } from '../ui/AdminShell.client';
import type { Staff } from './gate';
import { supportSummary } from './summaries/support';

/**
 * The counts beside the areas' names in the console's menu — each area adds its own here (e.g. the
 * support tickets waiting for an answer), for the roles that may open it. A count that fails to load
 * is left out, never the menu.
 */
export async function adminNavBadges(staff: Staff): Promise<AdminNavBadges> {
  const badges: AdminNavBadges = {};
  // support: the tickets waiting for the team's answer (null for roles without support.view)
  const support = await supportSummary(staff);
  if (support?.open) badges.support = support.open;
  // reports and privacy requests: present only while version 2 of the legal documents is in force
  // (a count of 0 still shows the area); the open ones wait for the team
  if (legalStatus().active && can(staff.role, 'support.view')) {
    const open = async (list: Promise<unknown[]>) => (await list).length;
    const [reports, requests] = await Promise.all([
      open(legalDb.reports(staff.userId, 'open', 200)).catch(() => 0),
      open(legalDb.requests(staff.userId, 'open', 200)).catch(() => 0),
    ]);
    badges.legal = reports + requests;
  }
  return badges;
}
