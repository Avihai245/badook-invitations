/**
 * Exports every legal document (version 2, Hebrew and English) to Markdown under docs/legal/review/, for
 * counsel and the owner to read and comment on. The operator's details are NOT taken from the
 * deployment: they are shown as ‹placeholders› so that nothing in a review copy can be mistaken for an
 * approved identity. Run: npm run legal:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGAL_VERSIONS } from '../src/features/legal/registry';
import { LEGAL_DOC_KEYS, type LegalBlock, type LegalContext } from '../src/features/legal/types';

const OUT = 'docs/legal/review';

function context(locale: 'he' | 'en', faceSearch: boolean): LegalContext {
  const ph = (he: string, en: string) => (locale === 'he' ? he : en);
  return {
    locale,
    brand: 'Badook',
    site: 'https://invitations.badooks.com',
    operator: {
      name: ph('‹שם המפעיל — לאימות›', '‹operator name — to be verified›'),
      id: ph('‹ח״פ›', '‹company no.›'),
      address: ph('‹כתובת›', '‹address›'),
      phone: ph('‹טלפון›', '‹phone›'),
      email: '‹support email›',
    },
    a11y: {
      name: ph('‹רכז/ת נגישות›', '‹accessibility coordinator›'),
      phone: '‹phone›',
      email: '‹email›',
      manualReview: '',
    },
    privacyEmail: '‹privacy email›',
    prices: { pro: 49, business: 149 },
    updated: ph('‹תאריך תחילה›', '‹effective date›'),
    version: '2',
    faceSearch,
  };
}

function block(b: LegalBlock): string {
  if (typeof b === 'string') return `${b}\n`;
  if ('list' in b) return b.list.map((i) => `- ${i}`).join('\n') + '\n';
  return `> ${b.note}\n`;
}

mkdirSync(OUT, { recursive: true });
for (const key of LEGAL_DOC_KEYS) {
  const v = LEGAL_VERSIONS[key].find((x) => x.version === '2')!;
  for (const locale of ['he', 'en'] as const) {
    // face search is shown in its "offered" form, the more detailed of the two
    const doc = v.build(context(locale, true));
    const md = [
      `# ${doc.title}`,
      `*${locale === 'he' ? 'גרסה 2 — טיוטה לאישור, לא בתוקף' : 'Version 2 — draft for approval, not in force'}*`,
      '',
      ...doc.intro.map(block),
      ...doc.sections.flatMap((s) => [`## ${s.heading} {#${s.id}}`, '', ...s.body.map(block)]),
    ].join('\n');
    writeFileSync(join(OUT, `${key}.${locale}.md`), md.replace(/\n{3,}/g, '\n\n'));
  }
}
console.log(`wrote ${LEGAL_DOC_KEYS.length * 2} files to ${OUT}`);
