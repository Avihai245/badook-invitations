import { dictFor, fmt, plural, type UiLocale } from '@/lib/i18n/app';

/**
 * The host's RSVP emails (§4 "sends host notification; daily digest option"): subject, HTML and text,
 * in the invitation's default language. Pure — sent by server/notify.ts. Everything a guest typed is
 * escaped.
 */

export interface ReplySummary {
  name: string;
  attending: boolean;
  adults: number;
  children: number;
  message: string | null;
  /** an edit of an earlier reply (edit link) */
  replaced?: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One line per reply: "דנה לוי — מגיעים · 3 אורחים". */
function replyLine(locale: UiLocale, r: ReplySummary): string {
  const e = dictFor(locale).email;
  return r.attending
    ? `${r.name} — ${e.attending} · ${plural(locale, e.guests, r.adults + r.children)}`
    : `${r.name} — ${e.declined}`;
}

function layout(
  locale: UiLocale,
  {
    heading,
    body,
    button,
    footer,
    brand,
  }: {
    heading: string;
    body: string;
    button: { href: string; label: string };
    footer: string;
    brand: string;
  },
): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const align = locale === 'he' ? 'right' : 'left';
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:24px;text-align:${align}" dir="${dir}">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">${heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding-top:20px"><a href="${escape(button.href)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${escape(button.label)}</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#78716c">${escape(footer)}<br>${escape(brand)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function replyEmail(opts: {
  locale: UiLocale;
  title: string;
  reply: ReplySummary;
  dashboardUrl: string;
  brand: string;
}): EmailContent {
  const { locale, title, reply: r, dashboardUrl, brand } = opts;
  const e = dictFor(locale).email;
  const guests = plural(locale, e.guests, r.adults + r.children);
  const subject = r.replaced
    ? fmt(e.subjectUpdated, { name: r.name, status: r.attending ? guests : e.declined })
    : r.attending
      ? fmt(e.subjectYes, { name: r.name, guests })
      : fmt(e.subjectNo, { name: r.name });
  const { common } = dictFor(locale);
  const counts = r.attending
    ? fmt(e.counts, {
        adults: plural(locale, common.adults, r.adults),
        children: plural(locale, common.children, r.children),
      })
    : null;
  const lines = [replyLine(locale, r), counts, r.message ? `${e.message}\n“${r.message}”` : null].filter(
    (l): l is string => !!l,
  );
  const body = [
    `<strong>${escape(replyLine(locale, r))}</strong>`,
    counts ? `<span style="color:#57534e">${escape(counts)}</span>` : '',
    r.message
      ? `<span style="color:#57534e">${escape(e.message)}</span><br><span style="display:block;margin-top:4px;padding:8px 12px;background:#f5f5f4;border-radius:8px;white-space:pre-line">${escape(r.message)}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('<br>');
  return {
    subject,
    html: layout(locale, {
      heading: escape(title),
      body,
      button: { href: dashboardUrl, label: e.open },
      footer: e.footerEach,
      brand,
    }),
    text: [title, '', ...lines, '', `${e.open}: ${dashboardUrl}`, '', e.footerEach].join('\n'),
  };
}

export function digestEmail(opts: {
  locale: UiLocale;
  title: string;
  replies: readonly ReplySummary[];
  dashboardUrl: string;
  brand: string;
}): EmailContent {
  const { locale, title, replies, dashboardUrl, brand } = opts;
  const e = dictFor(locale).email;
  const subject = plural(locale, e.digestSubject, replies.length, { title });
  const lines = replies.map((r) => replyLine(locale, r));
  return {
    subject,
    html: layout(locale, {
      heading: escape(title),
      body: `${escape(e.digestIntro)}<ul style="padding-${locale === 'he' ? 'right' : 'left'}:20px;margin:8px 0 0">${lines
        .map((l) => `<li style="margin:4px 0">${escape(l)}</li>`)
        .join('')}</ul>`,
      button: { href: dashboardUrl, label: e.open },
      footer: e.footerDigest,
      brand,
    }),
    text: [
      title,
      '',
      e.digestIntro,
      ...lines.map((l) => `• ${l}`),
      '',
      `${e.open}: ${dashboardUrl}`,
      '',
      e.footerDigest,
    ].join('\n'),
  };
}
