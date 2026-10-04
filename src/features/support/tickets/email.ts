import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { fmt, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';
import type { TicketCategory, TicketSource } from './config';

/**
 * The support tickets' emails — pure (sent by server/notify.ts), everything a person typed escaped:
 * the customer's when the team answers (the answer itself; an account gets a button to the ticket in
 * the app, a visitor answers by email), and the team's when a ticket opens or its customer answers (the
 * subject and a link to the console — never the conversation).
 */

export function customerReplyEmail(o: {
  locale: UiLocale;
  brand: string;
  number: number;
  subject: string;
  /** the team's answer */
  body: string;
  firstName: string | null;
  /** the ticket in the app (an account); null: a visitor, who answers by email */
  ticketUrl: string | null;
  /** the team's address (the Reply-To); empty: replies to the email reach nobody */
  supportEmail: string;
  contactUrl: string;
}): EmailContent {
  const e = dictFor(o.locale).tickets.email;
  const subject = fmt(e.subject, { subject: o.subject, n: o.number });
  const greeting = o.firstName ? fmt(e.greeting, { name: o.firstName }) : e.greetingAnonymous;
  const intro = fmt(e.intro, { brand: o.brand });
  const button = o.ticketUrl
    ? { href: o.ticketUrl, label: e.open }
    : o.supportEmail
      ? { href: `mailto:${o.supportEmail}?subject=${encodeURIComponent(`Re: ${subject}`)}`, label: e.reply }
      : { href: o.contactUrl, label: e.contact };
  const footer = o.ticketUrl
    ? o.supportEmail
      ? e.footerAccount
      : e.footerAccountApp
    : o.supportEmail
      ? e.footerVisitor
      : e.footerContact;
  const body = [
    escapeHtml(greeting),
    `<br>${escapeHtml(intro)}`,
    `<span dir="auto" style="display:block;margin-top:10px;padding:12px 14px;background:#f5f5f4;border-radius:8px;white-space:pre-line">${escapeHtml(o.body)}</span>`,
  ].join('');
  return {
    subject,
    html: emailLayout(o.locale, {
      heading: escapeHtml(o.subject),
      body,
      button,
      footer,
      brand: o.brand,
    }),
    text: [
      greeting,
      '',
      intro,
      '',
      o.body,
      '',
      o.ticketUrl ? `${e.open}: ${o.ticketUrl}` : o.supportEmail ? '' : `${e.contact}: ${o.contactUrl}`,
      footer,
    ]
      .filter((line, i, all) => line !== '' || all[i - 1] !== '')
      .join('\n')
      .trim(),
  };
}

/** To the team (in Hebrew, the team's language): a ticket opened, or its customer answered. */
export function teamTicketEmail(o: {
  kind: 'opened' | 'answered';
  brand: string;
  number: number;
  subject: string;
  category: TicketCategory;
  source: TicketSource;
  /** the customer's first name (null: none given) */
  firstName: string | null;
  /** a site visitor without an account */
  visitor: boolean;
  consoleUrl: string;
}): EmailContent {
  const d = dictFor('he').tickets;
  const e = d.teamEmail;
  const subject = fmt(o.kind === 'opened' ? e.subjectOpened : e.subjectAnswered, {
    brand: o.brand,
    n: o.number,
    subject: o.subject,
  });
  const who = [o.firstName, o.visitor ? e.visitor : null].filter(Boolean).join(' · ') || '—';
  const rows: [string, string][] = [
    [e.subject, o.subject],
    [e.category, d.categories[o.category]],
    [e.source, e.sources[o.source]],
    [e.customer, who],
  ];
  const heading = `${o.kind === 'opened' ? e.headingOpened : e.headingAnswered} · #${o.number}`;
  return {
    subject,
    html: emailLayout('he', {
      heading: escapeHtml(heading),
      body: `<table role="presentation" cellpadding="0" cellspacing="0">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 0;padding-left:16px;color:#78716c;vertical-align:top">${escapeHtml(k)}</td><td dir="auto" style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`,
      button: { href: o.consoleUrl, label: e.open },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [
      heading,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      `${e.open}: ${o.consoleUrl}`,
      '',
      e.footer,
    ].join('\n'),
  };
}
