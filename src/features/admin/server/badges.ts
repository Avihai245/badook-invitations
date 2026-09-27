import 'server-only';
import type { AdminNavBadges } from '../ui/AdminShell.client';
import type { Staff } from './gate';

/**
 * The counts beside the areas' names in the console's menu — each area adds its own here (e.g. the
 * support tickets waiting for an answer), for the roles that may open it. A count that fails to load
 * is left out, never the menu.
 */
export async function adminNavBadges(staff: Staff): Promise<AdminNavBadges> {
  void staff;
  return {};
}
