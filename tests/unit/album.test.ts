import { describe, expect, it } from 'vitest';
import {
  albumChapters,
  albumOpensAt,
  albumState,
  aspectOf,
  justifyRows,
  pickCover,
  pickHighlights,
  timelineOf,
  type AlbumEntry,
} from '@/features/album/model';
import { ALBUM_MESSAGE, ALBUM_SHARE_MESSAGE, albumLinkIn } from '@/features/album/messages';
import { ALBUM_EVENT_PHRASE, albumEventPhrase } from '@/features/album/phrases';
import { ALBUM } from '@/features/album/config';
import { LOCALES } from '@/features/invitations/contracts/types';
import { ALBUM_TEMPLATE_TEXT, fillTemplate } from '@/features/whatsapp/template-text';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';

/**
 * The album as plain math (features/album/model.ts): when it opens (the morning after, in the event's
 * zone), its cover and best moments, its chapters (the invitation's timeline — an evening that goes
 * past midnight — or the pauses between photos), the justified rows; and its words for every kind of
 * event and language (the thank-you, the WhatsApp template's values).
 */

const at = (iso: string) => iso;
let n = 0;
function entry(over: Partial<AlbumEntry> = {}): AlbumEntry {
  n += 1;
  return {
    id: `item-${String(n).padStart(4, '0')}`,
    kind: 'image',
    width: 1600,
    height: 1200,
    durationMs: null,
    at: '2027-06-17T17:00:00.000Z',
    sharpness: 200,
    brightness: 0.5,
    aiQuality: 0.7,
    phash: null,
    ...over,
  };
}

describe('when the album opens', () => {
  const doc = {
    event: { date: '2027-06-17', startTime: '19:30', endTime: '01:00' },
    timezone: 'Asia/Jerusalem',
  } as const;

  it('is the morning after the event, 08:00 in its time zone (summer: UTC+3)', () => {
    // the evening ends after midnight: still the next morning, not the one after
    expect(albumOpensAt(null, doc as never)?.toISOString()).toBe('2027-06-18T05:00:00.000Z');
  });

  it('is the hosts’ own moment when they chose one', () => {
    expect(albumOpensAt('2027-06-17T22:00:00.000Z', doc as never)?.toISOString()).toBe(
      '2027-06-17T22:00:00.000Z',
    );
  });

  it('a date that can’t be read: no time (open)', () => {
    expect(albumOpensAt(null, { event: { date: 'nope' }, timezone: 'Asia/Jerusalem' } as never)).toBeNull();
  });

  it('is off without the feature, the switch or the gallery; soon before its time; open after', () => {
    const opensAt = new Date('2027-06-18T05:00:00.000Z');
    const base = { feature: true, enabled: true, galleryEnabled: true, opensAt };
    expect(albumState({ ...base, now: Date.parse('2027-06-18T04:59:00Z') })).toBe('soon');
    expect(albumState({ ...base, now: Date.parse('2027-06-18T05:00:00Z') })).toBe('open');
    expect(albumState({ ...base, feature: false, now: Date.parse('2027-06-19T00:00:00Z') })).toBe('off');
    expect(albumState({ ...base, enabled: false, now: Date.parse('2027-06-19T00:00:00Z') })).toBe('off');
    expect(albumState({ ...base, galleryEnabled: false, now: Date.parse('2027-06-19T00:00:00Z') })).toBe(
      'off',
    );
    expect(albumState({ ...base, opensAt: null, now: 0 })).toBe('open');
  });
});

describe('the cover and the best moments', () => {
  it('the cover is the hosts’ choice while it is a photo of the album, else the best photo', () => {
    const blurry = entry({ sharpness: 5 });
    const best = entry({ sharpness: 600, aiQuality: 0.95, width: 4000, height: 3000 });
    const video = entry({ kind: 'video' });
    expect(pickCover([blurry, best, video], null)).toBe(best.id);
    expect(pickCover([blurry, best, video], blurry.id)).toBe(blurry.id);
    // a video, or an item no longer in the album, isn't a cover
    expect(pickCover([blurry, best, video], video.id)).toBe(best.id);
    expect(pickCover([blurry, best], 'gone')).toBe(best.id);
    expect(pickCover([video], null)).toBeNull();
  });

  it('a small album has no best-moments band', () => {
    const few = Array.from({ length: ALBUM.highlights.from - 1 }, () => entry());
    expect(pickHighlights(few, null)).toEqual([]);
  });

  it('takes one of each moment, never the cover, spread over the event, in time order', () => {
    const list: AlbumEntry[] = [];
    for (let i = 0; i < 30; i++)
      list.push(
        entry({
          at: new Date(Date.parse('2027-06-17T16:30:00Z') + i * 10 * 60_000).toISOString(),
          // a burst: pairs of the same picture (pairs far apart from each other)
          phash: '0123456789abcdef'[Math.floor(i / 2) % 16]!.repeat(16),
          sharpness: 100 + i,
        }),
      );
    const cover = pickCover(list, null);
    const picked = pickHighlights(list, cover);
    expect(picked).toHaveLength(ALBUM.highlights.count);
    expect(picked).not.toContain(cover);
    const byId = new Map(list.map((e) => [e.id, e]));
    const hashes = picked.map((id) => byId.get(id)!.phash);
    expect(new Set(hashes).size).toBe(hashes.length);
    const times = picked.map((id) => Date.parse(byId.get(id)!.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // the first and the last hours both have a moment
    expect(times[0]).toBeLessThan(Date.parse('2027-06-17T18:00:00Z'));
    expect(times.at(-1)).toBeGreaterThan(Date.parse('2027-06-17T20:00:00Z'));
  });
});

describe('the chapters', () => {
  const timeline = [
    { time: '19:30', label: { he: 'קבלת פנים', en: 'Reception' }, icon: 'glass' },
    { time: '20:30', label: { he: 'חופה', en: 'Ceremony' }, icon: 'chuppah' },
    { time: '21:30', label: { he: 'ארוחה', en: 'Dinner' }, icon: 'dinner' },
    { time: '23:00', label: { he: 'מסיבה', en: 'Party' }, icon: 'party' },
    { time: '00:30', label: { he: 'אחרי חצות', en: 'After midnight' }, icon: 'music' },
  ] as const;
  // Israel in June: UTC+3
  const local = (hhmm: string, day = 17) =>
    new Date(Date.parse(`2027-06-${day}T${hhmm}:00+03:00`)).toISOString();
  const ctx = { on: true, timeline, date: '2027-06-17', timeZone: 'Asia/Jerusalem' } as const;

  it('follows the invitation’s timeline, after midnight included; empty moments are left out', () => {
    const items = [
      ...['19:00', '19:40', '19:50', '20:10'].map((t) => entry({ at: at(local(t)) })),
      ...['20:26', '20:40', '21:00'].map((t) => entry({ at: at(local(t)) })),
      ...['23:10', '23:40'].map((t) => entry({ at: at(local(t)) })),
      ...['00:40', '01:10'].map((t) => entry({ at: at(local(t, 18)) })),
    ];
    const chapters = albumChapters(items, ctx);
    expect(chapters.map((c) => c.label?.en)).toEqual(['Reception', 'Ceremony', 'Party', 'After midnight']);
    expect(chapters.map((c) => c.ids.length)).toEqual([4, 3, 2, 2]);
    // a photo just before a moment (its lead) already belongs to it
    expect(chapters[1]!.ids).toContain(items[4]!.id);
    expect(chapters[1]!.time).toBe('20:30');
    expect(chapters[1]!.icon).toBe('chuppah');
  });

  it('without a timeline: by the pauses between the photos, small ones joining a neighbour', () => {
    const block = (from: string, count: number) =>
      Array.from({ length: count }, (_, k) =>
        entry({ at: new Date(Date.parse(local(from)) + k * 3 * 60_000).toISOString() }),
      );
    const items = [...block('19:00', 6), ...block('20:30', 2), ...block('22:00', 8), ...block('23:59', 5)];
    const chapters = albumChapters(items, { ...ctx, timeline: [] });
    expect(chapters.map((c) => c.ids.length)).toEqual([6 + 2, 8, 5]);
    expect(chapters.map((c) => c.auto)).toEqual(['opening', 'heart', 'ending']);
    expect(chapters.flatMap((c) => c.ids)).toEqual(items.map((i) => i.id));
  });

  it('never more chapters than the most', () => {
    const items = Array.from({ length: 12 }, (_, g) =>
      Array.from({ length: 4 }, (_, k) =>
        entry({ at: new Date(Date.parse(local('12:00')) + g * 3_600_000 + k * 60_000).toISOString() }),
      ),
    ).flat();
    expect(albumChapters(items, { ...ctx, timeline: [] }).length).toBeLessThanOrEqual(ALBUM.chapters.max);
  });

  it('one chapter without a title when chapters are off, or the album is small', () => {
    const items = Array.from({ length: 20 }, (_, k) => entry({ at: local(`2${k % 4}:0${k % 10}`) }));
    const off = albumChapters(items, { ...ctx, on: false });
    expect(off).toHaveLength(1);
    expect(off[0]!.ids).toHaveLength(20);
    expect(off[0]!.label).toBeNull();
    expect(albumChapters(items.slice(0, 5), ctx)).toHaveLength(1);
  });

  it('reads the timeline from the invitation’s first timeline section that is on', () => {
    const doc = {
      sections: [
        { type: 'timeline', enabled: false, data: { items: [{ time: '10:00', label: {}, icon: 'star' }] } },
        {
          type: 'timeline',
          enabled: true,
          data: {
            items: [
              { time: '19:30', label: { he: 'א' }, icon: 'glass' },
              { time: 'bad', label: {}, icon: 'star' },
            ],
          },
        },
      ],
    };
    expect(timelineOf(doc as never)).toEqual([{ time: '19:30', label: { he: 'א' }, icon: 'glass' }]);
  });
});

describe('the rows', () => {
  it('fill the width exactly, at most the target height; the last row keeps its size', () => {
    const items = [1.5, 0.75, 1.33, 1, 1.78, 0.66, 1.5].map((aspect, k) => ({ id: `p${k}`, aspect }));
    const rows = justifyRows(items, 1000, 230, 6);
    expect(rows.flatMap((r) => r.items.map((i) => i.id))).toEqual(items.map((i) => i.id));
    for (const row of rows.slice(0, -1)) {
      expect(row.full).toBe(true);
      expect(row.height).toBeLessThanOrEqual(230);
      const used = row.items.reduce((s, i) => s + i.width, 0) + 6 * (row.items.length - 1);
      expect(Math.abs(used - 1000)).toBeLessThanOrEqual(row.items.length);
    }
    expect(rows.at(-1)!.height).toBeLessThanOrEqual(230);
  });

  it('a lone photo isn’t blown up', () => {
    const [row] = justifyRows([{ id: 'a', aspect: 1 }], 1200, 230, 6);
    expect(row).toEqual({ items: [{ id: 'a', width: 230 }], height: 230, full: false });
  });

  it('keeps shapes within bounds (an unknown one is 4:3)', () => {
    expect(aspectOf(null, null)).toBeCloseTo(4 / 3);
    expect(aspectOf(4000, 100)).toBe(ALBUM.layout.aspect.max);
    expect(aspectOf(100, 4000)).toBe(ALBUM.layout.aspect.min);
  });
});

describe('the words', () => {
  const couple = {
    eventType: 'wedding',
    hosts: {
      primary: { he: 'אביב', en: 'Aviv' },
      secondary: { he: 'רוני', en: 'Roni' },
      joiner: null,
      parents: null,
    },
  } as const;
  const child = {
    eventType: 'bar_mitzvah',
    hosts: {
      primary: { he: 'יונתן', en: 'Jonathan', ru: 'Йонатан' },
      secondary: null,
      joiner: null,
      parents: null,
    },
  } as const;

  it('a couple’s event says “our”; one person’s names them where the language can', () => {
    expect(albumEventPhrase(couple as never, 'he')).toBe('בחתונה שלנו');
    expect(albumEventPhrase(couple as never, 'en')).toBe('at our wedding');
    expect(albumEventPhrase(child as never, 'he')).toBe('בבר המצווה של יונתן');
    expect(albumEventPhrase(child as never, 'en')).toBe('at Jonathan’s bar mitzvah');
    // Russian declines names: the event's word
    expect(albumEventPhrase(child as never, 'ru')).toBe('на бар-мицве');
  });

  it('every language has every event, the messages and the template', () => {
    for (const l of LOCALES) {
      for (const [type, phrase] of Object.entries(ALBUM_EVENT_PHRASE[l]))
        expect(phrase, `${l} ${type}`).toBeTruthy();
      for (const text of [ALBUM_MESSAGE[l], ALBUM_SHARE_MESSAGE[l]]) {
        expect(text).toContain('{event}');
        expect(text).toContain('{url}');
        expect(text).toContain('{hosts}');
      }
      expect(ALBUM_MESSAGE[l]).toContain('{name}');
      expect(ALBUM_GUEST[l].message).toContain('{event}');
      // Meta refuses a body that starts or ends with a variable, or two side by side
      const body = ALBUM_TEMPLATE_TEXT[l].body;
      expect(body).toMatch(/\{\{1\}\}/);
      expect(body).toMatch(/\{\{2\}\}/);
      expect(body).toMatch(/\{\{3\}\}/);
      expect(body.trim()).not.toMatch(/^\{\{|\}\}$/);
      expect(body).not.toMatch(/\}\}\s*\{\{/);
    }
    expect(fillTemplate(ALBUM_TEMPLATE_TEXT.he.body, ['דנה', 'בחתונה שלנו', 'אביב ורוני'])).toContain(
      'תודה שחגגתם איתנו בחתונה שלנו!',
    );
  });

  it('the album opens in another language with &lang=', () => {
    expect(albumLinkIn('https://x/e/s/album?a=t', 'en', 'he')).toBe('https://x/e/s/album?a=t&lang=en');
    expect(albumLinkIn('https://x/e/s/album?a=t', 'he', 'he')).toBe('https://x/e/s/album?a=t');
  });
});
