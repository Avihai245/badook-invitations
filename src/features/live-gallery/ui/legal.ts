import { PRIVACY_REQUEST_PATH, reportHref } from '@/features/legal/versions';

/**
 * Version 2 of the legal documents on the guests' pages (pure helpers, no server imports): which of the
 * links carry the page's language, and what a device remembers of the notice it acknowledged. The legal
 * pages exist in Hebrew and English only and follow the visitor's own language, so the others get no
 * language hint.
 */

/** The language hint a legal link may carry: the page's own when it is one the legal pages speak. */
export const legalLang = (locale: string): 'he' | 'en' | undefined =>
  locale === 'he' || locale === 'en' ? locale : undefined;

/** A legal page of the site (/gallery-rules, /privacy…), with the language hint. */
export function legalPage(path: string, locale: string): string {
  const lang = legalLang(locale);
  return lang ? `${path}?lang=${lang}` : path;
}

/** The report form, pointing at a gallery (or an album) and, when it is one, at an item. */
export function reportLink(p: { gallery?: string; album?: string; item?: string }, locale: string): string {
  return reportHref({ ...p, lang: legalLang(locale) });
}

/** The privacy request form, optionally of a kind ('biometric_exclusion'). */
export function privacyRequestLink(locale: string, kind?: string): string {
  const q = new URLSearchParams();
  if (kind) q.set('kind', kind);
  const lang = legalLang(locale);
  if (lang) q.set('lang', lang);
  const s = q.toString();
  return s ? `${PRIVACY_REQUEST_PATH}?${s}` : PRIVACY_REQUEST_PATH;
}

/** This device's memory of the notice it acknowledged: one key per rules version and gallery link. */
export const ackKey = (version: string, token: string) => `badook-gallery:ack:${version}:${token}`;

export function readAck(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    // private mode, blocked storage: the notice is shown again on the next visit
    return false;
  }
}

export function writeAck(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // the notice was acknowledged for this visit all the same
  }
}
