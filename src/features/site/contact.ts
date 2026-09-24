import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizeGuestPhone } from '@/features/invitations/lib/guest-import';
import { sendEmail } from '@/features/invitations/server/email';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';

export const CONTACT_TOPICS = [
  'support',
  'billing',
  'privacy',
  'accessibility',
  'business',
  'other',
] as const;

export const ContactSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(['he', 'en']).default('he'),
  /** a field people don't see: bots fill it in */
  website: z.string().max(200).optional().default(''),
});

/** Five messages an hour from one address. */
const RATE = { count: 5, windowSeconds: 3600 };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type ContactResult = { status: number; body: { ok: boolean; code?: string; fields?: string[] } };

/**
 * POST /api/contact: validates, drops what a bot filled in (quietly), limits each address, stores the
 * message and emails it to support (INVITES_SUPPORT_EMAIL) with the visitor as the reply-to address.
 */
export async function submitContact(
  raw: unknown,
  { ip, userId }: { ip: string | null; userId: string | null },
): Promise<ContactResult> {
  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        ok: false,
        code: 'invalid',
        fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
      },
    };
  const m = parsed.data;
  if (m.website) return { status: 200, body: { ok: true } };
  const phone = m.phone ? normalizeGuestPhone(m.phone) : null;
  if (m.phone && !phone) return { status: 400, body: { ok: false, code: 'invalid', fields: ['phone'] } };

  const env = serverEnv();
  const db = serviceDb();
  const key = createHash('sha256')
    .update(`${env.INVITES_IP_HASH_SALT}:contact:${userId ?? ip ?? 'unknown'}`)
    .digest('hex');
  const { data: allowed, error: rateError } = await db.rpc('support_rate_hit', {
    p_key_hash: key,
    p_limit: RATE.count,
    p_window_seconds: RATE.windowSeconds,
  });
  if (rateError) throw new Error(`support_rate_hit: ${rateError.message}`);
  if (allowed !== true) return { status: 429, body: { ok: false, code: 'rate' } };

  const { data: id, error } = await db.rpc('contact_submit', {
    p_name: m.name,
    p_email: m.email,
    p_phone: phone ?? '',
    p_topic: m.topic,
    p_message: m.message,
    p_locale: m.locale,
    p_user_id: userId,
  });
  if (error) throw new Error(`contact_submit: ${error.message}`);

  if (env.INVITES_SUPPORT_EMAIL) {
    const lines = [
      ['Name', m.name],
      ['Email', m.email],
      ['Phone', phone ?? '—'],
      ['Topic', m.topic],
      ['Language', m.locale],
      ['Account', userId ?? '—'],
      ['Reference', String(id)],
    ];
    await sendEmail({
      to: env.INVITES_SUPPORT_EMAIL,
      replyTo: m.email,
      subject: `[${env.INVITES_BRAND_NAME}] ${m.topic}: ${m.name}`,
      text: `${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${m.message}`,
      html: `<table>${lines.map(([k, v]) => `<tr><th align="left">${k}</th><td>${esc(String(v))}</td></tr>`).join('')}</table><p style="white-space:pre-wrap" dir="auto">${esc(m.message)}</p>`,
    });
  }
  return { status: 200, body: { ok: true } };
}
