import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import {
  cloudApiConfigured,
  postTemplate,
  type SendResult,
  type TemplateSend,
} from '@/features/whatsapp/cloud-api';
import { retryWait, type ProcessResult } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { eventDayDb, type ClaimedNotice, type EventDayDb } from './db';

/**
 * Telling guests their table from the system's WhatsApp number: the table number's own Meta template
 * (INVITES_WHATSAPP_TABLE_TEMPLATE, docs/whatsapp-setup.md) with the guest's name, the hosts, the
 * table, and a button to the guest's map (/e/<slug>/table?g=<their personal link's token>). Queued and
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

/** What the template says for this notice, in the template's language. */
export function noticeMessage(m: ClaimedNotice, doc: InvitationDocument): TemplateSend {
  const env = serverEnv();
  const lang = env.INVITES_WHATSAPP_TEMPLATE_LANG;
  const locale = (lang.startsWith('en') ? 'en' : 'he') as Locale;
  const docLocale = doc.locales.includes(locale) ? locale : doc.defaultLocale;
  return {
    to: m.toPhone,
    template: env.INVITES_WHATSAPP_TABLE_TEMPLATE,
    lang,
    body: [m.guestName ?? '', hostsLine(doc.hosts, docLocale), tableText(m.tableNumber, m.tableLabel)],
    button: `${m.slug}/table?g=${m.guestToken ?? ''}`,
    ref: m.id,
  };
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
        const outcome = await send(noticeMessage(m, migrateDocument(m.document)));
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
