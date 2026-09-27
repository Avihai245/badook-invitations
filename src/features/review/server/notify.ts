import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import { hostsLine } from '@/features/invitations/lib/text';
import { sendEmail } from '@/features/invitations/server/email';
import { serverEnv } from '@/lib/env';
import { REVIEW } from '../config';
import { reviewEmail } from '../email';
import { reviewDb, type PendingRow } from './db';

/**
 * The host hears about the family's comments by email, as they chose on the review link: soon after
 * new ones (at most one email every REVIEW.notifyEveryMinutes), or in the daily summary — which also
 * sends what the throttle held back. Each email marks what it told (up to its newest comment).
 */

const editorUrl = (id: string) => `${serverEnv().INVITES_PUBLIC_BASE_URL}/app/invitations/${id}/edit`;

async function send(p: PendingRow): Promise<boolean> {
  if (!p.email || !p.comments.length) return false;
  let locale: 'he' | 'en' = 'he';
  let title = '';
  try {
    const doc = migrateDocument(p.document);
    locale = doc.defaultLocale === 'en' ? 'en' : 'he';
    title = hostsLine(doc.hosts, doc.defaultLocale);
  } catch {
    // an unreadable draft: the email still goes, without its title
  }
  const ok = await sendEmail({
    to: p.email,
    kind: 'review',
    ...reviewEmail({
      locale,
      title,
      comments: p.comments,
      editorUrl: editorUrl(p.id),
      brand: serverEnv().INVITES_BRAND_NAME,
    }),
  });
  if (ok) {
    const newest = p.comments.reduce(
      (a, c) => (Date.parse(c.at) > Date.parse(a) ? c.at : a),
      p.comments[0]!.at,
    );
    await reviewDb.notifyMark(p.id, newest);
  }
  return ok;
}

/** After a new comment or reply: an email when the host wants one on each (throttled). Never throws. */
export async function notifyHost(invitationId: string, now = Date.now()): Promise<void> {
  try {
    const p = await reviewDb.notifyPending(invitationId);
    if (!p || p.mode !== 'each' || !p.comments.length) return;
    if (p.notifiedAt && now - Date.parse(p.notifiedAt) < REVIEW.notifyEveryMinutes * 60_000) return;
    await send(p);
  } catch (err) {
    console.error('[review] the host’s email failed', err);
  }
}

/** The daily run: a summary to every host with comments not emailed yet. */
export async function sendReviewDigests(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const id of (await reviewDb.digestDue()) ?? []) {
    const p = await reviewDb.notifyPending(id);
    if (!p || p.mode === 'off' || !p.comments.length) continue;
    if (await send(p)) sent++;
    else failed++;
  }
  return { sent, failed };
}
