import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminDict } from '@/features/admin/i18n';
import type { PartnerSource } from '@/features/admin/partners/model';
import { PartnerSourceCard } from '@/features/admin/partners/ui/PartnerSourceCard';

// Where a Badook Events account came from, on its page in the console (features/admin/partners), and
// the activity feed's lines about accounts Badook Events opened.

vi.mock('server-only', () => ({}));
const activity = vi.fn();
vi.mock('@/features/admin/partners/server', () => ({
  partnersDb: { activity: (actor: string, limit: number) => activity(actor, limit) },
}));

const { partnerActivity } = await import('@/features/admin/server/activity/partners');

const SOURCE: PartnerSource = {
  source: 'partner:badook-events',
  externalId: 'be-c-1',
  openedAt: '2026-09-10T06:00:00Z',
  opener: { id: 'be-u-7', name: 'רונית כהן', email: 'r***@venue.example.com', role: 'manager', via: 'call' },
  venue: { id: 'hall-17', name: 'אולמי הגן', address: 'הרצל 1' },
  userManaged: false,
  provisions: [
    { action: 'login_link', at: '2026-09-11T06:00:00Z', by: null, venue: 'אולמי הגן' },
    {
      action: 'created',
      at: '2026-09-10T06:00:00Z',
      by: { id: 'be-u-7', name: 'רונית כהן', role: 'manager', email: 'r***@venue.example.com' },
      venue: 'אולמי הגן',
    },
  ],
};

/** The card's text, tags stripped. */
const text = (source: PartnerSource, locale: 'he' | 'en') =>
  renderToStaticMarkup(<PartnerSourceCard source={source} t={adminDict(locale).partners} locale={locale} />)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

describe('the user page’s source card', () => {
  it('says who in Badook Events opened the account, when, and the venue, with the ids there', () => {
    const he = text(SOURCE, 'he');
    expect(he).toContain(
      'נפתח דרך Badook Events על ידי רונית כהן (manager) · 10 בספט׳ 2026 · אולם אולמי הגן',
    );
    expect(he).toContain('הלקוח: be-c-1 · מי שפתח: be-u-7 · האולם: hall-17');
    expect(he).toContain('r***@venue.example.com');
    expect(he).toContain('נפתח על ידי רונית כהן (manager)');
    const en = text(SOURCE, 'en');
    expect(en).toContain(
      'Opened through Badook Events by רונית כהן (manager) · 10 Sept 2026 · Venue אולמי הגן',
    );
    expect(en).toContain('Customer: be-c-1 · Opened by: be-u-7 · Venue: hall-17');
  });

  it('the venue’s owner when the call didn’t say; nobody said; a user who signs in by themselves', () => {
    const viaVenue = text(
      { ...SOURCE, opener: { id: 'be-u-1', name: 'משה לוי', email: null, role: 'owner', via: 'venue' } },
      'he',
    );
    expect(viaVenue).toContain('על ידי משה לוי (owner) · 10 בספט׳ 2026 · אולם אולמי הגן (בעל האולם)');
    const nobody = text({ ...SOURCE, opener: null, venue: null, provisions: [], userManaged: true }, 'he');
    expect(nobody).toContain('נפתח דרך Badook Events · 10 בספט׳ 2026');
    expect(nobody).toContain('Badook Events לא אמרה מי פתח את החשבון.');
    expect(nobody).toContain('המשתמש נכנס בעצמו');
    expect(nobody).not.toContain('הקריאות על החשבון');
  });
});

describe('the activity feed’s lines', () => {
  const staff = { userId: 'staff-1', email: 's@example.com', role: 'viewer' as const, permissions: [] };
  beforeEach(() => activity.mockReset());

  it('an account opened through Badook Events, by whom — names only', async () => {
    activity.mockResolvedValue([
      {
        id: 7,
        at: '2026-09-12T06:00:00Z',
        userId: 'u-4',
        name: 'פאר אדם',
        action: 'linked',
        byName: 'רונית כהן',
        byRole: 'manager',
        venue: null,
      },
      {
        id: 3,
        at: '2026-08-01T06:00:00Z',
        userId: 'u-2',
        name: null,
        action: 'created',
        byName: null,
        byRole: null,
        venue: 'אולמי הגן',
      },
    ]);
    expect(await partnerActivity(staff, 20)).toEqual([
      {
        id: 'partner:7',
        kind: 'partner_provision',
        at: '2026-09-12T06:00:00Z',
        actor: 'פאר אדם',
        subject: 'רונית כהן',
        amount: null,
        userId: 'u-4',
        invitationId: null,
        ticketId: null,
      },
      {
        id: 'partner:3',
        kind: 'partner_provision',
        at: '2026-08-01T06:00:00Z',
        actor: null,
        subject: null,
        amount: null,
        userId: 'u-2',
        invitationId: null,
        ticketId: null,
      },
    ]);
    expect(activity).toHaveBeenCalledWith('staff-1', 20);
    // can't be read: no lines (logged), never the feed
    activity.mockRejectedValueOnce(new Error('database down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await partnerActivity(staff, 20)).toEqual([]);
    log.mockRestore();
  });
});
