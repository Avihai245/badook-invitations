import type { InvitationDocument, Locale, TemplateManifest } from '../../contracts/types';
import type { RenderOptions } from '../context-core';

/** One locale of a bilingual invitation, prepared on the server. */
export interface LiveLocaleEntry {
  /** the Hebrew date line, formatted on the server (hebcal stays out of the browser) */
  hebrewDate: string | null;
  /** themeVars(template, doc, locale): the font stacks differ per locale */
  vars: Record<string, string>;
  /** document.title */
  title: string;
  /** the address shown once this locale is on screen (history.replaceState) */
  url: string;
  /** the language pill's plain link to this locale (before hydration, open in a new tab) */
  href: string;
  /** the page chrome in this locale */
  labels: { switch: string; play: string; pause: string };
}

/**
 * What the live language switch needs to render the invitation in another locale in the browser
 * (§2.2 Global): the document, the template and the render options, plus the per-locale values that
 * only the server computes.
 */
export interface LivePayload {
  doc: InvitationDocument;
  template: TemplateManifest;
  options: Omit<RenderOptions, 'mode'>;
  locales: Partial<Record<Locale, LiveLocaleEntry>>;
}
