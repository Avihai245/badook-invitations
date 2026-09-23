import 'server-only';
import { serverEnv } from '@/lib/env';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends one email through Resend (INVITES_EMAIL_API_KEY + INVITES_EMAIL_FROM). Not configured → the
 * email is only logged (local dev) and counts as delivered. Never throws: false when it failed.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const env = serverEnv();
  if (!env.INVITES_EMAIL_API_KEY || !env.INVITES_EMAIL_FROM) {
    console.info(`[email] not configured — would send to ${email.to}: ${email.subject}`);
    return true;
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
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email] send failed (${res.status}):`, (await res.text().catch(() => '')).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}
