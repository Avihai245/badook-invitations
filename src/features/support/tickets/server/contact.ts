import 'server-only';
import { after } from 'next/server';
import { adminNudge } from '@/features/admin/server/live';
import { subjectFrom, type TicketCategory } from '../config';
import { ticketsDb } from './db';
import { emailTeam } from './notify';

/**
 * The site's contact form opens a ticket too (source 'contact'): the team answers it from the console
 * — a visitor by email only, a signed-in customer also in the app. The team hears of it by email (the
 * subject and a console link) and the console's open pages refresh, after the answer is sent.
 */
export async function openContactTicket(m: {
  userId: string | null;
  name: string;
  email: string;
  /** E.164, or empty */
  phone: string;
  topic: TicketCategory;
  message: string;
  locale: 'he' | 'en';
}): Promise<{ id: string; number: number }> {
  const ticket = await ticketsDb.contact({
    userId: m.userId,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: subjectFrom(m.message),
    category: m.topic,
    body: m.message,
    locale: m.locale,
  });
  after(() => Promise.all([emailTeam(ticket.id, 'opened'), adminNudge('ticket')]));
  return ticket;
}
