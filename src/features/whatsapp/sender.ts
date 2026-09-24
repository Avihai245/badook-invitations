import 'server-only';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { EventType, InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { formatDate } from '@/features/invitations/lib/dates';
import { hostsLine } from '@/features/invitations/lib/text';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { sendTemplate, type SendResult, type TemplateMessage } from './cloud-api';

/**
 * Sends the queued WhatsApp invitations (supabase/migrations/*_guests_accounts_messaging.sql): claims a
 * batch, calls the Cloud API a few at a time, and records each answer — a failure refunds its
 * credit, a temporary one (rate limit, timeout) goes back to the queue (3 tries).
 */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Template parameter {{3}}: the event, with its preposition ("…מזמינים אותך לחתונה"). */
export const EVENT_PHRASE: Record<Locale, Record<EventType, string>> = {
  he: {
    wedding: 'לחתונה',
    engagement: 'למסיבת האירוסין',
    henna: 'לחינה',
    bar_mitzvah: 'לבר המצווה',
    bat_mitzvah: 'לבת המצווה',
    brit: 'לברית',
    baby_shower: 'לבייבי שאוור',
    birthday: 'ליום ההולדת',
    save_the_date: 'לשמור את התאריך',
    corporate: 'לאירוע',
    other: 'לאירוע',
  },
  en: {
    wedding: 'to the wedding',
    engagement: 'to the engagement party',
    henna: 'to the henna',
    bar_mitzvah: 'to the bar mitzvah',
    bat_mitzvah: 'to the bat mitzvah',
    brit: 'to the brit',
    baby_shower: 'to the baby shower',
    birthday: 'to the birthday party',
    save_the_date: 'to save the date',
    corporate: 'to the event',
    other: 'to the event',
  },
};

interface Claimed {
  id: string;
  invitationId: string;
  toPhone: string;
  guestName: string | null;
  guestToken: string | null;
  slug: string;
  document: unknown;
}

/** What the template says for this guest, in the template's language. */
export function templateMessage(m: Claimed, doc: InvitationDocument): TemplateMessage {
  const lang = serverEnv().INVITES_WHATSAPP_TEMPLATE_LANG.slice(0, 2);
  const locale: Locale = lang === 'en' ? 'en' : 'he';
  const docLocale = doc.locales.includes(locale) ? locale : doc.defaultLocale;
  return {
    to: m.toPhone,
    guestName: m.guestName ?? '',
    hosts: hostsLine(doc.hosts, docLocale),
    event: EVENT_PHRASE[locale][doc.eventType],
    date: formatDate(doc.event.date, locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    linkSuffix: m.guestToken ? `${m.slug}?g=${m.guestToken}` : m.slug,
    ref: m.id,
  };
}

export interface ProcessResult {
  sent: number;
  failed: number;
  retried: number;
}

const CONCURRENCY = 5;

/** Sends up to `limit` queued messages (one invitation's, or any when null). */
export async function processQueue(
  invitationId: string | null,
  limit = 25,
  send: (m: TemplateMessage) => Promise<SendResult> = (m) => sendTemplate(m),
): Promise<ProcessResult> {
  const claimed = await rpc<Claimed[]>('whatsapp_claim', { p_id: invitationId, p_limit: limit });
  const result: ProcessResult = { sent: 0, failed: 0, retried: 0 };
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(
      claimed.slice(i, i + CONCURRENCY).map(async (m) => {
        const doc = migrateDocument(m.document);
        const outcome = await send(templateMessage(m, doc));
        if (outcome.ok) {
          await rpc('whatsapp_result', { p_message_id: m.id, p_wa_id: outcome.id, p_error: null });
          result.sent++;
        } else if (outcome.retryable) {
          const again = await rpc<boolean>('whatsapp_requeue', {
            p_message_id: m.id,
            p_error: outcome.error,
          });
          if (again) result.retried++;
          else result.failed++;
        } else {
          await rpc('whatsapp_result', { p_message_id: m.id, p_wa_id: null, p_error: outcome.error });
          result.failed++;
        }
      }),
    );
  }
  return result;
}

export const whatsappDb = {
  queue: (id: string, ownerId: string, guestIds: string[], priceUsd: number) =>
    rpc<
      | { ok: true; queued: number; balance: number }
      | { ok: false; code: 'credits'; needed: number; balance: number }
      | { ok: false; code: 'nobody' }
      | null
    >('whatsapp_queue', { p_id: id, p_owner_id: ownerId, p_guest_ids: guestIds, p_price_usd: priceUsd }),
  pending: (id: string) => rpc<number>('whatsapp_pending', { p_id: id }),
  status: (waId: string, status: string, error: string | null) =>
    rpc<boolean>('whatsapp_status', { p_wa_id: waId, p_status: status, p_error: error }),
};
