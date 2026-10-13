import { LEGAL_DOC_KEYS, type LegalDocKey } from './types';

/**
 * The legal pages every page of the system links to: the privacy policy, the terms, the cookie policy
 * and the accessibility statement (Israel's accessibility regulations, 2013, reg. 35, ask for the
 * statement to be reachable from every page; the privacy notice goes with it). Their names are
 * t.site.footer[key]. Version 2 adds the refund policy and the gallery rules (legal/registry.ts).
 */
export const LEGAL_PAGES = ['privacy', 'terms', 'cookies', 'accessibility'] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

/** Pages that exist only once the legal documents' version 2 is active. */
export const LEGAL_PAGES_V2 = ['refunds', 'gallery-rules'] as const;

/** A document's stable public route — it always shows the version in force. */
export function legalHref(key: LegalDocKey): string {
  return `/${key}`;
}

/** An earlier (or the current) version's own permanent route. */
export function legalVersionHref(key: LegalDocKey, version: string): string {
  return `/legal/${key}/${version}`;
}

export function isLegalDocKey(v: string): v is LegalDocKey {
  return (LEGAL_DOC_KEYS as readonly string[]).includes(v);
}
