import 'server-only';
import { sendEmail } from '@/features/invitations/server/email';
import { serverEnv } from '@/lib/env';

/**
 * Something about money that a person has to look at (a charge to stop by hand, a payment PayPlus
 * didn't confirm): logged, and emailed to INVITES_SUPPORT_EMAIL when it is set. Never throws.
 */
export async function alertSupport(subject: string, details: Record<string, unknown>): Promise<void> {
  const env = serverEnv();
  console.error(`[billing] ${subject}`, details);
  if (!env.INVITES_SUPPORT_EMAIL) return;
  const text = Object.entries(details)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');
  await sendEmail({
    to: env.INVITES_SUPPORT_EMAIL,
    subject: `[${env.INVITES_BRAND_NAME} billing] ${subject}`,
    text,
    html: `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
  });
}
