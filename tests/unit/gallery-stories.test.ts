// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { FeedItem } from '@/features/live-gallery/types';
import { ago, groupStories, isUnseen, readSeen, writeSeen } from '@/features/live-gallery/ui/guest/stories';

// The guests' feed as stories: one per person, what each shared played oldest first, the newest
// activity first, and which stories this phone has already watched.

let n = 0;
const item = (over: Partial<FeedItem> & { at: string }): FeedItem => ({
  id: `item-${++n}`,
  kind: 'image',
  thumb: 'https://t/x.jpg',
  display: 'https://d/x.jpg',
  video: null,
  width: 800,
  height: 600,
  durationMs: null,
  takenAt: null,
  name: null,
  by: null,
  ...over,
});
/** the feed's order: newest first */
const feed = (...items: FeedItem[]) => [...items].sort((a, b) => (a.at < b.at ? 1 : -1));

describe('groupStories', () => {
  it('makes one story per uploader, played oldest first, the one with the newest item first', () => {
    const a1 = item({ at: '2026-10-03T18:00:00Z', by: 'aaaa', name: 'דנה' });
    const b1 = item({ at: '2026-10-03T18:05:00Z', by: 'bbbb', name: 'יואב' });
    const a2 = item({ at: '2026-10-03T18:10:00Z', by: 'aaaa', name: 'דנה' });
    const stories = groupStories(feed(a1, b1, a2));
    expect(stories.map((s) => s.name)).toEqual(['דנה', 'יואב']);
    expect(stories[0]!.items.map((i) => i.id)).toEqual([a1.id, a2.id]);
    expect(stories[0]).toMatchObject({ newestId: a2.id, newestAt: a2.at, host: false, anonymous: null });
  });

  it('keeps a name as one person even from two phones, whatever the case or spacing', () => {
    const stories = groupStories(
      feed(
        item({ at: '2026-10-03T18:00:00Z', by: 'aaaa', name: 'Dana  Levi' }),
        item({ at: '2026-10-03T18:01:00Z', by: 'bbbb', name: 'dana levi' }),
      ),
    );
    expect(stories).toHaveLength(1);
    expect(stories[0]!.items).toHaveLength(2);
    // the spelling shown is the newest one's
    expect(stories[0]!.name).toBe('dana levi');
  });

  it('puts what a phone sent before it typed a name under the name it gave later', () => {
    const early = item({ at: '2026-10-03T18:00:00Z', by: 'aaaa' });
    const late = item({ at: '2026-10-03T18:30:00Z', by: 'aaaa', name: 'נועה' });
    const stories = groupStories(feed(early, late));
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({ name: 'נועה' });
    expect(stories[0]!.items.map((i) => i.id)).toEqual([early.id, late.id]);
  });

  it('tells unnamed guests apart by their key and numbers them by who came first', () => {
    const first = item({ at: '2026-10-03T18:00:00Z', by: 'aaaa' });
    const second = item({ at: '2026-10-03T18:05:00Z', by: 'bbbb' });
    const firstAgain = item({ at: '2026-10-03T18:20:00Z', by: 'aaaa' });
    const stories = groupStories(feed(first, second, firstAgain));
    expect(stories).toHaveLength(2);
    // the newest activity is first, but the numbers follow who uploaded first
    expect(stories.map((s) => [s.key, s.anonymous])).toEqual([
      ['b:aaaa', 1],
      ['b:bbbb', 2],
    ]);
    expect(stories.every((s) => s.name === null)).toBe(true);
    // a third guest does not move the others' numbers
    const more = groupStories(
      feed(first, second, firstAgain, item({ at: '2026-10-03T19:00:00Z', by: 'cccc' })),
    );
    expect(more.find((s) => s.key === 'b:aaaa')!.anonymous).toBe(1);
    expect(more.find((s) => s.key === 'b:cccc')!.anonymous).toBe(3);
  });

  it('keeps the hosts’ own items as one story with no number and no name', () => {
    const stories = groupStories(
      feed(
        item({ at: '2026-10-03T18:00:00Z', by: 'host', name: 'ignored' }),
        item({ at: '2026-10-03T18:01:00Z', by: 'aaaa', name: 'דנה' }),
      ),
    );
    const host = stories.find((s) => s.host)!;
    expect(host).toMatchObject({ key: 'host', name: null, anonymous: null });
    expect(stories).toHaveLength(2);
  });

  it('without a key (an older answer) unnamed items share one story', () => {
    const stories = groupStories(
      feed(item({ at: '2026-10-03T18:00:00Z' }), item({ at: '2026-10-03T18:01:00Z' })),
    );
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({ key: 'anon', anonymous: 1 });
  });

  it('is empty for an empty feed', () => {
    expect(groupStories([])).toEqual([]);
  });
});

describe('what this phone has watched', () => {
  beforeEach(() => localStorage.clear());

  it('a story is new until its newest item is the one watched', () => {
    const a = item({ at: '2026-10-03T18:00:00Z', by: 'aaaa', name: 'דנה' });
    const [story] = groupStories([a]);
    expect(isUnseen(story!, {})).toBe(true);
    expect(isUnseen(story!, { [story!.key]: a.id })).toBe(false);
    // something newer arrived since
    const [again] = groupStories(feed(a, item({ at: '2026-10-03T18:10:00Z', by: 'aaaa', name: 'דנה' })));
    expect(isUnseen(again!, { [story!.key]: a.id })).toBe(true);
  });

  it('is kept on the phone per gallery, and a broken value starts fresh', () => {
    writeSeen('token-one-0123456789', { 'n:דנה': 'x1' });
    expect(readSeen('token-one-0123456789')).toEqual({ 'n:דנה': 'x1' });
    expect(readSeen('token-two-0123456789')).toEqual({});
    localStorage.setItem('badook-gallery:seen:token-one-', 'not json');
    expect(readSeen('token-one-0123456789')).toEqual({});
  });

  it('keeps only the newest 300 entries', () => {
    const many = Object.fromEntries(Array.from({ length: 320 }, (_, i) => [`k${i}`, `v${i}`]));
    writeSeen('token-big-0123456789', many);
    const kept = readSeen('token-big-0123456789');
    expect(Object.keys(kept)).toHaveLength(300);
    expect(kept['k319']).toBe('v319');
    expect(kept['k0']).toBeUndefined();
  });
});

describe('ago', () => {
  const now = Date.parse('2026-10-03T20:00:00Z');
  it('says "now", minutes, hours and days in the page’s language', () => {
    expect(ago('2026-10-03T19:59:50Z', now, 'en')).toMatch(/now/i);
    expect(ago('2026-10-03T19:55:00Z', now, 'en')).toMatch(/5/);
    expect(ago('2026-10-03T17:00:00Z', now, 'en')).toMatch(/3/);
    expect(ago('2026-10-01T20:00:00Z', now, 'en')).toMatch(/2/);
    expect(ago('2026-10-03T19:55:00Z', now, 'he-IL')).toMatch(/5/);
  });
  it('is empty for a time it cannot read', () => {
    expect(ago('garbage', now, 'en')).toBe('');
  });
});
