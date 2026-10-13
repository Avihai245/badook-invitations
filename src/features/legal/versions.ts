/**
 * The version of the legal documents that the features of version 2 record and link to. Pure (no server
 * imports) so client components and tests can use it. A change to a document's text is a new version —
 * add it to registry.ts and move these numbers; the evidence already stored keeps the old number.
 */
export const LEGAL_VERSION = '2';

/** The gallery rules' version a guest acknowledges before the first upload (gallery_acknowledgements). */
export const GALLERY_RULES_VERSION = LEGAL_VERSION;

/** The documents a host accepts at sign-up and at checkout (legal_acceptances.doc_key). */
export const SIGNUP_DOCS = ['terms', 'privacy'] as const;
export const CHECKOUT_DOCS = ['terms', 'privacy', 'refunds'] as const;

/** Public routes of the request forms (version 2). */
export const REPORT_PATH = '/report';
export const PRIVACY_REQUEST_PATH = '/privacy-request';

/** The gallery and album links the report form accepts: ?g=<upload token>&i=<item> or ?a=<album token>&i=<item>. */
export function reportHref(p: { gallery?: string; album?: string; item?: string; lang?: string }): string {
  const q = new URLSearchParams();
  if (p.gallery) q.set('g', p.gallery);
  if (p.album) q.set('a', p.album);
  if (p.item) q.set('i', p.item);
  if (p.lang) q.set('lang', p.lang);
  const s = q.toString();
  return s ? `${REPORT_PATH}?${s}` : REPORT_PATH;
}
