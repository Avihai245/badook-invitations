import { hostRoute } from '@/features/invitations/server/host-route';
import { listTickets, openTicket } from '@/features/support/tickets/server/api';
import { ticketDeps } from '@/features/support/tickets/server/deps';

/** GET /api/support/tickets — the signed-in customer's support tickets. */
export async function GET(request: Request) {
  return hostRoute(request, (userId) => listTickets(userId, ticketDeps()));
}

/**
 * POST /api/support/tickets { subject, category, body, invitationId?, locale, source: 'app' | 'chat',
 * chat? } — a new ticket for the team (from the app, or from the assistant with its conversation).
 */
export async function POST(request: Request) {
  return hostRoute(request, (userId, body) => openTicket(userId, body, ticketDeps()));
}
