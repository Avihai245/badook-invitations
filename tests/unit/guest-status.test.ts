import { describe, expect, it } from 'vitest';
import {
  guestStats,
  matchesGuestFilter,
  wasSent,
  type GuestLike,
} from '@/features/invitations/lib/guest-status';

const guest = (over: Partial<GuestLike> = {}): GuestLike => ({
  name: 'דנה',
  phone: '+972501234567',
  group: null,
  sendStatus: 'none',
  sendChannel: null,
  openedAt: null,
  response: null,
  ...over,
});

describe('an answer the host set is not the invitation reaching the guest', () => {
  const byHost = guest({ response: { attending: true, adults: 2, children: 0, source: 'host' } });
  const own = guest({ response: { attending: true, adults: 2, children: 0, source: 'guest' } });

  it('answered by the host, never sent: still waiting for the invitation', () => {
    expect(wasSent(byHost)).toBe(false);
    expect(matchesGuestFilter(byHost, 'notSent')).toBe(true);
    expect(matchesGuestFilter(byHost, 'opened')).toBe(false);
    // and still counted as coming
    expect(matchesGuestFilter(byHost, 'attending')).toBe(true);
  });

  it('answered through the invitation: it reached them', () => {
    expect(wasSent(own)).toBe(true);
    expect(matchesGuestFilter(own, 'opened')).toBe(true);
    // replies from before the source was kept count as the guest's own
    expect(wasSent(guest({ response: { attending: false, adults: 0, children: 0 } }))).toBe(true);
  });

  it('the numbers agree', () => {
    expect(guestStats([byHost, own])).toMatchObject({ sent: 1, opened: 1, attending: 2, attendingPeople: 4 });
  });
});
