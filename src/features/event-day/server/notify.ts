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
import { templateChain, valuesLocale, type TemplateLanguage } from '@/features/whatsapp/languages';
import { configuredTemplateLanguages, retryWait, type ProcessResult } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { eventDayDb, type ClaimedNotice, type EventDayDb } from './db';

/**
 * Telling guests their table from the system's WhatsApp number: the table number's own Meta template
 * (INVITES_WHATSAPP_TABLE_TEMPLATE, docs/whatsapp-setup.md) with the guest's name, the hosts, the
 * table, and a button to the guest's map (/e/<slug>/table?g=<their personal link's token>) — in the
 * guest's language when the template is approved in it (INVITES_WHATSAPP_TEMPLATE_LANGS, the same list
 * as the invitation's template), else in the invitation's (whatsapp/languages.ts). Queued and
 * sent like the invitations (features/whatsapp/sender.ts): claimed in batches, a temporary failure
 * waits and tries again (3 tries), a failure refunds its credit, nothing is ever sent twice. Until the
 * template is approved the host sends from their own WhatsApp and prints table cards.
 */

/** The system's number can send table numbers: WhatsApp is set up and the template approved. */
export function tableTemplateReady(): boolean {
  return cloudApiConfigured() && !!serverEnv().INVITES_WHATSAPP_TABLE_TEMPLATE;
}

/** The table as the message says it: "12", or "12 · the family's table". */
export const tableText = (number: number, label: string | null) =>
  label ? `${number} · ${label}` : String(number);

/**
 * What the template says for this notice in one of its languages (the first of the guest's chain when
 * not given): the hosts in that language, and a button whose map opens in it when the invitation has it.
 */
export function noticeMessage(
  m: ClaimedNotice,
  doc: InvitationDocument,
  lang: TemplateLanguage = templateChain(m.guestLanguage, doc, configuredTemplateLanguages())[0]!,
): TemplateSend {
  const env = serverEnv();
  const page: Locale = valuesLocale(lang.locale, doc);
  const query = [`g=${m.guestToken ?? ''}`, page !== doc.defaultLocale ? `lang=${page}` : null]
    .filter(Boolean)
    .join('&');
  return {
    to: m.toPhone,
    template: env.INVITES_WHATSAPP_TABLE_TEMPLATE,
    lang: lang.code,
    body: [m.guestName ?? '', hostsLine(doc.hosts, page), tableText(m.tableNumber, m.tableLabel)],
    button: `${m.slug}/table?${query}`,
    ref: m.id,
  };
}

/**
 * Sends one notice in the guest's language — or, when Meta has no approved template in it (132001),
 * in the next language of the chain: the invitation's default, its other languages, the first approved.
 */
async function sendInLanguage(
  m: ClaimedNotice,
  doc: InvitationDocument,
  send: (m: TemplateSend) => Promise<SendResult>,
): Promise<SendResult> {
  const chain = templateChain(m.guestLanguage, doc, configuredTemplateLanguages());
  let outcome: SendResult = { ok: false, error: 'no template language', retryable: false };
  for (const lang of chain) {
    outcome = await send(noticeMessage(m, doc, lang));
    if (!missingTemplate(outcome)) break;
  }
  return outcome;
}

const CONCURRENCY = 5;

/** Sends up to `limit` queued table notices (one invitation's, or any when null). */
export async function processNoticeQueue(
  invitationId: string | null,
  limit = 25,
  send: (m: TemplateSend) => Promise<SendResult> = (m) => postTemplate(m),
  db: Pick<EventDayDb, 'claimNotices' | 'noticeResult' | 'noticeRequeue'> = eventDayDb,
): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, retried: 0 };
  if (!tableTemplateReady()) return result;
  const claimed = await db.claimNotices(invitationId, limit);
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(
      claimed.slice(i, i + CONCURRENCY).map(async (m) => {
        // the guest left the list since (their link with them): nothing to link to
        if (!m.guestToken || !m.document) {
          await db.noticeResult(m.id, null, 'no_guest');
          result.failed++;
          return;
        }
        const outcome = await sendInLanguage(m, migrateDocument(m.document), send);
        if (outcome.ok) {
          await db.noticeResult(m.id, outcome.id, null);
          result.sent++;
        } else if (outcome.retryable) {
          const again = await db.noticeRequeue(m.id, outcome.error, retryWait(m.attempts ?? 1));
          if (again) result.retried++;
          else result.failed++;
        } else {
          await db.noticeResult(m.id, null, outcome.error);
          result.failed++;
        }
      }),
    );
  }
  return result;
}
