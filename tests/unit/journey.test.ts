import { describe, expect, it } from 'vitest';
import { journey, type HomeFacts } from '@/features/invitations/app/home/journey';
import type { ToolKey } from '@/features/invitations/lib/tools';

const ID = '11111111-1111-4111-8111-111111111111';
const base: HomeFacts = {
  daysLeft: 40,
  status: 'draft',
  unpublishedChanges: false,
  guests: 0,
  sent: 0,
  notAnswered: 0,
  unmatched: 0,
  responses: 0,
  planning: null,
  seating: null,
  eventDay: true,
  gallery: true,
};
const tools = (...t: ToolKey[]) => new Set<ToolKey>(t);
const run = (f: Partial<HomeFacts>, t = tools('invite')) => journey(ID, { ...base, ...f }, t);
const keys = (f: Partial<HomeFacts>, t?: Set<ToolKey>) => run(f, t).steps.map((s) => s.key);
const current = (f: Partial<HomeFacts>, t?: Set<ToolKey>) => {
  const c = run(f, t).current;
  return c ? `${c.key}:${c.variant}` : null;
};

describe('journey — the event’s path by the tools the host chose', () => {
  it('a digital invitation only: four steps, nothing about planning, seating or the day', () => {
    expect(keys({})).toEqual(['invitation', 'guests', 'send', 'rsvp']);
    expect(current({})).toBe('invitation:publish');
  });

  it('only planning: one step, the plan', () => {
    expect(keys({}, tools('plan'))).toEqual(['plan']);
    expect(current({}, tools('plan'))).toBe('plan:setup');
    expect(current({ planning: { planned: true, totalBudget: null, week: 0, open: 3 } }, tools('plan'))).toBe(
      'plan:budget',
    );
  });

  it('every tool: the plan first when the event is far, the invitation first when it is near', () => {
    const all = tools('invite', 'plan', 'seating', 'day');
    expect(keys({ daysLeft: 120 }, all)).toEqual([
      'plan',
      'invitation',
      'guests',
      'send',
      'rsvp',
      'seating',
      'day',
    ]);
    expect(keys({ daysLeft: 20 }, all)).toEqual([
      'invitation',
      'guests',
      'send',
      'rsvp',
      'plan',
      'seating',
      'day',
    ]);
    expect(current({ daysLeft: 120 }, all)).toBe('plan:setup');
  });

  it('walks the invitation: publish → guests → send → replies', () => {
    expect(current({ status: 'published' })).toBe('guests:add');
    expect(current({ status: 'published', guests: 40, sent: 10, notAnswered: 40 })).toBe('send:send');
    expect(run({ status: 'published', guests: 40, sent: 10 }).current?.n).toBe(30);
    expect(current({ status: 'published', guests: 40, sent: 40, notAnswered: 12, responses: 28 })).toBe(
      'rsvp:remind',
    );
    const all = run({ status: 'published', guests: 40, sent: 40, notAnswered: 0, responses: 40 });
    expect(all.current).toBeNull();
    expect(all.done).toBe(all.total);
  });

  it('guests can be added before publishing; sending waits for it', () => {
    const j = run({ guests: 20 });
    expect(j.current?.key).toBe('invitation');
    expect(j.steps.find((s) => s.key === 'guests')?.state).toBe('done');
    expect(j.steps.find((s) => s.key === 'send')?.state).toBe('waiting');
  });

  it('no list, only a general link: sharing it is the way, and its replies finish it', () => {
    expect(current({ status: 'published' })).toBe('guests:add');
    expect(run({ status: 'published' }).steps.find((s) => s.key === 'guests')?.alt?.key).toBe('shareLink');
    const viaLink = run({ status: 'published', responses: 12 });
    expect(viaLink.steps.find((s) => s.key === 'guests')?.variant).toBe('link');
    expect(viaLink.steps.find((s) => s.key === 'send')?.state).toBe('done');
  });

  it('changes the guests don’t see yet come first', () => {
    expect(current({ status: 'published', unpublishedChanges: true, guests: 5, sent: 1 })).toBe(
      'invitation:changes',
    );
  });

  it('planning shows this week, never "thirty open tasks"', () => {
    const plan = tools('plan');
    expect(current({ planning: { planned: true, totalBudget: 1, week: 3, open: 33 } }, plan)).toBe(
      'plan:tasks',
    );
    const calm = run({ planning: { planned: true, totalBudget: 1, week: 0, open: 33 } }, plan);
    expect(calm.current).toBeNull();
    expect(calm.steps[0]).toMatchObject({ variant: 'onTrack', state: 'waiting' });
  });

  it('seating alone: the host seats their own list; with the invitation it waits for replies', () => {
    expect(current({}, tools('seating'))).toBe('seating:start');
    const both = run(
      { status: 'published', guests: 10, sent: 10, notAnswered: 10 },
      tools('invite', 'seating'),
    );
    expect(both.steps.find((s) => s.key === 'seating')?.state).toBe('waiting');
    expect(current({ seating: { tables: 5, unseated: 4 } }, tools('seating'))).toBe('seating:open');
  });

  it('the event day: waiting until two weeks before, the one step on the day, the film after', () => {
    const day = tools('invite', 'day');
    expect(run({ daysLeft: 40 }, day).steps.at(-1)).toMatchObject({ key: 'day', state: 'waiting' });
    expect(current({ daysLeft: 0, status: 'draft' }, day)).toBe('day:today');
    const after = run({ daysLeft: -3, status: 'published', guests: 5, sent: 5, responses: 5 }, day);
    expect(after.current?.variant).toBe('after');
    expect(after.current?.href).toBe(`/app/invitations/${ID}/gallery/film`);
    expect(run({ daysLeft: -3 }, day).steps.map((s) => s.key)).toEqual(['day']);
  });
});
