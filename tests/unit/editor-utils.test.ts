import { describe, expect, it } from 'vitest';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { availableEntries, CATALOG, insertionIndex, newSection } from '@/features/invitations/editor/catalog';
import { commit, createHistory, redo, replacePresent, undo } from '@/features/invitations/editor/history';
import { addLocale, removeLocale } from '@/features/invitations/editor/locales';
import {
  getAt,
  insertAt,
  moveAt,
  removeAt,
  setAt,
  uniqueId,
  updateAt,
} from '@/features/invitations/editor/paths';
import { demoDocument, FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate, TEMPLATE_IDS } from '@/features/invitations/templates/registry';

describe('paths', () => {
  const doc = { a: { b: [{ c: 1 }, { c: 2 }] }, d: { e: 'x' } };

  it('reads and writes by dotted path with structural sharing', () => {
    expect(getAt(doc, 'a.b.1.c')).toBe(2);
    expect(getAt(doc, 'a.nope.c')).toBeUndefined();
    const next = setAt(doc, 'a.b.1.c', 3);
    expect(next.a.b[1]!.c).toBe(3);
    expect(doc.a.b[1]!.c).toBe(2); // original untouched
    expect(next.d).toBe(doc.d); // untouched branch keeps its identity
    expect(next.a.b[0]).toBe(doc.a.b[0]);
    expect(setAt(doc, 'a.b.0.c', 1)).toBe(doc); // same value → same object
  });

  it('removes, inserts and moves array items; removes object keys', () => {
    expect(removeAt(doc, 'a.b.0').a.b).toEqual([{ c: 2 }]);
    expect(removeAt(doc, 'd.e').d).toEqual({});
    expect(insertAt(doc, 'a.b', { c: 9 }, 1).a.b.map((x) => x.c)).toEqual([1, 9, 2]);
    expect(insertAt(doc, 'a.b', { c: 9 }).a.b.map((x) => x.c)).toEqual([1, 2, 9]);
    expect(moveAt(doc, 'a.b', 0, 1).a.b.map((x) => x.c)).toEqual([2, 1]);
    expect(updateAt(doc, 'd.e', (v) => `${v}!`).d.e).toBe('x!');
  });

  it('throws when the path goes through a primitive', () => {
    expect(() => setAt(doc, 'd.e.f', 1)).toThrow(/no container/);
  });

  it('uniqueId appends the first free -n', () => {
    expect(uniqueId('faq', ['hero'])).toBe('faq');
    expect(uniqueId('faq', ['faq', 'faq-2'])).toBe('faq-3');
  });
});

describe('history (§7.6 undo/redo, 50 steps)', () => {
  it('undo/redo walk the steps; a new commit clears redo', () => {
    let h = createHistory('a');
    h = commit(h, 'b', { now: 0 });
    h = commit(h, 'c', { now: 10_000 });
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe('b');
    h = commit(h, 'x', { now: 20_000 });
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it('typing into one field within a second is one step', () => {
    let h = createHistory('');
    h = commit(h, 'N', { key: 'hosts.primary.en', now: 0 });
    h = commit(h, 'No', { key: 'hosts.primary.en', now: 300 });
    h = commit(h, 'Noa', { key: 'hosts.primary.en', now: 600 });
    expect(h.past).toEqual(['']);
    h = commit(h, 'Noa!', { key: 'hosts.primary.en', now: 5_000 }); // pause → new step
    h = commit(h, 'x', { key: 'other', now: 5_100 }); // other field → new step
    expect(h.past).toEqual(['', 'Noa', 'Noa!']);
  });

  it('keeps at most 50 past steps; replacePresent adds no step', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 60; i++) h = commit(h, i, { now: i * 10_000 });
    expect(h.past).toHaveLength(50);
    expect(h.past[0]).toBe(10);
    h = replacePresent(h, 99);
    expect(h.past).toHaveLength(50);
    expect(h.present).toBe(99);
    expect(replacePresent(h, 1, { clear: true }).past).toEqual([]);
  });
});

describe('section catalog', () => {
  const NOW = Date.parse('2026-09-23T10:00:00Z');

  it.each(TEMPLATE_IDS)('every catalog entry yields a valid section for demo-%s', (templateId) => {
    const { manifest, defaults } = requireTemplate(templateId);
    const base = demoDocument(templateId);
    for (const entry of CATALOG) {
      if (entry.type === 'rsvp') continue; // demos already have one
      const doc = structuredClone(base);
      const section = newSection(entry, doc, manifest, defaults);
      expect(section.enabled).toBe(true);
      expect(doc.sections.some((s) => s.id === section.id)).toBe(false);
      doc.sections.splice(insertionIndex(doc, null), 0, section);
      const r = validateDocument(doc, manifest, { mode: 'publish', now: NOW });
      // structurally valid; only host-specific content may be missing
      expect(r.errors.filter((e) => !['required', 'empty_section'].includes(e.code))).toEqual([]);
    }
  });

  it('uses the template copy when it has some (ramon-dusk transport), generic otherwise', () => {
    const { manifest, defaults } = requireTemplate('ramon-dusk');
    const doc = demoDocument('ramon-dusk');
    const transport = newSection(
      { key: 'transport', type: 'text', kind: 'transport' },
      doc,
      manifest,
      defaults,
    );
    expect(transport.id).toBe('transport-2'); // the demo already has 'transport'
    if (transport.type !== 'text') throw new Error();
    expect(transport.data.body.he).toBeTruthy();
    const menu = newSection({ key: 'menu', type: 'text', kind: 'menu' }, doc, manifest, defaults);
    if (menu.type !== 'text') throw new Error();
    expect(menu.data.title).toEqual({ he: 'תפריט', en: 'Menu' });
    expect(menu.data.body).toEqual({});
  });

  it('only offers RSVP while there is none; inserts after the selection, never after the footer', () => {
    const doc = structuredClone(FIXTURES['wedding-he-en']);
    expect(availableEntries(doc).some((e) => e.type === 'rsvp')).toBe(false);
    const noRsvp = { ...doc, sections: doc.sections.filter((s) => s.type !== 'rsvp') };
    expect(availableEntries(noRsvp).some((e) => e.type === 'rsvp')).toBe(true);
    expect(insertionIndex(doc, 'hero')).toBe(1);
    expect(insertionIndex(doc, 'footer')).toBe(doc.sections.length - 1);
    expect(insertionIndex(doc, null)).toBe(doc.sections.length - 1);
  });

  it('new sections only carry the invitation languages', () => {
    const { manifest, defaults } = requireTemplate('honey-meadow');
    const doc = structuredClone(FIXTURES['babyshower-en']); // en only
    const faq = newSection({ key: 'faq', type: 'faq' }, doc, manifest, defaults);
    if (faq.type !== 'faq') throw new Error();
    expect(Object.keys(faq.data.title)).toEqual(['en']);
    expect(Object.keys(faq.data.items[0]!.q)).toEqual(['en']);
  });
});

describe('invitation languages (add / remove)', () => {
  const { manifest, defaults } = requireTemplate('sahar-bordeaux');
  const heOnly = () => removeLocale(structuredClone(FIXTURES['wedding-he-en']), 'en');

  it('removes a language from every text and keeps the default valid', () => {
    const doc = heOnly();
    expect(doc.locales).toEqual(['he']);
    expect(doc.defaultLocale).toBe('he');
    expect(JSON.stringify(doc)).not.toMatch(/"en":/);
    const en = removeLocale(structuredClone(FIXTURES['wedding-he-en']), 'he');
    expect(en.defaultLocale).toBe('en');
    expect(removeLocale(en, 'en')).toBe(en); // never the last one
  });

  it('adds a language: template copy for untouched texts, host content left to translate', () => {
    const seeded = demoDocument('sahar-bordeaux', 'wedding', ['he'], 'he');
    seeded.sections = seeded.sections.map((s) =>
      s.type === 'text' && s.data.kind === 'story'
        ? { ...s, data: { ...s.data, body: { he: 'הסיפור שלנו בקצרה' } } }
        : s,
    );
    const doc = addLocale(seeded, 'en', manifest, defaults);
    expect(doc.locales).toEqual(['he', 'en']);
    const countdown = doc.sections.find((s) => s.type === 'countdown');
    expect(countdown?.type === 'countdown' && countdown.data.title.en).toBeTruthy();
    const story = doc.sections.find((s) => s.type === 'text' && s.data.kind === 'story');
    expect(story?.type === 'text' && story.data.body.en).toBeUndefined(); // rewritten by the host
    expect(doc.hosts.primary.en).toBeUndefined(); // names are the host's to translate
    expect(doc.hosts.joiner).toEqual({ he: '&', en: '&' });
    const { errors } = validateDocument(doc, manifest, { mode: 'publish', now: Date.parse('2026-01-01') });
    expect(errors.some((e) => e.code === 'missing_translation' && e.path === 'hosts.primary.en')).toBe(true);
    expect(addLocale(doc, 'en', manifest, defaults)).toBe(doc);
  });

  it('round-trips a bilingual fixture through remove + add without losing Hebrew', () => {
    const doc = addLocale(heOnly(), 'en', manifest, defaults);
    expect(doc.hosts.primary.he).toBe(FIXTURES['wedding-he-en'].hosts.primary.he);
    expect(doc.locales).toEqual(['he', 'en']);
  });
});
