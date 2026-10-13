import type { UiLocale } from '@/lib/i18n/app';

/** A block of a policy page: a paragraph, a list, or a highlighted note. */
export type LegalBlock = string | { list: readonly string[] } | { note: string };

export interface LegalSection {
  id: string;
  heading: string;
  body: readonly LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** the page's meta description */
  description: string;
  intro: readonly LegalBlock[];
  sections: readonly LegalSection[];
}

/** The six legal documents; each has a stable public route (legal/links.ts). */
export const LEGAL_DOC_KEYS = [
  'terms',
  'privacy',
  'cookies',
  'accessibility',
  'refunds',
  'gallery-rules',
] as const;
export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

/**
 * What the policies say about who runs the service (INVITES_LEGAL_* and the accessibility
 * coordinator, set in the deployment); blank details are simply left out of the text.
 */
export interface LegalContext {
  locale: UiLocale;
  brand: string;
  site: string;
  operator: { name: string; id: string; address: string; phone: string; email: string };
  a11y: {
    name: string;
    phone: string;
    email: string;
    /** the date (as shown) of the last MANUAL review, from the deployment; '' = none is claimed */
    manualReview: string;
  };
  /** where privacy and media requests go (INVITES_PRIVACY_EMAIL, else the support address) */
  privacyEmail: string;
  prices: { pro: number; business: number };
  /** the date the version being shown took effect, as the page shows it */
  updated: string;
  /** the version being shown ("1", "2") */
  version: string;
  /** face search ("the photos I'm in") is offered on this deployment (INVITES_FACE_ALBUMS) */
  faceSearch: boolean;
}
