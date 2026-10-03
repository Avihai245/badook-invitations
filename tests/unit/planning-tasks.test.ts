import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/app.en';
import { he } from '@/lib/i18n/app.he';
import { googleTaskUrl, tasksIcs } from '@/features/planning/model/calendar';
import type { TaskView } from '@/features/planning/model/plan';
import { systemText } from '@/features/planning/model/system-text';
import {
  filterTasks,
  groupByCategory,
  groupTimeline,
  isSuggested,
  moveId,
  reorderWithin,
  timelineKey,
  type Chip,
} from '@/features/planning/model/tasks-view';
import { dueWithin, isDone, isOpen, nextTask } from '@/features/planning/model/week';

const TODAY = '2027-05-01';
let n = 0;
const task = (over: Partial<TaskView> = {}): TaskView => ({
  id: `t${++n}`,
  title: 'x',
  notes: null,
  dueDate: null,
  dueIsManual: false,
  offsetDays: null,
  status: 'todo',
  category: null,
  priority: 0,
  assignee: null,
  budgetItemId: null,
  vendorId: null,
  systemKey: null,
  tplKey: null,
  suggestHide: false,
  completedAt: null,
  sort: n * 10,
  derived: null,
  ...over,
});
const ids = (list: { id: string }[]) => list.map((t) => t.id);
const chips = (...c: Chip[]) => new Set<Chip>(c);

describe('which tasks are the host’s to do', () => {
  it('open means to do or in progress, not hidden, not offered for hiding, not ticked by the app', () => {
    expect(isOpen(task())).toBe(true);
    expect(isOpen(task({ status: 'doing' }))).toBe(true);
    expect(isOpen(task({ status: 'done' }))).toBe(false);
    expect(isOpen(task({ status: 'skipped' }))).toBe(false);
    expect(isOpen(task({ suggestHide: true }))).toBe(false);
    expect(isOpen(task({ systemKey: 'invitation_published', derived: true }))).toBe(false);
    expect(isOpen(task({ systemKey: 'invitation_published', derived: false }))).toBe(true);
    expect(isDone(task({ status: 'done' }))).toBe(true);
    expect(isDone(task({ derived: true }))).toBe(true);
    expect(isDone(task())).toBe(false);
  });

  it('this week is what is due within seven days or overdue; the next step is the earliest, the important one first', () => {
    const a = task({ dueDate: '2027-04-20' });
    const b = task({ dueDate: '2027-05-08' });
    const c = task({ dueDate: '2027-05-09' });
    const d = task({ dueDate: null });
    const e = task({ dueDate: '2027-05-03', status: 'done' });
    expect(ids(dueWithin([a, b, c, d, e], TODAY))).toEqual([a.id, b.id]);
    expect(nextTask([c, b, a, d])!.id).toBe(a.id);
    expect(nextTask([d])!.id).toBe(d.id);
    expect(nextTask([e])).toBeNull();
    const first = task({ dueDate: '2027-05-05', priority: 0, sort: 5 });
    const urgent = task({ dueDate: '2027-05-05', priority: 1, sort: 99 });
    expect(nextTask([first, urgent])!.id).toBe(urgent.id);
  });
});

describe('the timeline', () => {
  it('overdue, this week, this month, later, no date, done — each in the host’s order, empty groups left out', () => {
    const overdue = task({ dueDate: '2027-04-29' });
    const today = task({ dueDate: TODAY });
    const week = task({ dueDate: '2027-05-08' });
    const month = task({ dueDate: '2027-05-31' });
    const later = task({ dueDate: '2027-06-01' });
    const none = task({});
    const done = task({ status: 'done', completedAt: '2027-04-30T10:00:00Z', dueDate: '2027-04-01' });
    const auto = task({ systemKey: 'guests_uploaded', derived: true, dueDate: '2027-05-04' });
    expect(timelineKey(today, TODAY)).toBe('week');
    expect(timelineKey(auto, TODAY)).toBe('done');
    const g = groupTimeline([later, none, done, month, week, today, overdue, auto], TODAY);
    expect(g.map((x) => x.key)).toEqual(['overdue', 'week', 'month', 'later', 'noDate', 'done']);
    expect(ids(g.find((x) => x.key === 'week')!.tasks)).toEqual([today.id, week.id]);
    expect(groupTimeline([overdue], TODAY).map((x) => x.key)).toEqual(['overdue']);
    expect(groupTimeline([], TODAY)).toEqual([]);
  });
});

describe('the chips', () => {
  const open = task({ dueDate: '2027-05-10', assignee: 'me', budgetItemId: 'i1' });
  const far = task({ dueDate: '2027-09-10' });
  const hidden = task({ status: 'skipped', dueDate: '2027-05-02' });
  const suggested = task({ suggestHide: true, dueDate: '2027-05-02' });
  const all = [open, far, hidden, suggested];

  it('hidden and suggested tasks are out of the way unless asked for', () => {
    expect(ids(filterTasks(all, chips(), TODAY))).toEqual([open.id, far.id]);
    expect(ids(filterTasks(all, chips('hidden'), TODAY))).toEqual([hidden.id]);
    expect(isSuggested(suggested)).toBe(true);
    expect(isSuggested(hidden)).toBe(false);
  });

  it('now: due within two weeks; mine: assigned to me; cost: linked to a budget item', () => {
    expect(ids(filterTasks(all, chips('now'), TODAY))).toEqual([open.id]);
    expect(ids(filterTasks(all, chips('mine'), TODAY))).toEqual([open.id]);
    expect(ids(filterTasks(all, chips('cost'), TODAY))).toEqual([open.id]);
    expect(ids(filterTasks(all, chips('mine', 'now', 'cost'), TODAY))).toEqual([open.id]);
    expect(filterTasks([far], chips('now'), TODAY)).toEqual([]);
  });
});

describe('by category and as a list', () => {
  it('tasks with no category come first as general; the others follow the categories’ own order', () => {
    const none = task({});
    const dj = task({ category: 'dj', sort: 5 });
    const venue = task({ category: 'venue', sort: 50 });
    const venue2 = task({ category: 'venue', sort: 1 });
    const g = groupByCategory([dj, venue, none, venue2]);
    expect(g.map((x) => x.key)).toEqual([null, 'venue', 'dj']);
    expect(ids(g[1]!.tasks)).toEqual([venue2.id, venue.id]);
  });
});

describe('reordering', () => {
  it('after a drag inside a group the group’s tasks swap places and everything else stays put', () => {
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => task({ id, sort: (i + 1) * 10 }));
    const all = [a!, b!, c!, d!, e!];
    // the group is b, d (they hold slots 1 and 3): dragged so d comes first
    expect(reorderWithin(all, ['b', 'd'], ['d', 'b'])).toEqual(['a', 'd', 'c', 'b', 'e']);
    expect(reorderWithin(all, ['a', 'b', 'c', 'd', 'e'], ['e', 'd', 'c', 'b', 'a'])).toEqual([
      'e',
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('moves one id up or down, clamped at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 'a', 5)).toEqual(['b', 'c', 'a']);
    expect(moveId(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b']);
  });
});

describe('the calendar', () => {
  it('writes all-day events on the due dates, escaped, folded, with a stable id', () => {
    const ics = tasksIcs(
      [
        { id: 'abc', title: 'לסגור אולם, ולשלם; מקדמה', notes: 'שורה 1\nשורה 2', dueDate: '2027-06-30' },
        { id: 'def', title: 'Book the DJ', notes: null, dueDate: '2027-07-01' },
      ],
      'תכנון',
      new Date('2027-05-01T10:00:00Z'),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc@planning.badook');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270630');
    // all-day events end on the next day (exclusive)
    expect(ics).toContain('DTEND;VALUE=DATE:20270701');
    expect(ics).toContain('DTEND;VALUE=DATE:20270702');
    expect(ics).toContain('DTSTAMP:20270501T100000Z');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    // unfolded, the escapes are there
    const flat = ics.replace(/\r\n /g, '');
    expect(flat).toContain('\\,');
    expect(flat).toContain('\;');
    expect(flat).toContain('DESCRIPTION:שורה 1\\nשורה 2');
  });

  it('links one task to Google Calendar as an all-day event', () => {
    const url = new URL(
      googleTaskUrl({ title: 'Book the DJ', notes: 'ask for a quote', dueDate: '2027-12-31' }),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('dates')).toBe('20271231/20280101');
    expect(url.searchParams.get('text')).toBe('Book the DJ');
    expect(url.searchParams.get('details')).toBe('ask for a quote');
  });
});

describe('what a system task is called', () => {
  it('the road’s five are named by the overview’s steps, in either language', () => {
    expect(systemText(he, 'invitation_published', { adults: 0, children: 0 }).title).toBe(
      he.overview.steps.publish.title,
    );
    expect(systemText(en, 'guests_uploaded', { adults: 0, children: 0 }).title).toBe(
      en.overview.steps.import.title,
    );
    expect(systemText(en, 'rsvp_tracked', { adults: 0, children: 0 }).body).toBe(
      en.overview.steps.track.body,
    );
  });

  it('the head-count task quotes the replies, and leaves children out when there are none', () => {
    expect(systemText(he, 'final_headcount', { adults: 120, children: 15 }).title).toBe(
      'לעדכן את המקום בכמות הסופית: 120 מבוגרים, 15 ילדים',
    );
    expect(systemText(en, 'final_headcount', { adults: 80, children: 0 }).title).toBe(
      'Give the venue the final numbers: 80 adults',
    );
    expect(systemText(he, 'seating_done', { adults: 0, children: 0 }).title).toBe(
      he.planning.system.seating_done.title,
    );
  });
});
