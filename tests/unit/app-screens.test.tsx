import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable, Hint, HintProvider, isDisabledElement } from '@/components/app';
import { countdownState, daysUntilEvent } from '@/features/invitations/app/countdown';
import {
  eventTypeFilters,
  initialPreview,
  matchesFilter,
} from '@/features/invitations/app/gallery/TemplateGallery';
import { publishHref, workspaceTab } from '@/features/invitations/app/workspace/paths';
import {
  EVENT_TYPES,
  type InvitationDocument,
  type TemplateManifest,
} from '@/features/invitations/contracts/types';
import { premiumLocked } from '@/features/invitations/editor/Topbar';
import { trackLicense } from '@/features/invitations/editor/panels/GlobalPanels';
import { TEMPLATES, requireTemplate } from '@/features/invitations/templates/registry';
import { dictFor, plural } from '@/lib/i18n/app';

describe('the countdown on an invitation', () => {
  const now = new Date(2026, 8, 24, 21, 30); // late evening, local time
  it('counts whole days in the visitor’s own day', () => {
    expect(daysUntilEvent('2026-09-24', now)).toBe(0);
    expect(daysUntilEvent('2026-09-25', now)).toBe(1);
    expect(daysUntilEvent('2026-10-06', now)).toBe(12);
    expect(daysUntilEvent('2026-09-20', now)).toBe(-4);
  });

  it('the day itself is "today", not "in 0 days"; after it, "the event has passed"', () => {
    expect(countdownState(0)).toEqual({ kind: 'today' });
    expect(countdownState(1)).toEqual({ kind: 'days', n: 1 });
    expect(countdownState(-1)).toEqual({ kind: 'past' });
    for (const locale of ['he', 'en'] as const) {
      const t = dictFor(locale);
      expect(t.list.countdown.today).not.toMatch(/0/);
      expect(plural(locale, t.list.countdown.days, 1, { n: 1 })).toBe(locale === 'he' ? 'מחר' : 'Tomorrow');
      expect(plural(locale, t.list.countdown.days, 12, { n: 12 })).toContain('12');
    }
  });
});

describe('the gallery’s event-type chips', () => {
  const manifests = [...TEMPLATES.values()].map((e) => e.manifest);
  const filters = eventTypeFilters(manifests);

  it('cover every event type a design is made for, in the contract’s order', () => {
    const listed = new Set(manifests.flatMap((m) => m.categories));
    expect(filters.map((f) => f.type)).toEqual(EVENT_TYPES.filter((t) => listed.has(t)));
    // today's designs cover all of them — engagement, henna, corporate and "other" included
    expect(filters.map((f) => f.type)).toEqual([...EVENT_TYPES]);
  });

  it('show every design under each of its types, with the right count', () => {
    for (const m of manifests) for (const type of m.categories) expect(matchesFilter(m, type)).toBe(true);
    for (const { type, count } of filters)
      expect(count).toBe(manifests.filter((m) => matchesFilter(m, type)).length);
    expect(manifests.every((m) => matchesFilter(m, 'all'))).toBe(true);
  });
});

describe('a design to open the preview on right away (from a ?template= link)', () => {
  it('a real, listed id opens it; anything else opens the plain gallery', () => {
    expect(initialPreview('sahar-bordeaux', false)).toBe('sahar-bordeaux');
    expect(initialPreview(null, false)).toBeNull();
    expect(initialPreview(undefined, false)).toBeNull();
    expect(initialPreview('', false)).toBeNull();
    expect(initialPreview('no-such-template', false)).toBeNull();
    // unlisted: nothing for a visitor, the design itself for an admin
    expect(TEMPLATES.get('lumiere')?.manifest.listed).toBe(false);
    expect(initialPreview('lumiere', false)).toBeNull();
    expect(initialPreview('lumiere', true)).toBe('lumiere');
  });
});

describe('the workspace’s addresses', () => {
  it('knows its tab from the path', () => {
    expect(workspaceTab('/app/invitations/abc', 'abc')).toBe('overview');
    expect(workspaceTab('/app/invitations/abc/guests', 'abc')).toBe('guests');
    expect(workspaceTab('/app/invitations/abc/responses', 'abc')).toBe('responses');
    expect(workspaceTab('/app/invitations/abc/share', 'abc')).toBe('share');
    expect(workspaceTab('/app/invitations/abcd/share', 'abc')).toBeNull();
    expect(publishHref('abc')).toBe('/app/invitations/abc/edit?publish=1');
  });
});

describe('the editor', () => {
  it('a premium design, or an animated invitation on any design, is locked only on a plan without them (the publish route’s 402s)', () => {
    const t = (over: Partial<TemplateManifest>) => ({
      ...requireTemplate('sahar-bordeaux').manifest,
      ...over,
    });
    const page = { theme: {} } as Pick<InvitationDocument, 'theme'>;
    const film = { theme: { scene: { enabled: true } } } as Pick<InvitationDocument, 'theme'>;
    expect(premiumLocked(t({ tier: 'premium' }), page, { premiumTemplates: false })).toBe('design');
    expect(premiumLocked(t({ tier: 'premium' }), page, { premiumTemplates: true })).toBeNull();
    expect(premiumLocked(t({ tier: 'standard' }), page, { premiumTemplates: false })).toBeNull();
    // a page made a film by its host: the plan must have it too
    expect(premiumLocked(t({ tier: 'standard' }), film, { premiumTemplates: false })).toBe('scene');
    expect(premiumLocked(t({ tier: 'standard' }), film, { premiumTemplates: true })).toBeNull();
    // a design made as a film is a premium design
    expect(premiumLocked(requireTemplate('celestial').manifest, page, { premiumTemplates: false })).toBe(
      'design',
    );
  });

  it('never shows a placeholder music licence', () => {
    expect(trackLicense('TBD — must be royalty-free for commercial use')).toBeNull();
    expect(trackLicense('  ')).toBeNull();
    expect(trackLicense('CC BY 4.0 — Artist')).toBe('CC BY 4.0 — Artist');
    // every track in the pack is a placeholder today
    for (const { manifest } of TEMPLATES.values())
      for (const track of manifest.music.tracks)
        if (/^tbd/i.test(track.license.trim())) expect(trackLicense(track.license)).toBeNull();
  });
});

describe('primitives', () => {
  it('a clickable table row is a named button for keyboards and screen readers', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ id: '1', name: 'Dana' }]}
        getRowKey={(r) => r.id}
        onRowClick={() => {}}
        rowLabel={(r) => `Details of ${r.name}`}
      />,
    );
    expect(html).toContain('<button type="button" aria-label="Details of Dana"');
    expect(html).not.toMatch(/<tr[^>]*tabindex/i);
  });

  it('a hint on a disabled button still has a trigger that takes hover and focus', () => {
    const disabled = <button disabled>Export</button>;
    expect(isDisabledElement(disabled)).toBe(true);
    expect(isDisabledElement(<button>Export</button>)).toBe(false);
    const html = renderToStaticMarkup(
      <HintProvider>
        <Hint text="Downloads the replies" disabledText="Nothing to export yet">
          {disabled}
        </Hint>
      </HintProvider>,
    );
    expect(html).toMatch(/<span[^>]*tabindex="0"[^>]*data-disabled-hint=""/);
    expect(html).toContain('<button disabled="">Export</button>');
  });
});
