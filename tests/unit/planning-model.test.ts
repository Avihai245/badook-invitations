import { describe, expect, it } from 'vitest';
import { categoryPlanned, plannedTotal, shekels } from '@/features/planning/model/budget';
import { buildPlanDraft, buildPlanDraftFromPrivate, splitBudget } from '@/features/planning/model/draft';
import { integrationsForMode, readIntegrations } from '@/features/planning/model/integrations';
import { computeSchedule, daysBetween, todayIn } from '@/features/planning/model/schedule';
import { systemTaskDone, systemTasksFor, type SystemFacts } from '@/features/planning/model/system-tasks';
import { TEMPLATES } from '@/features/planning/templates';

const facts = (over: Partial<SystemFacts> = {}): SystemFacts => ({
  status: 'draft',
  unpublishedChanges: false,
  guests: 0,
  sent: 0,
  responses: 0,
  deadline: null,
  today: '2027-05-01',
  tables: 0,
  confirmedUnseated: 0,
  stationReady: false,
  ...over,
});

describe('putting a template on the calendar', () => {
  const tasks = [
    { id: 'book', offset: -300, minDays: 120 },
    { id: 'attire', offset: -150 },
    { id: 'confirm', offset: -14 },
    { id: 'day', offset: 0 },
    { id: 'thanks', offset: 5 },
  ];

  it('a year ahead every task sits at its nominal place', () => {
    const s = computeSchedule(tasks, { eventDate: '2028-06-17', today: '2027-06-01' });
    expect(s.map((x) => x.due)).toEqual([
      '2027-08-22',
      '2028-01-19',
      '2028-06-03',
      '2028-06-17',
      '2028-06-22',
    ]);
    expect(s.some((x) => x.compressed || x.suggestHide)).toBe(false);
  });

  it('with little time left the overdue ones are squeezed, in order, into the first stretch', () => {
    // 40 days left: the hall (300 before) and the outfits (150 before) would be in the past
    const s = computeSchedule(tasks, { eventDate: '2027-06-10', today: '2027-05-01' });
    const by = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(by.book!.compressed).toBe(true);
    expect(by.attire!.compressed).toBe(true);
    expect(by.confirm!.compressed).toBe(false);
    // nothing is in the past, the earliest comes first, and all land in the first 40% of the time left
    for (const x of s) expect(x.due >= '2027-05-01').toBe(true);
    expect(by.book!.due <= by.attire!.due).toBe(true);
    expect(by.attire!.due <= '2027-05-17').toBe(true);
    // the real ones keep their places
    expect(by.confirm!.due).toBe('2027-05-27');
    expect(by.day!.due).toBe('2027-06-10');
    // the hall can't be booked the way it is meant with 40 days to go: offered for hiding
    expect(by.book!.suggestHide).toBe(true);
    expect(by.attire!.suggestHide).toBe(false);
  });

  it('an event that is over schedules nothing into the past and suggests nothing', () => {
    const s = computeSchedule(tasks, { eventDate: '2027-04-01', today: '2027-05-01' });
    expect(s.every((x) => !x.compressed && !x.suggestHide)).toBe(true);
    expect(daysBetween('2027-05-01', '2027-04-01')).toBe(-30);
  });

  it('finds today in the event’s own zone', () => {
    const lateEvening = new Date('2027-05-01T22:30:00Z');
    expect(todayIn('Asia/Jerusalem', lateEvening)).toBe('2027-05-02');
    expect(todayIn('UTC', lateEvening)).toBe('2027-05-01');
  });
});

describe('the system tasks', () => {
  it('the five of the road, the deadline, and the ones that need the seating and the entrance', () => {
    const f = facts({ guests: 10, sent: 10, responses: 3, status: 'published' });
    expect(systemTaskDone('invitation_designed', f)).toBe(true);
    expect(systemTaskDone('invitation_published', f)).toBe(true);
    expect(
      systemTaskDone('invitation_published', facts({ status: 'published', unpublishedChanges: true })),
    ).toBe(false);
    expect(systemTaskDone('invitation_published', facts())).toBe(false);
    expect(systemTaskDone('guests_uploaded', f)).toBe(true);
    expect(systemTaskDone('guests_uploaded', facts())).toBe(false);
    expect(systemTaskDone('invites_sent', f)).toBe(true);
    expect(systemTaskDone('invites_sent', facts({ guests: 10, sent: 9 }))).toBe(false);
    expect(systemTaskDone('invites_sent', facts())).toBe(false);
    expect(systemTaskDone('rsvp_tracked', f)).toBe(true);
    expect(systemTaskDone('rsvp_tracked', facts())).toBe(false);
  });

  it('the deadline is a milestone, the head-count is the host’s own call, seating and the station follow the app', () => {
    expect(systemTaskDone('rsvp_deadline', facts({ deadline: '2027-05-10' }))).toBe(false);
    expect(systemTaskDone('rsvp_deadline', facts({ deadline: '2027-05-10', today: '2027-05-11' }))).toBe(
      true,
    );
    expect(systemTaskDone('rsvp_deadline', facts())).toBeNull();
    expect(systemTaskDone('final_headcount', facts({ deadline: '2020-01-01' }))).toBeNull();
    expect(systemTaskDone('seating_done', facts())).toBe(false);
    expect(systemTaskDone('seating_done', facts({ tables: 5, confirmedUnseated: 2 }))).toBe(false);
    expect(systemTaskDone('seating_done', facts({ tables: 5 }))).toBe(true);
    expect(systemTaskDone('entry_station_ready', facts({ stationReady: true }))).toBe(true);
  });

  it('seating and entrance tasks only where the event has seats and the feature', () => {
    const keys = (o: Parameters<typeof systemTasksFor>[0]) => systemTasksFor(o).map((s) => s.key);
    expect(keys({ size: 'full', seating: true, checkin: true, seated: true })).toContain('seating_done');
    expect(keys({ size: 'full', seating: true, checkin: true, seated: true })).toContain(
      'entry_station_ready',
    );
    expect(keys({ size: 'full', seating: true, checkin: false, seated: true })).not.toContain(
      'entry_station_ready',
    );
    expect(keys({ size: 'light', seating: true, checkin: true, seated: false })).toEqual([
      'invitation_designed',
      'invitation_published',
      'guests_uploaded',
      'invites_sent',
      'rsvp_tracked',
      'rsvp_deadline',
      'final_headcount',
    ]);
  });
});

describe('a plan from a template', () => {
  const ctx = {
    eventDate: '2027-06-17',
    today: '2026-10-03',
    deadline: '2027-06-01',
    variant: 'default' as const,
    features: { seating: true, checkin: false },
    totalBudget: 200000,
    headcount: { adults: 150, children: 20, tables: 15 },
  };

  it('has the system tasks, the template’s own, in the order they fall due', () => {
    const d = buildPlanDraft(TEMPLATES.wedding, ctx);
    const system = d.tasks.filter((t) => t.systemKey).map((t) => t.systemKey);
    expect(system).toContain('invitation_published');
    expect(system).toContain('seating_done');
    expect(system).not.toContain('entry_station_ready');
    expect(d.tasks.filter((t) => t.tplKey).length).toBe(TEMPLATES.wedding.tasks.length);
    const dates = d.tasks.map((t) => t.dueDate!);
    expect([...dates].sort()).toEqual(dates);
    expect(d.tasks.map((t) => t.sort)).toEqual(d.tasks.map((_, i) => (i + 1) * 10));
    // the two that come from data follow the invitation's own deadline
    expect(d.tasks.find((t) => t.systemKey === 'rsvp_deadline')!.dueDate).toBe('2027-06-01');
    expect(d.tasks.find((t) => t.systemKey === 'final_headcount')!.dueDate).toBe('2027-06-02');
    // a template task has no text of its own: its template names it
    expect(d.tasks.find((t) => t.tplKey)!).toMatchObject({ title: null, notes: null });
  });

  it('sizes the categories to the total, with per-head prices that come to the same today', () => {
    const d = buildPlanDraft(TEMPLATES.wedding, ctx);
    const total = d.categories.reduce((n, c) => n + c.plannedAmount, 0);
    expect(Math.abs(total - 200000)).toBeLessThan(1);
    const catering = d.categories.find((c) => c.key === 'catering')!;
    expect(catering.costBasis).toBe('per_adult');
    expect(catering.unitPrice).toBeCloseTo(catering.plannedAmount / 150, 2);
    expect(categoryPlanned(catering, { adults: 150, children: 20, tables: 15 })).toBeCloseTo(
      catering.plannedAmount,
      0,
    );
    expect(d.categories.find((c) => c.key === 'venue')!.unitPrice).toBeNull();
    expect(d.requiredVendors).toEqual(TEMPLATES.wedding.requiredVendors);
    expect(d.categories.filter((c) => c.required).map((c) => c.key)).toEqual(
      expect.arrayContaining([...TEMPLATES.wedding.requiredVendors]),
    );
  });

  it('without a total or guests there is nothing to price', () => {
    const d = buildPlanDraft(TEMPLATES.birthday, {
      ...ctx,
      totalBudget: null,
      headcount: { adults: 0, children: 0, tables: 0 },
    });
    expect(d.categories.every((c) => c.plannedAmount === 0 && c.unitPrice === null)).toBe(true);
  });

  it('a short runway compresses the tasks and offers the ones that lost their meaning for hiding', () => {
    const d = buildPlanDraft(TEMPLATES.wedding, { ...ctx, today: '2027-05-10' });
    expect(d.tasks.every((t) => t.dueDate! >= '2027-05-10' || t.offsetDays! > -8)).toBe(true);
    expect(d.tasks.some((t) => t.suggestHide)).toBe(true);
  });

  it('a private template keeps the host’s own words', () => {
    const d = buildPlanDraftFromPrivate(
      {
        tasks: [{ title: 'לסגור את הדוד מוישה', notes: null, offsetDays: -20, category: null, priority: 1 }],
        categories: [{ key: 'venue', name: null, pct: 100, basis: 'fixed', required: true }],
        requiredVendors: ['venue'],
      },
      ctx,
    );
    expect(d.tasks.find((t) => t.title === 'לסגור את הדוד מוישה')).toMatchObject({
      tplKey: null,
      priority: 1,
    });
    expect(d.categories[0]).toMatchObject({ key: 'venue', plannedAmount: 200000, required: true });
  });
});

describe('the budget formula', () => {
  const cat = (over: Record<string, unknown>) =>
    ({ costBasis: 'fixed', plannedAmount: 1000, unitPrice: null, childPrice: null, ...over }) as never;
  const n = { adults: 100, children: 10, tables: 12 };

  it('mirrors the database: per adult with the child supplement, per child, per guest, per table', () => {
    expect(categoryPlanned(cat({}), n)).toBe(1000);
    expect(categoryPlanned(cat({ costBasis: 'per_adult', unitPrice: 300, childPrice: 150 }), n)).toBe(31500);
    expect(categoryPlanned(cat({ costBasis: 'per_adult', unitPrice: 300 }), n)).toBe(30000);
    expect(categoryPlanned(cat({ costBasis: 'per_child', unitPrice: 100 }), n)).toBe(1000);
    expect(categoryPlanned(cat({ costBasis: 'per_guest', unitPrice: 50 }), n)).toBe(5500);
    expect(categoryPlanned(cat({ costBasis: 'per_table', unitPrice: 250 }), n)).toBe(3000);
    // priced per head but no price yet: stays at its planned amount
    expect(categoryPlanned(cat({ costBasis: 'per_guest' }), n)).toBe(1000);
    expect(plannedTotal([cat({}), cat({ costBasis: 'per_guest', unitPrice: 50 })], n)).toBe(6500);
  });

  it('writes shekels with a thousands separator and no agorot unless there are some', () => {
    expect(shekels(1234567)).toMatch(/^₪1,234,567$|^₪1\.234\.567$/);
    expect(shekels(0)).toBe('₪0');
    expect(shekels(12.5, 'en')).toBe('₪12.50');
    expect(shekels(-40, 'en')).toBe('−₪40');
  });
});

describe('how the plan follows the invitation system', () => {
  it('standalone follows nothing, recommended the vendors and tasks and the overview, full everything', () => {
    expect(integrationsForMode('standalone')).toMatchObject({
      vendors: false,
      tasks: false,
      guests: false,
      overview: false,
    });
    expect(integrationsForMode('recommended')).toMatchObject({
      vendors: true,
      tasks: true,
      overview: true,
      guests: false,
      seating: false,
      eventDay: false,
    });
    expect(integrationsForMode('full')).toMatchObject({ guests: true, seating: true, eventDay: true });
  });

  it('a stored value with missing switches is completed from its mode', () => {
    expect(readIntegrations(undefined).mode).toBe('recommended');
    expect(readIntegrations({ mode: 'full', seating: false })).toMatchObject({
      guests: true,
      seating: false,
    });
  });
});

describe('splitBudget (whole shekels, summing to the budget)', () => {
  const wedding = TEMPLATES.wedding.categories.map((c) => ({ key: c.key, pct: c.pct, basis: c.basis }));

  it('never leaves agorot and adds up to the total exactly (the report: ₪100,000 for 126 + 20)', () => {
    const split = splitBudget(100_000, wedding, { adults: 126, children: 20, tables: 1 });
    for (const s of split) {
      expect(Number.isInteger(s.planned)).toBe(true);
      if (s.unitPrice !== null) expect(Number.isInteger(s.unitPrice)).toBe(true);
    }
    expect(split.reduce((n, s) => n + s.planned, 0)).toBe(100_000);
    const catering = split[wedding.findIndex((c) => c.key === 'catering')]!;
    expect(catering.planned).toBe(catering.unitPrice! * 126);
  });

  it('balances an odd total with no guests to divide by', () => {
    const split = splitBudget(99_999.99, wedding, { adults: 0, children: 0, tables: 0 });
    expect(split.reduce((n, s) => n + s.planned, 0)).toBe(100_000);
    expect(split.every((s) => s.unitPrice === null)).toBe(true);
  });
});
