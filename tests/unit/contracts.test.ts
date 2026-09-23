import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import {
  InvitationDocumentSchema,
  SectionSchema,
  TemplateManifestSchema,
} from '@/features/invitations/contracts/schemas';
import { TEMPLATES, TEMPLATE_IDS } from '@/features/invitations/templates/registry';
import { validateTemplate } from '@/features/invitations/templates/validate-template';

const fixturesDir = join(process.cwd(), 'docs/invitations/fixtures');
const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'))] as const);

describe('template pack', () => {
  it('registers all 8 templates in gallery order', () => {
    expect(TEMPLATE_IDS).toEqual([
      'sahar-bordeaux',
      'papercut-gold',
      'caesarea-shore',
      'ramon-dusk',
      'atara',
      'nitzan',
      'rooftop-dusk',
      'honey-meadow',
    ]);
  });

  it.each(TEMPLATE_IDS)('%s passes the cross-field template rules', (id) => {
    expect(validateTemplate(TEMPLATES.get(id)!)).toEqual([]);
  });

  it('rejects unknown manifest keys (strict schema)', () => {
    const { manifest } = TEMPLATES.get('sahar-bordeaux')!;
    expect(TemplateManifestSchema.safeParse({ ...manifest, typo: true }).success).toBe(false);
  });
});

describe('fixtures (§10)', () => {
  it.each(fixtures)('%s is a valid InvitationDocument for a pack template', (_file, json) => {
    const doc = migrateDocument(json);
    expect(TEMPLATES.has(doc.templateId)).toBe(true);
    expect(doc.sections[0]?.type).toBe('hero');
    expect(doc.sections.at(-1)?.type).toBe('footer');
  });

  it('migrateDocument rejects unknown schema versions', () => {
    const [, json] = fixtures[0]!;
    expect(() => migrateDocument({ ...json, schemaVersion: 99 })).toThrow(/schemaVersion/);
    expect(() => migrateDocument(null)).toThrow();
  });

  it('validates HH:mm, ISO dates, slugs and asset refs', () => {
    const [, json] = fixtures.find(([f]) => f.includes('wedding'))!;
    const bad = (patch: (d: typeof json) => void) => {
      const copy = structuredClone(json);
      patch(copy);
      return InvitationDocumentSchema.safeParse(copy).success;
    };
    expect(bad((d) => (d.event.startTime = '24:00'))).toBe(false);
    expect(bad((d) => (d.event.date = '2027-02-30'))).toBe(false);
    expect(bad((d) => (d.share.slug = 'No Spaces'))).toBe(false);
    expect(bad((d) => (d.sections[0].data.media.src = 'ftp://x'))).toBe(false);
    expect(bad((d) => (d.timezone = 'Mars/Olympus'))).toBe(false);
  });

  it('requires options on select questions', () => {
    const rsvp = fixtures
      .find(([f]) => f.includes('wedding'))![1]
      .sections.find((s: { type: string }) => s.type === 'rsvp');
    const q = { ...rsvp.data.customQuestions[0], options: [] };
    expect(SectionSchema.safeParse({ ...rsvp, data: { ...rsvp.data, customQuestions: [q] } }).success).toBe(
      false,
    );
  });
});
