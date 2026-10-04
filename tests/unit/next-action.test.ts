import { describe, expect, it } from 'vitest';
import { alsoWorth, getNextAction, type HomeFacts } from '@/features/invitations/app/home/next-action';

const ID = '11111111-1111-4111-8111-111111111111';
const base: HomeFacts = {
  daysLeft: 120,
  status: 'draft',
  unpublishedChanges: false,
  guests: 0,
  sent: 0,
  notAnswered: 0,
  unmatched: 0,
  planning: { planned: false, totalBudget: null, week: 0, open: 0 },
  seating: { tables: 0, unseated: 0 },
  eventDay: true,
  gallery: true,
};
const next = (f: Partial<HomeFacts>) => getNextAction(ID, { ...base, ...f }).key;

describe('getNextAction — one next step for the event (UX report §4.3)', () => {
  it('far from the event the plan and its budget come first', () => {
    expect(next({})).toBe('planSetup');
    expect(next({ planning: { planned: true, totalBudget: null, week: 0, open: 3 } })).toBe('budget');
  });
  it('then publishing, the guest list and sending', () => {
    const planned = { planned: true, totalBudget: 100_000, week: 0, open: 3 };
    expect(next({ planning: planned })).toBe('publish');
    expect(next({ planning: planned, status: 'published' })).toBe('guests');
    expect(next({ planning: planned, status: 'published', guests: 40, sent: 10 })).toBe('send');
    expect(getNextAction(ID, { ...base, planning: planned, status: 'published', guests: 40 }).n).toBe(40);
  });
  it('closer than 60 days, the budget waits behind publishing', () => {
    expect(next({ daysLeft: 50 })).toBe('publish');
  });
  it('two weeks before: the tables; on the day: the entrance; after: the film', () => {
    const ready = {
      status: 'published' as const,
      guests: 40,
      sent: 40,
      planning: { planned: true, totalBudget: 100_000, week: 0, open: 0 },
    };
    expect(next({ ...ready, daysLeft: 10 })).toBe('seating');
    expect(next({ ...ready, daysLeft: 10, seating: { tables: 5, unseated: 0 } })).toBe('gallery');
    expect(next({ ...ready, daysLeft: 10, seating: { tables: 5, unseated: 0 }, gallery: false })).toBe(
      'allSet',
    );
    expect(next({ ...ready, daysLeft: 0 })).toBe('eventDay');
    expect(next({ ...ready, daysLeft: -2 })).toBe('film');
    expect(next({ ...ready, daysLeft: -2, gallery: false })).toBe('insights');
  });
  it('without planning there is no budget step', () => {
    expect(next({ planning: null })).toBe('publish');
  });
  it('suggests up to three more, never the main one again', () => {
    const f = {
      ...base,
      status: 'published' as const,
      guests: 40,
      sent: 40,
      notAnswered: 12,
      unmatched: 1,
      daysLeft: 20,
    };
    const main = getNextAction(ID, f);
    const more = alsoWorth(ID, f);
    expect(more.length).toBeLessThanOrEqual(3);
    expect(more.map((a) => a.key)).not.toContain(main.key);
  });
});
