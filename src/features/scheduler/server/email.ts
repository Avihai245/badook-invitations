import 'server-only';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { hostLanguageOf } from '@/features/invitations/lib/locales';
import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { hostsLine } from '@/features/invitations/lib/text';
import { fmt } from '@/lib/i18n/app';
import { zoneCity } from '../time';
import type { ScheduledSend, SendKind } from '../types';
import type { ScheduleDb } from './db';

/**
 * "Your scheduled send didn't go out" (features/scheduler): the host of a scheduled send that failed
 * gets one email — what it was, when it was for (on the clock of the time zone they picked, and the
 * time zone named), why, and what to do: buy credits, turn the album back on, or simply send it again
 * from its dialog. In the invitation's host language (Hebrew, else English). Plain functions over
 * injected dependencies (tests/unit/scheduler.test.ts).
 */

const TEXT = {
  he: {
    subject: 'השליחה המתוזמנת לא יצאה — {names}',
    heading: 'השליחה המתוזמנת לא יצאה',
    body: '{what} שתוזמן ל־{when} (לפי שעון {city}) לא נשלח לאורחים: {reason}.',
    what: { gallery_link: 'הקישור לגלריה', album_thanks: 'התודה עם האלבום' } as Record<SendKind, string>,
    reasons: {
      credits: 'לא היו מספיק קרדיטים (היה צריך {needed}, היו {balance})',
      not_configured: 'השליחה מהמספר הרשמי לא הייתה זמינה באותו רגע',
      feature_off: 'האפשרות לא כלולה בחבילה של האירוע',
      no_gallery: 'הגלריה הייתה כבויה',
      no_album: 'האלבום היה כבוי',
      timeout: 'השליחה לא הושלמה',
      other: 'משהו השתבש',
    },
    fix: {
      credits: 'אפשר לרכוש קרדיטים ואז לשלוח מהדיאלוג — מיד, או בתזמון חדש.',
      no_gallery: 'אפשר להפעיל את הגלריה ואז לשלוח מהדיאלוג — מיד, או בתזמון חדש.',
      no_album: 'אפשר להפעיל את האלבום ואז לשלוח מהדיאלוג — מיד, או בתזמון חדש.',
      other: 'אפשר לשלוח מהדיאלוג — מיד, או בתזמון חדש. האורחים לא קיבלו הודעה, ולא ירדו קרדיטים.',
    },
    open: 'לשליחה מחדש',
    credits: 'לרכישת קרדיטים',
    footer: 'קיבלתם את המייל הזה כי תזמנתם שליחה לאורחים ב־{brand}.',
  },
  en: {
    subject: '{names} — your scheduled send didn’t go out',
    heading: 'Your scheduled send didn’t go out',
    body: '{what} scheduled for {when} ({city} time) wasn’t sent to your guests: {reason}.',
    what: { gallery_link: 'The gallery link', album_thanks: 'The thank-you with the album' } as Record<
      SendKind,
      string
    >,
    reasons: {
      credits: 'there weren’t enough credits ({needed} needed, {balance} left)',
      not_configured: 'sending from the official number wasn’t available at that moment',
      feature_off: 'it isn’t in the event’s plan',
      no_gallery: 'the gallery was off',
      no_album: 'the album was off',
      timeout: 'the send didn’t finish',
      other: 'something went wrong',
    },
    fix: {
      credits: 'Buy credits, then send it from its dialog — now, or schedule it again.',
      no_gallery: 'Turn the gallery on, then send it from its dialog — now, or schedule it again.',
      no_album: 'Turn the album on, then send it from its dialog — now, or schedule it again.',
      other:
        'Send it from its dialog — now, or schedule it again. No guest got a message and no credits were used.',
    },
    open: 'Send it again',
    credits: 'Buy credits',
    footer: 'You got this email because you scheduled a send to your guests with {brand}.',
  },
} as const;

type Reason = keyof (typeof TEXT)['he']['reasons'];
const reasonOf = (error: string | null): Reason =>
  error && error in TEXT.he.reasons ? (error as Reason) : 'other';

/** The email for a failed send. */
export function failedEmail(opts: {
  send: Pick<ScheduledSend, 'kind' | 'runAt' | 'timeZone' | 'error' | 'result'>;
  doc: InvitationDocument;
  /** the dialog's page (the invitation's gallery tab) */
  sendUrl: string;
  billingUrl: string;
  brand: string;
}): EmailContent {
  const locale = hostLanguageOf(opts.doc);
  const t = TEXT[locale];
  const names = hostsLine(opts.doc.hosts, locale) || hostsLine(opts.doc.hosts, opts.doc.defaultLocale);
  const reason = reasonOf(opts.send.error);
  const when = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    timeZone: opts.send.timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(opts.send.runAt));
  const result = opts.send.result ?? {};
  const body = fmt(t.body, {
    what: t.what[opts.send.kind],
    when,
    city: zoneCity(opts.send.timeZone),
    reason: fmt(t.reasons[reason], {
      needed: String(result.needed ?? '?'),
      balance: String(result.balance ?? 0),
    }),
  });
  const fix =
    reason === 'credits' || reason === 'no_gallery' || reason === 'no_album' ? t.fix[reason] : t.fix.other;
  const billing =
    reason === 'credits'
      ? `<br><br><a href="${escapeHtml(opts.billingUrl)}" style="color:#1c1917">${escapeHtml(t.credits)}</a>`
      : '';
  return {
    subject: fmt(t.subject, { names }),
    html: emailLayout(locale, {
      heading: escapeHtml(t.heading),
      body: `${escapeHtml(body)}<br><br>${escapeHtml(fix)}${billing}`,
      button: { href: opts.sendUrl, label: t.open },
      footer: escapeHtml(fmt(t.footer, { brand: opts.brand })),
      brand: opts.brand,
    }),
    text: [
      t.heading,
      '',
      body,
      '',
      fix,
      '',
      `${t.open}: ${opts.sendUrl}`,
      ...(reason === 'credits' ? [`${t.credits}: ${opts.billingUrl}`] : []),
    ].join('\n'),
  };
}

/** A failed send as scheduled_send_failures gives it: with the owner's address and the invitation. */
export type FailedSend = ScheduledSend & { ownerEmail: string | null; slug: string; document: unknown };

export interface FailureMailDeps {
  db: Pick<ScheduleDb, 'failures' | 'failureMailed'>;
  send(email: { to: string } & EmailContent): Promise<boolean>;
  base: string;
  brand: string;
}

/**
 * Tells the hosts whose scheduled send failed (once each; an email that couldn't go is tried again on
 * the next turn). Never throws.
 */
export async function mailFailedSends(deps: FailureMailDeps, limit = 20): Promise<{ mailed: number }> {
  const out = { mailed: 0 };
  let failed: FailedSend[];
  try {
    failed = await deps.db.failures(limit);
  } catch (err) {
    console.error('[scheduler] failed sends', err);
    return out;
  }
  for (const f of failed) {
    try {
      const parsed = safeMigrateDocument(f.document);
      // nobody to write to, or nothing to write about: marked so it isn't looked at again
      if (!f.ownerEmail || !parsed.success) {
        await deps.db.failureMailed(f.id);
        continue;
      }
      const email = failedEmail({
        send: f,
        doc: parsed.data,
        sendUrl: `${deps.base}/app/invitations/${f.invitationId}/gallery`,
        billingUrl: `${deps.base}/app/billing`,
        brand: deps.brand,
      });
      if (await deps.send({ to: f.ownerEmail, ...email })) {
        await deps.db.failureMailed(f.id);
        out.mailed++;
      }
    } catch (err) {
      console.error('[scheduler] failure email', f.id, err);
    }
  }
  return out;
}
