import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InvitationDocument, SectionOf } from '@/features/invitations/contracts/types';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { InvitationSections } from '@/features/invitations/renderer/InvitationSections';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';

// A section with nothing to show renders nothing — no empty band of padding between its neighbours.

const render = (doc: InvitationDocument) =>
  renderToStaticMarkup(
    <InvitationSections
      ctx={buildRenderContext(doc, requireTemplate(doc.templateId).manifest, 'he', {
        brand: 'Badook',
        now: Date.parse('2026-09-23T10:00:00Z'),
        bases: { templateMedia: '', uploads: '' },
        publicBaseUrl: 'https://invitations.example',
      })}
    />,
  );
const wedding = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
const first = <T extends InvitationDocument['sections'][number]['type']>(doc: InvitationDocument, type: T) =>
  doc.sections.find((s) => s.type === type) as SectionOf<T>;

describe('gifts', () => {
  it('shows only the complete ways to give (a name, and an https link or details)', () => {
    const doc = wedding();
    first(doc, 'gifts').data.links = [
      { id: 'half', kind: 'bit', label: { he: '', en: '' }, url: null, details: null },
      {
        id: 'http',
        kind: 'paybox',
        label: { he: 'פייבוקס', en: 'PayBox' },
        url: 'http://pay.example',
        details: null,
      },
      { id: 'nameless', kind: 'bit', label: { he: '' }, url: 'https://bit.example/x', details: null },
      {
        id: 'bank',
        kind: 'bank_transfer',
        label: { he: 'העברה', en: 'Transfer' },
        url: null,
        details: { he: 'חשבון 123', en: 'Account 123' },
      },
      {
        id: 'bit',
        kind: 'bit',
        label: { he: 'ביט', en: 'Bit' },
        url: 'https://bit.example/me',
        details: null,
      },
    ];
    const html = render(doc);
    expect(html).toContain('חשבון 123');
    expect(html).toContain('href="https://bit.example/me"');
    expect(html).not.toContain('http://pay.example');
    expect(html).not.toContain('https://bit.example/x');
    expect(html.match(/class="details"/g)).toHaveLength(1);
  });

  it('with no complete way to give, the whole section is left out', () => {
    const doc = wedding();
    const gifts = first(doc, 'gifts');
    expect(render(doc)).toContain(gifts.data.body.he!);
    gifts.data.links = [{ id: 'half', kind: 'bit', label: {}, url: null, details: null }];
    expect(render(doc)).not.toContain(gifts.data.body.he!);
    gifts.data.links = [];
    expect(render(doc)).not.toContain(gifts.data.body.he!);
  });
});

describe('text', () => {
  it('a text section with nothing in this language renders nothing', () => {
    const doc = wedding();
    const text = first(doc, 'text');
    const kind = `data-kind="${text.data.kind}"`;
    expect(render(doc)).toContain(kind);
    text.data = {
      ...text.data,
      title: null,
      subtitle: null,
      body: { he: '', en: 'Only in English' },
      illustration: null,
      cta: null,
    };
    expect(render(doc)).not.toContain(kind);
  });

  it('a title alone leaves no empty paragraph; a link that is not https is not a button', () => {
    const doc = wedding();
    const text = first(doc, 'text');
    text.data = {
      ...text.data,
      title: { he: 'כותרת', en: 'Title' },
      body: { he: '', en: '' },
      cta: { label: { he: 'לאתר', en: 'Website' }, url: 'javascript:alert(1)' },
    };
    const html = render(doc);
    const section = html.slice(html.indexOf(`data-kind="${text.data.kind}"`));
    expect(section).toContain('כותרת');
    expect(section.slice(0, section.indexOf('</section>'))).not.toContain('sec-body');
    expect(html).not.toContain('javascript:');
  });
});
