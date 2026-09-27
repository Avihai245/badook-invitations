import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  emailDays,
  emailGroupOf,
  emailTotals,
  waDays,
  waTotals,
  type MessagesRaw,
} from '@/features/admin/messages/model';

// The console's messages (features/admin/messages/model.ts): WhatsApp's totals and rates by kind, the
// days of the chart, the emails by group — from the database's counts (the seeded month of
// tests/db/admin-money.test.ts).

const TOTALS: MessagesRaw['totals'] = [
  { kind: 'gallery', status: 'delivered', n: 1, usd: 0.0353 },
  { kind: 'gallery', status: 'failed', n: 1, usd: 0.0353 },
  { kind: 'invitation', status: 'delivered', n: 1, usd: 0.0353 },
  { kind: 'invitation', status: 'failed', n: 1, usd: 0.0353 },
  { kind: 'invitation', status: 'queued', n: 1, usd: 0.0353 },
  { kind: 'invitation', status: 'read', n: 3, usd: 0.1059 },
  { kind: 'invitation', status: 'sent', n: 1, usd: 0.0353 },
  { kind: 'table', status: 'failed', n: 1, usd: 0.0353 },
  { kind: 'table', status: 'read', n: 2, usd: 0.0706 },
];

describe('WhatsApp', () => {
  it('totals and rates: delivered of those that went out, read of those delivered; cost of what Meta charges for', () => {
    const all = waTotals(TOTALS);
    expect(all).toMatchObject({ total: 12, pending: 1, sent: 8, delivered: 7, read: 5, failed: 3 });
    expect(all.deliveredRate).toBeCloseTo(7 / 11);
    expect(all.readRate).toBeCloseTo(5 / 7);
    expect(all.failRate).toBeCloseTo(3 / 11);
    // not the failed ones, not the queued one
    expect(all.usd).toBeCloseTo(0.2824, 6);
    expect(waTotals(TOTALS, 'table')).toMatchObject({ total: 3, delivered: 2, read: 2, failed: 1 });
    expect(waTotals(TOTALS, 'gallery').readRate).toBe(0);
    // nothing finished yet: no rates
    expect(waTotals([{ kind: 'invitation', status: 'queued', n: 4, usd: 0.1412 }])).toMatchObject({
      total: 4,
      pending: 4,
      deliveredRate: null,
      readRate: null,
      failRate: null,
      usd: 0,
    });
  });

  it('every day of the 30, queued and sending as waiting, by kind or all', () => {
    const raw = {
      from: '2026-09-13',
      to: '2026-09-15',
      days: [
        { day: '2026-09-13', kind: 'invitation', status: 'read', n: 4 },
        { day: '2026-09-13', kind: 'table', status: 'read', n: 2 },
        { day: '2026-09-15', kind: 'invitation', status: 'queued', n: 3 },
        { day: '2026-09-15', kind: 'invitation', status: 'sending', n: 1 },
        { day: '2026-09-15', kind: 'gallery', status: 'failed', n: 1 },
        // outside the range: ignored
        { day: '2026-09-12', kind: 'invitation', status: 'read', n: 9 },
      ],
    } satisfies Pick<MessagesRaw, 'days' | 'from' | 'to'>;
    const zero = { read: 0, delivered: 0, sent: 0, failed: 0, pending: 0 };
    expect(waDays(raw, 'all')).toEqual([
      { day: '2026-09-13', ...zero, read: 6 },
      { day: '2026-09-14', ...zero },
      { day: '2026-09-15', ...zero, failed: 1, pending: 4 },
    ]);
    expect(waDays(raw, 'table').map((d) => d.read)).toEqual([2, 0, 0]);
    // across the clocks' change and a month's end
    expect(daysBetween('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(daysBetween('2026-08-30', '2026-09-02')).toHaveLength(4);
    expect(daysBetween('2026-09-02', '2026-09-01')).toEqual([]);
  });
});

describe('emails', () => {
  it('five groups on the chart (each keeps its color); the kinds in the table, the most first', () => {
    expect(
      ['rsvp_reply', 'rsvp_digest', 'review', 'billing_alert', 'contact', 'support', 'other', 'new_kind'].map(
        emailGroupOf,
      ),
    ).toEqual(['replies', 'digests', 'review', 'team', 'team', 'team', 'other', 'other']);
    const raw = {
      from: '2026-09-14',
      to: '2026-09-15',
      emails: [
        { day: '2026-09-14', kind: 'rsvp_reply', status: 'sent', n: 3 },
        { day: '2026-09-14', kind: 'rsvp_reply', status: 'failed', n: 1 },
        { day: '2026-09-14', kind: 'contact', status: 'sent', n: 2 },
        { day: '2026-09-15', kind: 'billing_alert', status: 'skipped', n: 1 },
        { day: '2026-09-15', kind: 'review', status: 'sent', n: 2 },
      ],
    } satisfies Pick<MessagesRaw, 'emails' | 'from' | 'to'>;
    expect(emailDays(raw)).toEqual([
      { day: '2026-09-14', replies: 4, digests: 0, review: 0, team: 2, other: 0 },
      { day: '2026-09-15', replies: 0, digests: 0, review: 2, team: 1, other: 0 },
    ]);
    expect(emailTotals(raw)).toEqual([
      { kind: 'rsvp_reply', sent: 3, failed: 1, skipped: 0 },
      { kind: 'contact', sent: 2, failed: 0, skipped: 0 },
      { kind: 'review', sent: 2, failed: 0, skipped: 0 },
      { kind: 'billing_alert', sent: 0, failed: 0, skipped: 1 },
    ]);
  });
});
