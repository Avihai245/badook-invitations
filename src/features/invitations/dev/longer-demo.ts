import { LOCALES, type InvitationDocument, type L10n, type Locale } from '../contracts/types';
import { CAPS, l10nFields } from '../contracts/validate';
import { cappedLength } from '../lib/l10n';
import { demoDocument } from '../templates/demo';

/** A demo in every invitation language, Hebrew first — the language switch and the per-language QA. */
export function worldDocument(templateId: string): InvitationDocument {
  return demoDocument(templateId, undefined, [...LOCALES], 'he');
}

/** Names at the length cap in every language (§12.12: 20 characters). */
const LONG_NAMES: { primary: L10n; secondary: L10n } = {
  primary: {
    he: 'אלכסנדרה־מרגריטה לוי',
    en: 'Alexandra-Margaretta',
    ru: 'Александра-Маргарита',
    ar: 'عبد الرحمن أبو الخير',
    fr: 'Anne-Charlotte Dupré',
    es: 'María de los Ángeles',
    am: 'ወለተ ጊዮርጊስ ገብረ ሥላሴ',
  },
  secondary: {
    he: 'בנימין־זאב־יהונתן כץ',
    en: 'Maximilian-Alexander',
    ru: 'Константин-Вячеслав',
    ar: 'محمد نور الدين حداد',
    fr: 'Jean-Baptiste Moreau',
    es: 'José Antonio Álvarez',
    am: 'ገብረ መድኅን ወልደ ማርያም',
  },
};

/**
 * `text` made `factor` times longer (to `cap` characters at most) by repeating its own words — the
 * way a translation runs longer than the Hebrew it comes from.
 */
export function lengthen(text: string, factor: number, cap?: number): string {
  const length = cappedLength(text);
  const target = Math.min(Math.ceil(length * factor), cap ?? Infinity);
  // placeholders ("{primary}") are not repeated: one cut short by the cap would show its braces
  const words = text.split(/\s+/).filter((w) => w && !/[{}]/.test(w));
  if (!words.length || length >= target) return text;
  let out = text;
  for (let i = 0; cappedLength(out) < target; i++) out += ` ${words[i % words.length]}`;
  while (cap !== undefined && cappedLength(out) > cap) out = out.slice(0, -1);
  return out.trimEnd();
}

/**
 * The i18n stress document (e2e/i18n.spec.ts): the demo in every language, names at their cap and
 * every other text 40% longer (within its cap) — every section must hold it on a phone and a desktop
 * without a horizontal scroll or clipped text.
 */
export function longerDocument(templateId: string, factor = 1.4): InvitationDocument {
  // a deep copy without shared objects: each text is lengthened once
  const doc = JSON.parse(JSON.stringify(worldDocument(templateId))) as InvitationDocument;
  const locales: readonly Locale[] = doc.locales;
  doc.hosts.primary = { ...LONG_NAMES.primary };
  if (doc.hosts.secondary) doc.hosts.secondary = { ...LONG_NAMES.secondary };
  for (const f of l10nFields(doc)) {
    const value = f.value;
    if (!value || f.cap === CAPS.hostName) continue;
    // the cover's monogram has the template's own glyph cap, the joiner is a sign
    if (f.field === 'cover.monogram' || f.field === 'hosts.joiner') continue;
    for (const l of locales) {
      const text = value[l];
      if (text) value[l] = lengthen(text, factor, f.cap);
    }
  }
  return doc;
}
