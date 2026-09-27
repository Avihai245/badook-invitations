import 'server-only';
import type { ActivityItem } from '../../activity';
import { can } from '../../permissions';
import { coreDb } from '../core-db';
import type { Staff } from '../gate';
import { partnerActivity } from './partners';
import { supportActivity } from './support';

/** Lines on the overview's feed. */
export const FEED_LIMIT = 30;

/**
 * The feed's lines from every area, newest first, at most `limit`: an account Badook Events opened
 * shows once — as Badook Events' line when that area gives one, else as a signup.
 */
export function mergeActivity(lists: readonly (readonly ActivityItem[])[], limit: number): ActivityItem[] {
  const all = lists.flat();
  const provisioned = new Set(
    all.filter((i) => i.kind === 'partner_provision' && i.userId).map((i) => i.userId),
  );
  const seen = new Set<string>();
  return all
    .filter((i) => !(i.kind === 'signup' && i.userId && provisioned.has(i.userId)))
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1))
    .slice(0, limit);
}

export interface FeedSources {
  core(staff: Staff, limit: number): Promise<ActivityItem[]>;
  support(staff: Staff, limit: number): Promise<ActivityItem[]>;
  partner(staff: Staff, limit: number): Promise<ActivityItem[]>;
}

const sources: FeedSources = {
  core: (staff, limit) => coreDb.activity(staff.userId, limit),
  support: supportActivity,
  partner: partnerActivity,
};

/**
 * The overview's live feed for this staff member: the core's lines (accounts, invitations, RSVPs,
 * messages, payments, the team) and — for the roles that may see them — the support tickets' and
 * Badook Events' lines. An area that fails to answer is left out, never the feed.
 */
export async function adminFeed(
  staff: Staff,
  limit = FEED_LIMIT,
  from: FeedSources = sources,
): Promise<ActivityItem[]> {
  const quietly = (area: string, lines: Promise<ActivityItem[]>) =>
    lines.catch((err) => (console.error(`[admin] feed: ${area}`, err), [] as ActivityItem[]));
  const lists = await Promise.all([
    quietly('core', from.core(staff, limit)),
    can(staff.role, 'support.view') ? quietly('support', from.support(staff, limit)) : [],
    can(staff.role, 'partners.view') ? quietly('partners', from.partner(staff, limit)) : [],
  ]);
  return mergeActivity(lists, limit);
}
