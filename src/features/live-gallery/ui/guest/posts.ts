import type { FeedItem, Likes } from '../../types';

/**
 * The gallery as the event's Instagram: what was shared to the story (the circles at the top) and the
 * posts of the feed. Photos a guest shared to the feed together are one post (one key); an item from
 * before there was a choice is a post of its own, in the feed.
 */

export interface Post {
  key: string;
  /** in the order they were shared */
  items: FeedItem[];
  name: string | null;
  /** the uploader's opaque key ('host' for the hosts) */
  by: string | null;
  /** when the post entered the feed (its first item): a post never jumps when its later photos land */
  at: string;
}

export const isStory = (item: FeedItem) => item.placement === 'story';
export const postKey = (item: FeedItem) => item.post ?? item.id;

const byTime = (a: FeedItem, b: FeedItem) =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** `feed` is newest first (as the server sends it); posts come out newest first. */
export function groupPosts(feed: readonly FeedItem[]): Post[] {
  const groups = new Map<string, FeedItem[]>();
  for (const item of feed) {
    if (isStory(item)) continue;
    const key = postKey(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  const posts: Post[] = [...groups.entries()].map(([key, list]) => {
    const items = [...list].sort(byTime);
    const first = items[0]!;
    // the name the guest gave, from any of the post's items
    const name = items.find((i) => i.name?.trim())?.name?.trim() ?? null;
    return { key, items, name, by: first.by ?? null, at: first.at };
  });
  return posts.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? 1 : -1));
}

/** A like turned on or off, at once (the server's answer follows). */
export function toggled(likes: Likes | undefined, on: boolean): Likes {
  const now = likes ?? { n: 0, mine: false };
  if (now.mine === on) return now;
  return { n: Math.max(0, now.n + (on ? 1 : -1)), mine: on };
}

/**
 * The likes in a feed answer, merged into what the page has: every post asked about gets its answer,
 * a post the answer leaves out has no likes (nobody, or nobody any more), and the rest stay.
 */
export function mergeLikes(
  current: Readonly<Record<string, Likes>>,
  asked: readonly string[],
  answer: Readonly<Record<string, Likes>> | undefined,
): Record<string, Likes> {
  if (!answer) return current as Record<string, Likes>;
  const next: Record<string, Likes> = { ...current };
  for (const key of asked) next[key] = answer[key] ?? { n: 0, mine: false };
  for (const [key, value] of Object.entries(answer)) next[key] = value;
  return next;
}

/** A post's frame: its first photo's shape, kept between Instagram's tallest (4:5) and widest (1.91:1). */
export function frameRatio(item: Pick<FeedItem, 'width' | 'height'> | undefined): number {
  if (!item?.width || !item.height) return 1;
  return Math.min(1.91, Math.max(0.8, item.width / item.height));
}
