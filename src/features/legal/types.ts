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

/**
 * What the policies say about who runs the service (INVITES_LEGAL_* and the accessibility
 * coordinator, set in the deployment); blank details are simply left out of the text.
 */
export interface LegalContext {
  locale: UiLocale;
  brand: string;
  site: string;
  operator: { name: string; id: string; address: string; phone: string; email: string };
  a11y: { name: string; phone: string; email: string };
  prices: { pro: number; business: number };
  /** the date the policies were last revised, as the page shows it */
  updated: string;
}
