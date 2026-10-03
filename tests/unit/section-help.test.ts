import { describe, expect, it } from 'vitest';
import { SECTION_TYPES } from '@/features/invitations/contracts/types';
import { sectionHelpEn } from '@/lib/i18n/section-help.en';
import { sectionHelpHe } from '@/lib/i18n/section-help.he';

// the text section's kinds (contracts/schemas.ts) — each is its own section for the host
const TEXT_KINDS = ['story', 'transport', 'accommodation', 'dress_code', 'menu', 'activities', 'custom'];

describe('the editor’s "?" for every section', () => {
  it('explains every section type and text kind, and the cover, in both languages', () => {
    const keys = [
      'cover',
      ...SECTION_TYPES.filter((t) => t !== 'text').map((t) => (t === 'custom' ? 'custom_media' : t)),
      ...TEXT_KINDS,
    ];
    for (const dict of [sectionHelpHe, sectionHelpEn])
      for (const key of keys) {
        const entry = (dict.types as Record<string, { what: string; guests: string; tip: string }>)[key];
        expect(entry, key).toBeDefined();
        for (const text of [entry!.what, entry!.guests, entry!.tip]) expect(text.trim(), key).not.toBe('');
      }
    expect(Object.keys(sectionHelpEn.types).sort()).toEqual(Object.keys(sectionHelpHe.types).sort());
  });
});
