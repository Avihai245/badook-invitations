import 'server-only';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import { missingTemplate, type SendResult, type TemplateSend } from '@/features/whatsapp/cloud-api';
import type { TemplateLanguage } from '@/features/whatsapp/languages';
import type { ScheduledSend } from '../types';
import type { ScheduleDb } from './db';
import { failureParts } from './email';

/**
 * "Your scheduled send didn't go out" on WhatsApp (features/scheduler): besides the email, the host
 * gets the host alert template (docs/whatsapp-setup.md §14) from the system's number, on the phone of
 * their account — the same words as the email: what it was, when it was for on the clock they picked,
 * why — with a button to the invitation's gallery tab, where its dialog sends it again. In their
 * language when the template is approved in it, else the next approved one. Once per send; nothing for
 * a host without a phone, with a landline or who asked not to get WhatsApp messages (recorded as
 * skipped); a send WhatsApp couldn't take now is tried again on the next turn. No credit: it is the
 * system's own message. Plain functions over injected dependencies (tests/unit/scheduler.test.ts).
 */

/** A failed send as scheduled_send_failure_alerts gives it. */
export type AlertSend = ScheduledSend & {
  ownerPhone: string | null;
  reach: 'ok' | 'none' | 'landline' | 'opted_out';
  document: unknown;
};

export interface FailureAlertDeps {
  db: Pick<ScheduleDb, 'failureAlerts' | 'failureAlerted'>;
  /** the host alert template's name ('' — not approved yet: nothing is sent, nothing recorded) */
  template: string;
  /** the languages the system's templates are approved in */
  languages(): TemplateLanguage[];
  send(m: TemplateSend): Promise<SendResult>;
}

/** The alert in one language: the template, its three values and the button's suffix. */
export function alertMessage(f: AlertSend, template: string, lang: TemplateLanguage): TemplateSend | null {
  const parsed = safeMigrateDocument(f.document);
  if (!parsed.success || !f.ownerPhone) return null;
  const p = failureParts(f, { ...parsed.data, defaultLocale: lang.locale, locales: [lang.locale] });
  const when = lang.locale === 'he' ? `${p.when} (לפי שעון ${p.city})` : `${p.when} (${p.city} time)`;
  return {
    to: f.ownerPhone,
    template,
    lang: lang.code,
    body: [p.what, when, p.why],
    button: `${f.invitationId}/gallery`,
    ref: `alert:${f.id}`,
  };
}

/** The host's language first (Hebrew, else English — like the email), then the other approved ones. */
function chainFor(f: AlertSend, languages: TemplateLanguage[]): TemplateLanguage[] {
  const parsed = safeMigrateDocument(f.document);
  const own = parsed.success ? failureParts(f, parsed.data).locale : 'he';
  const usable = languages.filter((l) => l.locale === 'he' || l.locale === 'en');
  return [...usable.filter((l) => l.locale === own), ...usable.filter((l) => l.locale !== own)];
}

/** Tells the hosts whose scheduled send failed, on WhatsApp. Never throws. */
export async function alertFailedSends(
  deps: FailureAlertDeps,
  limit = 20,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!deps.template) return out;
  let pending: AlertSend[];
  try {
    pending = await deps.db.failureAlerts(limit);
  } catch (err) {
    console.error('[scheduler] failure alerts', err);
    return out;
  }
  for (const f of pending) {
    try {
      const chain = chainFor(f, deps.languages());
      if (f.reach !== 'ok' || !chain.length) {
        await deps.db.failureAlerted(f.id, 'skipped');
        out.skipped++;
        continue;
      }
      let outcome: SendResult | null = null;
      for (const lang of chain) {
        const m = alertMessage(f, deps.template, lang);
        if (!m) break;
        outcome = await deps.send(m);
        // Meta has no such template in this language: the next one
        if (!missingTemplate(outcome)) break;
      }
      if (!outcome) {
        await deps.db.failureAlerted(f.id, 'skipped');
        out.skipped++;
      } else if (outcome.ok) {
        await deps.db.failureAlerted(f.id, 'sent');
        out.sent++;
      } else if (!outcome.retryable) {
        await deps.db.failureAlerted(f.id, 'failed');
        out.failed++;
      }
      // retryable: left for the next turn
    } catch (err) {
      console.error('[scheduler] failure alert', f.id, err);
    }
  }
  return out;
}
