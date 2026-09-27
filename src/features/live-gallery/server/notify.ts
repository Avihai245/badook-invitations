import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import {
  cloudApiConfigured,
  missingTemplate,
  postTemplate,
  type SendResult,
  type TemplateSend,
} from '@/features/whatsapp/cloud-api';
import {
  guestLocale,
  templateChain,
  valuesLocale,
  type TemplateLanguage,
} from '@/features/whatsapp/languages';
import { configuredTemplateLanguages, retryWait, type ProcessResult } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { galleryNoticesDb, type ClaimedGalleryNotice, type GalleryNoticesDb } from './notices-db';
import { linkToken } from './tokens';

/**
 * Sending guests the gallery link from the system's WhatsApp number: the gallery's own Meta template
 * (INVITES_WHATSAPP_GALLERY_TEMPLATE, docs/whatsapp-setup.md §9) with the guest's name, the hosts, and
 * a button to their own gallery link (/e/<slug>/upload?t=<gallery link>&g=<their personal token> —
 * their uploads then carry their name — opening in their language). Written in the guest's language
 * when the template is approved in it (INVITES_WHATSAPP_TEMPLATE_LANGS, the list the invitation's and
 * the table number's templates share), else in the invitation's (whatsapp/languages.ts). Queued and
 * sent like the table numbers (features/event-day/server/notify.ts): claimed in batches, a temporary
 * failure waits and tries again (3 tries), a failure refunds its credit, nothing is sent twice. Until
 * the template is approved the host sends it from their own WhatsApp, or copies the message.
 */

/** The system's number can send the gallery link: WhatsApp is set up and the template approved. */
export function galleryTemplateReady(): boolean {
  return cloudApiConfigured() && !!serverEnv().INVITES_WHATSAPP_GALLERY_TEMPLATE;
}

/**
 * A guest's own gallery link, after the site's address: "<slug>/upload?t=<link>&g=<token>", and
 * "&lang=<language>" when it opens in another of the invitation's languages than its default.
 */
export const galleryLinkSuffix = (
  slug: string,
  uploadToken: string,
  guestToken: string,
  lang: Locale | null = null,
) => `${slug}/upload?t=${uploadToken}&g=${guestToken}${lang ? `&lang=${lang}` : ''}`;

/**
 * What the template says for this message in one of its languages (the first of the guest's chain
 * when not given): the hosts in that language, and a button to the guest's gallery link, which opens
 * in the guest's own language — the gallery page doesn't look the guest up, so the link says it. null:
 * no link to give.
 */
export function galleryNoticeMessage(
  m: ClaimedGalleryNotice,
  doc: InvitationDocument,
  lang: TemplateLanguage = templateChain(m.guestLanguage, doc, configuredTemplateLanguages())[0]!,
): TemplateSend | null {
  const env = serverEnv();
  if (!m.guestToken || !m.uploadTokenNonce || !m.uploadTokenHash) return null;
  const upload = linkToken('upload', m.invitationId, m.uploadTokenNonce, m.uploadTokenHash);
  if (!upload) return null;
  const page = guestLocale(m.guestLanguage, doc);
  return {
    to: m.toPhone,
    template: env.INVITES_WHATSAPP_GALLERY_TEMPLATE,
    lang: lang.code,
    body: [m.guestName ?? '', hostsLine(doc.hosts, valuesLocale(lang.locale, doc))],
    button: galleryLinkSuffix(m.slug, upload, m.guestToken, page !== doc.defaultLocale ? page : null),
    ref: m.id,
  };
}

/**
 * Sends one gallery link in the guest's language — or, when Meta has no approved template in it
 * (132001), in the next language of the chain: the invitation's default, its other languages, the
 * first approved. null: no link to give.
 */
async function sendInLanguage(
  m: ClaimedGalleryNotice,
  doc: InvitationDocument,
  send: (m: TemplateSend) => Promise<SendResult>,
): Promise<SendResult | null> {
  const chain = templateChain(m.guestLanguage, doc, configuredTemplateLanguages());
  let outcome: SendResult = { ok: false, error: 'no template language', retryable: false };
  for (const lang of chain) {
    const message = galleryNoticeMessage(m, doc, lang);
    if (!message) return null;
    outcome = await send(message);
    if (!missingTemplate(outcome)) break;
  }
  return outcome;
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
        const outcome = m.document ? await sendInLanguage(m, migrateDocument(m.document), send) : null;
        if (!outcome) {
          await db.result(m.id, null, m.guestToken ? 'no_gallery' : 'no_guest');
          result.failed++;
          return;
        }
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
