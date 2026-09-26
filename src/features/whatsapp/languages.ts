import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { isLocale } from '@/features/invitations/lib/locales';

/**
 * The languages the WhatsApp template is approved in (Meta approves each language of a template on
 * its own — docs/whatsapp-setup.md) and which one each guest gets. Isomorphic: the sender picks the
 * language per message, the send dialog counts and previews the same way.
 */

/** A language of the approved template: our language and Meta's code for it ("en" or "en_US"…). */
export interface TemplateLanguage {
  locale: Locale;
  code: string;
}

/** The languages when nothing is configured: the Hebrew and English templates of the setup guide. */
export const DEFAULT_TEMPLATE_LANGS = 'he,en';

/**
 * INVITES_WHATSAPP_TEMPLATE_LANGS ("he,en,ru,ar" — Meta's codes, e.g. "en_US", "es_ES") → the
 * languages, in order, each once; codes that aren't an invitation language are left out. Without it,
 * the older single INVITES_WHATSAPP_TEMPLATE_LANG when set, else Hebrew and English.
 */
export function templateLanguages(list: string | undefined, single?: string): TemplateLanguage[] {
  const raw = list?.trim() || single?.trim() || DEFAULT_TEMPLATE_LANGS;
  const out: TemplateLanguage[] = [];
  for (const entry of raw.split(/[\s,;]+/)) {
    const code = entry.trim();
    const locale = code.slice(0, 2).toLowerCase();
    if (!code || !isLocale(locale) || out.some((l) => l.locale === locale)) continue;
    out.push({ locale, code });
  }
  return out.length ? out : [{ locale: 'he', code: 'he' }];
}

/** The language a guest reads the invitation in: theirs when the invitation has it, else its default. */
export function guestLocale(
  language: string | null | undefined,
  doc: Pick<InvitationDocument, 'locales' | 'defaultLocale'>,
): Locale {
  return language && isLocale(language) && doc.locales.includes(language) ? language : doc.defaultLocale;
}

/**
 * The template languages to try for a guest, best first: their own language, the invitation's
 * default, its other languages — those with an approved template — and at the end the first approved
 * one (an invitation in none of them gets that). The sender moves to the next when Meta says the
 * template doesn't exist in a language (132001).
 */
export function templateChain(
  language: string | null | undefined,
  doc: Pick<InvitationDocument, 'locales' | 'defaultLocale'>,
  langs: readonly TemplateLanguage[],
): TemplateLanguage[] {
  const wanted = [guestLocale(language, doc), doc.defaultLocale, ...doc.locales];
  const chain: TemplateLanguage[] = [];
  for (const l of wanted) {
    const found = langs.find((t) => t.locale === l);
    if (found && !chain.includes(found)) chain.push(found);
  }
  if (!chain.length && langs[0]) chain.push(langs[0]);
  return chain;
}

/** The invitation language the template's values (the hosts' names) are written in for a template language. */
export const valuesLocale = (
  template: Locale,
  doc: Pick<InvitationDocument, 'locales' | 'defaultLocale'>,
): Locale => (doc.locales.includes(template) ? template : doc.defaultLocale);
