import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import { linkToken } from '@/features/live-gallery/server/tokens';
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
import { albumEventPhrase } from '../phrases';
import { albumNoticesDb, type AlbumNoticesDb, type ClaimedAlbumNotice } from './notices-db';

/**
 * The album's thank-you from the system's WhatsApp number: its own Meta template
 * (INVITES_WHATSAPP_ALBUM_TEMPLATE, docs/whatsapp-setup.md §10) with the guest's name, where they
 * celebrated ("בחתונה שלנו") and the hosts, and a button to the album opening in the guest's language.
 * Written in the guest's language when the template is approved in it, else the invitation's — the
 * chain the other templates use. Queued and sent like the gallery link: claimed in batches, a
 * temporary failure waits and tries again (3 tries), a failure refunds its credit, nothing is sent
 * twice. Until the template is approved the hosts send it from their own WhatsApp, or copy it.
 */

/** The system's number can send the thank-you: WhatsApp is set up and the template approved. */
export function albumTemplateReady(): boolean {
  return cloudApiConfigured() && !!serverEnv().INVITES_WHATSAPP_ALBUM_TEMPLATE;
}

/** The album's link after the site's "/e/": "<slug>/album?a=<link>", and "&lang=" for another language. */
export const albumLinkSuffix = (slug: string, albumToken: string, lang: Locale | null = null) =>
  `${slug}/album?a=${albumToken}${lang ? `&lang=${lang}` : ''}`;

/** The template's message in one of its languages (the first of the guest's chain by default); null: no album. */
export function albumNoticeMessage(
  m: ClaimedAlbumNotice,
  doc: InvitationDocument,
  lang: TemplateLanguage = templateChain(m.guestLanguage, doc, configuredTemplateLanguages())[0]!,
): TemplateSend | null {
  if (!m.albumEnabled || !m.albumTokenNonce || !m.albumTokenHash) return null;
  const token = linkToken('album', m.invitationId, m.albumTokenNonce, m.albumTokenHash);
  if (!token) return null;
  const values = valuesLocale(lang.locale, doc);
  const page = guestLocale(m.guestLanguage, doc);
  return {
    to: m.toPhone,
    template: serverEnv().INVITES_WHATSAPP_ALBUM_TEMPLATE,
    lang: lang.code,
    body: [m.guestName ?? '', albumEventPhrase(doc, values), hostsLine(doc.hosts, values)],
    button: albumLinkSuffix(m.slug, token, page !== doc.defaultLocale ? page : null),
    ref: m.id,
  };
}

/** One thank-you in the guest's language, or the next of the chain when Meta has none in it (132001). */
async function sendInLanguage(
  m: ClaimedAlbumNotice,
  doc: InvitationDocument,
  send: (m: TemplateSend) => Promise<SendResult>,
): Promise<SendResult | null> {
  const chain = templateChain(m.guestLanguage, doc, configuredTemplateLanguages());
  let outcome: SendResult = { ok: false, error: 'no template language', retryable: false };
  for (const lang of chain) {
    const message = albumNoticeMessage(m, doc, lang);
    if (!message) return null;
    outcome = await send(message);
    if (!missingTemplate(outcome)) break;
  }
  return outcome;
}

const CONCURRENCY = 5;

/** Sends up to `limit` queued thank-yous (one invitation's, or any when null). */
export async function processAlbumNoticeQueue(
  invitationId: string | null,
  limit = 25,
  send: (m: TemplateSend) => Promise<SendResult> = (m) => postTemplate(m),
  db: Pick<AlbumNoticesDb, 'claim' | 'result' | 'requeue'> = albumNoticesDb,
  ready: () => boolean = albumTemplateReady,
): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, retried: 0 };
  if (!ready()) return result;
  const claimed = await db.claim(invitationId, limit);
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(
      claimed.slice(i, i + CONCURRENCY).map(async (m) => {
        // the album went (or its link): nothing to link to
        const outcome = m.document ? await sendInLanguage(m, migrateDocument(m.document), send) : null;
        if (!outcome) {
          await db.result(m.id, null, 'no_album');
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
