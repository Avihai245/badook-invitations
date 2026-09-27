import 'server-only';
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
  return badges;
}
