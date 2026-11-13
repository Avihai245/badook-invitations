import 'server-only';
import { sendEmail } from '@/features/invitations/server/email';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';

/** Emails a throttled alert may send an hour (all servers together). */
export const THROTTLED_ALERTS_PER_HOUR = 3;

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
    kind: 'billing_alert',
    subject: `[${env.INVITES_BRAND_NAME} billing] ${subject}`,
    text,
    html: `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
  });
}

/**
 * The same for something anyone on the internet can set off (an unsigned payment notice): always logged,
 * emailed at most THROTTLED_ALERTS_PER_HOUR times an hour for `key` — a loop of forged requests can't
 * flood the support inbox or use up the email quota every other email depends on. Never throws.
 */
export async function alertSupportThrottled(
  key: string,
  subject: string,
  details: Record<string, unknown>,
  rateHit: (keyHash: string, limit: number, windowSeconds: number) => Promise<boolean> = supportRateHit,
): Promise<void> {
  const within = await rateHit(rateKey('billing', 'alert', key), THROTTLED_ALERTS_PER_HOUR, 3600).catch(
    () => false,
  );
  if (within) return alertSupport(subject, details);
  console.error(`[billing] ${subject} (not emailed: over the hour's alerts)`, details);
}

async function supportRateHit(keyHash: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await serviceDb().rpc('support_rate_hit', {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`support_rate_hit: ${error.message}`);
  return data === true;
}
