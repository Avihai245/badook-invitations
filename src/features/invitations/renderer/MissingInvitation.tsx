import type { ReactNode } from 'react';
import type { Locale } from '../contracts/types';
import { fontFaceCss } from '../fonts';

const FAMILIES = ['Frank Ruhl Libre', 'Assistant'];

/**
 * The document of an invitation link that has nothing to show — unknown slug, not published yet or
 * archived. No template to theme it with, so it has its own quiet paper look (invitation.css §8).
 * `locale` only orders the two languages (the link's ?lang=, Hebrew first otherwise).
 */
export function MissingInvitationHtml({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} data-theme="light" className="inv-missing">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss(FAMILIES) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * What a guest sees on such a link (a 404), in both languages — each with its own heading; the
 * link's language comes first (CSS order on :root[lang]).
 */
export function MissingInvitation({ brand }: { brand: string }) {
  return (
    <main className="missing">
      <div className="missing-card">
        <svg className="missing-art" viewBox="0 0 64 64" aria-hidden focusable="false">
          <rect x="8" y="17" width="48" height="33" rx="4" />
          <path d="M9.5 19.5 32 36l22.5-16.5" />
          <path d="M9.5 48.5 26 32m12 0 16.5 16.5" />
          <circle cx="32" cy="36" r="5.5" className="missing-seal" />
        </svg>
        <section lang="he" dir="rtl" className="missing-he">
          <h1>ההזמנה לא זמינה כרגע</h1>
          <p>
            ייתכן שהיא עוד לא פורסמה, או שהקישור לא מלא. כדאי לבדוק את הקישור מול מי ששלח אותו, או לנסות שוב
            מאוחר יותר.
          </p>
        </section>
        <div className="missing-rule" aria-hidden>
          <span />✦<span />
        </div>
        <section lang="en" dir="ltr" className="missing-en">
          <h1>This invitation isn&rsquo;t available right now</h1>
          <p>
            It may not be published yet, or the link may be incomplete. Check the link with whoever sent it,
            or try again later.
          </p>
        </section>
      </div>
      <p className="missing-brand" dir="ltr">
        {brand}
      </p>
    </main>
  );
}
