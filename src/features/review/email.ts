import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { fmt, plural, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';

/**
 * The host's email about new comments on the review link: the comments and the family's replies since
 * the last one, in the invitation's language (like the RSVP emails). Pure; everything the family typed
 * is escaped.
 */
export function reviewEmail(opts: {
  locale: UiLocale;
  title: string;
  comments: readonly { number: number; name: string; body: string; reply: boolean }[];
  editorUrl: string;
  brand: string;
}): EmailContent {
  const { locale, title, comments, editorUrl, brand } = opts;
  const e = dictFor(locale).studio.review.email;
  const intro = plural(locale, e.intro, comments.length);
  const line = (c: (typeof comments)[number]) =>
    `#${c.number} · ${c.name}${c.reply ? ` (${fmt(e.replyTo, { n: c.number })})` : ''}`;
  const side = locale === 'he' ? 'right' : 'left';
  const body = `${escapeHtml(intro)}<ul style="padding-${side}:20px;margin:8px 0 0">${comments
    .map(
      (c) =>
        `<li style="margin:8px 0"><strong>${escapeHtml(line(c))}</strong><br><span style="white-space:pre-line;color:#57534e">${escapeHtml(c.body)}</span></li>`,
    )
    .join('')}</ul>`;
  return {
    subject: fmt(e.subject, { title }),
    html: emailLayout(locale, {
      heading: escapeHtml(title),
      body,
      button: { href: editorUrl, label: e.open },
      footer: e.footer,
      brand,
    }),
    text: [
      title,
      '',
      intro,
      ...comments.map((c) => `• ${line(c)}\n  ${c.body}`),
      '',
      `${e.open}: ${editorUrl}`,
      '',
      e.footer,
    ].join('\n'),
  };
}
