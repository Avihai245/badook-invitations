import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The public invitation page is cached (ISR) and static: the flag for the RSVP form's extra line comes from
// the deployment's settings through renderOptions, the same options the live language switch uses — not from
// the request.

vi.mock('server-only', () => ({}));
const status = vi.hoisted(() => ({ active: false }));
vi.mock('@/features/legal/status', () => ({ legalStatus: () => ({ active: status.active }) }));
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({
    INVITES_BRAND_NAME: 'Badook',
    INVITES_PUBLIC_BASE_URL: 'https://example.test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://db.example.test',
    NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL: '',
  }),
}));

const { renderOptions } = await import('@/features/invitations/server/render-options');
const { buildRenderContext } = await import('@/features/invitations/renderer/context');
const { RsvpView } = await import('@/features/invitations/sections/rsvp/RsvpView');
const { demoDocument } = await import('@/features/invitations/templates/demo');
const { requireTemplate } = await import('@/features/invitations/templates/registry');

const invitation = { followUp: null } as unknown as Parameters<typeof renderOptions>[0];

describe('the RSVP form’s legal flag', () => {
  beforeEach(() => {
    status.active = false;
  });

  it('is off while version 2 is not in force, and on once it is', () => {
    expect(renderOptions(invitation, false).legalNotice).toBe(false);
    status.active = true;
    expect(renderOptions(invitation, false).legalNotice).toBe(true);
  });

  it('reaches the RSVP form’s config through the render context, and is off by default', () => {
    const doc = demoDocument('celestial');
    const section = doc.sections.find((x) => x.type === 'rsvp')!;
    const configOf = (legalNotice?: boolean) => {
      const ctx = buildRenderContext(doc, requireTemplate(doc.templateId).manifest, doc.defaultLocale, {
        brand: 'Badook',
        bases: { templateMedia: '', uploads: 'https://x.supabase.co/storage/v1/object/public/m' },
        publicBaseUrl: 'https://invitations.example',
        ...(legalNotice === undefined ? {} : { legalNotice }),
      });
      const tree = RsvpView({ section: section as never, prev: undefined, ctx }) as ReactElement<{
        children?: unknown;
      }>;
      const find = (node: unknown): { legalNotice?: boolean } | null => {
        if (!node || typeof node !== 'object') return null;
        if (Array.isArray(node)) return node.map(find).find(Boolean) ?? null;
        const props = (node as ReactElement<{ config?: { legalNotice?: boolean }; children?: unknown }>)
          .props;
        return props?.config ?? find(props?.children);
      };
      return find(tree);
    };
    expect(configOf()?.legalNotice).toBe(false);
    expect(configOf(true)?.legalNotice).toBe(true);
  });
});
