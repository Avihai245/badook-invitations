/**
 * Adding and removing an invitation language (Languages panel, §7.4).
 *
 * Adding: every text that still reads exactly like the template's copy in the existing languages gets
 * the template's copy in the new language; everything the host wrote (names, venues, rewritten texts)
 * is left missing — the editor's missing-translation dots show what to translate before publishing.
 * Removing drops that language from every text.
 */
import { l10nFields } from '../contracts/validate';
import type {
  InvitationDocument,
  L10n,
  Locale,
  TemplateDefaults,
  TemplateManifest,
} from '../contracts/types';
import { seedDocument } from '../templates/seed-document';
import { wizardInputOf } from './catalog';
import { removeAt, setAt } from './paths';

/** "<section id>|<path inside the section>" for section texts, the plain path for document-level ones. */
function keyOf(path: string, doc: InvitationDocument): string {
  const m = /^sections\.(\d+)\.(.+)$/.exec(path);
  if (!m) return path;
  const section = doc.sections[Number(m[1])];
  return `${section?.id ?? m[1]}|${m[2]}`;
}

export function addLocale(
  doc: InvitationDocument,
  locale: Locale,
  template: TemplateManifest,
  defaults: TemplateDefaults,
): InvitationDocument {
  if (doc.locales.includes(locale)) return doc;
  const locales = [...doc.locales, locale];
  const seed = seedDocument(template, defaults, { ...wizardInputOf(doc), locales });
  const seeded = new Map<string, L10n | null>();
  for (const f of l10nFields(seed)) seeded.set(keyOf(f.path, seed), f.value);

  let next: InvitationDocument = { ...doc, locales };
  for (const f of l10nFields(doc)) {
    if (!f.value) continue;
    const copy = seeded.get(keyOf(f.path, doc));
    const text = copy?.[locale];
    if (!copy || !text) continue;
    const unchanged = doc.locales.every((l) => (f.value?.[l] ?? '') === (copy[l] ?? ''));
    if (unchanged) next = setAt(next, `${f.path}.${locale}`, text);
  }
  return next;
}

export function removeLocale(doc: InvitationDocument, locale: Locale): InvitationDocument {
  if (!doc.locales.includes(locale) || doc.locales.length === 1) return doc;
  const locales = doc.locales.filter((l) => l !== locale);
  let next: InvitationDocument = {
    ...doc,
    locales,
    defaultLocale: doc.defaultLocale === locale ? locales[0]! : doc.defaultLocale,
  };
  for (const f of l10nFields(doc)) {
    if (f.value && locale in f.value) next = removeAt(next, `${f.path}.${locale}`);
  }
  return next;
}
