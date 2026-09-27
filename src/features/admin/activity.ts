/**
 * One line of the console's live activity feed (the overview): what happened, when, and where to look
 * — a user, an invitation, a ticket. Each area gives its own lines (features/admin/server/activity/*);
 * the feed merges them newest first. No contact details here: the line says who by name, or masked.
 */
export type ActivityKind =
  | 'signup'
  | 'invitation_created'
  | 'invitation_published'
  | 'rsvp'
  | 'whatsapp_batch'
  | 'payment'
  | 'credits'
  | 'ticket_opened'
  | 'ticket_reply'
  | 'partner_provision'
  | 'staff'
  /** the team acted on a customer: a plan as a gift, a discount, sign-in suspended or restored, a feature */
  | 'team_action';

export interface ActivityItem {
  /** unique across the kinds (e.g. "rsvp:<id>") */
  id: string;
  kind: ActivityKind;
  /** ISO time */
  at: string;
  /** who it is about (a display name, never an email or a phone) */
  actor: string | null;
  /** what it is about (an invitation's title, a ticket's subject, a plan) */
  subject: string | null;
  /** a number that goes with it (messages in a batch, an amount in shekels, credits) */
  amount: number | null;
  userId: string | null;
  invitationId: string | null;
  ticketId: string | null;
  /**
   * What the line needs besides (optional): signup { source }, rsvp { attending }, whatsapp_batch
   * { channel: 'invitation' | 'table' | 'gallery' }, payment { renewal }, staff and team_action
   * { action, role, before, plan, percent, feature, grant }.
   */
  detail?: Record<string, string | number | boolean | null>;
}
