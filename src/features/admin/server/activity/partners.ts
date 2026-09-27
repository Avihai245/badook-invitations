import 'server-only';
import type { ActivityItem } from '../../activity';
import { partnersDb } from '../../partners/server';
import { can } from '../../permissions';
import type { Staff } from '../gate';

/**
 * Badook Events' lines of the activity feed: an account opened through the partner API — `actor` is
 * the new account's name, `subject` the Badook Events user who opened it (the call's createdBy, else
 * the venue's owner; null when neither said), e.g. "Dana Levi · opened through Badook Events by
 * Ronit Cohen". Names only, never an email. For roles with partners.view; none when it can't be read.
 */
export async function partnerActivity(staff: Staff, limit: number): Promise<ActivityItem[]> {
  if (!can(staff.role, 'partners.view')) return [];
  try {
    const rows = await partnersDb.activity(staff.userId, limit);
    return rows.map((r) => ({
      id: `partner:${r.id}`,
      kind: 'partner_provision',
      at: r.at,
      actor: r.name,
      subject: r.byName,
      amount: null,
      userId: r.userId,
      invitationId: null,
      ticketId: null,
    }));
  } catch (err) {
    console.error('[admin] partner activity', err);
    return [];
  }
}
