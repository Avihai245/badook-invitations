import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import {
  cloudApiConfigured,
  postTemplate,
  type SendResult,
  type TemplateSend,
} from '@/features/whatsapp/cloud-api';
import { templateChain, valuesLocale } from '@/features/whatsapp/languages';
import { configuredTemplateLanguages, retryWait, type ProcessResult } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { galleryNoticesDb, type ClaimedGalleryNotice, type GalleryNoticesDb } from './notices-db';
import { linkToken } from './tokens';

/**
 * Sending guests the gallery link from the system's WhatsApp number: the gallery's own Meta template
 * (INVITES_WHATSAPP_GALLERY_TEMPLATE, docs/whatsapp-setup.md §9) with the guest's name, the hosts, and
 * a button to their own gallery link (/e/<slug>/upload?t=<gallery link>&g=<their personal token> —
 * their uploads then carry their name). Queued and sent like the table numbers
 * (features/event-day/server/notify.ts): claimed in batches, a temporary failure waits and tries again
 * (3 tries), a failure refunds its credit, nothing is sent twice. Until the template is approved the
 * host sends it from their own WhatsApp, or copies the link.
 */

/** The system's number can send the gallery link: WhatsApp is set up and the template approved. */
export function galleryTemplateReady(): boolean {
  return cloudApiConfigured() && !!serverEnv().INVITES_WHATSAPP_GALLERY_TEMPLATE;
}

/** A guest's own gallery link, after the site's address: "<slug>/upload?t=<link>&g=<token>". */
export const galleryLinkSuffix = (slug: string, uploadToken: string, guestToken: string) =>
  `${slug}/upload?t=${uploadToken}&g=${guestToken}`;

/** What the template says for this message, in the template's language (null: no link to give). */
export function galleryNoticeMessage(m: ClaimedGalleryNotice, doc: InvitationDocument): TemplateSend | null {
  const env = serverEnv();
  if (!m.guestToken || !m.uploadTokenNonce || !m.uploadTokenHash) return null;
  const upload = linkToken('upload', m.invitationId, m.uploadTokenNonce, m.uploadTokenHash);
  if (!upload) return null;
  // the template's language: the invitation's own when it is approved (docs/whatsapp-setup.md §2א)
  const lang = templateChain(null, doc, configuredTemplateLanguages())[0]!;
  const docLocale = valuesLocale(lang.locale, doc);
  return {
    to: m.toPhone,
    template: env.INVITES_WHATSAPP_GALLERY_TEMPLATE,
    lang: lang.code,
    body: [m.guestName ?? '', hostsLine(doc.hosts, docLocale)],
    button: galleryLinkSuffix(m.slug, upload, m.guestToken),
    ref: m.id,
  };
}

const CONCURRENCY = 5;

/** Sends up to `limit` queued gallery links (one invitation's, or any when null). */
export async function processGalleryNoticeQueue(
  invitationId: string | null,
  limit = 25,
  send: (m: TemplateSend) => Promise<SendResult> = (m) => postTemplate(m),
  db: Pick<GalleryNoticesDb, 'claim' | 'result' | 'requeue'> = galleryNoticesDb,
): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, retried: 0 };
  if (!galleryTemplateReady()) return result;
  const claimed = await db.claim(invitationId, limit);
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(
      claimed.slice(i, i + CONCURRENCY).map(async (m) => {
        // the guest left the list (their link with them), or the gallery went: nothing to link to
        const message = m.document ? galleryNoticeMessage(m, migrateDocument(m.document)) : null;
        if (!message) {
          await db.result(m.id, null, m.guestToken ? 'no_gallery' : 'no_guest');
          result.failed++;
          return;
        }
        const outcome = await send(message);
        if (outcome.ok) {
          await db.result(m.id, outcome.id, null);
          result.sent++;
        } else if (outcome.retryable) {
          const again = await db.requeue(m.id, outcome.error, retryWait(m.attempts ?? 1));
          if (again) result.retried++;
          else result.failed++;
        } else {
          await db.result(m.id, null, outcome.error);
          result.failed++;
        }
      }),
    );
  }
  return result;
}
