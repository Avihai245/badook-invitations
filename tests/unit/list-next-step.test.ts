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
  it('draft → publish; changes → publish again; archived → nothing', () => {
    expect(nextStep(item({ status: 'draft' }))).toEqual({
      key: 'publish',
      href: '/app/invitations/inv-1/edit',
    });
    expect(nextStep(item({ unpublishedChanges: true }))?.key).toBe('republish');
    expect(nextStep(item({ status: 'archived' }))).toBeNull();
  });

  it('published: send to the guests who haven’t got it, share it, then follow the replies', () => {
    expect(nextStep(item({ guests: 40, sent: 12 }))).toEqual({
      key: 'send',
      href: '/app/invitations/inv-1/guests',
      n: 28,
    });
    expect(nextStep(item({}))).toEqual({ key: 'share', href: '/app/invitations/inv-1/share' });
    expect(nextStep(item({ responses: 3 }))?.key).toBe('track');
    expect(nextStep(item({ guests: 40, sent: 40 }))).toEqual({
      key: 'track',
      href: '/app/invitations/inv-1/responses',
    });
  });
});
