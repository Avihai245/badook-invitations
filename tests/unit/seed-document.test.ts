import { describe, expect, it } from 'vitest';
import { InvitationDocumentSchema } from '@/features/invitations/contracts/schemas';
import type { EventType, L10n, Locale } from '@/features/invitations/contracts/types';
import { visibleGlyphCount } from '@/features/invitations/lib/text';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { resolveEventDefaults, seedDocument } from '@/features/invitations/templates/seed-document';

const LOCALE_SETS: { locales: Locale[]; defaultLocale: Locale }[] = [
  { locales: ['he'], defaultLocale: 'he' },
  { locales: ['en'], defaultLocale: 'en' },
  { locales: ['he', 'en'], defaultLocale: 'he' },
];
const hosts = { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } };

const cases = [...TEMPLATES.values()].flatMap(({ manifest }) =>
  manifest.categories.flatMap((eventType) => LOCALE_SETS.map((ls) => [manifest.id, eventType, ls] as const)),
);

/** Every L10n in the document only carries the selected locales. */
function collectL10n(value: unknown, out: L10n[] = []): L10n[] {
  if (Array.isArray(value)) value.forEach((v) => collectL10n(v, out));
  else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length && keys.every((k) => k === 'he' || k === 'en')) out.push(value as L10n);
    else Object.values(value).forEach((v) => collectL10n(v, out));
  }
  return out;
}

describe('seedDocument', () => {
  it.each(cases)('%s / %s / %o seeds a valid, complete document', (id, eventType, ls) => {
    const { manifest, defaults } = TEMPLATES.get(id)!;
    const doc = seedDocument(manifest, defaults, {
      eventType: eventType as EventType,
      ...ls,
      hosts,
      date: '2027-06-17',
      startTime: '19:30',
      endTime: '01:00',
      timezone: 'Asia/Jerusalem',
    });
    expect(InvitationDocumentSchema.safeParse(doc).success).toBe(true);
    expect(doc.sections[0]?.type).toBe('hero');
    expect(doc.sections.at(-1)?.type).toBe('footer');
    expect(doc.sections.filter((s) => s.type === 'rsvp')).toHaveLength(1);
    expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
    for (const l10n of collectL10n(doc)) {
      for (const key of Object.keys(l10n)) expect(ls.locales).toContain(key);
    }
    for (const l of ls.locales) {
      expect(visibleGlyphCount(doc.cover.monogram?.[l] ?? '')).toBeLessThanOrEqual(
        manifest.cover.overlay.text.maxGlyphs,
      );
    }
    if (manifest.cover.overlay.recolor) expect(manifest.cover.sealColors).toContain(doc.cover.sealColor);
    expect(doc.theme.fontPairId).toBe(manifest.fontPairs[0]!.id);
  });

  it('builds couple monograms per script (נ&א / N&I)', () => {
    const { manifest, defaults } = TEMPLATES.get('sahar-bordeaux')!;
    const doc = seedDocument(manifest, defaults, {
      eventType: 'wedding',
      locales: ['he', 'en'],
      defaultLocale: 'he',
      hosts,
      date: '2027-06-17',
      startTime: '19:30',
      timezone: 'Asia/Jerusalem',
    });
    expect(doc.cover.monogram).toEqual({ he: 'נ&א', en: 'N&I' });
    expect(doc.hosts.joiner).toEqual({ he: '&', en: '&' });
    expect(doc.share.slug).toBe('noa-and-itay');
    expect(doc.event.rsvpDeadline).toBe('2027-06-03');
  });

  it('puts an initial on seals and the name on tickets for a single host', () => {
    const single = { primary: { he: 'יונתן', en: 'Jonathan' } };
    const base = {
      locales: ['he', 'en'] as Locale[],
      defaultLocale: 'he' as const,
      date: '2027-06-17',
      startTime: '19:00',
      timezone: 'Asia/Jerusalem',
    };
    const atara = TEMPLATES.get('atara')!;
    expect(
      seedDocument(atara.manifest, atara.defaults, { ...base, eventType: 'bar_mitzvah', hosts: single }).cover
        .monogram,
    ).toEqual({ he: 'י', en: 'J' });
    const rooftop = TEMPLATES.get('rooftop-dusk')!;
    expect(
      seedDocument(rooftop.manifest, rooftop.defaults, { ...base, eventType: 'birthday', hosts: single })
        .cover.monogram,
    ).toEqual({ he: 'יונתן', en: 'JONATHAN' });
  });

  it('falls back to the closest event type and flags it', () => {
    const { defaults } = TEMPLATES.get('nitzan')!;
    const resolved = resolveEventDefaults(defaults, 'baby_shower');
    expect(resolved).toMatchObject({ eventType: 'brit', exact: false });
    expect(resolveEventDefaults(defaults, 'brit').exact).toBe(true);
  });
});
