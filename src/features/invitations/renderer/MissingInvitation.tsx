import type { CSSProperties, ReactNode } from 'react';
import { dirOf, type Locale } from '../contracts/types';
import { fontFaceCss, scriptFamily, type FaceRequest } from '../fonts';
import { t } from '../i18n/dictionary';
import { LOCALE_INFO, scriptsOf, type Script } from '../lib/locales';

/** The page's own two families (no template to take them from) — and their faces in other scripts. */
const DISPLAY = 'Frank Ruhl Libre';
const BODY = 'Assistant';
const SUBSETS: Record<Script, string[]> = {
  latin: ['latin', 'latin-ext'],
  hebrew: ['hebrew'],
  cyrillic: ['cyrillic', 'cyrillic-ext'],
  arabic: ['arabic'],
  ethiopic: ['ethiopic'],
};

/** The languages the page speaks: the link's own first, then Hebrew and English. */
const languagesOf = (locale: Locale): Locale[] => [...new Set<Locale>([locale, 'he', 'en'])];

function fontsFor(locales: readonly Locale[]) {
  const scripts = scriptsOf(locales).filter((s) => s !== 'latin' && s !== 'hebrew');
  const faces: FaceRequest[] = [DISPLAY, BODY].map((family) => ({
    family,
    subsets: ['hebrew', 'latin', 'latin-ext'],
  }));
  const extra = (family: string, role: 'display' | 'body') =>
    scripts.map((s) => scriptFamily(family, role, s)).filter((f): f is string => !!f);
  for (const s of scripts)
    for (const [family, role] of [
      [DISPLAY, 'display'],
      [BODY, 'body'],
    ] as const) {
      const f = scriptFamily(family, role, s);
      if (f) faces.push({ family: f, subsets: SUBSETS[s] });
    }
  const stack = (families: string[], generic: string) =>
    [...new Set(families)].map((f) => `'${f}'`).join(', ') + `, ${generic}`;
  return {
    css: fontFaceCss(faces),
    vars: {
      '--f-display': stack([DISPLAY, ...extra(DISPLAY, 'display')], 'Georgia, serif'),
      '--f-body': stack([BODY, ...extra(BODY, 'body')], 'system-ui, sans-serif'),
    } as CSSProperties,
  };
}

/**
 * The document of an invitation link that has nothing to show — unknown slug, not published yet or
 * archived. No template to theme it with, so it has its own quiet paper look (invitation.css §8), in
 * the link's language (its ?lang=, Hebrew otherwise) and then in Hebrew and English.
 */
export function MissingInvitationHtml({
  locale,
  brand,
  children,
}: {
  locale: Locale;
  brand: string;
  children?: ReactNode;
}) {
  const { css, vars } = fontsFor(languagesOf(locale));
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme="light" className="inv-missing" style={vars}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <MissingInvitation locale={locale} brand={brand} />
        {children}
      </body>
    </html>
  );
}

/** What a guest sees on such a link (a 404): each language with its own heading, the link's first. */
export function MissingInvitation({ locale, brand }: { locale: Locale; brand: string }) {
  const [first, ...rest] = languagesOf(locale);
  return (
    <main className="missing">
      <div className="missing-card">
        <svg className="missing-art" viewBox="0 0 64 64" aria-hidden focusable="false">
          <rect x="8" y="17" width="48" height="33" rx="4" />
          <path d="M9.5 19.5 32 36l22.5-16.5" />
          <path d="M9.5 48.5 26 32m12 0 16.5 16.5" />
          <circle cx="32" cy="36" r="5.5" className="missing-seal" />
        </svg>
        {[first!, ...rest].map((l, i) => (
          <section
            key={l}
            lang={l}
            dir={dirOf(l)}
            className={i === 0 ? 'missing-lang missing-first' : 'missing-lang'}
            data-script={LOCALE_INFO[l].script}
          >
            {i > 0 ? (
              <div className="missing-rule" aria-hidden>
                <span />✦<span />
              </div>
            ) : null}
            {i === 0 ? <h1>{t(l, 'missing.title')}</h1> : <h2>{t(l, 'missing.title')}</h2>}
            <p>{t(l, 'missing.body')}</p>
          </section>
        ))}
      </div>
      <p className="missing-brand" dir="ltr">
        {brand}
      </p>
    </main>
  );
}
