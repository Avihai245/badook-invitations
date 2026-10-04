import { fmt, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';
import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { shekels } from './budget';
import { formatDate } from '@/features/invitations/lib/dates';

/**
 * The weekly planning email: the tasks and payments of the coming week and what is overdue, in the host's
 * language. Pure — sent by server/reminders.ts. Everything the host typed is escaped.
 */

export interface ReminderTask {
  title: string;
  /** YYYY-MM-DD */
  due: string;
  overdue: boolean;
}
export interface ReminderPayment {
  label: string;
  item: string;
  amount: number;
  due: string;
  overdue: boolean;
}

export function planReminderEmail(opts: {
  locale: UiLocale;
  title: string;
  tasks: readonly ReminderTask[];
  payments: readonly ReminderPayment[];
  url: string;
  brand: string;
}): EmailContent {
  const { locale, title, tasks, payments, url, brand } = opts;
  const E = dictFor(locale).planning.email;
  const day = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'short' });
  const taskLines = tasks.map(
    (t) => `${t.title} — ${t.overdue ? E.overdue : fmt(E.due, { date: day(t.due) })}`,
  );
  const paymentLines = payments.map(
    (p) =>
      `${p.label}${p.item ? ` (${p.item})` : ''}: ${shekels(p.amount, locale)} — ${p.overdue ? E.overdue : fmt(E.due, { date: day(p.due) })}`,
  );
  const side = locale === 'he' ? 'right' : 'left';
  const list = (heading: string, lines: string[]) =>
    lines.length
      ? `<p style="margin:16px 0 4px;font-weight:700">${escapeHtml(heading)}</p><ul style="padding-${side}:20px;margin:0">${lines
          .map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`)
          .join('')}</ul>`
      : '';
  return {
    subject: fmt(E.subject, { title }),
    html: emailLayout(locale, {
      heading: escapeHtml(E.heading),
      body: `${escapeHtml(E.intro)}${list(E.tasks, taskLines)}${list(E.payments, paymentLines)}`,
      button: { href: url, label: E.open },
      footer: E.footer,
      brand,
    }),
    text: [
      title,
      '',
      E.intro,
      ...(taskLines.length ? ['', E.tasks, ...taskLines.map((l) => `• ${l}`)] : []),
      ...(paymentLines.length ? ['', E.payments, ...paymentLines.map((l) => `• ${l}`)] : []),
      '',
      `${E.open}: ${url}`,
      '',
      E.footer,
    ].join('\n'),
  };
}
