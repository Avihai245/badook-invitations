import 'server-only';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';

/**
 * What an email is, for the admin console's log of emails (email_log: the kind and whether it went —
 * no address, no content; kept 90 days): a guest's reply to the host, the host's daily summary, the
 * family's comments on a draft, an alert to the team about money, the contact form, a support ticket's
 * answer, anything else.
 */
export type EmailKind =
  | 'rsvp_reply'
  | 'rsvp_digest'
  | 'plan_reminder'
  | 'review'
  | 'billing_alert'
  | 'contact'
  | 'support'
  | 'other';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** where replies go (the contact form: the visitor's address) */
  replyTo?: string;
  /** what it is, for the log of emails (default 'other') */
  kind?: EmailKind;
}

type Outcome = 'sent' | 'failed' | 'skipped';

async function deliver(email: OutgoingEmail): Promise<Outcome> {
  const env = serverEnv();
  if (!env.INVITES_EMAIL_API_KEY || !env.INVITES_EMAIL_FROM) {
    console.info(`[email] not configured — would send to ${email.to}: ${email.subject}`);
    return 'skipped';
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.INVITES_EMAIL_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.INVITES_EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email] send failed (${res.status}):`, (await res.text().catch(() => '')).slice(0, 300));
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[email] send failed:', err);
    return 'failed';
  }
}

/** One line in the log of emails: the kind and how it went. Never throws. */
async function logEmail(kind: EmailKind, outcome: Outcome): Promise<void> {
  try {
    const { error } = await serviceDb().rpc('email_log_add', { p_kind: kind, p_status: outcome });
    if (error) console.error('[email] log', error.message);
  } catch (err) {
    console.error('[email] log', err);
  }
}

/**
 * Sends one email through Resend (INVITES_EMAIL_API_KEY + INVITES_EMAIL_FROM). Not configured → the
 * email is only logged (local dev) and counts as delivered. Each one goes into the log of emails with
 * its kind and outcome. Never throws: false when it failed.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const outcome = await deliver(email);
  await logEmail(email.kind ?? 'other', outcome);
  return outcome !== 'failed';
}
