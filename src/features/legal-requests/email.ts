import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { fmt, intlLocale, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';
import type { ReportCategory, ReportResolution, RequestKind, RequestStatus } from './config';

/**
 * The emails of the report and privacy-request flows — pure (sent by server/notify.ts). Fixed texts:
 * the team's carry a number, a category and a link to the console and nothing a person typed; the
 * gallery host's say that an item was reported (the category) and never by whom; the reporter's and
 * the requester's are one template per outcome, and a staff member's note reaches the requester only
 * when the staff ticked "include the note" (the reporter never gets it). Everything typed is escaped.
 */

const lines = (rows: readonly (string | false | null | undefined)[]) => rows.filter((r): r is string => !!r);

function day(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));
}

const table = (rows: readonly (readonly [string, string])[]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 0;padding-left:16px;color:#78716c;vertical-align:top">${escapeHtml(k)}</td><td dir="auto" style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join('')}</table>`;

const paragraphs = (ps: readonly string[]) => ps.map((p) => escapeHtml(p)).join('<br><br>');

/** To the team (in Hebrew, the team's language): a report arrived. No word of what the reporter wrote. */
export function teamReportEmail(o: {
  brand: string;
  number: number;
  category: ReportCategory;
  urgent: boolean;
  hidden: boolean;
  consoleUrl: string;
}): EmailContent {
  const d = dictFor('he').legalRequests;
  const e = d.mail.team.report;
  const category = d.admin.category[o.category];
  const subject = fmt(o.urgent ? e.subjectUrgent : e.subject, { brand: o.brand, n: o.number, category });
  const rows: [string, string][] = [
    [e.number, String(o.number)],
    [e.category, category],
    [e.urgent, o.urgent ? e.urgentYes : e.urgentNo],
  ];
  const note = o.hidden ? e.hidden : null;
  return {
    subject,
    html: emailLayout('he', {
      heading: escapeHtml(`${e.heading} · #${o.number}`),
      body: table(rows) + (note ? `<br>${escapeHtml(note)}` : ''),
      button: { href: o.consoleUrl, label: e.open },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [
      `${e.heading} · #${o.number}`,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...(note ? ['', note] : []),
      '',
      `${e.open}: ${o.consoleUrl}`,
      '',
      e.footer,
    ].join('\n'),
  };
}

/** To the team: a privacy request arrived (the number, the type, the due date and the console link). */
export function teamRequestEmail(o: {
  brand: string;
  number: number;
  kind: RequestKind;
  dueAt: string;
  consoleUrl: string;
}): EmailContent {
  const d = dictFor('he').legalRequests;
  const e = d.mail.team.request;
  const kind = d.admin.kind[o.kind];
  const rows: [string, string][] = [
    [e.number, String(o.number)],
    [e.kind, kind],
    [e.due, day(o.dueAt, 'he')],
  ];
  return {
    subject: fmt(e.subject, { brand: o.brand, n: o.number, kind }),
    html: emailLayout('he', {
      heading: escapeHtml(`${e.heading} · #${o.number}`),
      body: table(rows),
      button: { href: o.consoleUrl, label: e.open },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [
      `${e.heading} · #${o.number}`,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      `${e.open}: ${o.consoleUrl}`,
      '',
      e.footer,
    ].join('\n'),
  };
}

/** To the one who created the invitation: an item in their gallery was reported — the category, never by whom. */
export function hostReportEmail(o: {
  locale: UiLocale;
  brand: string;
  category: ReportCategory;
  hidden: boolean;
  appUrl: string;
}): EmailContent {
  const d = dictFor(o.locale).legalRequests;
  const e = d.mail.host;
  const body = lines([
    fmt(e.body, { category: d.admin.category[o.category] }),
    o.hidden && e.hidden,
    e.review,
    e.anonymous,
  ]);
  return {
    subject: e.subject,
    html: emailLayout(o.locale, {
      heading: escapeHtml(e.heading),
      body: paragraphs(body),
      button: { href: o.appUrl, label: d.mail.button.app },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [e.heading, '', ...body, '', `${d.mail.button.app}: ${o.appUrl}`, '', e.footer].join('\n'),
  };
}

/** Which of the fixed texts a decision on a report gets. */
export type ReportOutcome = 'removed' | 'hidden' | 'kept' | 'notApplicable' | 'closed';

export function reportOutcomeOf(resolution: ReportResolution | null): ReportOutcome {
  switch (resolution) {
    case 'removed':
      return 'removed';
    case 'hidden':
      return 'hidden';
    case 'kept':
      return 'kept';
    case 'not_applicable':
      return 'notApplicable';
    default:
      return 'closed';
  }
}

/** To the reporter, when the report is decided: one fixed text per outcome, in the report's language. */
export function reporterOutcomeEmail(o: {
  locale: UiLocale;
  brand: string;
  number: number;
  outcome: ReportOutcome;
  contactUrl: string;
}): EmailContent {
  const d = dictFor(o.locale).legalRequests;
  const e = d.mail.reporter;
  const heading = fmt(e.heading, { n: o.number });
  const text = e[o.outcome];
  return {
    subject: fmt(e.subject, { n: o.number }),
    html: emailLayout(o.locale, {
      heading: escapeHtml(heading),
      body: escapeHtml(text),
      button: { href: o.contactUrl, label: d.mail.button.contact },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [heading, '', text, '', `${d.mail.button.contact}: ${o.contactUrl}`, '', e.footer].join('\n'),
  };
}

/** To the requester, right after the request is stored: the number and the date the reply is due. */
export function requestAckEmail(o: {
  locale: UiLocale;
  brand: string;
  number: number;
  dueAt: string;
  privacyUrl: string;
}): EmailContent {
  const d = dictFor(o.locale).legalRequests;
  const e = d.mail.ack;
  const heading = fmt(e.heading, { n: o.number });
  const body = [fmt(e.body, { n: o.number }), fmt(e.due, { date: day(o.dueAt, o.locale) }), e.verify];
  return {
    subject: fmt(e.subject, { n: o.number }),
    html: emailLayout(o.locale, {
      heading: escapeHtml(heading),
      body: paragraphs(body),
      button: { href: o.privacyUrl, label: d.mail.button.privacy },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [heading, '', ...body, '', `${d.mail.button.privacy}: ${o.privacyUrl}`, '', e.footer].join('\n'),
  };
}

/** To the requester when the request reaches a final status; the team's note only when `note` is given. */
export function requestStatusEmail(o: {
  locale: UiLocale;
  brand: string;
  number: number;
  status: Extract<RequestStatus, 'fulfilled' | 'partly' | 'declined' | 'closed'>;
  note: string | null;
  contactUrl: string;
}): EmailContent {
  const d = dictFor(o.locale).legalRequests;
  const e = d.mail.status;
  const heading = fmt(e.heading, { n: o.number });
  const text = e[o.status];
  const note = o.note?.trim() || null;
  return {
    subject: fmt(e.subject, { n: o.number }),
    html: emailLayout(o.locale, {
      heading: escapeHtml(heading),
      body:
        escapeHtml(text) +
        (note
          ? `<br><br><span style="color:#57534e">${escapeHtml(e.note)}</span><span dir="auto" style="display:block;margin-top:4px;padding:8px 12px;background:#f5f5f4;border-radius:8px;white-space:pre-line">${escapeHtml(note)}</span>`
          : ''),
      button: { href: o.contactUrl, label: d.mail.button.contact },
      footer: e.footer,
      brand: o.brand,
    }),
    text: [
      heading,
      '',
      text,
      ...(note ? ['', `${e.note}:`, note] : []),
      '',
      `${d.mail.button.contact}: ${o.contactUrl}`,
      '',
      e.footer,
    ].join('\n'),
  };
}
