import { describe, expect, it } from 'vitest';
import type { NoticeRow, SeatingChange } from '@/features/event-day/model';
import { describeChange } from '@/features/event-day/ui/HistoryList';
import { noticeState } from '@/features/event-day/ui/NoticesDialog';
import { movedIds } from '@/features/event-day/ui/useNotifyOutcome';
import { dictFor, fmt, plural } from '@/lib/i18n/app';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe } from '@/lib/i18n/event-day-guest.he';
import { eventDayEn } from '@/lib/i18n/event-day.en';
import { eventDayHe } from '@/lib/i18n/event-day.he';

// The host's event-day screens, pure parts: where a family stands in "send guests their table", the
// history's changes in words, the families a change moved (the ones told again), and the two
// dictionaries saying the same things (the same {placeholders} in every string).

const row = (over: Partial<NoticeRow>): NoticeRow => ({
  unitId: 'u1',
  guestId: 'g1',
  name: 'משפחת כהן',
  seats: 3,
  status: 'confirmed',
  phone: '+972501234567',
  token: 'tok_aaaaaaaaaaaaaaaa',
  reach: 'ok',
  table: { id: 't12', number: 12, label: null },
  told: null,
  queued: false,
  ...over,
});
const told = (number: number, tableId = `t${number}`) => ({
  tableId,
  number,
  label: null,
  channel: 'whatsapp' as const,
  status: 'delivered' as const,
  at: '2027-06-17T10:00:00Z',
});

describe('telling guests their table: where a family stands', () => {
  it('not told yet, told its number, on its way, told another number, or left without a table', () => {
    expect(noticeState(row({}))).toBe('unsent');
    expect(noticeState(row({ told: told(12) }))).toBe('told');
    expect(noticeState(row({ queued: true, told: told(12) }))).toBe('queued');
    expect(noticeState(row({ told: told(7, 't7') }))).toBe('update');
    // the table was renumbered: same table, another number — an update too
    expect(noticeState(row({ told: told(9, 't12') }))).toBe('update');
    expect(noticeState(row({ table: null, told: told(12) }))).toBe('unseated');
    expect(noticeState(row({ table: null }))).toBe('none');
  });
});

const ui = {
  t: dictFor('he'),
  fmt,
  plural: (entry: Parameters<typeof plural>[1], n: number, vars?: Record<string, string | number>) =>
    plural('he', entry, n, vars),
  number: (n: number) => String(n),
  date: () => '',
  locale: 'he' as const,
  dir: 'rtl' as const,
};
type Ui = Parameters<typeof describeChange>[1];

const change = (over: Partial<SeatingChange>): SeatingChange => ({
  id: 'c1',
  kind: 'move',
  source: 'live',
  reason: null,
  at: '2027-06-17T18:00:00Z',
  actorId: null,
  undoOf: null,
  undoneAt: null,
  units: [],
  tables: [],
  ...over,
});
const unit = (name: string, from: number | null, to: number | null, id = name) => ({
  id,
  name,
  seats: 2,
  from: from === null ? null : { id: `t${from}`, number: from },
  to: to === null ? null : { id: `t${to}`, number: to },
});

describe('the history of changes, in words', () => {
  const say = (c: SeatingChange) => describeChange(c, ui as unknown as Ui);

  it('a family moved, seated, or left without a table', () => {
    expect(say(change({ units: [unit('משפחת לוי', 12, 7)] }))).toEqual({
      head: 'משפחת לוי: משולחן 12 לשולחן 7',
      lines: [],
    });
    expect(say(change({ units: [unit('משפחת לוי', null, 7)] })).head).toBe('משפחת לוי: לשולחן 7');
    expect(say(change({ units: [unit('משפחת לוי', 12, null)] })).head).toBe('משפחת לוי: משולחן 12 בלי שולחן');
  });

  it('several families: how many, and each one', () => {
    const d = say(change({ units: [unit('משפחת לוי', 12, 7), unit('משפחת כהן', 12, 3)] }));
    expect(d.head).toBe('2 משפחות הועברו');
    expect(d.lines).toEqual(['משפחת לוי: משולחן 12 לשולחן 7', 'משפחת כהן: משולחן 12 לשולחן 3']);
  });

  it('a merge names the two tables; undoing it is the families going back', () => {
    const merge = change({ kind: 'merge', units: [unit('משפחת לוי', 5, 3), unit('משפחת כהן', 5, 3)] });
    expect(say(merge).head).toBe('שולחן 5 אוחד לשולחן 3');
    expect(say(merge).lines).toHaveLength(2);
    const back = change({
      kind: 'merge',
      undoOf: 'c0',
      units: [unit('משפחת לוי', 3, 5), unit('משפחת כהן', 3, 5)],
    });
    expect(say(back).head).toBe('2 משפחות הועברו');
  });

  it('a renumbered table (the seating screen, a family already told)', () => {
    const d = say(
      change({
        kind: 'renumber',
        source: 'seating',
        units: [{ ...unit('משפחת לוי', 4, 9), from: { id: 't4', number: 4 }, to: { id: 't4', number: 9 } }],
        tables: [{ id: 't4', from: 4, to: 9 }],
      }),
    );
    expect(d).toEqual({ head: 'שולחן 4 קיבל את המספר 9', lines: [] });
  });
});

describe('the families a change moved (told again)', () => {
  it('only those whose table number changed', () => {
    const c = change({
      units: [
        unit('a', 12, 7, 'a'),
        unit('b', null, 7, 'b'),
        unit('c', 12, null, 'c'),
        { ...unit('d', 4, 4, 'd'), to: { id: 't4', number: 4 } },
      ],
    });
    expect(movedIds(c)).toEqual(['a', 'b']);
  });
});

/** Every string's {placeholders}, by its path in the dictionary. */
function placeholders(value: unknown, path = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof value === 'string') out.set(path, [...new Set(value.match(/\{\w+\}/g) ?? [])].sort().join(','));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) placeholders(v, path ? `${path}.${k}` : k, out);
  return out;
}

describe('the event day’s dictionaries', () => {
  it.each([
    ['the host’s', eventDayHe, eventDayEn],
    ['the guests’', eventDayGuestHe, eventDayGuestEn],
  ])('%s: Hebrew and English have the same strings with the same placeholders', (_, he, en) => {
    const a = placeholders(he);
    const b = placeholders(en);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [path, names] of a) expect({ path, names: b.get(path) }).toEqual({ path, names });
  });
});
