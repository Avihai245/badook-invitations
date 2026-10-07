import { describe, expect, it } from 'vitest';
import type { FeedItem } from '@/features/live-gallery/types';
import { frameRatio, groupPosts, mergeLikes, toggled } from '@/features/live-gallery/ui/guest/posts';

const item = (id: string, at: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id,
  kind: 'image',
  thumb: null,
  display: null,
  video: null,
  width: 1200,
  height: 1600,
  durationMs: null,
  takenAt: null,
  at,
  name: null,
  by: 'b1',
  ...over,
});

describe('the feed as posts', () => {
  it('photos shared together are one post, in the order they landed; stories are not posts', () => {
    // newest first, as the server sends them
    const feed = [
      item('c', '2026-10-17T20:05:00Z', { placement: 'feed', post: 'p2', name: 'יואב' }),
      item('s', '2026-10-17T20:04:00Z', { placement: 'story' }),
      item('b', '2026-10-17T20:03:00Z', { placement: 'feed', post: 'p1' }),
      item('a', '2026-10-17T20:01:00Z', { placement: 'feed', post: 'p1', name: 'דנה' }),
      // from before the choice: a post of its own
      item('old', '2026-10-17T19:00:00Z'),
    ];
    const posts = groupPosts(feed);
    expect(posts.map((p) => [p.key, p.items.map((i) => i.id)])).toEqual([
      ['p2', ['c']],
      ['p1', ['a', 'b']],
      ['old', ['old']],
    ]);
    expect(posts[1]).toMatchObject({ name: 'דנה', at: '2026-10-17T20:01:00Z' });
  });

  it('a post keeps its place when its later photos land', () => {
    const before = groupPosts([
      item('x', '2026-10-17T20:02:00Z', { placement: 'feed', post: 'other' }),
      item('a', '2026-10-17T20:01:00Z', { placement: 'feed', post: 'p1' }),
    ]);
    const after = groupPosts([
      item('b', '2026-10-17T20:09:00Z', { placement: 'feed', post: 'p1' }),
      item('x', '2026-10-17T20:02:00Z', { placement: 'feed', post: 'other' }),
      item('a', '2026-10-17T20:01:00Z', { placement: 'feed', post: 'p1' }),
    ]);
    expect(before.map((p) => p.key)).toEqual(['other', 'p1']);
    expect(after.map((p) => p.key)).toEqual(['other', 'p1']);
  });
});

describe('likes', () => {
  it('a tap counts at once, once; taking it back never goes below zero', () => {
    expect(toggled(undefined, true)).toEqual({ n: 1, mine: true });
    expect(toggled({ n: 4, mine: true }, true)).toEqual({ n: 4, mine: true });
    expect(toggled({ n: 4, mine: true }, false)).toEqual({ n: 3, mine: false });
    expect(toggled({ n: 0, mine: true }, false)).toEqual({ n: 0, mine: false });
  });

  it('an answer: the posts asked about it leaves out have no likes; the others stay', () => {
    const merged = mergeLikes(
      { p1: { n: 2, mine: true }, p2: { n: 5, mine: false }, p3: { n: 1, mine: false } },
      ['p1', 'p2'],
      { p2: { n: 6, mine: false } },
    );
    expect(merged).toEqual({
      p1: { n: 0, mine: false },
      p2: { n: 6, mine: false },
      p3: { n: 1, mine: false },
    });
  });
});

describe('a post’s frame', () => {
  it('its first photo’s shape, between 4:5 and 1.91:1; square without a size', () => {
    expect(frameRatio({ width: 1000, height: 3000 })).toBe(0.8);
    expect(frameRatio({ width: 4000, height: 1000 })).toBe(1.91);
    expect(frameRatio({ width: 1600, height: 1200 })).toBeCloseTo(1.333, 3);
    expect(frameRatio({ width: null, height: null })).toBe(1);
  });
});
