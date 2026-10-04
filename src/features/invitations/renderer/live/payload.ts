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
  /** the page chrome in this locale: the language menu's name, the music button's */
  labels: { menu: string; play: string; pause: string };
}

/**
 * What renders the invitation in another locale in the browser: the document, the template and the
 * render options (the same the page renders its own locale with). Large — the document is every
 * language's text — so the public page doesn't carry it: it names where to fetch it (`{ url }`, served
 * as a cached file by server/live-body.ts), and the dev pages put it inline.
 */
export interface LiveBody {
  doc: InvitationDocument;
  template: TemplateManifest;
  options: Omit<RenderOptions, 'mode'>;
}

/**
 * What the live language switch (§2.2 Global) needs on the page: the languages, the invitation's
 * address name, and the per-locale values that only the server computes — a few hundred bytes a
 * language — plus where the rest (LiveBody) comes from.
 */
export interface LivePayload {
  /** the document's languages, in its order */
  languages: Locale[];
  /** the invitation's address name (the guest's chosen language is remembered under it) */
  slug: string;
  locales: Partial<Record<Locale, LiveLocaleEntry>>;
  /** inline (the dev pages), or the address to fetch it from (the public page) */
  body: LiveBody | { url: string };
}
