import 'server-only';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { migrateDocument } from '../contracts/migrate';
import type { InvitationDocument } from '../contracts/types';
import { digestEmail, replyEmail, type ReplySummary } from '../lib/notify-email';
import type { NotifyMode } from '../lib/responses';
import { hostsLine } from '../lib/text';
import { sendEmail } from './email';

const dashboardUrl = (id: string) => `${serverEnv().INVITES_PUBLIC_BASE_URL}/app/invitations/${id}/responses`;

/**
 * After a guest's reply is saved: an email to the host when the invitation notifies on every reply
 * (§4). The emails are in the invitation's default language.
 */
export async function notifyReply(saved: {
  invitationId: string;
  doc: InvitationDocument;
  reply: ReplySummary;
}): Promise<void> {
  const { data, error } = await serviceDb().rpc('rsvp_notification_target', {
    p_invitation_id: saved.invitationId,
  });
  if (error) throw new Error(`rsvp_notification_target: ${error.message}`);
  const target = data as { id: string; email: string | null; mode: NotifyMode } | null;
  if (!target?.email || target.mode !== 'each') return;
  const locale = saved.doc.defaultLocale;
  await sendEmail({
    to: target.email,
    ...replyEmail({
      locale,
      title: hostsLine(saved.doc.hosts, locale),
      reply: saved.reply,
      dashboardUrl: dashboardUrl(target.id),
      brand: serverEnv().INVITES_BRAND_NAME,
    }),
  });
}

interface DigestItem {
  id: string;
  email: string | null;
  document: unknown;
  responses: { name: string; attending: boolean; adults: number; children: number }[];
}

/** The daily summary (POST /api/cron/rsvp-digest): one email per invitation with new replies. */
export async function sendDigests(now: Date): Promise<{ sent: number; failed: number }> {
  const db = serviceDb();
  const { data, error } = await db.rpc('rsvp_digest_due', { p_now: now.toISOString() });
  if (error) throw new Error(`rsvp_digest_due: ${error.message}`);
  let sent = 0;
  let failed = 0;
  for (const item of (data ?? []) as DigestItem[]) {
    if (!item.email || !item.responses?.length) continue;
    let doc: InvitationDocument;
    try {
      doc = migrateDocument(item.document);
    } catch {
      failed++;
      continue;
    }
    const locale = doc.defaultLocale;
    const ok = await sendEmail({
      to: item.email,
      ...digestEmail({
        locale,
        title: hostsLine(doc.hosts, locale),
        replies: item.responses.map((r) => ({ ...r, message: null })),
        dashboardUrl: dashboardUrl(item.id),
        brand: serverEnv().INVITES_BRAND_NAME,
      }),
    });
    if (!ok) {
      failed++;
      continue;
    }
    const marked = await db.rpc('mark_rsvp_digest_sent', { p_id: item.id, p_at: now.toISOString() });
    if (marked.error) throw new Error(`mark_rsvp_digest_sent: ${marked.error.message}`);
    sent++;
  }
  return { sent, failed };
}
