/**
 * The legal pages every page of the system links to: the privacy policy, the terms, the cookie policy
 * and the accessibility statement (Israel's accessibility regulations, 2013, reg. 35, ask for the
 * statement to be reachable from every page; the privacy notice goes with it). Their names are
 * t.site.footer[key].
 */
export const LEGAL_PAGES = ['privacy', 'terms', 'cookies', 'accessibility'] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];
