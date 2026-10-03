import { describe, expect, it } from 'vitest';
import { rsvpSummary, suggestGuests } from '@/features/invitations/lib/rsvp-summary';

const guest = (id: string, name: string, phone: string | null = null, response: unknown = null) => ({
  id,
  name,
  phone,
  response,
});

describe('rsvpSummary — one count of replies for every screen (UX report B2)', () => {
  it('counts a general-link reply as coming, says it is from the link, and leaves the list "not answered"', () => {
    const guests = Array.from({ length: 40 }, (_, i) => guest(`g${i}`, `אורח ${i}`));
    const s = rsvpSummary(guests, [{ id: 'r1', attending: true, adults: 2, children: 0, guestId: null }]);
    expect(s).toMatchObject({
      coming: 1,
      comingPeople: 2,
      comingFromLink: 1,
      declined: 0,
      unmatched: 1,
      listed: 40,
      notAnswered: 40,
    });
  });

  it('a matched reply is no longer "from the link", and its guest has answered', () => {
    const guests = [guest('g1', 'אבי', null, { attending: true }), guest('g2', 'דנה')];
    const s = rsvpSummary(guests, [
      { id: 'r1', attending: true, adults: 2, children: 1, guestId: 'g1' },
      { id: 'r2', attending: false, adults: 0, children: 0, guestId: null },
    ]);
    expect(s).toMatchObject({
      coming: 1,
      comingPeople: 3,
      comingFromLink: 0,
      declined: 1,
      unmatched: 1,
      notAnswered: 1,
    });
  });
});

describe('suggestGuests', () => {
  const list = [
    guest('a', 'אבי כהן', '+972501111111'),
    guest('b', 'אבי סבבה'),
    guest('c', 'אבי', null, { attending: true }),
    guest('d', 'רותם'),
  ];
  it('puts the same phone first, then the same name, then a partial one; never a guest who answered', () => {
    expect(suggestGuests({ name: 'אבי סבבה', phone: '050-111-1111' }, list).map((g) => g.id)).toEqual([
      'a',
      'b',
    ]);
    expect(suggestGuests({ name: 'אבי סבבה', phone: null }, list).map((g) => g.id)).toEqual(['b']);
    expect(suggestGuests({ name: 'רותם לוי', phone: null }, list).map((g) => g.id)).toEqual(['d']);
  });
});
