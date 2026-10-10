import 'server-only';
import { albumEventPhrase } from '@/features/album/phrases';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { formatDate, formatTime } from '@/features/invitations/lib/dates';
import { firstVenue } from '@/features/invitations/renderer/calendar-event';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { messageParams, type EventValues, type MessageKind } from './catalog';
import {
  cloudApiConfigured,
  missingTemplate,
  postTemplate,
  type SendResult,
  type TemplateSend,
} from './cloud-api';
import { guestLocale, templateChain, valuesLocale, type TemplateLanguage } from './languages';
import { configuredTemplateLanguages, retryWait, templateValues, type ProcessResult } from './sender';

/**
 * The templates that had no queue of their own — the RSVP follow-up, the reminder before the event
 * and the thank-you without an album (supabase/migrations/*_whatsapp_schedule.sql, whatsapp_notices) —
 * sent like every other message of the system's number: claimed in batches, in the guest's language
 * when the template is approved in it (else the next of the chain), a temporary failure waits and
 * tries again (3 tries), a failure refunds its credit, nothing is sent twice. The claim checks each
 * guest's RSVP once more right before sending: a follow-up never reaches a guest who answered.
 */

/** The template's name at Meta for each message ('' — not approved here, never offered). */
export function templateName(kind: MessageKind): string {
  const env = serverEnv();
  return {
    invitation: env.INVITES_WHATSAPP_TEMPLATE,
    reminder: env.INVITES_WHATSAPP_REMINDER_TEMPLATE,
    event_reminder: env.INVITES_WHATSAPP_EVENT_TEMPLATE,
    thanks: env.INVITES_WHATSAPP_THANKS_TEMPLATE,
    album: env.INVITES_WHATSAPP_ALBUM_TEMPLATE,
  }[kind];
}

/** The messages the system's number can send here: WhatsApp is connected and the template approved. */
export function approvedKinds(): MessageKind[] {
  if (!cloudApiConfigured()) return [];
  return (['invitation', 'reminder', 'event_reminder', 'thanks', 'album'] as const).filter(
    (k) => !!templateName(k),
  );
}

/** When and where, for the reminder: "יום שלישי, 17 בנובמבר · 19:30 · גן האירועים". */
export function eventWhen(doc: InvitationDocument, locale: Locale): string {
  const venue = firstVenue({ doc } as Parameters<typeof firstVenue>[0]);
  const date = formatDate(venue?.date ?? doc.event.date, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time = formatTime(venue?.startTime ?? doc.event.startTime, locale, doc.event.timeFormat);
  const place = venue ? (venue.name[locale] ?? venue.name[doc.defaultLocale] ?? '').trim() : '';
  return [date, time, place].filter(Boolean).join(' · ');
}

/** Every value the event's messages need in one language (catalog.ts EventValues). */
export function eventValues(doc: InvitationDocument, locale: Locale): EventValues {
  const values = valuesLocale(locale, doc);
  return {
    ...templateValues(doc, locale),
    when: eventWhen(doc, values),
    phrase: albumEventPhrase(doc, values),
  };
}

export interface ClaimedNotice {
  id: string;
  invitationId: string;
  template: 'reminder' | 'event_reminder' | 'thanks';
  toPhone: string;
  attempts?: number;
  guestName: string | null;
  guestToken: string | null;
  guestLanguage?: string | null;
  slug: string;
  document: unknown;
}

/** The guest's personal invitation after the site's "/i/": "<slug>?g=<token>&lang=<language>". */
function invitationSuffix(m: ClaimedNotice, doc: InvitationDocument): string {
  const page = guestLocale(m.guestLanguage, doc);
  const query = [
    m.guestToken ? `g=${m.guestToken}` : null,
    page !== doc.defaultLocale ? `lang=${page}` : null,
  ]
    .filter(Boolean)
    .join('&');
  return query ? `${m.slug}?${query}` : m.slug;
}

/** A notice in one of its template's languages. */
export function noticeMessage(
  m: ClaimedNotice,
  doc: InvitationDocument,
  lang: TemplateLanguage,
): TemplateSend {
  const values = eventValues(doc, lang.locale);
  return {
    to: m.toPhone,
    template: templateName(m.template),
    lang: lang.code,
    body: messageParams(m.template, m.guestName ?? '', values),
    // the thank-you has no button; the others open the guest's invitation (the RSVP, the map)
    button: m.template === 'thanks' ? null : invitationSuffix(m, doc),
    ref: m.id,
  };
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const noticesDb = {
  claim: (id: string | null, limit: number) =>
    rpc<ClaimedNotice[]>('whatsapp_notice_claim', { p_id: id, p_limit: limit }),
  result: (id: string, waId: string | null, error: string | null) =>
    rpc<void>('whatsapp_notice_result', { p_notice_id: id, p_wa_id: waId, p_error: error }),
  requeue: (id: string, error: string, waitSeconds: number) =>
    rpc<boolean>('whatsapp_notice_requeue', { p_notice_id: id, p_error: error, p_wait_seconds: waitSeconds }),
  status: (waId: string, status: string, error: string | null) =>
    rpc<boolean>('whatsapp_notice_status', { p_wa_id: waId, p_status: status, p_error: error }),
  pending: (id: string) => rpc<number>('whatsapp_notice_pending', { p_id: id }),
};
export type NoticesDb = typeof noticesDb;

const CONCURRENCY = 5;

/** Sends up to `limit` queued notices (one invitation's, or any when null). */
export async function processNotices(
  invitationId: string | null,
  limit = 25,
  send: (m: TemplateSend) => Promise<SendResult> = (m) => postTemplate(m),
  db: Pick<NoticesDb, 'claim' | 'result' | 'requeue'> = noticesDb,
  languages: () => TemplateLanguage[] = configuredTemplateLanguages,
): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, retried: 0 };
  if (!cloudApiConfigured()) return result;
  const claimed = await db.claim(invitationId, limit);
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(
      claimed.slice(i, i + CONCURRENCY).map(async (m) => {
        const doc = migrateDocument(m.document);
        let outcome: SendResult = { ok: false, error: 'no template language', retryable: false };
        if (!templateName(m.template)) outcome = { ok: false, error: 'template', retryable: false };
        else
          for (const lang of templateChain(m.guestLanguage, doc, languages())) {
            outcome = await send(noticeMessage(m, doc, lang));
            if (!missingTemplate(outcome)) break;
          }
        if (outcome.ok) {
          await db.result(m.id, outcome.id, null);
          result.sent++;
        } else if (outcome.retryable) {
          if (await db.requeue(m.id, outcome.error, retryWait(m.attempts ?? 1))) result.retried++;
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
