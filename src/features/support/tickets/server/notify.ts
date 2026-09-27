import 'server-only';
import { sendEmail } from '@/features/invitations/server/email';
import { serverEnv } from '@/lib/env';
import { broadcastRefresh } from '@/lib/live/broadcast';
import { customerReplyEmail, teamTicketEmail } from '../email';
import { ticketsDb } from './db';

/**
 * Who hears about a ticket, after the action (the routes' `after`): the customer gets the team's
 * answer by email (and whether it went is kept on the answer); the team (INVITES_SUPPORT_EMAIL) hears
 * of a new ticket or a customer's answer; the customer's open ticket page is told something changed.
 * Never throws — an email that fails never fails the action.
 */

const site = () => serverEnv().INVITES_PUBLIC_BASE_URL;

/** The team's answer, by email to the customer (an account: with a button to the ticket in the app). */
export async function emailCustomerReply(ticketId: string, messageId: number, body: string): Promise<void> {
  try {
    const target = await ticketsDb.target(ticketId);
    if (!target?.email) return;
    const env = serverEnv();
    const content = customerReplyEmail({
      locale: target.locale,
      brand: env.INVITES_BRAND_NAME,
      number: target.number,
      subject: target.subject,
      body,
      firstName: target.firstName,
      ticketUrl: target.userId ? `${site()}/app/support/${target.id}` : null,
      supportEmail: env.INVITES_SUPPORT_EMAIL,
      contactUrl: `${site()}/contact`,
    });
    const ok = await sendEmail({
      to: target.email,
      ...(env.INVITES_SUPPORT_EMAIL ? { replyTo: env.INVITES_SUPPORT_EMAIL } : {}),
      ...content,
    });
    await ticketsDb.emailed(messageId, ok);
  } catch (err) {
    console.error('[support] the customer’s email failed', err);
  }
}

/** A new ticket, or its customer's answer, to the team's address: the subject and a console link. */
export async function emailTeam(ticketId: string, kind: 'opened' | 'answered'): Promise<void> {
  try {
    const env = serverEnv();
    if (!env.INVITES_SUPPORT_EMAIL) return;
    const target = await ticketsDb.target(ticketId);
    if (!target) return;
    await sendEmail({
      to: env.INVITES_SUPPORT_EMAIL,
      ...teamTicketEmail({
        kind,
        brand: env.INVITES_BRAND_NAME,
        number: target.number,
        subject: target.subject,
        category: target.category,
        source: target.source,
        firstName: target.firstName,
        visitor: !target.userId && !!target.email,
        consoleUrl: `${site()}/app/admin/support/${target.id}`,
      }),
    });
  } catch (err) {
    console.error('[support] the team’s email failed', err);
  }
}

/** The customer's open page of this ticket refreshes (a hint on its channel, no data). */
export async function tellCustomerPage(ticketId: string): Promise<void> {
  try {
    const target = await ticketsDb.target(ticketId);
    if (target) await broadcastRefresh(target.channel, 'ticket', fetch, 'support');
  } catch (err) {
    console.error('[support] the ticket page’s hint failed', err);
  }
}
