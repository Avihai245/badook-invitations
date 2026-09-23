import { describe, expect, it } from 'vitest';
import { InvitationDocumentSchema } from '@/features/invitations/contracts/schemas';
import type { InvitationDocument, SectionOf } from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { followUpDocument, followUpSlug, saveTheDateSlug } from '@/features/invitations/templates/follow-up';
import { requireTemplate } from '@/features/invitations/templates/registry';

const saveTheDate = (mutate?: (d: InvitationDocument) => void) => {
  const doc = structuredClone(FIXTURES['savethedate-he']);
  mutate?.(doc);
  return doc;
};
const follow = (source: InvitationDocument, eventType: 'wedding' | 'engagement' = 'wedding') => {
  const { manifest, defaults } = requireTemplate(source.templateId);
  return followUpDocument(manifest, defaults, source, eventType);
};

describe('save-the-date slugs', () => {
  it('the save-the-date takes a suffix, leaving the plain slug to the full invitation', () => {
    expect(saveTheDateSlug('noa-and-itay')).toBe('noa-and-itay-save-the-date');
    expect(saveTheDateSlug('noa-and-itay-save-the-date')).toBe('noa-and-itay-save-the-date');
    const long = saveTheDateSlug('a'.repeat(50) + '-bb');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(/^a+-save-the-date$/);
    expect(followUpSlug('noa-and-itay-save-the-date')).toBe('noa-and-itay');
    expect(followUpSlug('noa-and-itay')).toBeNull();
    expect(followUpSlug('-save-the-date')).toBeNull();
  });
});

describe('followUpDocument', () => {
  it('a wedding invitation with the save-the-date’s names, date, design, cover and music', () => {
    const source = saveTheDate((d) => {
      d.theme.palette = { accent: '#123456' };
      d.hosts.joiner = { he: 'ו' };
      d.event.hebrewDate = 'eve';
    });
    const doc = follow(source);
    expect(InvitationDocumentSchema.safeParse(doc).success).toBe(true);
    expect(doc.eventType).toBe('wedding');
    expect(doc.templateId).toBe(source.templateId);
    expect(doc.locales).toEqual(['he']);
    expect(doc.hosts).toEqual({ ...source.hosts, joiner: { he: 'ו' } });
    expect(doc.event).toMatchObject({
      date: '2027-06-17',
      startTime: '19:30',
      endTime: '01:00',
      hebrewDate: 'eve',
      rsvpDeadline: '2027-06-03',
    });
    expect(doc.theme).toEqual(source.theme);
    expect(doc.cover).toEqual(source.cover);
    expect(doc.music).toEqual(source.music);
    const types = doc.sections.map((s) => s.type);
    expect(types).toEqual(expect.arrayContaining(['hero', 'countdown', 'venues', 'rsvp', 'footer']));
    expect(types).not.toContain('reveal');
    expect(doc.sections.find((s) => s.type === 'rsvp')?.enabled).toBe(true);
    // a complete draft: publishing only waits for what the host still has to fill (the venue)
    const { manifest } = requireTemplate(doc.templateId);
    const { errors } = validateDocument(doc, manifest, { mode: 'publish', now: Date.parse('2026-09-23') });
    expect(errors.filter((i) => !i.path.includes('.items.'))).toEqual([]);
  });

  it('keeps the hero’s photo and a gallery with photos; the texts are the event’s', () => {
    const source = saveTheDate((d) => {
      const hero = d.sections.find((s): s is SectionOf<'hero'> => s.type === 'hero')!;
      hero.data.media = {
        kind: 'image',
        src: 'upload:u/i/couple.jpg',
        poster: null,
        focalPoint: { x: 0.5, y: 0.4 },
      };
      hero.data.overlayOpacity = 0.5;
      d.sections.push({
        id: 'gallery',
        type: 'gallery',
        enabled: true,
        data: {
          title: { he: 'רגעים' },
          layout: 'grid',
          images: [{ id: 'img-1', src: 'upload:u/i/1.jpg', alt: {} }],
        },
      });
    });
    const doc = follow(source, 'engagement');
    const hero = doc.sections.find((s): s is SectionOf<'hero'> => s.type === 'hero')!;
    expect(hero.data.media).toEqual({
      kind: 'image',
      src: 'upload:u/i/couple.jpg',
      poster: null,
      focalPoint: { x: 0.5, y: 0.4 },
    });
    expect(hero.data.overlayOpacity).toBe(0.5);
    const sourceHero = source.sections.find((s): s is SectionOf<'hero'> => s.type === 'hero')!;
    expect(hero.data.eyebrow).not.toEqual(sourceHero.data.eyebrow);
    const gallery = doc.sections.find((s): s is SectionOf<'gallery'> => s.type === 'gallery')!;
    expect(gallery.enabled).toBe(true);
    expect(gallery.data.layout).toBe('grid');
    expect(gallery.data.images).toHaveLength(1);
  });
});
