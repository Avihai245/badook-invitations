import { describe, expect, it } from 'vitest';
import { nextStep } from '@/features/invitations/app/list/InvitationsList';
import type { InvitationSummary } from '@/features/invitations/server/host-db';

const item = (over: Partial<InvitationSummary>): InvitationSummary =>
  ({
    id: 'inv-1',
    status: 'published',
    unpublishedChanges: false,
    guests: 0,
    sent: 0,
    responses: 0,
    attending: 0,
    ...over,
  }) as InvitationSummary;

describe('the next step on an invitation card', () => {
  it('draft → publish (the editor opens its publish window); changes → publish again; archived → nothing', () => {
    expect(nextStep(item({ status: 'draft' }))).toEqual({
      key: 'publish',
      href: '/app/invitations/inv-1/edit?publish=1',
    });
    expect(nextStep(item({ unpublishedChanges: true }))).toEqual({
      key: 'republish',
      href: '/app/invitations/inv-1/edit?publish=1',
    });
    expect(nextStep(item({ status: 'archived' }))).toBeNull();
  });

  it('published: upload the guest list, send it on WhatsApp to who hasn’t got it, then follow the replies', () => {
    expect(nextStep(item({}))).toEqual({ key: 'import', href: '/app/invitations/inv-1/guests?import=1' });
    expect(nextStep(item({ guests: 40, sent: 12 }))).toEqual({
      key: 'send',
      href: '/app/invitations/inv-1/guests?send=1',
      n: 28,
    });
    // shared by the general link, with replies already: follow them
    expect(nextStep(item({ responses: 3 }))?.key).toBe('track');
    expect(nextStep(item({ guests: 40, sent: 40 }))).toEqual({
      key: 'track',
      href: '/app/invitations/inv-1/responses',
    });
  });

  it('after the event: only the replies are left to look at', () => {
    expect(nextStep(item({ status: 'draft' }), { past: true })).toBeNull();
    expect(nextStep(item({ guests: 40, sent: 12 }), { past: true })).toBeNull();
    expect(nextStep(item({ responses: 5 }), { past: true })).toEqual({
      key: 'track',
      href: '/app/invitations/inv-1/responses',
    });
    expect(nextStep(item({ status: 'archived', responses: 5 }), { past: true })).toBeNull();
  });
});
