import { describe, expect, it } from 'vitest';
import {
  formatIls,
  guestPhone,
  LIST_FILTERS,
  matchesListFilter,
  sendFailure,
  whatsappReach,
  type ListGuest,
} from '@/features/invitations/lib/guest-list';

const guest = (over: Partial<ListGuest> = {}): ListGuest => ({
  name: 'דנה',
  phone: '+972501234567',
  group: null,
  sendStatus: 'none',
  sendChannel: null,
  openedAt: null,
  response: null,
  ...over,
});

describe('the guests screen', () => {
  it('"failed": WhatsApp did not get through and the invitation has not reached them otherwise', () => {
    expect(LIST_FILTERS).toContain('failed');
    const failed = guest({
      sendStatus: 'failed',
      sendChannel: 'whatsapp',
      sendError: '131026 · not a WhatsApp user',
    });
    expect(matchesListFilter(failed, 'failed')).toBe(true);
    expect(matchesListFilter(failed, 'notSent')).toBe(true);
    expect(matchesListFilter({ ...failed, openedAt: '2027-01-01T00:00:00Z' }, 'failed')).toBe(false);
    expect(matchesListFilter(guest({ sendStatus: 'sent' }), 'failed')).toBe(false);
    expect(matchesListFilter(guest(), 'all')).toBe(true);
  });

  it("says why the system's WhatsApp can't reach a guest", () => {
    expect(whatsappReach(guest())).toBe('ok');
    expect(whatsappReach(guest({ phone: null }))).toBe('noPhone');
    expect(whatsappReach(guest({ phone: '+97231234567' }))).toBe('landline');
    expect(whatsappReach(guest({ optedOut: true }))).toBe('optedOut');
  });

  it('shows phones as dialled: landlines too', () => {
    expect(guestPhone('+972501234567')).toBe('050-123-4567');
    expect(guestPhone('+97235551234')).toBe('03-555-1234');
    expect(guestPhone('+442079460958')).toBe('+44 20 7946 0958');
    expect(guestPhone(null)).toBe('');
  });

  it("prices a message in the host's language", () => {
    expect(formatIls(0.14, 'en')).toBe('₪0.14');
    expect(formatIls(0.14, 'he')).toMatch(/^\u200f?0\.14\s\u200f?₪$/);
  });

  it('turns a stored failure into one the host can act on', () => {
    expect(sendFailure('timeout')).toBe('timeout');
    expect(sendFailure('opted_out')).toBe('optedOut');
    expect(sendFailure('131050 · user stopped marketing messages')).toBe('optedOut');
    expect(sendFailure('131026 · not a WhatsApp user')).toBe('notOnWhatsapp');
    expect(sendFailure('131049 · healthy ecosystem')).toBe('limited');
    expect(sendFailure('130429 · Rate limit hit')).toBe('limited');
    expect(sendFailure('132001 · template does not exist')).toBe('other');
    expect(sendFailure(null)).toBe('other');
  });
});
